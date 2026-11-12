// Vercel Serverless Function: /api/alternative-matching
// Intelligent Alternative Hospital Matching Backend Service

import { runMatchingEngine } from "../src/services/matchingEngine.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Only POST is supported." });
  }

  try {
    const { 
      referral, 
      hospitals = [], 
      excludeHospitalIds = [], 
      weights 
    } = req.body || {};

    if (!referral) {
      return res.status(400).json({ error: "Missing mandatory referral object." });
    }

    // 1. Gather all excluded hospitals (previous rejections + explicitly excluded)
    const previouslyRejected = Array.isArray(referral.rejectedHospitalIds) 
      ? referral.rejectedHospitalIds 
      : [];
    const additionalExcluded = Array.isArray(excludeHospitalIds) 
      ? excludeHospitalIds 
      : [];
    const currentTarget = referral.targetHospitalId ? [referral.targetHospitalId] : [];

    const allExcludedIds = Array.from(new Set([
      ...previouslyRejected,
      ...additionalExcluded,
      ...currentTarget
    ]));

    // 2. Filter candidate hospitals to exclude previously declined facilities
    const candidateHospitals = hospitals.filter(h => !allExcludedIds.includes(h.id));

    // 3. Run Matching Engine with hard eligibility filters and weighted ranking
    const engineResult = runMatchingEngine(referral, candidateHospitals, { weights });

    // 4. Return structured response
    return res.status(200).json({
      success: true,
      evaluatedAt: new Date().toISOString(),
      referralId: referral.id,
      patientName: referral.patient?.name,
      excludedHospitalIds: allExcludedIds,
      totalCandidatesEvaluated: candidateHospitals.length,
      eligibleAlternativeCount: engineResult.eligibleHospitals.length,
      unsuitableCount: engineResult.unsuitableHospitals.length,
      alternatives: engineResult.eligibleHospitals,
      unsuitableAlternatives: engineResult.unsuitableHospitals,
      emergencyEscalationNeeded: engineResult.emergencyEscalationNeeded,
      previousRejections: referral.rejectionHistory || [],
    });
  } catch (error) {
    console.error("Alternative matching API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

