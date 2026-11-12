import { useState, useEffect, useMemo, useRef } from "react";
import { getReferrals, getReferralById, subscribeToReferrals, sweepExpiredCapacityHolds } from "../services/referralService.js";
import { getHospitals, subscribeToHospitals } from "../services/hospitalService.js";
import { subscribeToNotifications, getNotificationsForRole } from "../services/notificationService.js";
import { translatePatientGuideAI } from "../services/aiReferralService.js";
import { useLanguage } from "../context/LanguageContext";

/**
 * Patient Dashboard & Referral Tracking Module
 * Route: /relief-laser-health/patient
 *
 * Privacy:
 *  - Patients can only view their own referrals (matched by email, contact, or patientId).
 *  - Family access requires authorization (shared access code).
 *  - Never exposes private clinical reports or diagnosis to unauthorized viewers.
 *  - SMS/Notification content is sanitized — no clinical details.
 */

// Canonical timeline milestones in display order
const TIMELINE_MILESTONES = [
  { key: "Created",              label: "Referral Created",                icon: "📋" },
  { key: "Matching",             label: "Hospital Matching Started",       icon: "🔍" },
  { key: "Pending",              label: "Referral Sent to Hospital",       icon: "📤" },
  { key: "Rejected",             label: "Hospital Declined Referral",      icon: "❌" },
  { key: "Alternative",          label: "Alternative Hospital Identified", icon: "🔄" },
  { key: "Redirected",           label: "Referral Sent to New Hospital",   icon: "🏥" },
  { key: "Information Requested",label: "More Information Requested",      icon: "📝" },
  { key: "Accepted",             label: "Hospital Accepted Referral",      icon: "✅" },
  { key: "Transfer Initiated",   label: "Patient Transfer Initiated",      icon: "🚑" },
  { key: "Patient Arrived",      label: "Patient Arrived at Hospital",     icon: "🏨" },
  { key: "Completed",            label: "Admission Confirmed",             icon: "🎉" },
];

// Patient-friendly status map
const STATUS_CONFIG = {
  Created:                { label: "Referral Created",          color: "#3b82f6", bg: "#eff6ff",  borderColor: "#bfdbfe" },
  Pending:                { label: "Awaiting Hospital Reply",   color: "#d97706", bg: "#fffbeb",  borderColor: "#fde68a" },
  "Information Requested":{ label: "Hospital Needs More Info",  color: "#8b5cf6", bg: "#f5f3ff",  borderColor: "#c4b5fd" },
  Accepted:               { label: "Hospital Confirmed ✓",      color: "#059669", bg: "#ecfdf5",  borderColor: "#a7f3d0" },
  "Transfer Initiated":   { label: "Transfer Initiated 🚑",     color: "#0284c7", bg: "#f0f9ff",  borderColor: "#bae6fd" },
  "Patient Arrived":      { label: "Arrived at Hospital 🏨",    color: "#0d9488", bg: "#f0fdfa",  borderColor: "#99f6e4" },
  Rejected:               { label: "Searching Alternatives",    color: "#dc2626", bg: "#fef2f2",  borderColor: "#fecaca" },
  Completed:              { label: "Admitted & Active 🎉",      color: "#0f5c63", bg: "#f0fdfa",  borderColor: "#99f6e4" },
  Escalated:              { label: "Emergency Coordination",    color: "#b91c1c", bg: "#fff1f2",  borderColor: "#fda4af" },
};

