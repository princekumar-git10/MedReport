/**
 * Vercel Serverless API Function: /api/ai-referral-assist
 * OpenRouter AI-Assisted Capabilities for Relief Laser Health.
 *
 * SAFETY & ARCHITECTURE CONSTRAINTS:
 * - Never replaces deterministic matchingEngine.js; strictly assistive.
 * - Never diagnoses patients, prescribes treatment, invents capacity, or approves referrals.
 * - All extracted fields require explicit Doctor Review before saving.
 * - API key stays strictly on the server (process.env.OPENROUTER_API_KEY).
 */

export const config = {
  maxDuration: 60,
};

function safeJsonParse(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackExtract(text = "") {
  const lower = text.toLowerCase();
  const specialty = lower.includes("cardio")
    ? "Cardiology"
    : lower.includes("urol") || lower.includes("stone") || lower.includes("holep") || lower.includes("prostate")
    ? "Laser Urology"
    : lower.includes("vascular") || lower.includes("varicose")
    ? "Vascular Surgery"
    : lower.includes("gyne")
    ? "Laser Gynecology"
    : "Laser Proctology";

  const icuRequired = /\bicu\b|intensive care|ventilator|critical care/.test(lower);
  const emergencyRequired = /\bemergency\b|urgent|trauma|stat\b/.test(lower);

  const facilities = [];
  if (icuRequired) facilities.push("ICU Bed Support");
  if (emergencyRequired) facilities.push("24/7 Emergency Desk");
  if (/laser/.test(lower)) facilities.push("Surgical Laser Suite");
  if (/ot|operation theatre/.test(lower)) facilities.push("Operation Theatre");

  return {
    specialty,
    procedure: text.split(/\n|\./)[0]?.trim().slice(0, 90) || "",
    requiredFacilities: facilities.join(", "),
    equipmentRequirements: /laser|diode|holmium/.test(lower) ? "High-Power Surgical Laser Unit" : "",
    instructions: text.trim().slice(0, 280),
    icuRequired,
    emergencyRequired,
    priority: emergencyRequired ? "Emergency" : icuRequired ? "Urgent" : "Routine",
  };
}

function fallbackNlSearch(query = "") {
  const lower = query.toLowerCase();
  const filters = {
    cityOrArea: "",
    specialty: "",
    procedure: "",
    requireIcu: /\bicu\b|intensive care|critical/.test(lower),
    requireEmergency: /\bemergency\b|trauma|24\/7/.test(lower),
    minAvailableBeds: /\bbed\b|beds|admit|capacity/.test(lower) ? 1 : 0,
  };

  const cityMatch = lower.match(/\bin\s+([a-z\s]{3,28}?)(?:\s+that|\s+which|\s+with|\s+having|$)/i);
  if (cityMatch && cityMatch[1]) {
    filters.cityOrArea = cityMatch[1].trim();
  }
  if (lower.includes("delhi")) filters.cityOrArea = filters.cityOrArea || "Delhi";
  if (lower.includes("mumbai")) filters.cityOrArea = filters.cityOrArea || "Mumbai";
  if (lower.includes("bengaluru") || lower.includes("bangalore")) filters.cityOrArea = filters.cityOrArea || "Bengaluru";

  if (lower.includes("urolog")) filters.specialty = "Urology";
  else if (lower.includes("proctolog")) filters.specialty = "Proctology";
  else if (lower.includes("cardio")) filters.specialty = "Cardiology";
  else if (lower.includes("laser")) filters.specialty = "Laser";

  return filters;
}

async function callOpenRouter({ systemPrompt, userPrompt, temperature = 0.2 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "OPENROUTER_API_KEY_NOT_CONFIGURED" };
  }

  const primaryModel = process.env.OPENROUTER_MODEL || "mistralai/mistral-saba";
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || "google/gemma-3-27b-it";

  const tryModel = async (model) => {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://medisync.ai",
        "X-Title": "Relief Laser Health AI Assist",
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      throw new Error(`OpenRouter HTTP ${resp.status}: ${errTxt.slice(0, 120)}`);
    }
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content || "";
    return { ok: true, model, content };
  };

  try {
    return await tryModel(primaryModel);
  } catch (err1) {
    try {
      return await tryModel(fallbackModel);
    } catch (err2) {
      return { ok: false, reason: `${err1.message}; ${err2.message}` };
    }
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { mode, payload = {} } = req.body || {};

    if (!mode) {
      return res.status(400).json({ error: "Missing required 'mode' parameter." });
    }

    // ── FEATURE 1: Referral Document Extraction (editable before doctor save) ──
    if (mode === "extract_document") {
      const docText = String(payload.documentText || "").trim();
      if (!docText) {
        return res.status(400).json({ error: "Provide referral document text or notes to extract." });
      }

      const aiRes = await callOpenRouter({
        systemPrompt:
          "You extract structured hospital referral intake fields from clinical referral notes. Never diagnose or invent unstated medical facts. Return ONLY valid JSON with keys: specialty (string), procedure (string), requiredFacilities (string), equipmentRequirements (string), instructions (string), icuRequired (boolean), emergencyRequired (boolean), priority ('Emergency'|'Urgent'|'Routine').",
        userPrompt: `Extract referral form fields from this uploaded/pasted note (${payload.fileName || "Referral Note"}):\n\n${docText.slice(0, 4000)}`,
      });

      const parsed = aiRes.ok ? safeJsonParse(aiRes.content) : null;
      return res.status(200).json({
        success: true,
        mode,
        aiUsed: Boolean(aiRes.ok && parsed),
        model: aiRes.model || "deterministic_parser_fallback",
        notice: aiRes.ok && parsed
          ? "AI-extracted draft. Doctor review and approval required before saving."
          : `Fallback parser used (${aiRes.reason || "unparseable response"}). Doctor review required.`,
        extracted: parsed || fallbackExtract(docText),
      });
    }

    // ── FEATURE 2: Natural Language Search -> Structured Filters ──
    if (mode === "natural_language_search") {
      const query = String(payload.query || "").trim();
      if (!query) {
        return res.status(400).json({ error: "Provide a natural language hospital filter query." });
      }

      const aiRes = await callOpenRouter({
        systemPrompt:
          "Convert a doctor's natural language hospital search request into structured filter JSON for deterministic hospital filtering. Return ONLY valid JSON with keys: cityOrArea (string), specialty (string), procedure (string), requireIcu (boolean), requireEmergency (boolean), minAvailableBeds (number).",
        userPrompt: `Query: "${query}"`,
      });

      const parsed = aiRes.ok ? safeJsonParse(aiRes.content) : null;
      return res.status(200).json({
        success: true,
        mode,
        aiUsed: Boolean(aiRes.ok && parsed),
        model: aiRes.model || "deterministic_filter_fallback",
        filters: parsed || fallbackNlSearch(query),
      });
    }

    // ── FEATURE 3: Grounded Matching Explanation ──
    if (mode === "explain_match") {
      const { hospitalSummary = {}, eligibility = {}, scoreDetails = {} } = payload;
      const aiRes = await callOpenRouter({
        systemPrompt:
          "Explain clearly in 2-4 factual sentences why this hospital passed or failed deterministic referral matching using ONLY the provided database fields. Do NOT invent capacity numbers, equipment, or medical diagnoses.",
        userPrompt: JSON.stringify({ hospitalSummary, eligibility, scoreDetails }),
      });

      const deterministicFallback = eligibility.eligible
        ? `${hospitalSummary.name || "Hospital"} is eligible (Match Score ${scoreDetails.score ?? "N/A"}/100) because: ${(eligibility.passedCriteria || []).join("; ")}. Open capacity reported: ${hospitalSummary.availableBeds ?? 0} general beds, ${hospitalSummary.availableIcuBeds ?? 0} ICU beds.`
        : `${hospitalSummary.name || "Hospital"} failed mandatory matching filters: ${(eligibility.missingCriteria || []).join("; ")}.`;

      return res.status(200).json({
        success: true,
        mode,
        aiUsed: Boolean(aiRes.ok && aiRes.content),
        model: aiRes.model || "deterministic_db_summary",
        explanation: (aiRes.ok && aiRes.content?.trim()) || deterministicFallback,
      });
    }

    // ── FEATURE 4: Multilingual Patient Assistance (English / Hindi) ──
    if (mode === "patient_multilingual") {
      const lang = payload.language === "hi" ? "Hindi (हिन्दी)" : "English";
      const referralSummary = payload.referralSummary || {};

      const aiRes = await callOpenRouter({
        systemPrompt: `You are a compassionate Relief Laser Health patient coordinator. Explain the patient's CURRENT referral status and hospital arrival instructions clearly in ${lang}. Do NOT give medical diagnoses or prescriptions; rely strictly on the status and hospital details provided.`,
        userPrompt: JSON.stringify(referralSummary),
        temperature: 0.3,
      });

      const fallbackText =
        payload.language === "hi"
          ? `आपकी रेफरल स्थिति अभी "${referralSummary.status || "Pending"}" है। ${
              referralSummary.hospitalName
                ? `अस्पताल: ${referralSummary.hospitalName} (${referralSummary.hospitalAddress || ""})। कृपया अस्पताल के प्रवेश डेस्क पर अपना रेफरल आईडी ${referralSummary.referralId || ""} और पहचान पत्र साथ लेकर पहुँचें।`
                : "हमारा सिस्टम आपके लिए उपयुक्त अस्पताल के साथ समन्वय कर रहा है।"
            }`
          : `Your referral (${referralSummary.referralId || ""}) is currently "${referralSummary.status || "Pending"}". ${
              referralSummary.hospitalName
                ? `Receiving hospital: ${referralSummary.hospitalName} (${referralSummary.hospitalAddress || ""}). Bring your Referral ID and photo ID to the Admission Desk.`
                : "The care network is actively coordinating hospital confirmation."
            }`;

      return res.status(200).json({
        success: true,
        mode,
        language: payload.language === "hi" ? "hi" : "en",
        aiUsed: Boolean(aiRes.ok && aiRes.content),
        model: aiRes.model || "bilingual_template_fallback",
        translatedGuide: (aiRes.ok && aiRes.content?.trim()) || fallbackText,
      });
    }

    return res.status(400).json({ error: `Unsupported AI assist mode '${mode}'.` });
  } catch (err) {
    console.error("ai-referral-assist error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

