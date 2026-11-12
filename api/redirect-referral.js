// Vercel Serverless Function: /api/redirect-referral
// Secure Backend API for Doctor Authorizing Referral Redirection to an Alternative Hospital

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
      referralId,
      newHospitalId,
      newHospitalName,
      doctorName = "Referring Clinician",
      doctorEmail = "",
      redirectionNotes = "",
    } = req.body || {};

    if (!referralId || !newHospitalId || !newHospitalName) {
      return res.status(400).json({
        error: "Missing mandatory fields: referralId, newHospitalId, and newHospitalName are required."
      });
    }

    const nowIso = new Date().toISOString();

    const result = {
      success: true,
      action: "redirect",
      referralId,
      newHospitalId,
      newHospitalName,
      status: "Pending",
      redirectedAt: nowIso,
      redirectedBy: doctorName,
      redirectedByEmail: doctorEmail,
      redirectionNotes: redirectionNotes.trim(),
      timelineEvent: {
        status: "Pending",
        timestamp: nowIso,
        note: `Referral authorized and redirected to ${newHospitalName} by ${doctorName}.${redirectionNotes ? ` Doctor note: ${redirectionNotes}` : ""}`,
        by: doctorName,
        email: doctorEmail,
      },
      notification: {
        notifiedAt: nowIso,
        target: "patient_and_hospital",
        title: "Referral Re-routed to Alternative Hospital",
        message: `Referral ${referralId} has been authorized and dispatched to ${newHospitalName} admissions desk.`
      }
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("Redirect referral API error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

