/**
 * Vercel Serverless API Function: /api/chat
 * Integrates OpenRouter for MediSync AI Medical Assistant
 * Primary model: mistralai/mistral-saba
 * Fallback model: google/gemma-3-27b-it
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
    const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemma-3-27b-it";

    const targetLang = LANGUAGE_LABELS[language] || "English";

    // Build MediSync Clinical System Prompt
    let systemPrompt = `You are MediSync AI, a world-class, empathetic, and culturally aware clinical decision support and health communication assistant.
Your mission is to help patients understand their laboratory blood and diagnostic reports, clearly explaining what abnormal and normal test markers mean in easy-to-understand terms.

STRICT MEDICAL & ETHICAL GUARDRAILS:
1. Educational Information Only: You do not provide definitive diagnoses, write medical prescriptions, or claim to cure diseases. Always advise the patient to discuss their results with their physician or qualified healthcare provider for personalized treatment.
2. Empathy & Clarity: Explain medical terms (e.g., Creatinine, HbA1c, LDL, Hemoglobin, SGPT) in plain, reassuring language suitable for patients and their families.
3. Language Requirement: You MUST reply entirely and fluently in ${targetLang}. Keep clinical marker names and measurement units (mg/dL, g/dL, %, etc.) recognizable.
4. Actionable Next Steps: When relevant, suggest thoughtful questions the patient can ask their doctor during their next clinical consultation.`;

    // Inject Report Context if available
    if (Array.isArray(reportContext) && reportContext.length > 0) {
      systemPrompt += `\n\n═════ ACTIVE PATIENT LAB REPORT DATA (${reportContext.length} tests analyzed) ═════\n`;
      reportContext.forEach((t) => {
        const refRange = (t.low !== undefined && t.high !== undefined) ? `[Ref: ${t.low} - ${t.high} ${t.unit || ""}]` : "";
        systemPrompt += `• ${t.name}: ${t.value} ${t.unit || ""} — Status: ${t.status || "Normal"} ${refRange}\n`;
      });
      systemPrompt += `═════════════════════════════════════════════════════════════════\n`;
      systemPrompt += `Directly reference the patient's specific numbers, reference ranges, and abnormal markers in your response when answering their query.`;
    }

    // Format conversation history for OpenRouter
    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-10).map((m) => ({
        role: m.sender === "user" || m.role === "user" ? "user" : "assistant",
        content: m.text || m.content || ""
      }))
    ];

    // Helper to call OpenRouter
    async function callOpenRouter(modelName, isStreaming) {
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://medisync-ai.vercel.app",
          "X-Title": "MediSync AI"
        },
        body: JSON.stringify({
          model: modelName,
          messages: formattedMessages,
          temperature: 0.35,
          max_tokens: 1200,
          stream: isStreaming
        })
      });

      return resp;
    }

    // Attempt 1: Primary Model (mistralai/mistral-saba)
    let openRouterRes = await callOpenRouter(primaryModel, stream);

    // If Primary fails or returns non-200, attempt Fallback Model (google/gemma-3-27b-it)
    if (!openRouterRes.ok) {
      console.warn(`Primary model ${primaryModel} failed with status ${openRouterRes.status}. Retrying with fallback model ${fallbackModel}...`);
      openRouterRes = await callOpenRouter(fallbackModel, stream);
    }

    if (!openRouterRes.ok) {
      const errText = await openRouterRes.text();
      console.error("OpenRouter API error:", errText);
      return res.status(openRouterRes.status || 502).json({
        error: "OpenRouter service returned an error. Please try again in a few moments.",
        details: errText
      });
    }

    // Streaming Response Handler
    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive"
      });

      const reader = openRouterRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
      return;
    }

    // Standard JSON Response Handler
    const data = await openRouterRes.json();
    const replyText = data.choices?.[0]?.message?.content || "";
    const usedModel = data.model || primaryModel;

    return res.status(200).json({
      reply: replyText,
      model: usedModel,
      usage: data.usage || null
    });

  } catch (err) {
    console.error("Fatal /api/chat error:", err);
    return res.status(500).json({
      error: "Internal server error while processing your clinical query.",
      message: err.message
    });
  }
}

