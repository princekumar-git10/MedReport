/**
 * Vercel Serverless API Function: /api/chat
 * Integrates OpenRouter for MediSync AI Conversational & Clinical Assistant
 * Primary model: mistralai/mistral-saba
 * Fallback models: google/gemma-3-27b-it, google/gemini-2.5-flash, meta-llama/llama-3.3-70b-instruct
 */

const LANGUAGE_LABELS = {
  en: "English",
  hi: "Hindi (हिन्दी)",
  bn: "Bengali (বাংলা)",
  ta: "Tamil (தமிழ்)",
  te: "Telugu (తెలుగు)",
  mr: "Marathi (मराठी)",
  gu: "Gujarati (ગુજરાતી)",
  kn: "Kannada (ಕನ್ನಡ)",
  ml: "Malayalam (മലയാളം)",
  pa: "Punjabi (ਪੰਜਾਬੀ)"
};

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // CORS & Method Check
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "OPENROUTER_API_KEY is not configured on the server. Please add it to your environment variables."
    });
  }

  try {
    const { messages = [], reportContext = [], language = "en", stream = false } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid payload. 'messages' must be a non-empty array." });
    }

    const primaryModel = process.env.OPENROUTER_MODEL || "mistralai/mistral-saba";
    const configuredFallback = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemma-3-27b-it";
    
    // Resilient fallback candidate chain in case of provider rate-limits or temporary outages
    const modelCandidates = [
      primaryModel,
      configuredFallback,
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct"
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    const targetLang = LANGUAGE_LABELS[language] || "English";

    // Build comprehensive, non-restrictive conversational & clinical system prompt
    let systemPrompt = `You are MediSync AI, a highly intelligent, empathetic, versatile, and culturally aware conversational AI assistant. You possess broad general knowledge across science, technology, programming, history, education, and daily life, alongside deep specialized capability in healthcare, laboratory diagnostics, and blood report interpretation.

CORE CONVERSATIONAL BEHAVIORS:
1. Answer Directly & Comprehensively: Answer ANY question the user asks—whether about general topics (science, mathematics, history, programming, geography, general knowledge), casual greetings, everyday advice, or health and medicine. NEVER refuse to answer a question simply because it is not medical or does not match a predefined template.
2. Context & Continuity: Maintain coherent conversation context across turns. Understand pronouns (e.g. "it", "they", "its"), references to prior messages, and follow-up prompts such as "Explain more", "Why?", "What about this?", "Give an example", or "How does that compare?".
3. Adaptive Depth & Tone: Provide concise, clear answers for quick or simple queries, and thorough, step-by-step structured explanations for complex concepts. Format answers cleanly using Markdown (readable paragraphs, headings, bullet points, and code blocks where applicable).
4. Language Fluency: You must converse fluently in ${targetLang}. If the user addresses you in a different language or dialect, adapt naturally while keeping technical terms and medical units (e.g. mg/dL, g/dL, %) clear and recognizable.
5. Clarification: If a user query is genuinely ambiguous, provide a helpful general answer first and politely ask clarifying questions to narrow down what they need.

SPECIALIZED MEDICAL & HEALTHCARE GUIDANCE:
1. Educational & Supportive: Explain medical terminology, laboratory parameters, and physiological mechanisms in plain, reassuring language suitable for patients and families.
2. Information, Not Diagnosis: Clearly distinguish educational health information from a definitive clinical diagnosis. Never claim to diagnose a disease with certainty or prescribe prescription medications. Recommend consulting a licensed healthcare professional for individual medical decisions.
3. Accurate & Grounded: Never invent laboratory values, normal ranges, or clinical facts. When discussing medical markers, reference established clinical standards.
4. Red Flags & Emergencies: If a user mentions emergency warning signs (such as acute severe chest pain, sudden numbness/paralysis, severe shortness of breath, heavy uncontrolled bleeding, or loss of consciousness), immediately advise them to seek emergency medical care or call local emergency services.`;

    // Inject Report Context if available
    if (Array.isArray(reportContext) && reportContext.length > 0) {
      systemPrompt += `\n\n═════ ACTIVE PATIENT LAB REPORT DATA (${reportContext.length} tests loaded) ═════\n`;
      reportContext.forEach((t) => {
        const refRange = (t.low !== undefined && t.high !== undefined) ? `[Ref: ${t.low} - ${t.high} ${t.unit || ""}]` : "";
        systemPrompt += `• ${t.name}: ${t.value} ${t.unit || ""} — Status: ${t.status || "Normal"} ${refRange}\n`;
      });
      systemPrompt += `═════════════════════════════════════════════════════════════════\n`;
      systemPrompt += `When the user asks about their specific health, report, or test markers, directly reference their actual numbers, reference ranges, and clinical status from the table above. For unrelated non-medical questions, answer normally without forcing lab report data into the reply.`;
    }

    // Clean and sanitize messages history: filter out empty messages and limit to last 20 turns
    const cleanHistory = messages
      .filter((m) => {
        const text = m.text || m.content;
        return typeof text === "string" && text.trim().length > 0 && !m.isWelcome;
      })
      .slice(-20)
      .map((m) => ({
        role: m.sender === "user" || m.role === "user" ? "user" : "assistant",
        content: (m.text || m.content).trim()
      }));

    if (cleanHistory.length === 0) {
      return res.status(400).json({ error: "No valid user messages found in payload." });
    }

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...cleanHistory
    ];

    // Helper to call OpenRouter API
    async function callOpenRouter(modelName, isStreaming) {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://med-report-two.vercel.app",
          "X-Title": "MediSync AI"
        },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          temperature: 0.6,
          max_tokens: 1500,
          stream: isStreaming
        })
      });

      return resp;
    }

    // Attempt model candidates sequentially until a successful response is received
    let openRouterRes = null;
    let successfulModel = primaryModel;
    let lastErrorText = "";

    for (const modelCandidate of modelCandidates) {
      try {
        const resCandidate = await callOpenRouter(modelCandidate, stream);
        if (resCandidate.ok) {
          openRouterRes = resCandidate;
          successfulModel = modelCandidate;
          break;
        } else {
          lastErrorText = await resCandidate.text();
          console.warn(`Model candidate '${modelCandidate}' returned status ${resCandidate.status}: ${lastErrorText.slice(0, 150)}`);
        }
      } catch (callErr) {
        lastErrorText = callErr.message;
        console.warn(`Model candidate '${modelCandidate}' connection failed: ${callErr.message}`);
      }
    }

    if (!openRouterRes || !openRouterRes.ok) {
      console.error("All OpenRouter model candidates failed. Last error:", lastErrorText);
      return res.status(502).json({
        error: "OpenRouter service returned an error. Please try again in a few moments.",
        details: lastErrorText
      });
    }

    // Streaming Response Handler
    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      });

      try {
        const reader = openRouterRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      } catch (streamErr) {
        console.error("Streaming error in /api/chat:", streamErr);
      } finally {
        res.end();
      }
      return;
    }

    // Standard JSON Response Handler
    const data = await openRouterRes.json();
    const replyText = data.choices?.[0]?.message?.content || "";
    const usedModel = data.model || successfulModel;

    return res.status(200).json({
      reply: replyText,
      model: usedModel,
      usage: data.usage || null
    });

  } catch (err) {
    console.error("Fatal /api/chat error:", err);
    return res.status(500).json({
      error: "Internal server error while processing your query.",
      message: err.message
    });
  }
}
