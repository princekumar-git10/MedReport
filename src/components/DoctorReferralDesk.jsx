import { useState, useEffect } from "react";
import { 
  getReferrals, 
  createReferral, 
  matchHospitalsForReferral, 
  dispatchReferralToHospital,
  getAlternativeHospitalsForReferral,
  redirectReferralToHospital,
  subscribeToReferrals,
  sweepExpiredCapacityHolds,
  escalateReferralToHumanDesk
} from "../services/referralService.js";
import { subscribeToHospitals } from "../services/hospitalService.js";
import {
  extractReferralDocumentAI,
  parseNaturalLanguageSearchAI,
  explainHospitalMatchAI,
} from "../services/aiReferralService.js";
import { useLanguage } from "../context/LanguageContext";

export default function DoctorReferralDesk({ userEmail, results = [], onNavigateToPass }) {
  const { t } = useLanguage();

  // Active view inside Doctor module: "dashboard" | "create" | "matched" | "alternatives"
  const [activeView, setActiveView] = useState("dashboard");

  // Referrals state
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Referral for matching results view
  const [activeReferral, setActiveReferral] = useState(null);
  const [matchedHospitals, setMatchedHospitals] = useState([]);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState("");

  // Alternative Matching State
  const [alternativeData, setAlternativeData] = useState(null);
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const [alternativeError, setAlternativeError] = useState("");
  const [selectedAlternativeForRedirect, setSelectedAlternativeForRedirect] = useState(null);
  const [redirectNotes, setRedirectNotes] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectSuccess, setRedirectSuccess] = useState("");
  const [humanEscalationLogged, setHumanEscalationLogged] = useState(false);
  const [showAuditLedger, setShowAuditLedger] = useState(false);

  // Doctor session profile
  const [doctorProfile, setDoctorProfile] = useState({
    name: "Dr. Referring Clinician",
    email: userEmail || "doctor@clinic.med",
    clinic: "Primary Clinic Desk",
  });

  // Form State
  const initialForm = {
    // Section 1: Patient Information
    patientName: "",
    patientId: `PID-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    patientAge: "",
    patientContact: "",
    gender: "Clinically Non-specified",
    patientLocation: "New Delhi",
    emergencyContact: "",

    // Section 2: Clinical Requirements
    specialty: "Laser Proctology",
    procedure: "Laser Hemorrhoidoplasty (LHP)",
    diagnosis: "",
    hospitalFacilities: "Daycare Surgical Suite, Post-op Recovery",
    icuRequired: false,
    emergencySupportRequired: false,
    requiredSpecialist: "Senior Laser Surgeon",
    equipmentRequirements: "1470nm Dual Diode Laser",
    additionalClinicalNotes: "",

    // Section 3: Referral Priority
    priority: "Urgent", // Emergency, Urgent, Routine

    // Section 4: Documents
    documents: [],

    // Section 5: Referral Preferences
    preferredLocation: "New Delhi",
    maxDistance: "50 km",
    insuranceRequirements: "Cashless TPA / Private Insurance",
  };

  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OpenRouter AI-Assisted State (strictly optional, doctor-reviewed, non-replacing)
  const [rawDocText, setRawDocText] = useState("");
  const [aiExtractLoading, setAiExtractLoading] = useState(false);
  const [aiExtractDraft, setAiExtractDraft] = useState(null);
  const [aiExtractNotice, setAiExtractNotice] = useState("");
  const [aiConsentChecked, setAiConsentChecked] = useState(false);
  const [aiDocFileName, setAiDocFileName] = useState("");

  const [nlSearchQuery, setNlSearchQuery] = useState("");
  const [nlSearchLoading, setNlSearchLoading] = useState(false);
  const [nlActiveFilters, setNlActiveFilters] = useState(null);

  const [aiExplanations, setAiExplanations] = useState({});

  const handleAiDocFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiDocFileName(file.name);
    if (file.type === "text/plain" || /\.(txt|md|csv|json)$/i.test(file.name)) {
      const content = await file.text();
      setRawDocText(content.slice(0, 4000));
      setAiExtractNotice(`Loaded "${file.name}". Confirm privacy consent below to extract requirements.`);
    } else {
      // Attach to referral documents list cleanly & prompt doctor to paste text if binary PDF/image
      setFormData((prev) => ({
        ...prev,
        documents: [
          ...prev.documents,
          {
            id: `doc-ai-${Date.now()}`,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            category: "Uploaded Referral Document",
          },
        ],
      }));
      setAiExtractNotice(`Attached "${file.name}" to referral documents. Paste key text below for AI field extraction.`);
    }
    e.target.value = "";
  };

  const handleRunAiExtract = async () => {
    if (!rawDocText.trim()) return;
    setAiExtractLoading(true);
    setAiExtractNotice("");
    try {
      const res = await extractReferralDocumentAI(
        rawDocText,
        aiDocFileName || "Pasted / Uploaded Referral Note",
        { patientName: formData.patientName, consentConfirmed: aiConsentChecked }
      );
      setAiExtractDraft(res.extracted || null);
      setAiExtractNotice(res.notice || "Review all extracted fields carefully before applying.");
    } catch (err) {
      setAiExtractNotice(`Extraction blocked/error: ${err.message}`);
    } finally {
      setAiExtractLoading(false);
    }
  };

  const handleApplyExtractedDraft = () => {
    if (!aiExtractDraft) return;
    setFormData((prev) => ({
      ...prev,
      specialty: aiExtractDraft.specialty || prev.specialty,
      procedure: aiExtractDraft.procedure || prev.procedure,
      hospitalFacilities: aiExtractDraft.requiredFacilities || prev.hospitalFacilities,
      equipmentRequirements: aiExtractDraft.equipmentRequirements || prev.equipmentRequirements,
      additionalClinicalNotes: aiExtractDraft.instructions || prev.additionalClinicalNotes,
      icuRequired: Boolean(aiExtractDraft.icuRequired),
      emergencySupportRequired: Boolean(aiExtractDraft.emergencyRequired),
      priority: ["Emergency", "Urgent", "Routine"].includes(aiExtractDraft.priority)
        ? aiExtractDraft.priority
        : prev.priority,
    }));
    setAiExtractDraft(null);
    setAiExtractNotice("✓ Doctor-reviewed fields applied to referral form.");
  };

  const handleRunNlFilter = async (e) => {
    if (e) e.preventDefault();
    if (!nlSearchQuery.trim()) {
      setNlActiveFilters(null);
      return;
    }
    setNlSearchLoading(true);
    try {
      const res = await parseNaturalLanguageSearchAI(nlSearchQuery);
      setNlActiveFilters(res.filters || null);
    } catch (err) {
      setFormError(`NL Search conversion failed: ${err.message}`);
    } finally {
      setNlSearchLoading(false);
    }
  };

  const handleExplainHospitalMatch = async (matchItem) => {
    const hId = matchItem?.hospital?.id;
    if (!hId) return;
    setAiExplanations((prev) => ({ ...prev, [hId]: { loading: true, text: "", model: "" } }));
    try {
      const res = await explainHospitalMatchAI(
        {
          hospital: matchItem.hospital,
          score: matchItem.matchScore,
          distanceKm: matchItem.distanceKm,
          estimatedTravelTime: matchItem.estimatedTravelTime,
          eligibility: {
            eligible: (matchItem.missingRequirements || []).length === 0,
            passedCriteria: matchItem.matchReasons || [],
            missingCriteria: matchItem.missingRequirements || [],
          },
          scoreBreakdown: {},
        },
        activeReferral?.clinicalRequirements || {}
      );
      setAiExplanations((prev) => ({
        ...prev,
        [hId]: { loading: false, text: res.explanation, model: res.model },
      }));
    } catch (err) {
      setAiExplanations((prev) => ({
        ...prev,
        [hId]: { loading: false, text: `Unable to fetch explanation: ${err.message}`, model: "error" },
      }));
    }
  };

  // Load referrals
  const loadReferrals = async () => {
    setLoading(true);
    try {
      const data = await getReferrals(userEmail);
      setReferrals(data);
    } catch (e) {
      console.error("Error loading referrals:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    sweepExpiredCapacityHolds().catch(() => {});
    loadReferrals();

    const unsubReferrals = subscribeToReferrals((updatedList) => {
      if (Array.isArray(updatedList)) {
        const scopedList = userEmail
          ? updatedList.filter(
              (r) => r.doctorId?.toLowerCase() === userEmail.toLowerCase() || r.isDemoData === true
            )
          : updatedList;
        setReferrals(scopedList);
        // Sync activeReferral live when another role accepts/rejects/updates
        setActiveReferral((prev) => {
          if (!prev) return prev;
          const fresh = scopedList.find((r) => r.id === prev.id);
          return fresh || prev;
        });
      }
    });

    const unsubHospitals = subscribeToHospitals(() => {
      // Refresh active matching cards if viewing matches/alternatives when capacity changes
      if (activeReferral) {
        if (activeView === "matched") {
          matchHospitalsForReferral(activeReferral).then(setMatchedHospitals).catch(() => {});
        } else if (activeView === "alternatives") {
          getAlternativeHospitalsForReferral(activeReferral.id).then(setAlternativeData).catch(() => {});
        }
      }
    });

    return () => {
      unsubReferrals();
      unsubHospitals();
    };
  }, [userEmail, activeView, activeReferral?.id]);

  // Compute Dashboard Metrics
  const totalCount = referrals.length;
  const pendingCount = referrals.filter((r) => r.status === "Pending" || r.status === "Created").length;
  const acceptedCount = referrals.filter((r) => r.status === "Accepted").length;
  const rejectedCount = referrals.filter((r) => r.status === "Rejected").length;
  const completedCount = referrals.filter((r) => r.status === "Completed").length;

  // Handle Document Upload with Validation
  const handleFileUpload = (e, category) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    const validDocs = [];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        alert(`File "${file.name}" has an unsupported format. Allowed: PDF, PNG, JPG, WEBP.`);
        continue;
      }
      if (file.size > maxSizeBytes) {
        alert(`File "${file.name}" exceeds the 10MB limit.`);
        continue;
      }

      validDocs.push({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        category,
      });
    }

    if (validDocs.length > 0) {
      setFormData((prev) => ({
        ...prev,
        documents: [...prev.documents, ...validDocs],
      }));
    }
    e.target.value = "";
  };

  // Attach Session Lab Report if present
  const handleAttachSessionReport = () => {
    if (!results || results.length === 0) return;

    const sessionDoc = {
      id: `doc-session-${Date.now()}`,
      name: `MediSync_Analyzed_Lab_Report_${results.length}_tests.pdf`,
      type: "application/pdf",
      size: 184500,
      uploadedAt: new Date().toISOString(),
      category: "MediSync Verified Lab Extraction",
      clinicalSummary: `${results.length} tests extracted (${results.filter(r => r.needsAttention).length} abnormal findings)`,
    };

    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, sessionDoc],
    }));
  };

  const handleRemoveDoc = (docId) => {
    setFormData((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== docId),
    }));
  };

  // Form Submit: Find Suitable Hospitals
  const handleSubmitReferral = async (e) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      // Create and save referral
      const created = await createReferral(formData, {
        name: doctorProfile.name,
        email: doctorProfile.email,
        clinic: doctorProfile.clinic,
      });

      // Match suitable hospitals
      setMatchingLoading(true);
      const matches = await matchHospitalsForReferral(created);
      setActiveReferral(created);
      setMatchedHospitals(matches);
      setMatchingLoading(false);

      // Switch to matching view
      setActiveView("matched");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setFormError(err.message || "Failed to create referral.");
    }
    setIsSubmitting(false);
  };

  // Dispatch Referral to Target Hospital
  const handleDispatch = async (hosp) => {
    if (!activeReferral) return;
    try {
      const updated = await dispatchReferralToHospital(
        activeReferral.id,
        hosp.id,
        hosp.name,
        doctorProfile.name
      );
      setActiveReferral(updated);
      setDispatchSuccess(`Referral pass successfully dispatched to ${hosp.name}! Token issued.`);
      loadReferrals();
    } catch (err) {
      alert(err.message || "Dispatch failed");
    }
  };

  // Launch Alternative Matching Engine for a Declined/Rejected Referral
  const handleFindAlternatives = async (ref) => {
    setActiveReferral(ref);
    setAlternativeLoading(true);
    setAlternativeError("");
    setRedirectSuccess("");
    setHumanEscalationLogged(false);
    setSelectedAlternativeForRedirect(null);
    setActiveView("alternatives");
    window.scrollTo({ top: 0, behavior: "smooth" });

    try {
      const data = await getAlternativeHospitalsForReferral(ref.id);
      setAlternativeData(data);
    } catch (err) {
      setAlternativeError(err.message || "Failed to find alternative hospitals");
    } finally {
      setAlternativeLoading(false);
    }
  };

  // Doctor Authorizes Redirection to Selected Alternative Hospital
  const handleAuthorizeRedirect = async () => {
    if (!activeReferral || !selectedAlternativeForRedirect) return;
    setIsRedirecting(true);
    try {
      const targetHosp = selectedAlternativeForRedirect.hospital;
      const updated = await redirectReferralToHospital({
        referralId: activeReferral.id,
        newHospitalId: targetHosp.id,
        newHospitalName: targetHosp.name,
        doctorName: doctorProfile.name,
        doctorEmail: doctorProfile.email,
        redirectionNotes: redirectNotes,
      });

      setActiveReferral(updated);
      setRedirectSuccess(
        `Referral successfully authorized and redirected to ${targetHosp.name}! Status reset to Pending for admissions triage.`
      );
      setSelectedAlternativeForRedirect(null);
      setRedirectNotes("");
      await loadReferrals();

      // Refresh alternative data view
      const refreshed = await getAlternativeHospitalsForReferral(updated.id);
      setAlternativeData(refreshed);
    } catch (err) {
      alert(err.message || "Failed to redirect referral");
    } finally {
      setIsRedirecting(false);
    }
  };

  // Human Escalation Desk Callback Request (via canonical referralService)
  const handleRequestHumanEscalation = async () => {
    if (!activeReferral) return;
    try {
      const { referral: updated } = await escalateReferralToHumanDesk(activeReferral.id, doctorProfile.name);
      setActiveReferral(updated);
      setHumanEscalationLogged(true);
      await loadReferrals();
    } catch (e) {
      console.warn("Escalation log failed:", e.message);
    }
  };

  return (
    <div className="doc-referral-desk-wrap">
      {/* ── Top Header & Tab Navigation ── */}
      <div className="doc-desk-header">
        <div className="doc-desk-title-group">
          <div className="hosp-pill-badge">
            <span className="live-pulse-dot" />
            <span>Physician Desk · Relief Laser Health</span>
          </div>
          <h2 className="doc-main-title">Doctor Referral Portal</h2>
          <p className="doc-main-sub">
            Generate clinical referrals, specify exact surgical and laser requirements, and match patients with accredited hospital facilities.
          </p>
        </div>

        <div className="doc-tab-switch">
          <button
            type="button"
            className={`doc-tab-btn ${activeView === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            <span>Referrals Dashboard</span>
            <span className="tab-counter">{totalCount}</span>
          </button>

          <button
            type="button"
            className={`doc-tab-btn ${activeView === "create" ? "active" : ""}`}
            onClick={() => {
              setActiveView("create");
              setDispatchSuccess("");
            }}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Create New Referral</span>
          </button>

          {activeView === "alternatives" && activeReferral && (
            <button
              type="button"
              className="doc-tab-btn active alt-tab-active"
              onClick={() => setActiveView("alternatives")}
            >
              <span>⚡ Alternative Matching</span>
            </button>
          )}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          VIEW 1: DOCTOR DASHBOARD
      ═════════════════════════════════════════════════════════════════════ */}
      {activeView === "dashboard" && (
        <section className="doc-dashboard-view">
          {/* Doctor Profile Banner */}
          <div className="doc-profile-bar">
            <div className="doc-info-left">
              <div className="doc-avatar">👨‍⚕️</div>
              <div>
                <div className="doc-name-badge">
                  <strong>{doctorProfile.name}</strong>
                  <span className="doc-badge-pill">Registered Clinician</span>
                </div>
                <p className="doc-clinic-sub">{doctorProfile.clinic} • {doctorProfile.email}</p>
              </div>
            </div>

            <button
              type="button"
              className="relief-primary-btn compact"
              onClick={() => setActiveView("create")}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span>Create New Referral</span>
            </button>
          </div>

          {/* Metrics Grid */}
          <div className="doc-metrics-grid">
            <div className="doc-metric-card box-navy">
              <span className="dmc-label">Total Referrals</span>
              <strong className="dmc-val">{totalCount}</strong>
              <span className="dmc-sub">All patient referrals issued</span>
            </div>

            <div className="doc-metric-card box-amber">
              <span className="dmc-label">Pending Triage</span>
              <strong className="dmc-val">{pendingCount}</strong>
              <span className="dmc-sub">Awaiting hospital acceptance</span>
            </div>

            <div className="doc-metric-card box-emerald">
              <span className="dmc-label">Accepted Admissions</span>
              <strong className="dmc-val">{acceptedCount}</strong>
              <span className="dmc-sub">Bed reserved &amp; authorized</span>
            </div>

            <div className="doc-metric-card box-slate">
              <span className="dmc-label">Rejected / Redirected</span>
              <strong className="dmc-val">{rejectedCount}</strong>
              <span className="dmc-sub">Redirected to alternate center</span>
            </div>

            <div className="doc-metric-card box-teal">
              <span className="dmc-label">Completed Care</span>
              <strong className="dmc-val">{completedCount}</strong>
              <span className="dmc-sub">Treated &amp; discharged</span>
            </div>
          </div>

          {/* Referrals History Table */}
          <div className="doc-history-card">
            <div className="history-header">
              <h3 className="section-heading">Recent Clinical Referrals</h3>
              <span className="history-count">Showing {referrals.length} active records</span>
            </div>

            {loading ? (
              <div className="hosp-loading-state">
                <div className="hosp-spinner" />
                <p>Loading patient referral ledger...</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="hosp-empty-state">
                <div className="empty-icon">📋</div>
                <h3>No referrals created yet</h3>
                <p>Click "Create New Referral" to initiate structured hospital matching for your patient.</p>
                <button
                  type="button"
                  className="relief-primary-btn compact"
                  onClick={() => setActiveView("create")}
                >
                  Create Referral
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="doc-referral-table">
                  <thead>
                    <tr>
                      <th>Referral ID / Date</th>
                      <th>Patient Information</th>
                      <th>Priority</th>
                      <th>Specialty &amp; Procedure</th>
                      <th>Target Hospital</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((r) => {
                      const priorityClass = r.priority?.toLowerCase() || "routine";
                      const statusClass = r.status?.toLowerCase() || "created";

                      return (
                        <tr key={r.id}>
                          <td>
                            <div className="cell-id">
                              <strong className="mono-id">{r.id}</strong>
                              <span className="date-sub">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                              <span className={r.isDemoData ? "data-source-pill demo" : "data-source-pill live"}>
                                {r.isDemoData ? "Demo Sample" : "Live Referral"}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="cell-patient">
                              <strong>{r.patient?.name}</strong>
                              <span className="pat-meta">
                                {r.patient?.gender}, {r.patient?.age} yrs • {r.patient?.location}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className={`priority-badge ${priorityClass}`}>
                              {r.priority}
                            </span>
                          </td>

                          <td>
                            <div className="cell-specialty">
                              <strong>{r.clinicalRequirements?.specialty}</strong>
                              <span>{r.clinicalRequirements?.procedure}</span>
                            </div>
                          </td>

                          <td>
                            {r.status === "Rejected" ? (
                              <div className="declined-hosp-cell">
                                <span className="declined-hosp-name">{r.targetHospitalName || "Declined Hospital"}</span>
                                <span className="declined-tag">Declined</span>
                              </div>
                            ) : (
                              <span className="hosp-name-cell">
                                {r.targetHospitalName || "Not assigned yet"}
                              </span>
                            )}
                          </td>

                          <td>
                            <div className="status-cell-wrap">
                              <span className={`status-pill-table ${statusClass}`}>
                                ● {r.status}
                              </span>
                              {r.status === "Rejected" && r.rejectionReason && (
                                <span className="rejected-reason-chip" title={r.rejectionReason}>
                                  {r.rejectionReason}
                                </span>
                              )}
                              {r.rejectionHistory && r.rejectionHistory.length > 0 && r.status !== "Rejected" && (
                                <span className="redirected-count-pill" title={`Attempt #${r.rejectionHistory.length + 1}`}>
                                  Redirected ({r.rejectionHistory.length}x)
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            {r.status === "Rejected" ? (
                              <button
                                type="button"
                                className="view-btn-table alt-match-btn"
                                onClick={() => handleFindAlternatives(r)}
                              >
                                ⚡ Find Alternatives →
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="view-btn-table"
                                onClick={async () => {
                                  setActiveReferral(r);
                                  setMatchingLoading(true);
                                  const matches = await matchHospitalsForReferral(r);
                                  setMatchedHospitals(matches);
                                  setMatchingLoading(false);
                                  setActiveView("matched");
                                }}
                              >
                                Matching &amp; Pass →
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          VIEW 2: REFERRAL CREATION FORM
      ═════════════════════════════════════════════════════════════════════ */}
      {activeView === "create" && (
        <section className="doc-create-section">
          <div className="create-header-card">
            <span className="subview-badge">Step 1 of 2: Structured Clinical Intake</span>
            <h2 className="create-title">Create Structured Patient Referral</h2>
            <p className="create-sub">
              Define the patient's exact clinical and technological requirements. The system will match facilities with verified surgical suites, beds, and laser equipment.
            </p>
          </div>

          {formError && (
            <div className="dash-alert error">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmitReferral} className="structured-referral-form">
            {/* ── Section 1: Patient Information ── */}
            <div className="form-card-section">
              <div className="section-head-num">
                <span className="num-bubble">1</span>
                <div>
                  <h3 className="section-heading">Patient Information</h3>
                  <span className="section-hint">Mandatory demographic and contact credentials</span>
                </div>
              </div>

              <div className="grid-form-3">
                <div className="form-group">
                  <label htmlFor="pat-name">Patient Name *</label>
                  <input
                    id="pat-name"
                    type="text"
                    required
                    placeholder="Full Legal Name"
                    value={formData.patientName}
                    onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pat-id">Patient ID</label>
                  <input
                    id="pat-id"
                    type="text"
                    value={formData.patientId}
                    onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                    className="dash-input"
                  />
                  <span className="field-hint">Auto-generated or hospital MRN</span>
                </div>

                <div className="form-group">
                  <label htmlFor="pat-age">Age *</label>
                  <input
                    id="pat-age"
                    type="number"
                    min="1"
                    max="125"
                    required
                    placeholder="Years"
                    value={formData.patientAge}
                    onChange={(e) => setFormData({ ...formData, patientAge: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pat-contact">Contact Number *</label>
                  <input
                    id="pat-contact"
                    type="tel"
                    required
                    placeholder="+91 98000 00000"
                    value={formData.patientContact}
                    onChange={(e) => setFormData({ ...formData, patientContact: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pat-gender">Gender (Clinically Relevant)</label>
                  <select
                    id="pat-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="dash-input"
                  >
                    <option value="Clinically Non-specified">Clinically Non-specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="pat-loc">Patient Location (City/Area) *</label>
                  <input
                    id="pat-loc"
                    type="text"
                    required
                    placeholder="e.g. New Delhi / South Delhi"
                    value={formData.patientLocation}
                    onChange={(e) => setFormData({ ...formData, patientLocation: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group span-3">
                  <label htmlFor="pat-emerg">Emergency Contact (Name &amp; Phone)</label>
                  <input
                    id="pat-emerg"
                    type="text"
                    placeholder="e.g. Spouse / Next of Kin: +91 98111 22233"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    className="dash-input"
                  />
                </div>
              </div>
            </div>

            {/* ── Section 2: Clinical Requirements ── */}
            <div className="form-card-section">
              <div className="section-head-num">
                <span className="num-bubble">2</span>
                <div>
                  <h3 className="section-heading">Clinical Requirements</h3>
                  <span className="section-hint">Exact surgical procedures, specialists, and equipment needed</span>
                </div>
              </div>

              {/* OpenRouter AI-Assisted Document / Note Extractor (Doctor Review Required) */}
              <div className="ai-assist-extract-box">
                <div className="aaeb-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div>
                    <strong>✨ AI Referral Document Extractor (Doctor Review Required)</strong>
                    <span className="aaeb-sub">Upload a referral document (.txt, .pdf) or paste clinical note text. Patient PII is scrubbed before sending, and nothing is saved until you review &amp; approve.</span>
                  </div>
                  <label className="relief-secondary-btn compact" style={{ cursor: "pointer" }}>
                    📄 Upload Referral Doc
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.pdf,.png,.jpg,.jpeg"
                      onChange={handleAiDocFileUpload}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                <div className="aaeb-input-row">
                  <textarea
                    rows="2"
                    className="dash-input"
                    placeholder="Paste referral letter / discharge note text here (e.g. 'Refer patient for HoLEP laser prostate enucleation with ICU standby and 100W Holmium laser...')"
                    value={rawDocText}
                    onChange={(e) => setRawDocText(e.target.value)}
                  />
                  <button
                    type="button"
                    className="relief-secondary-btn compact"
                    disabled={aiExtractLoading || !rawDocText.trim() || !aiConsentChecked}
                    onClick={handleRunAiExtract}
                  >
                    {aiExtractLoading ? "Extracting..." : "Extract Fields →"}
                  </button>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "0.78rem", color: "#334155", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={aiConsentChecked}
                    onChange={(e) => setAiConsentChecked(e.target.checked)}
                  />
                  <span>
                    I confirm patient consent &amp; de-identification safeguard (names, emails, phones, and IDs are scrubbed client-side before external AI processing).
                  </span>
                </label>

                {aiExtractNotice && <p className="aaeb-notice">{aiExtractNotice}</p>}

                {aiExtractDraft && (
                  <div className="aaeb-draft-review">
                    <div className="aaeb-draft-head">
                      <strong>Editable AI Draft — Review Before Applying</strong>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button type="button" className="relief-secondary-btn compact" onClick={() => setAiExtractDraft(null)}>
                          Discard
                        </button>
                        <button type="button" className="relief-primary-btn compact" onClick={handleApplyExtractedDraft}>
                          ✓ Approve &amp; Fill Form
                        </button>
                      </div>
                    </div>
                    <div className="grid-form-2">
                      <div className="form-group">
                        <label>Extracted Specialty</label>
                        <input
                          type="text"
                          className="dash-input"
                          value={aiExtractDraft.specialty || ""}
                          onChange={(e) => setAiExtractDraft({ ...aiExtractDraft, specialty: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Extracted Procedure</label>
                        <input
                          type="text"
                          className="dash-input"
                          value={aiExtractDraft.procedure || ""}
                          onChange={(e) => setAiExtractDraft({ ...aiExtractDraft, procedure: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Mentioned Facilities</label>
                        <input
                          type="text"
                          className="dash-input"
                          value={aiExtractDraft.requiredFacilities || ""}
                          onChange={(e) => setAiExtractDraft({ ...aiExtractDraft, requiredFacilities: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Instructions / Equipment</label>
                        <input
                          type="text"
                          className="dash-input"
                          value={aiExtractDraft.instructions || ""}
                          onChange={(e) => setAiExtractDraft({ ...aiExtractDraft, instructions: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid-form-2">
                <div className="form-group">
                  <label htmlFor="req-specialty">Required Medical Specialty *</label>
                  <select
                    id="req-specialty"
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="dash-input"
                  >
                    <option value="Laser Proctology">Laser Proctology</option>
                    <option value="Laser Urology">Laser Urology</option>
                    <option value="Vascular Surgery">Vascular Surgery (Laser Varicose Veins)</option>
                    <option value="Laparoscopic Surgery">Laparoscopic Surgery</option>
                    <option value="Cardiology">Cardiology / Interventional</option>
                    <option value="Laser Surgery">Laser Surgery (General)</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Critical Care">Critical Care / ICU</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="req-proc">Required Treatment or Procedure *</label>
                  <input
                    id="req-proc"
                    type="text"
                    required
                    placeholder="e.g. Laser Hemorrhoidoplasty (LHP), EVLA, HoLEP"
                    value={formData.procedure}
                    onChange={(e) => setFormData({ ...formData, procedure: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group span-2">
                  <label htmlFor="req-diag">Diagnosis or Clinical Notes *</label>
                  <textarea
                    id="req-diag"
                    rows="3"
                    required
                    placeholder="Document clinical diagnosis, stage, severity, and rationale for surgical referral..."
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    className="dash-input textarea"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="req-fac">Required Hospital Facilities</label>
                  <input
                    id="req-fac"
                    type="text"
                    placeholder="e.g. Daycare Surgical Suite, Post-op Recovery, Inpatient Ward"
                    value={formData.hospitalFacilities}
                    onChange={(e) => setFormData({ ...formData, hospitalFacilities: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="req-spec-doc">Required Specialist</label>
                  <input
                    id="req-spec-doc"
                    type="text"
                    placeholder="e.g. Senior Colorectal Surgeon / Urologist"
                    value={formData.requiredSpecialist}
                    onChange={(e) => setFormData({ ...formData, requiredSpecialist: e.target.value })}
                    className="dash-input"
                  />
                </div>

                {/* ICU & Emergency Toggles */}
                <div className="toggle-box">
                  <div className="tb-text">
                    <strong>ICU Required?</strong>
                    <span>Does patient require dedicated critical care or ventilator bed?</span>
                  </div>
                  <div className="toggle-switch-group">
                    <button
                      type="button"
                      className={`tb-btn ${!formData.icuRequired ? "active-no" : ""}`}
                      onClick={() => setFormData({ ...formData, icuRequired: false })}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      className={`tb-btn ${formData.icuRequired ? "active-yes" : ""}`}
                      onClick={() => setFormData({ ...formData, icuRequired: true })}
                    >
                      Yes (ICU Bed)
                    </button>
                  </div>
                </div>

                <div className="toggle-box">
                  <div className="tb-text">
                    <strong>Emergency Support Required?</strong>
                    <span>Does the case require 24/7 acute trauma receiving and resuscitation?</span>
                  </div>
                  <div className="toggle-switch-group">
                    <button
                      type="button"
                      className={`tb-btn ${!formData.emergencySupportRequired ? "active-no" : ""}`}
                      onClick={() => setFormData({ ...formData, emergencySupportRequired: false })}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      className={`tb-btn ${formData.emergencySupportRequired ? "active-yes" : ""}`}
                      onClick={() => setFormData({ ...formData, emergencySupportRequired: true })}
                    >
                      Yes (Emergency Bay)
                    </button>
                  </div>
                </div>

                <div className="form-group span-2">
                  <label htmlFor="req-equip">Equipment Requirements</label>
                  <input
                    id="req-equip"
                    type="text"
                    placeholder="e.g. 1470nm Dual Diode Laser, 100W Holmium:YAG, 4K Laparoscopy Tower"
                    value={formData.equipmentRequirements}
                    onChange={(e) => setFormData({ ...formData, equipmentRequirements: e.target.value })}
                    className="dash-input"
                  />
                </div>

                <div className="form-group span-2">
                  <label htmlFor="req-addnotes">Additional Clinical Requirements / Comorbidities</label>
                  <textarea
                    id="req-addnotes"
                    rows="2"
                    placeholder="Allergies, diabetes, anticoagulation, pacemaker, prior surgeries..."
                    value={formData.additionalClinicalNotes}
                    onChange={(e) => setFormData({ ...formData, additionalClinicalNotes: e.target.value })}
                    className="dash-input textarea"
                  />
                </div>
              </div>
            </div>

            {/* ── Section 3: Referral Priority ── */}
            <div className="form-card-section">
              <div className="section-head-num">
                <span className="num-bubble">3</span>
                <div>
                  <h3 className="section-heading">Referral Priority Tier</h3>
                  <span className="section-hint">Clinical urgency classification for bed triage</span>
                </div>
              </div>

              <div className="priority-select-cards">
                <label className={`priority-card emergency ${formData.priority === "Emergency" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="priority"
                    value="Emergency"
                    checked={formData.priority === "Emergency"}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  />
                  <div className="p-card-body">
                    <div className="p-card-top">
                      <span className="p-tag emergency">🚨 Level 1 Emergency</span>
                      <strong className="p-time">&lt; 2 Hours</strong>
                    </div>
                    <h4>Emergency Admission</h4>
                    <p>Immediate life or limb threat, acute hemorrhaging, acute urinary retention, acute surgical abdomen.</p>
                  </div>
                </label>

                <label className={`priority-card urgent ${formData.priority === "Urgent" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="priority"
                    value="Urgent"
                    checked={formData.priority === "Urgent"}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  />
                  <div className="p-card-body">
                    <div className="p-card-top">
                      <span className="p-tag urgent">⚡ Priority Urgent</span>
                      <strong className="p-time">&lt; 24 Hours</strong>
                    </div>
                    <h4>Urgent Priority</h4>
                    <p>Severe pain, advancing symptoms, bleeding hemorrhoids with anemia, active stones causing hydronephrosis.</p>
                  </div>
                </label>

                <label className={`priority-card routine ${formData.priority === "Routine" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="priority"
                    value="Routine"
                    checked={formData.priority === "Routine"}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  />
                  <div className="p-card-body">
                    <div className="p-card-top">
                      <span className="p-tag routine">🟢 Elective Schedule</span>
                      <strong className="p-time">2–5 Days</strong>
                    </div>
                    <h4>Routine Elective</h4>
                    <p>Elective laser ablation, varicose vein cosmetic/functional repair, scheduled laparoscopic consultation.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* ── Section 4: Documents & Attachments ── */}
            <div className="form-card-section">
              <div className="section-head-num">
                <span className="num-bubble">4</span>
                <div>
                  <h3 className="section-heading">Documents &amp; Diagnostic Reports</h3>
                  <span className="section-hint">Upload verified medical lab reports, notes, or imaging (Max 10MB each)</span>
                </div>
              </div>

              {/* Attach session lab report if present */}
              {results && results.length > 0 && (
                <div className="session-attach-banner">
                  <div className="sab-left">
                    <span className="sab-badge">Active MediSync Session</span>
                    <strong>{results.length} Lab Test Results Analyzed</strong>
                    <p>Attach the currently analyzed PDF lab report directly to this clinical referral.</p>
                  </div>
                  <button
                    type="button"
                    className="sab-btn"
                    onClick={handleAttachSessionReport}
                  >
                    + Attach Session Lab Report
                  </button>
                </div>
              )}

              <div className="upload-drop-grid">
                <div className="upload-drop-box">
                  <span className="ud-icon">📄</span>
                  <strong>Upload Medical Reports</strong>
                  <span>PDF, PNG, JPG up to 10MB</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleFileUpload(e, "Medical Report")}
                    className="file-hidden-input"
                    id="file-med-rep"
                  />
                  <label htmlFor="file-med-rep" className="file-pick-btn">Choose Lab Report</label>
                </div>

                <div className="upload-drop-box">
                  <span className="ud-icon">📝</span>
                  <strong>Upload Referral Notes</strong>
                  <span>Doctor letterhead note or prescription</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleFileUpload(e, "Doctor Referral Letter")}
                    className="file-hidden-input"
                    id="file-ref-doc"
                  />
                  <label htmlFor="file-ref-doc" className="file-pick-btn">Choose Referral Note</label>
                </div>

                <div className="upload-drop-box">
                  <span className="ud-icon">🩻</span>
                  <strong>Upload Supporting Documents</strong>
                  <span>Ultrasound, Doppler, MRI or ECG scan</span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleFileUpload(e, "Supporting Imaging / Diagnostics")}
                    className="file-hidden-input"
                    id="file-supp-doc"
                  />
                  <label htmlFor="file-supp-doc" className="file-pick-btn">Choose Diagnostics</label>
                </div>
              </div>

              {/* Uploaded Documents List */}
              {formData.documents.length > 0 && (
                <div className="uploaded-docs-list">
                  <span className="docs-title">Attached Clinical Documents ({formData.documents.length}):</span>
                  {formData.documents.map((d) => (
                    <div key={d.id} className="doc-pill-item">
                      <div className="dpi-left">
                        <span className="dpi-icon">📎</span>
                        <div>
                          <strong>{d.name}</strong>
                          <span className="dpi-meta">
                            {d.category} • {Math.round(d.size / 1024)} KB
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="dpi-remove"
                        onClick={() => handleRemoveDoc(d.id)}
                        title="Remove attachment"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Section 5: Referral Preferences ── */}
            <div className="form-card-section">
              <div className="section-head-num">
                <span className="num-bubble">5</span>
                <div>
                  <h3 className="section-heading">Referral Preferences</h3>
                  <span className="section-hint">Geographic radius and insurance pre-authorization requirements</span>
                </div>
              </div>

              <div className="grid-form-3">
                <div className="form-group">
                  <label htmlFor="pref-loc">Preferred Hospital Location</label>
                  <input
                    id="pref-loc"
                    type="text"
                    value={formData.preferredLocation}
                    onChange={(e) => setFormData({ ...formData, preferredLocation: e.target.value })}
                    placeholder="e.g. New Delhi, South Delhi, Gurugram"
                    className="dash-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pref-dist">Maximum Travel Distance</label>
                  <select
                    id="pref-dist"
                    value={formData.maxDistance}
                    onChange={(e) => setFormData({ ...formData, maxDistance: e.target.value })}
                    className="dash-input"
                  >
                    <option value="10 km">Within 10 km (Immediate Local)</option>
                    <option value="25 km">Within 25 km (City Center)</option>
                    <option value="50 km">Within 50 km (Metropolitan Area)</option>
                    <option value="100 km">Within 100 km (Inter-city)</option>
                    <option value="Any distance">Any distance (Specialized Care Priority)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="pref-ins">Insurance / TPA Requirements</label>
                  <select
                    id="pref-ins"
                    value={formData.insuranceRequirements}
                    onChange={(e) => setFormData({ ...formData, insuranceRequirements: e.target.value })}
                    className="dash-input"
                  >
                    <option value="Cashless TPA / Private Insurance">Cashless TPA (Private Mediclaim)</option>
                    <option value="Ayushman Bharat / PMJAY">Ayushman Bharat (PMJAY)</option>
                    <option value="Corporate / CGHS">Corporate / CGHS Empaneled</option>
                    <option value="Self-Pay / Direct Patient">Self-Pay / Direct Patient</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── FINAL ACTION: Find Suitable Hospitals ── */}
            <div className="form-final-action-card">
              <div className="ff-text">
                <h4>Ready to Coordinate Hospital Admission?</h4>
                <p>
                  Upon submission, clinical requirements will be stored securely, a permanent referral ID generated, and hospitals ranked by surgical match and real-time bed capacity.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="relief-primary-btn large"
              >
                {isSubmitting ? "Processing Clinical Requirements..." : "Find Suitable Hospitals →"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          VIEW 3: MATCHING RESULTS & DISPATCH PASS
      ═════════════════════════════════════════════════════════════════════ */}
      {activeView === "matched" && activeReferral && (
        <section className="doc-matched-section">
          {/* Referral Summary Strip */}
          <div className="matched-summary-bar">
            <div className="ms-left">
              <div className="ms-badge-row">
                <span className="mono-id">{activeReferral.id}</span>
                <span className={`priority-badge ${activeReferral.priority?.toLowerCase()}`}>
                  {activeReferral.priority} Priority
                </span>
                <span className="status-pill-table">
                  Status: {activeReferral.status}
                </span>
              </div>
              <h2 className="ms-title">
                Hospital Matching: {activeReferral.patient?.name} ({activeReferral.patient?.age} yrs)
              </h2>
              <p className="ms-proc">
                Procedure: <strong>{activeReferral.clinicalRequirements?.procedure}</strong> ({activeReferral.clinicalRequirements?.specialty}) • Location: {activeReferral.patient?.location}
              </p>
            </div>

            <div className="ms-right">
              <button
                type="button"
                className="relief-secondary-btn compact"
                onClick={() => setActiveView("dashboard")}
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          {dispatchSuccess && (
            <div className="dash-alert success">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{dispatchSuccess}</span>
            </div>
          )}

          {activeReferral.status === "Rejected" && (
            <div className="matched-rejected-alert-banner">
              <div className="mrab-left">
                <span className="mrab-icon">⚠️</span>
                <div>
                  <strong>Referral Declined by {activeReferral.targetHospitalName || "Target Hospital"}</strong>
                  <p>Reason: {activeReferral.rejectionReason || "Capacity unavailable"}. Candidate exclusion and intelligent alternative hospital matching is active.</p>
                </div>
              </div>
              <button
                type="button"
                className="relief-primary-btn compact"
                onClick={() => handleFindAlternatives(activeReferral)}
              >
                ⚡ Switch to Alternative Matching Engine →
              </button>
            </div>
          )}

          {/* Matched Hospitals List */}
          <div className="matched-hospitals-wrap">
            <div className="matched-head">
              <h3 className="section-heading">Verified Compatible Healthcare Centers</h3>
              <p className="section-subtext">
                Ranked deterministically by clinical department alignment, equipment readiness, ICU capability, and real-time bed telemetry.
              </p>

              {/* AI Feature 2: Natural Language Search -> Structured Filters */}
              <form className="nl-search-bar" onSubmit={handleRunNlFilter}>
                <input
                  type="text"
                  className="dash-input"
                  placeholder="Natural Language Filter (e.g. 'Find hospitals in Delhi that provide laser surgery and have ICU support')"
                  value={nlSearchQuery}
                  onChange={(e) => setNlSearchQuery(e.target.value)}
                />
                <button type="submit" className="relief-secondary-btn compact" disabled={nlSearchLoading}>
                  {nlSearchLoading ? "Parsing..." : "✨ Convert to Filter"}
                </button>
                {nlActiveFilters && (
                  <button
                    type="button"
                    className="relief-secondary-btn compact"
                    onClick={() => {
                      setNlActiveFilters(null);
                      setNlSearchQuery("");
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </form>

              {nlActiveFilters && (
                <div className="nl-filter-chips">
                  <span>Structured Filters Active:</span>
                  {nlActiveFilters.cityOrArea && <span className="nl-chip">📍 Area: {nlActiveFilters.cityOrArea}</span>}
                  {nlActiveFilters.specialty && <span className="nl-chip">🏥 Specialty: {nlActiveFilters.specialty}</span>}
                  {nlActiveFilters.requireIcu && <span className="nl-chip">🛏 ICU Required</span>}
                  {nlActiveFilters.requireEmergency && <span className="nl-chip">🚨 24/7 Emergency</span>}
                  {nlActiveFilters.minAvailableBeds > 0 && <span className="nl-chip">Open Beds ≥ {nlActiveFilters.minAvailableBeds}</span>}
                </div>
              )}
            </div>

            {matchingLoading ? (
              <div className="hosp-loading-state">
                <div className="hosp-spinner" />
                <p>Matching clinical requirements against live hospital capacities...</p>
              </div>
            ) : (() => {
              const displayedMatches = nlActiveFilters
                ? matchedHospitals.filter(({ hospital }) => {
                    if (nlActiveFilters.cityOrArea) {
                      const locStr = `${hospital.address || ""} ${hospital.city || ""} ${hospital.state || ""}`.toLowerCase();
                      if (!locStr.includes(nlActiveFilters.cityOrArea.toLowerCase())) return false;
                    }
                    if (nlActiveFilters.specialty) {
                      const depStr = (hospital.departments || []).join(" ").toLowerCase();
                      if (!depStr.includes(nlActiveFilters.specialty.toLowerCase())) return false;
                    }
                    if (nlActiveFilters.requireIcu && !(hospital.icuFacilities?.available && (hospital.icuFacilities?.availableBeds ?? 0) > 0)) {
                      return false;
                    }
                    if (nlActiveFilters.requireEmergency && !(hospital.emergencyFacilities?.available && (hospital.availableEmergencyBeds ?? 0) > 0)) {
                      return false;
                    }
                    if ((nlActiveFilters.minAvailableBeds || 0) > (hospital.availableBeds || 0)) {
                      return false;
                    }
                    return true;
                  })
                : matchedHospitals;

              if (displayedMatches.length === 0) {
                return (
                  <div className="hosp-empty-state">
                    <div className="empty-icon">🏥</div>
                    <h3>No compatible hospital matches the current requirements/filters</h3>
                    <p>Try widening the travel distance, adjusting ICU requirements, or clearing the NL filter.</p>
                  </div>
                );
              }

              return (
              <div className="matched-cards-stack">
                {displayedMatches.map((matchItem) => {
                  const { hospital, matchScore, matchGrade, matchReasons, missingRequirements } = matchItem;
                  const isCurrentTarget = activeReferral.targetHospitalId === hospital.id;
                  const aiExp = aiExplanations[hospital.id];

                  return (
                    <div key={hospital.id} className={`matched-hosp-card ${isCurrentTarget ? "dispatched-target" : ""}`}>
                      <div className="mhc-left-score">
                        <div className={`score-circle ${matchScore >= 80 ? "high" : matchScore >= 50 ? "med" : "low"}`}>
                          <strong>{matchScore}%</strong>
                          <span>Match</span>
                        </div>
                        <span className="grade-tag">{matchGrade}</span>
                      </div>

                      <div className="mhc-center-info">
                        <div className="mhc-top-tags">
                          <span className="mono-id">{hospital.id}</span>
                          <span className="hosp-type-badge">{hospital.hospitalType}</span>
                          {hospital.confirmedByHospital ? (
                            <span className="confirmed-pill">● Verified Hospital Desk</span>
                          ) : (
                            <span className="reported-pill">● Reported Status</span>
                          )}
                        </div>

                        <h4 className="mhc-hosp-name">{hospital.name}</h4>
                        <p className="mhc-hosp-loc">
                          📍 {hospital.address}, {hospital.city}, {hospital.state} • Phone: {hospital.contactPhone}
                        </p>

                        {/* Capacity Telemetry Pills */}
                        <div className="mhc-telemetry-strip">
                          <div className="tele-pill">
                            <span className="tp-k">General Beds:</span>
                            <strong className="tp-v">{hospital.availableBeds} Open</strong>
                          </div>
                          <div className="tele-pill">
                            <span className="tp-k">ICU Capacity:</span>
                            <strong className="tp-v">{hospital.icuFacilities?.availableBeds ?? hospital.icuBedCapacity} Open</strong>
                          </div>
                          <div className="tele-pill">
                            <span className="tp-k">Emergency:</span>
                            <strong className="tp-v">{hospital.availableEmergencyBeds} Bays</strong>
                          </div>
                        </div>

                        {/* Match Reasons */}
                        <div className="match-reasons-cloud">
                          {matchReasons.map((reason, i) => (
                            <span key={i} className="reason-chip">✓ {reason}</span>
                          ))}
                          {missingRequirements.map((mis, i) => (
                            <span key={i} className="missing-chip">⚠️ {mis}</span>
                          ))}
                        </div>

                        {/* AI Match Explanation Trigger & Grounded Output */}
                        <div className="mhc-ai-explain-row">
                          <button
                            type="button"
                            className="ai-explain-btn"
                            disabled={aiExp?.loading}
                            onClick={() => handleExplainHospitalMatch(matchItem)}
                          >
                            {aiExp?.loading ? "Analyzing DB Records..." : "✨ Explain Match (Grounded in DB)"}
                          </button>
                          {aiExp?.text && (
                            <div className="ai-explain-box">
                              <p>{aiExp.text}</p>
                              <span className="ai-model-tag">Source: {aiExp.model}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mhc-right-actions">
                        {isCurrentTarget ? (
                          <div className="dispatched-confirmed-box">
                            <span className="dcb-check">✓</span>
                            <strong>Dispatched</strong>
                            <span>Token Active</span>
                          </div>
                        ) : matchItem.isEligible === false || (missingRequirements && missingRequirements.length > 0) ? (
                          <div className="dispatched-confirmed-box" style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
                            <span className="dcb-check" style={{ background: "#dc2626" }}>✕</span>
                            <strong>Ineligible</strong>
                            <span>Fails Hard Filter</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="relief-primary-btn compact"
                            onClick={() => handleDispatch(hospital)}
                          >
                            Dispatch Referral →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </section>
      )}
      {/* ═════════════════════════════════════════════════════════════════════
          VIEW 4: INTELLIGENT ALTERNATIVE HOSPITAL MATCHING
      ═════════════════════════════════════════════════════════════════════ */}
      {activeView === "alternatives" && activeReferral && (
        <section className="doc-alternatives-section">
          {/* Referral Summary Header */}
          <div className="matched-summary-bar">
            <div className="ms-left">
              <div className="ms-badge-row">
                <span className="mono-id">{activeReferral.id}</span>
                <span className={`priority-badge ${activeReferral.priority?.toLowerCase()}`}>
                  {activeReferral.priority} Priority
                </span>
                <span className="status-pill-table rejected-badge-alt">
                  ● Status: {activeReferral.status}
                </span>
              </div>
              <h2 className="ms-title">
                Alternative Hospital Matching: {activeReferral.patient?.name} ({activeReferral.patient?.age} yrs)
              </h2>
              <p className="ms-proc">
                Procedure: <strong>{activeReferral.clinicalRequirements?.procedure}</strong> ({activeReferral.clinicalRequirements?.specialty}) • Location: {activeReferral.patient?.location}
              </p>
            </div>

            <div className="ms-right">
              <button
                type="button"
                className="relief-secondary-btn compact"
                onClick={() => setActiveView("dashboard")}
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          {redirectSuccess && (
            <div className="dash-alert success">
              <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{redirectSuccess}</span>
            </div>
          )}

          {/* ── Persistent Rejection Context Alert Strip ── */}
          <div className="alt-rejection-alert">
            <div className="ara-badge-top">
              <span className="ara-status-pill">
                ● Rejected by previous hospital — finding alternatives
              </span>
              <span className="ara-audit-tag">
                Audit Trail ID: {activeReferral.id}
              </span>
            </div>

            <div className="ara-content-box">
              <div className="ara-header-row">
                <div className="ara-hosp-info">
                  <span className="ara-label">Declining Medical Center</span>
                  <h3 className="ara-hosp-name">
                    {(activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0)
                      ? activeReferral.rejectionHistory[activeReferral.rejectionHistory.length - 1].hospitalName
                      : (activeReferral.lastRejectedHospital?.name || activeReferral.targetHospitalName || "Target Hospital")}
                  </h3>
                </div>

                <div className="ara-reason-block">
                  <span className="ara-label">Recorded Rejection Reason</span>
                  <div className="ara-reason-chip">
                    {(activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0)
                      ? activeReferral.rejectionHistory[activeReferral.rejectionHistory.length - 1].reason
                      : (activeReferral.rejectionReason || "Capacity unavailable")}
                  </div>
                </div>
              </div>

              {((activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0 && activeReferral.rejectionHistory[activeReferral.rejectionHistory.length - 1].clinicalNotes) || activeReferral.clinicalNotes) && (
                <div className="ara-notes-row">
                  <span className="ara-notes-label">Staff Clinical Notes:</span>
                  <p className="ara-notes-text">
                    "{(activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0)
                      ? activeReferral.rejectionHistory[activeReferral.rejectionHistory.length - 1].clinicalNotes
                      : activeReferral.clinicalNotes}"
                  </p>
                </div>
              )}

              <div className="ara-reviewer-meta">
                <span>Declined by: <strong>
                  {(activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0)
                    ? activeReferral.rejectionHistory[activeReferral.rejectionHistory.length - 1].rejectedBy
                    : (activeReferral.rejectedBy || "Hospital Admissions")}
                </strong></span>
                <span> • Timestamp: {new Date(
                  (activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0)
                    ? activeReferral.rejectionHistory[activeReferral.rejectionHistory.length - 1].rejectedAt
                    : (activeReferral.rejectedAt || activeReferral.createdAt)
                ).toLocaleString()}</span>
              </div>

              {/* Data Preservation & Exclusion Guarantee Bar */}
              <div className="ara-guarantee-grid">
                <div className="agg-card preserved">
                  <div className="agg-head">
                    <span className="agg-icon">🛡️</span>
                    <strong>Preserved Clinical File (Zero Data Loss)</strong>
                  </div>
                  <ul>
                    <li>✓ Original Patient Demographics &amp; Contact Info Preserved</li>
                    <li>✓ Clinical Diagnosis &amp; Procedure Requirements Preserved</li>
                    <li>✓ {activeReferral.documents?.length || 0} Attached Lab &amp; Diagnostic Documents Preserved</li>
                    <li>✓ Complete Historical Referral Audit Trail Retained</li>
                  </ul>
                </div>

                <div className="agg-card excluded">
                  <div className="agg-head">
                    <span className="agg-icon">🚫</span>
                    <strong>Candidate Exclusion Guarantee</strong>
                  </div>
                  <p>
                    <strong>{alternativeData?.excludedHospitalIds?.length || 1}</strong> previously declined facility(s) have been hard-excluded from the active matching pool:
                  </p>
                  <div className="excluded-pills-row">
                    {alternativeData?.excludedHospitalIds?.map((exId) => (
                      <span key={exId} className="excluded-pill">
                        ✕ {exId} ({exId === activeReferral.targetHospitalId ? "Declined Center" : "Previously Declined"})
                      </span>
                    )) || <span className="excluded-pill">✕ {activeReferral.targetHospitalId}</span>}
                  </div>
                </div>
              </div>

              {/* Rejection Audit Ledger Toggle */}
              {activeReferral.rejectionHistory && activeReferral.rejectionHistory.length > 0 && (
                <div className="ara-ledger-toggle-wrap">
                  <button
                    type="button"
                    className="ara-toggle-btn"
                    onClick={() => setShowAuditLedger(!showAuditLedger)}
                  >
                    <span>📋 {showAuditLedger ? "Hide Rejection History Ledger ▲" : `View Complete Rejection Audit Trail (${activeReferral.rejectionHistory.length} attempts) ▼`}</span>
                  </button>

                  {showAuditLedger && (
                    <div className="ara-ledger-table-wrap">
                      <table className="ara-ledger-table">
                        <thead>
                          <tr>
                            <th>Attempt #</th>
                            <th>Hospital</th>
                            <th>Reason Recorded</th>
                            <th>Clinical Note</th>
                            <th>Staff Reviewer</th>
                            <th>Declined At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeReferral.rejectionHistory.map((rej, idx) => (
                            <tr key={idx}>
                              <td><span className="mono-bubble">#{idx + 1}</span></td>
                              <td><strong>{rej.hospitalName}</strong></td>
                              <td><span className="rej-badge-sm">{rej.reason}</span></td>
                              <td><span className="note-cell">{rej.clinicalNotes || "None"}</span></td>
                              <td>{rej.rejectedBy}</td>
                              <td>{new Date(rej.rejectedAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Alternatives Stack ── */}
          <div className="matched-hospitals-wrap">
            <div className="matched-head">
              <div className="mh-title-flex">
                <div>
                  <h3 className="section-heading">Verified Alternative Healthcare Facilities</h3>
                  <p className="section-subtext">
                    Ranked by clinical department alignment, equipment readiness, ICU capability, and real-time bed telemetry. All previously declined centers are excluded.
                  </p>
                </div>
                {alternativeData && (
                  <button
                    type="button"
                    className="relief-secondary-btn compact"
                    onClick={() => handleFindAlternatives(activeReferral)}
                  >
                    🔄 Re-Run Live Matching
                  </button>
                )}
              </div>
            </div>

            {alternativeLoading ? (
              <div className="hosp-loading-state">
                <div className="hosp-spinner" />
                <p>Re-running matching engine across accredited alternative facilities...</p>
              </div>
            ) : alternativeError ? (
              <div className="dash-alert error">
                <span>{alternativeError}</span>
              </div>
            ) : !alternativeData || !alternativeData.alternatives || alternativeData.alternatives.length === 0 ? (
              /* Honest "No suitable alternative" state */
              <div className="no-alt-honest-box">
                <div className="nah-icon">⚠️</div>
                <h3 className="nah-title">No suitable alternative hospital currently verified</h3>
                <p className="nah-desc">
                  None of the remaining accredited partner facilities in this radius currently report verified ICU bed availability or the specialized laser equipment required for this clinical case.
                </p>

                {alternativeData?.unsuitableAlternatives && alternativeData.unsuitableAlternatives.length > 0 && (
                  <div className="unsuitable-reasons-box">
                    <span className="urb-title">Disqualification Breakdown of Evaluated Facilities:</span>
                    <ul className="urb-list">
                      {alternativeData.unsuitableAlternatives.map((uns) => (
                        <li key={uns.hospital.id}>
                          <strong>{uns.hospital.name}:</strong>{" "}
                          <span>{uns.missingCriteria.join("; ") || "Did not meet mandatory clinical filters"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="matched-cards-stack">
                {alternativeData.alternatives.map((altItem, index) => {
                  const { hospital, matchScore, distanceKm, travelTime, passedCriteria, explanation } = altItem;
                  const isCurrentTarget = activeReferral.targetHospitalId === hospital.id && activeReferral.status !== "Rejected";

                  return (
                    <div key={hospital.id} className={`matched-hosp-card alt-candidate-card ${index === 0 ? "top-rank-card" : ""}`}>
                      <div className="mhc-left-score">
                        <div className={`score-circle ${matchScore >= 80 ? "high" : matchScore >= 50 ? "med" : "low"}`}>
                          <strong>{matchScore}%</strong>
                          <span>Match</span>
                        </div>
                        <span className="grade-tag">
                          {index === 0 ? "★ #1 Recommended" : matchScore >= 80 ? "Excellent Match" : "High Match"}
                        </span>
                      </div>

                      <div className="mhc-center-info">
                        <div className="mhc-top-tags">
                          <span className="mono-id">{hospital.id}</span>
                          <span className="hosp-type-badge">{hospital.hospitalType}</span>
                          {hospital.confirmedByHospital ? (
                            <span className="confirmed-pill">● Verified Hospital Desk</span>
                          ) : (
                            <span className="reported-pill">● Reported Status</span>
                          )}
                        </div>

                        <h4 className="mhc-hosp-name">{hospital.name}</h4>
                        <p className="mhc-hosp-loc">
                          📍 {hospital.address}, {hospital.city}, {hospital.state} • Phone: {hospital.contactPhone}
                        </p>

                        {/* Capacity Telemetry & Transit */}
                        <div className="mhc-telemetry-strip">
                          <div className="tele-pill">
                            <span className="tp-k">General Beds:</span>
                            <strong className="tp-v">{hospital.availableBeds} Open</strong>
                          </div>
                          <div className="tele-pill">
                            <span className="tp-k">ICU Capacity:</span>
                            <strong className="tp-v">{hospital.icuBedCapacity || (hospital.icuFacilities?.availableBeds ?? 0)} Open</strong>
                          </div>
                          <div className="tele-pill">
                            <span className="tp-k">Emergency:</span>
                            <strong className="tp-v">{hospital.availableEmergencyBeds} Bays</strong>
                          </div>
                          <div className="tele-pill transit">
                            <span className="tp-k">Distance &amp; Transit:</span>
                            <strong className="tp-v">~{distanceKm} km ({travelTime})</strong>
                          </div>
                        </div>

                        {/* Match Reasons */}
                        <div className="match-reasons-cloud">
                          {passedCriteria.map((reason, i) => (
                            <span key={i} className="reason-chip">✓ {reason}</span>
                          ))}
                        </div>

                        {/* Explanation Box */}
                        <div className="alt-explanation-box">
                          <p>{explanation}</p>
                        </div>
                      </div>

                      <div className="mhc-right-actions">
                        {isCurrentTarget ? (
                          <div className="dispatched-confirmed-box">
                            <span className="dcb-check">✓</span>
                            <strong>Active Referral</strong>
                            <span>Awaiting Triage</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="relief-primary-btn compact"
                            onClick={() => setSelectedAlternativeForRedirect(altItem)}
                          >
                            Send Referral to This Hospital →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 24/7 Human Emergency Escalation Coordination Desk ── */}
            <div className="human-escalation-card">
              <div className="hec-left">
                <div className="hec-badge">
                  <span className="live-pulse-dot red" />
                  <span>Human Escalation Desk · 24/7 Emergency Coordination</span>
                </div>
                <h4 className="hec-title">Need Immediate Bed Requisition or Clinical Triage Assistance?</h4>
                <p className="hec-sub">
                  If this is a critical case requiring cross-hospital emergency beds, inter-city transport, or specialized physician consultation, connect directly with our central clinical operations team.
                </p>

                <div className="hec-contacts-grid">
                  <div className="hec-contact-pill">
                    <span className="hcp-k">Emergency Coordination Hotline:</span>
                    <strong className="hcp-v">📞 +91 11 4000 9999</strong>
                  </div>
                  <div className="hec-contact-pill">
                    <span className="hcp-k">Clinical Ops Desk:</span>
                    <strong className="hcp-v">✉️ emergency-desk@relieflaser.med</strong>
                  </div>
                  <div className="hec-contact-pill">
                    <span className="hcp-k">Priority Escalation Token:</span>
                    <strong className="hcp-v mono-token">{activeReferral.id}-ESC-LIVE</strong>
                  </div>
                </div>
              </div>

              <div className="hec-right">
                {humanEscalationLogged ? (
                  <div className="escalation-dispatched-box">
                    <span className="edb-icon">✓</span>
                    <strong>Escalation Call Dispatched</strong>
                    <span>Coordinator will call Dr. {doctorProfile.name} within 3 minutes</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="escalation-action-btn"
                    onClick={handleRequestHumanEscalation}
                  >
                    🚨 Request Emergency Call-Back
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Doctor Redirection Authorization Modal ── */}
      {selectedAlternativeForRedirect && activeReferral && (
        <div className="auth-modal-overlay" role="dialog" aria-modal="true">
          <div className="auth-modal-content">
            <div className="auth-modal-header">
              <div className="amh-title">
                <span className="amh-icon">🩺</span>
                <div>
                  <h3>Authorize Referral Transfer &amp; Redirection</h3>
                  <span className="amh-sub">Physician Confirmation &amp; Bed Requisition</span>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedAlternativeForRedirect(null)}
                disabled={isRedirecting}
              >
                ✕
              </button>
            </div>

            <div className="auth-modal-body">
              {/* Patient and Target Strip */}
              <div className="modal-case-strip">
                <div className="mcs-col">
                  <span className="mcs-label">Patient</span>
                  <strong>{activeReferral.patient?.name}</strong>
                  <span>{activeReferral.patient?.age} yrs • {activeReferral.patient?.gender}</span>
                </div>
                <div className="mcs-arrow">➔</div>
                <div className="mcs-col target">
                  <span className="mcs-label">New Target Facility</span>
                  <strong className="hosp-dest-name">{selectedAlternativeForRedirect.hospital.name}</strong>
                  <span>{selectedAlternativeForRedirect.hospital.city} • ~{selectedAlternativeForRedirect.distanceKm} km away</span>
                </div>
              </div>

              {/* Physician Authority Notice */}
              <div className="doctor-auth-callout">
                <div className="dac-head">
                  <span className="dac-icon">⚖️</span>
                  <strong>Doctor Authorization Mandate</strong>
                </div>
                <p>
                  As <strong>{doctorProfile.name}</strong>, you are authorizing the transfer of this clinical case to <strong>{selectedAlternativeForRedirect.hospital.name}</strong>. 
                  The referral status will reset to <strong>Pending</strong> for their admissions triage team, 
                  all previous rejection records are preserved in the permanent audit ledger, 
                  and the patient will receive real-time notification with updated hospital directions.
                </p>
              </div>

              {/* Clinical Transfer Remarks Input */}
              <div className="auth-form-group">
                <label htmlFor="redirect-notes">
                  Physician Transfer Remarks &amp; Prep Instructions (Optional)
                </label>
                <textarea
                  id="redirect-notes"
                  rows={3}
                  className="dash-textarea"
                  placeholder="e.g. Patient is hemodynamically stable. Coagulation labs normal. Transport via private vehicle; requested urgent surgical evaluation upon arrival."
                  value={redirectNotes}
                  onChange={(e) => setRedirectNotes(e.target.value)}
                />
              </div>

              {/* Action buttons */}
              <div className="modal-actions-row">
                <button
                  type="button"
                  className="relief-secondary-btn"
                  onClick={() => setSelectedAlternativeForRedirect(null)}
                  disabled={isRedirecting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="relief-primary-btn"
                  onClick={handleAuthorizeRedirect}
                  disabled={isRedirecting}
                >
                  {isRedirecting ? "Authorizing Transfer..." : "Authorize & Send Referral →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