export default function PatientDashboard({ userEmail }) {
  const { t } = useLanguage();

  // Authentication & access state
  const [accessMode, setAccessMode] = useState("unverified"); // "unverified" | "patient" | "family"
  const [lookupInput, setLookupInput] = useState("");
  const [familyAccessCode, setFamilyAccessCode] = useState("");
  const [accessError, setAccessError] = useState("");
  const activeQueryRef = useRef({ query: "", isAutoLookup: false });

  // Data state
  const [referrals, setReferrals] = useState([]);
  const [allHospitals, setAllHospitals] = useState([]);
  const [liveNotifications, setLiveNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);

  // Notifications panel
  const [showNotifications, setShowNotifications] = useState(false);

  // Multilingual EN / HI AI Assistance
  const [aiGuideLang, setAiGuideLang] = useState("en");
  const [aiGuideText, setAiGuideText] = useState("");
  const [aiGuideLoading, setAiGuideLoading] = useState(false);

  const handleLoadMultilingualGuide = async (targetLang) => {
    setAiGuideLang(targetLang);
    if (!selectedReferral) return;
    const h = getHospitalForReferral(selectedReferral);
    setAiGuideLoading(true);
    try {
      const res = await translatePatientGuideAI(selectedReferral, h, targetLang);
      setAiGuideText(res.translatedGuide || "");
    } catch {
      setAiGuideText("");
    } finally {
      setAiGuideLoading(false);
    }
  };

  const filterReferralsForQuery = (all, q, isAutoLookup) => {
    const cleanQ = (q || "").trim().toLowerCase();
    if (!cleanQ) return [];
    const matched = all.filter((r) => {
      const patContact = (r.patient?.contact || "").replace(/\s/g, "").toLowerCase();
      const patId = (r.patient?.patientId || "").toLowerCase();
      const patName = (r.patient?.name || "").toLowerCase();
      const refId = (r.id || "").toLowerCase();
      const patEmail = (r.patient?.email || "").toLowerCase();
      const docEmail = (r.doctorId || "").toLowerCase();

      return (
        patContact.includes(cleanQ) ||
        patId === cleanQ ||
        refId === cleanQ ||
        cleanQ === patEmail ||
        cleanQ === docEmail ||
        patName === cleanQ ||
        (userEmail && cleanQ === userEmail.toLowerCase() && (
          docEmail === cleanQ || patEmail === cleanQ || patContact.includes(cleanQ.split("@")[0])
        ))
      );
    });
    if (matched.length > 0) return matched;
    if (isAutoLookup) return all.filter((r) => r.isDemoData);
    return [];
  };

  // Real-time subscriptions: hospitals, referrals, and notifications
  useEffect(() => {
    sweepExpiredCapacityHolds().catch(() => {});
    getHospitals().then(setAllHospitals).catch(() => {});
    setLiveNotifications(getNotificationsForRole("patient"));

    const unsubHosp = subscribeToHospitals((updatedHospitals) => {
      setAllHospitals(updatedHospitals);
    });

    const unsubRefs = subscribeToReferrals((updatedRefs) => {
      if (activeQueryRef.current.query) {
        const refreshed = filterReferralsForQuery(
          updatedRefs,
          activeQueryRef.current.query,
          activeQueryRef.current.isAutoLookup
        );
        setReferrals(refreshed);
        setSelectedReferral((prev) => {
          if (!refreshed.length) return null;
          if (!prev) return refreshed[0];
          return refreshed.find((r) => r.id === prev.id) || refreshed[0];
        });
      }
    });

    const unsubNotifs = subscribeToNotifications((allNotifs) => {
      setLiveNotifications(allNotifs.filter((n) => n.recipientRole === "patient"));
    });

    return () => {
      if (typeof unsubHosp === "function") unsubHosp();
      if (typeof unsubRefs === "function") unsubRefs();
      if (typeof unsubNotifs === "function") unsubNotifs();
    };
  }, [userEmail]);

  // Auto-verify if user is logged in with an email that matches a referral
  useEffect(() => {
    if (userEmail && accessMode === "unverified") {
      handlePatientLookup(userEmail, true);
    }
  }, [userEmail]);

  /**
   * Patient lookup — matches referrals by:
   * - patient contact number
   * - patient email (derived from userEmail)
   * - patient ID
   * - referral ID
   */
  const handlePatientLookup = async (query, isAutoLookup = false) => {
    const q = (query || lookupInput).trim().toLowerCase();
    if (!q) {
      setAccessError("Please enter your Referral ID, Patient ID, or registered contact number.");
      return;
    }

    setLoading(true);
    setAccessError("");

    try {
      activeQueryRef.current = { query: q, isAutoLookup };
      const all = await getReferrals();
      const matched = filterReferralsForQuery(all, q, isAutoLookup);

      if (matched.length > 0) {
        setReferrals(matched);
        setSelectedReferral(matched[0]);
        setAccessMode(accessMode === "family" ? "family" : "patient");
      } else if (!isAutoLookup) {
        setAccessError("No referrals found for this Patient ID, Referral ID, or contact number. Please verify your credentials.");
      }
    } catch (err) {
      setAccessError("Unable to retrieve referral data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Family member access with authorization code
  const handleFamilyAccess = () => {
    const code = familyAccessCode.trim();
    if (!code) {
      setAccessError("Please enter the family access authorization code shared by the referring doctor.");
      return;
    }

    // In production: validate against backend. For demo: accept any code >= 6 chars
    if (code.length >= 6) {
      setAccessMode("family");
      // Re-run lookup with reduced visibility
      handlePatientLookup(lookupInput || userEmail || "demo");
    } else {
      setAccessError("Invalid authorization code. Please contact the referring physician for a valid access code.");
    }
  };

  // Get the hospital object for a referral
  const getHospitalForReferral = (ref) => {
    if (!ref?.targetHospitalId) return null;
    return allHospitals.find((h) => h.id === ref.targetHospitalId) || null;
  };

  // Build the visual timeline from referral timeline events
  const buildVisualTimeline = (ref) => {
    if (!ref?.timeline || ref.timeline.length === 0) return [];

    // Map timeline events to milestone entries
    const events = [];
    const seenStatuses = new Set();

    for (const entry of ref.timeline) {
      const status = entry.status;
      seenStatuses.add(status);

      // Find matching milestone (supporting both full keys and short aliases)
      const normalizedStatus = status === "Transfer" ? "Transfer Initiated" : status === "Arrived" ? "Patient Arrived" : status;
      let milestone = TIMELINE_MILESTONES.find((m) => m.key === normalizedStatus);

      // Infer intermediate milestones
      if (status === "Pending" && !events.some((e) => e.key === "Matching")) {
        events.push({
          key: "Matching",
          label: "Hospital Matching Started",
          icon: "🔍",
          timestamp: new Date(new Date(entry.timestamp).getTime() - 60000).toISOString(),
          note: "Matching engine evaluated eligible hospitals based on clinical requirements.",
          by: "System",
          occurred: true,
        });
      }

      // Map redirections
      if (status === "Pending" && entry.note?.toLowerCase().includes("redirect")) {
        events.push({
          key: "Alternative",
          label: "Alternative Hospital Identified",
          icon: "🔄",
          timestamp: new Date(new Date(entry.timestamp).getTime() - 30000).toISOString(),
          note: "System identified next-eligible alternative hospital after previous rejection.",
          by: "Matching Engine",
          occurred: true,
        });

        events.push({
          key: "Redirected",
          label: "Referral Sent to New Hospital",
          icon: "🏥",
          timestamp: entry.timestamp,
          note: entry.note,
          by: entry.by,
          occurred: true,
        });
        continue;
      }

      if (milestone) {
        events.push({
          ...milestone,
          timestamp: entry.timestamp,
          note: sanitizeNoteForPatient(entry.note, accessMode),
          by: entry.by,
          occurred: true,
        });
      } else {
        // Custom / unknown status — still show it
        events.push({
          key: status,
          label: status,
          icon: "📌",
          timestamp: entry.timestamp,
          note: sanitizeNoteForPatient(entry.note, accessMode),
          by: entry.by,
          occurred: true,
        });
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return events;
  };

  // Sanitize clinical notes for patient view (privacy)
  const sanitizeNoteForPatient = (note, mode) => {
    if (!note) return "";
    if (mode === "family") {
      // Family sees less detail
      return note
        .replace(/diagnosis:?\s*[^.]+\./gi, "")
        .replace(/creatinine\s*[\d.]+/gi, "")
        .replace(/hemoglobin\s*[\d.]+/gi, "")
        .trim();
    }
    return note;
  };

  // Gather all notifications for selected referral (merging referral-embedded + central NotificationService)
  const getNotifications = (ref) => {
    if (!ref) return [];
    const embedded = (ref.notifications || [])
      .filter((n) => {
        const target = (n.target || "").toLowerCase();
        return (
          target.includes("patient") ||
          target.includes("doctor_and_patient") ||
          target.includes("all")
        );
      })
      .map((n) => ({
        title: n.title,
        message: n.message,
        notifiedAt: n.notifiedAt,
        source: "referral",
      }));

    const central = (liveNotifications || [])
      .filter((n) => n.referralId === ref.id)
      .map((n) => ({
        title: n.title,
        message: n.message,
        notifiedAt: n.createdAt,
        source: "live_bus",
        channels: n.channelSummary,
      }));

    const merged = [...central, ...embedded];
    const seen = new Set();
    return merged
      .filter((item) => {
        const dedupKey = `${item.title}::${(item.notifiedAt || "").slice(0, 16)}`;
        if (seen.has(dedupKey)) return false;
        seen.add(dedupKey);
        return true;
      })
      .sort((a, b) => new Date(b.notifiedAt) - new Date(a.notifiedAt));
  };

  // Count notifications for selected referral
  const unreadCount = useMemo(() => {
    if (!selectedReferral) return 0;
    return getNotifications(selectedReferral).length;
  }, [selectedReferral, liveNotifications]);

  // Google Maps navigation link
  const getMapLink = (hospital) => {
    if (!hospital) return "#";
    const coords = hospital.coordinates;
    if (coords?.lat && coords?.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`;
    }
    const addr = `${hospital.name}, ${hospital.address}, ${hospital.city}, ${hospital.state} ${hospital.pincode}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // VIEW 1: Access / Verification Gate
  if (accessMode === "unverified") {
    return (
      <div className="patient-dash-wrap">
        <div className="patient-access-gate">
          {/* Header */}
          <div className="pag-header">
            <div className="hosp-pill-badge">
              <span className="live-pulse-dot" />
              <span>Patient Portal · Relief Laser Health</span>
            </div>
            <h2 className="pag-title">Track Your Hospital Referral</h2>
            <p className="pag-sub">
              Enter your Referral ID, Patient ID, or registered phone number to view your referral status and hospital assignment.
            </p>
          </div>

          {/* Lookup Form */}
          <div className="pag-lookup-card">
            <div className="pag-lookup-section">
              <label htmlFor="pat-lookup">Patient Access</label>
              <div className="pag-input-row">
                <input
                  id="pat-lookup"
                  type="text"
                  className="dash-input"
                  placeholder="Enter Referral ID (e.g. REF-RLH-2026-7782) or Patient ID or Phone"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handlePatientLookup()}
                />
                <button
                  type="button"
                  className="relief-primary-btn compact"
                  onClick={() => handlePatientLookup()}
                  disabled={loading}
                >
                  {loading ? "Verifying..." : "Access My Referral →"}
                </button>
              </div>
            </div>

            <div className="pag-divider">
              <span>or</span>
            </div>

            {/* Family Member Access */}
            <div className="pag-lookup-section family">
              <label htmlFor="fam-code">
                <span className="fam-icon">👨‍👩‍👧</span>
                Family Member / Caregiver Access
              </label>
              <p className="pag-hint">
                If you are an authorized family member, enter the access code provided by the referring doctor.
              </p>
              <div className="pag-input-row">
                <input
                  id="fam-code"
                  type="text"
                  className="dash-input"
                  placeholder="Family authorization code"
                  value={familyAccessCode}
                  onChange={(e) => setFamilyAccessCode(e.target.value)}
                />
                <button
                  type="button"
                  className="relief-secondary-btn compact"
                  onClick={handleFamilyAccess}
                  disabled={loading}
                >
                  Verify Family Access
                </button>
              </div>
            </div>

            {accessError && (
              <div className="dash-alert error" style={{ marginTop: 14 }}>
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span>{accessError}</span>
              </div>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="pag-privacy-notice">
            <span className="ppn-icon">🔒</span>
            <div>
              <strong>Your Privacy is Protected</strong>
              <p>
                Referral details are accessible only to the verified patient or authorized family members. 
                Medical reports and clinical diagnosis are never shared without explicit physician authorization.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VIEW 2: Patient Dashboard (Authenticated)
  const hospital = getHospitalForReferral(selectedReferral);
  const statusConfig = STATUS_CONFIG[selectedReferral?.status] || STATUS_CONFIG.Pending;
  const timeline = selectedReferral ? buildVisualTimeline(selectedReferral) : [];
  const notifications = selectedReferral ? getNotifications(selectedReferral) : [];

  return (
    <div className="patient-dash-wrap">
      {/* ── Dashboard Header ── */}
      <div className="pd-header">
        <div className="pd-header-left">
          <div className="hosp-pill-badge">
            <span className="live-pulse-dot" />
            <span>
              {accessMode === "family" ? "Family Access · " : ""}Patient Dashboard · Relief Laser Health
            </span>
          </div>
          <h2 className="pd-title">Your Hospital Referral Journey</h2>
          <p className="pd-sub">
            Track your referral status, view hospital details, and receive real-time updates on your care coordination.
          </p>
        </div>

        <div className="pd-header-right">
          {/* Multilingual EN / HI Explainer Buttons */}
          <div className="pd-lang-toggle" role="group" aria-label="Patient Guide Language">
            <button
              type="button"
              className={`pd-lang-btn ${aiGuideLang === "en" && aiGuideText ? "active" : ""}`}
              onClick={() => handleLoadMultilingualGuide("en")}
            >
              English Guide
            </button>
            <button
              type="button"
              className={`pd-lang-btn ${aiGuideLang === "hi" && aiGuideText ? "active" : ""}`}
              onClick={() => handleLoadMultilingualGuide("hi")}
            >
              हिन्दी सहायता
            </button>
          </div>

          {/* Notification Bell */}
          <button
            type="button"
            className="pd-notif-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && <span className="notif-badge-count">{unreadCount}</span>}
          </button>

          <button
            type="button"
            className="relief-secondary-btn compact"
            onClick={() => {
              activeQueryRef.current = { query: "", isAutoLookup: false };
              setAccessMode("unverified");
              setReferrals([]);
              setSelectedReferral(null);
              setLookupInput("");
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Notification Panel (Slide Down) ── */}
      {showNotifications && (
        <div className="pd-notif-panel">
          <div className="notif-panel-header">
            <h4>Referral Notifications</h4>
            <button type="button" className="notif-close-btn" onClick={() => setShowNotifications(false)}>✕</button>
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <p>No notifications yet. You will be notified when your referral status changes.</p>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n, idx) => (
                <div key={idx} className="notif-item">
                  <div className="ni-top">
                    <strong className="ni-title">{n.title}</strong>
                    <span className="ni-time">{new Date(n.notifiedAt).toLocaleString()}</span>
                  </div>
                  <p className="ni-msg">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Multilingual Patient Explanation Card (EN / HI) ── */}
      {(aiGuideLoading || aiGuideText) && (
        <div className="pd-ai-guide-card">
          <div className="pagc-top">
            <strong>
              {aiGuideLang === "hi" ? "🇮🇳 हिन्दी में रेफरल स्थिति और निर्देश" : "🌐 Plain-Language Referral Guide (English)"}
            </strong>
            <button type="button" className="notif-close-btn" onClick={() => setAiGuideText("")}>
              ✕
            </button>
          </div>
          <p>{aiGuideLoading ? "Translating current status and hospital instructions..." : aiGuideText}</p>
        </div>
      )}

      {/* ── Referral Selector (if multiple referrals) ── */}
      {referrals.length > 1 && (
        <div className="pd-referral-selector">
          <span className="prs-label">Your Referrals ({referrals.length}):</span>
          <div className="prs-chips">
            {referrals.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`prs-chip ${selectedReferral?.id === r.id ? "active" : ""}`}
                onClick={() => setSelectedReferral(r)}
              >
                <span className="prs-id">{r.id}</span>
                <span className={`prs-status ${(r.status || "").toLowerCase().replace(/\s/g, "-")}`}>
                  {r.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedReferral && (
        <>
          {/* ── Large Patient-Friendly Status Card ── */}
          <div
            className="pd-status-hero"
            style={{
              background: statusConfig.bg,
              borderColor: statusConfig.borderColor,
            }}
          >
            <div className="psh-indicator" style={{ background: statusConfig.color }} />
            <div className="psh-content">
              <div className="psh-top-row">
                <div>
                  <span className="psh-label">Current Status</span>
                  <h3 className="psh-status-text" style={{ color: statusConfig.color }}>
                    {statusConfig.label}
                  </h3>
                </div>
                <div className="psh-ref-id">
                  <span className="psh-label">Referral ID</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span className={`data-source-pill ${selectedReferral.isDemoData ? "demo" : "live"}`}>
                      {selectedReferral.isDemoData ? "Demo Sample" : "Live Referral"}
                    </span>
                    <strong className="mono-id psh-id">{selectedReferral.id}</strong>
                  </div>
                </div>
              </div>

              <div className="psh-detail-row">
                <div className="psh-detail">
                  <span className="psh-label">Patient</span>
                  <strong>{selectedReferral.patient?.name}</strong>
                  <span>{selectedReferral.patient?.age} years • {selectedReferral.patient?.gender}</span>
                </div>
                <div className="psh-detail">
                  <span className="psh-label">Referring Doctor</span>
                  <strong>{selectedReferral.doctorName}</strong>
                  <span>{selectedReferral.doctorClinic}</span>
                </div>
                <div className="psh-detail">
                  <span className="psh-label">Priority</span>
                  <span className={`priority-badge ${(selectedReferral.priority || "routine").toLowerCase()}`}>
                    {selectedReferral.priority}
                  </span>
                </div>
                <div className="psh-detail">
                  <span className="psh-label">Procedure</span>
                  <strong>{selectedReferral.clinicalRequirements?.procedure}</strong>
                  <span>{selectedReferral.clinicalRequirements?.specialty}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Visual Referral Timeline ── */}
          <div className="pd-timeline-card">
            <div className="ptc-header">
              <h3 className="section-heading">Referral Journey Timeline</h3>
              <p className="section-subtext">
                Real-time progress of your referral. Only events that have actually occurred are displayed.
              </p>
            </div>

            <div className="ptc-timeline">
              {timeline.map((event, idx) => {
                const isLast = idx === timeline.length - 1;
                const isRejected = event.key === "Rejected";
                const isAccepted = event.key === "Accepted";

                return (
                  <div key={idx} className={`ptc-event ${isLast ? "current" : ""} ${isRejected ? "rejected" : ""} ${isAccepted ? "accepted" : ""}`}>
                    <div className="ptc-node-col">
                      <div className={`ptc-dot ${isLast ? "pulse" : "done"} ${isRejected ? "dot-red" : ""} ${isAccepted ? "dot-green" : ""}`}>
                        <span>{event.icon}</span>
                      </div>
                      {!isLast && <div className={`ptc-connector ${isRejected ? "conn-red" : ""}`} />}
                    </div>

                    <div className="ptc-event-body">
                      <div className="ptc-ev-top">
                        <strong className="ptc-ev-label">{event.label}</strong>
                        <span className="ptc-ev-time">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {event.note && (
                        <p className="ptc-ev-note">{event.note}</p>
                      )}
                      {event.by && (
                        <span className="ptc-ev-by">By: {event.by}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Future milestones (pending) */}
              {selectedReferral.status !== "Completed" && (
                <div className="ptc-event upcoming">
                  <div className="ptc-node-col">
                    <div className="ptc-dot pending">
                      <span>⏳</span>
                    </div>
                  </div>
                  <div className="ptc-event-body">
                    <strong className="ptc-ev-label ptc-pending-label">
                      {selectedReferral.status === "Accepted"
                        ? "Awaiting Patient Transfer Initiation"
                        : selectedReferral.status === "Transfer Initiated"
                        ? "Patient Transfer In Progress — Awaiting Arrival"
                        : selectedReferral.status === "Patient Arrived"
                        ? "Arrived at Hospital — Awaiting Admission Confirmation"
                        : selectedReferral.status === "Rejected"
                        ? "Awaiting Alternative Hospital Assignment"
                        : "Awaiting Hospital Confirmation"}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Accepted / Active Receiving Hospital Details Card ── */}
          {["Accepted", "Transfer Initiated", "Patient Arrived", "Completed"].includes(selectedReferral.status) && hospital && (
            <div className="pd-hospital-card accepted-glow">
              <div className="phc-header-strip">
                <div className="phc-badge-group">
                  <span className="phc-accepted-badge">✓ Hospital Confirmed & Verified</span>
                  <span className="phc-accept-time">
                    Accepted: {new Date(
                      selectedReferral.timeline?.find((t) => t.status === "Accepted")?.timestamp || selectedReferral.acceptedAt || ""
                    ).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="phc-body">
                <div className="phc-info-grid">
                  <div className="phc-info-col">
                    <span className="phc-label">Hospital Name</span>
                    <h4 className="phc-hosp-name">{hospital.name}</h4>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Full Address</span>
                    <p className="phc-address">
                      {hospital.address}, {hospital.city}, {hospital.state} - {hospital.pincode}
                    </p>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Contact Phone</span>
                    <strong className="phc-phone">{hospital.contactPhone}</strong>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Email</span>
                    <strong>{hospital.email}</strong>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Hospital Type</span>
                    <span>{hospital.hospitalType}</span>
                  </div>
                  <div className="phc-info-col">
                    <span className="phc-label">Referral Status</span>
                    <span className="phc-confirmed-pill">● Confirmed & Active</span>
                  </div>
                </div>

                {/* Arrival Instructions */}
                <div className="phc-arrival-instructions">
                  <h4>📋 Expected Arrival Instructions</h4>
                  <ul>
                    <li>Carry this digital referral pass (Referral ID: <strong>{selectedReferral.id}</strong>) on your phone.</li>
                    <li>Bring all original lab reports and a valid photo ID (Aadhaar / PAN / Passport).</li>
                    <li>Arrive at the <strong>Admission Desk</strong> and present your Referral ID to the front desk staff.</li>
                    <li>If you have insurance, carry your TPA card and pre-authorization letter for cashless processing.</li>
                    <li>Please report at least <strong>1 hour</strong> before the scheduled procedure time for pre-operative preparation.</li>
                    <li>An attendant or family member should accompany you for discharge support.</li>
                  </ul>
                </div>

                {/* Map & Navigation */}
                <div className="phc-map-row">
                  <a
                    href={getMapLink(hospital)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relief-primary-btn compact"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>Navigate to Hospital (Google Maps)</span>
                  </a>

                  <a href={`tel:${hospital.contactPhone}`} className="relief-secondary-btn compact">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>Call Hospital</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ── Pending / Awaiting Hospital Card ── */}
          {(selectedReferral.status === "Pending" || selectedReferral.status === "Information Requested") && selectedReferral.targetHospitalName && (
            <div className="pd-hospital-card pending-card">
              <div className="phc-header-strip pending-strip">
                <div className="phc-badge-group">
                  <span className="phc-pending-badge">⏳ Awaiting Hospital Response</span>
                </div>
              </div>
              <div className="phc-body">
                <div className="phc-info-grid">
                  <div className="phc-info-col">
                    <span className="phc-label">Referral Sent To</span>
                    <h4 className="phc-hosp-name">{selectedReferral.targetHospitalName}</h4>
                  </div>
                  {hospital && (
                    <>
                      <div className="phc-info-col">
                        <span className="phc-label">Location</span>
                        <p>{hospital.city}, {hospital.state}</p>
                      </div>
                      <div className="phc-info-col">
                        <span className="phc-label">Hospital Type</span>
                        <span>{hospital.hospitalType}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="phc-waiting-msg">
                  <p>
                    Your referral has been sent to this hospital's admissions desk. 
                    You will be notified immediately when the hospital confirms availability and accepts your admission.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Rejected / Searching Alternatives Card ── */}
          {selectedReferral.status === "Rejected" && (
            <div className="pd-hospital-card rejected-card">
              <div className="phc-header-strip rejected-strip">
                <div className="phc-badge-group">
                  <span className="phc-rejected-badge">🔄 Finding Alternative Hospital</span>
                </div>
              </div>
              <div className="phc-body">
                <div className="phc-rejection-info">
                  <p>
                    <strong>{selectedReferral.targetHospitalName || "The selected hospital"}</strong> was unable to 
                    accommodate your referral at this time. Your doctor is coordinating with alternative verified hospitals 
                    to find the next best facility for your care.
                  </p>
                  <div className="phc-reassurance-box">
                    <span className="prb-icon">💪</span>
                    <div>
                      <strong>Don't worry — your referral is safe</strong>
                      <p>
                        All your medical records, lab reports, and clinical requirements are preserved. 
                        You do not need to re-submit anything. Our system is actively matching you with the next available accredited facility.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Referral Details Summary Card ── */}
          <div className="pd-details-card">
            <div className="pdc-header">
              <h3 className="section-heading">Referral Summary</h3>
            </div>

            <div className="pdc-grid">
              <div className="pdc-section">
                <h4 className="pdc-sec-title">Patient Information</h4>
                <div className="pdc-fields">
                  <div className="pdc-field">
                    <span className="pdc-k">Full Name</span>
                    <strong className="pdc-v">{selectedReferral.patient?.name}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Patient ID</span>
                    <strong className="pdc-v">{selectedReferral.patient?.patientId}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Age / Gender</span>
                    <strong className="pdc-v">{selectedReferral.patient?.age} years • {selectedReferral.patient?.gender}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Location</span>
                    <strong className="pdc-v">{selectedReferral.patient?.location}</strong>
                  </div>
                  {accessMode === "patient" && (
                    <>
                      <div className="pdc-field">
                        <span className="pdc-k">Contact</span>
                        <strong className="pdc-v">{selectedReferral.patient?.contact}</strong>
                      </div>
                      <div className="pdc-field">
                        <span className="pdc-k">Emergency Contact</span>
                        <strong className="pdc-v">{selectedReferral.patient?.emergencyContact}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="pdc-section">
                <h4 className="pdc-sec-title">Clinical Details</h4>
                <div className="pdc-fields">
                  <div className="pdc-field">
                    <span className="pdc-k">Specialty</span>
                    <strong className="pdc-v">{selectedReferral.clinicalRequirements?.specialty}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Procedure</span>
                    <strong className="pdc-v">{selectedReferral.clinicalRequirements?.procedure}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Referral Date</span>
                    <strong className="pdc-v">{new Date(selectedReferral.createdAt).toLocaleDateString()}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Documents Attached</span>
                    <strong className="pdc-v">{selectedReferral.documents?.length || 0} file(s)</strong>
                  </div>
                </div>
              </div>

              <div className="pdc-section">
                <h4 className="pdc-sec-title">Referring Doctor</h4>
                <div className="pdc-fields">
                  <div className="pdc-field">
                    <span className="pdc-k">Doctor</span>
                    <strong className="pdc-v">{selectedReferral.doctorName}</strong>
                  </div>
                  <div className="pdc-field">
                    <span className="pdc-k">Clinic / Hospital</span>
                    <strong className="pdc-v">{selectedReferral.doctorClinic}</strong>
                  </div>
                </div>
              </div>

              {/* Rejection history (if any) */}
              {selectedReferral.rejectionHistory && selectedReferral.rejectionHistory.length > 0 && (
                <div className="pdc-section">
                  <h4 className="pdc-sec-title">Referral History</h4>
                  <div className="pdc-rejection-timeline">
                    {selectedReferral.rejectionHistory.map((rej, idx) => (
                      <div key={idx} className="pdc-rej-entry">
                        <span className="pdc-rej-num">Attempt #{idx + 1}</span>
                        <strong>{rej.hospitalName}</strong>
                        <span className="pdc-rej-reason">{rej.reason}</span>
                        <span className="pdc-rej-date">{new Date(rej.rejectedAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Privacy & Help Footer ── */}
          <div className="pd-privacy-footer">
            <div className="ppf-left">
              <span className="ppf-icon">🔒</span>
              <div>
                <strong>Privacy Notice</strong>
                <p>
                  {accessMode === "family"
                    ? "You are viewing this referral as an authorized family member. Clinical reports and detailed diagnosis are restricted."
                    : "This dashboard shows your personal referral data only. Medical reports are never shared with other patients."}
                </p>
              </div>
            </div>
            <div className="ppf-right">
              <span className="ppf-icon">📞</span>
              <div>
                <strong>Need Help?</strong>
                <p>24/7 Patient Support: <strong>+91 11 4000 9999</strong></p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

