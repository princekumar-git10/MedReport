/**
 * Client-side caller for /api/ai-referral-assist (OpenRouter server-side integration).
 * Strictly assistive: never replaces deterministic matchingEngine.js or auto-submits referrals.
 * Applies strict client-side PII scrubbing before any text leaves the browser.
 */

export function scrubSensitivePatientData(text = "", patientName = "") {
  let out = String(text || "");
  if (patientName && patientName.trim().length > 2) {
    const escaped = patientName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "[PATIENT_REDACTED]");
  }
  out = out
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, "[EMAIL_REDACTED]")
    .replace(/(\+?\d[\d\s-]{7,14}\d)/g, "[CONTACT_REDACTED]")
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[ID_REDACTED]")
    .replace(/\b(PID|UHID|MRN)[-\s:]?[A-Z0-9-]+\b/gi, "[PATIENT_ID_REDACTED]");
  return out;
}

async function postAiAssist(mode, payload) {
  const resp = await fetch("/api/ai-referral-assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, payload }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `AI Assist request failed (HTTP ${resp.status})`);
  }
  return resp.json();
}

export async function extractReferralDocumentAI(documentText, fileName = "Referral Note", { patientName = "", consentConfirmed = false } = {}) {
  if (!consentConfirmed) {
    throw new Error("Privacy Guard: Confirm consent & de-identification safeguard before running external AI extraction.");
  }
  const sanitizedText = scrubSensitivePatientData(documentText, patientName);
  return postAiAssist("extract_document", { documentText: sanitizedText, fileName });
}

export async function parseNaturalLanguageSearchAI(query) {
  return postAiAssist("natural_language_search", { query: scrubSensitivePatientData(query) });
}

export async function explainHospitalMatchAI(hospitalMatch, referralRequirements = {}) {
  const h = hospitalMatch.hospital || {};
  // Whitelist strictly non-identifying structural requirements & hospital telemetry
  const sanitizedRequirements = {
    specialty: referralRequirements.specialty || "",
    procedure: referralRequirements.procedure || "",
    icuRequired: Boolean(referralRequirements.icuRequired),
    emergencySupportRequired: Boolean(referralRequirements.emergencySupportRequired),
    equipmentRequirements: referralRequirements.equipmentRequirements || "",
  };
  return postAiAssist("explain_match", {
    hospitalSummary: {
      id: h.id,
      name: h.name,
      city: h.city,
      state: h.state,
      departments: h.departments,
      availableTreatments: h.availableTreatments,
      medicalEquipment: h.medicalEquipment,
      availableBeds: h.availableBeds,
      availableIcuBeds: h.icuFacilities?.availableBeds ?? 0,
      availableEmergencyBeds: h.availableEmergencyBeds,
      lastUpdatedAt: h.lastUpdatedAt,
    },
    referralRequirements: sanitizedRequirements,
    eligibility: hospitalMatch.eligibility,
    scoreDetails: {
      score: hospitalMatch.score,
      distanceKm: hospitalMatch.distanceKm,
      estimatedTravelTime: hospitalMatch.estimatedTravelTime,
      breakdown: hospitalMatch.scoreBreakdown,
    },
  });
}

export async function translatePatientGuideAI(referral, hospital, language = "en") {
  // Send strictly non-PHI coordination status & receiving hospital logistics
  return postAiAssist("patient_multilingual", {
    language,
    referralSummary: {
      referralId: referral?.id,
      status: referral?.status,
      priority: referral?.priority,
      specialty: referral?.clinicalRequirements?.specialty,
      procedure: referral?.clinicalRequirements?.procedure,
      hospitalName: hospital?.name || referral?.targetHospitalName || "",
      hospitalAddress: hospital
        ? `${hospital.address}, ${hospital.city}, ${hospital.state} ${hospital.pincode}`
        : "",
      hospitalPhone: hospital?.contactPhone || "",
    },
  });
}

