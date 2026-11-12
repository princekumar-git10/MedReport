import { useState, useEffect, useMemo } from "react";
import {
  getHospitals,
  subscribeToHospitals,
  verifyHospitalByAdmin,
  getAdminAuditLogs,
  appendAdminAuditLog,
} from "../services/hospitalService.js";
import {
  getReferrals,
  subscribeToReferrals,
  sweepExpiredCapacityHolds,
} from "../services/referralService.js";
import {
  subscribeToNotifications,
  getNotifications,
} from "../services/notificationService.js";

/**
 * Super Admin Governance & Monitoring Dashboard
 * Route: /relief-laser-health/admin
 *
 * Security & Privacy:
 * - Least-privilege monitoring: hides private patient clinical notes & uploaded medical document bodies.
 * - Audits all hospital approval, rejection, suspension, and compliance review actions.
 */
const STALE_CAPACITY_HOURS = 24;

export default function SuperAdminDashboard({ userEmail }) {
  const [hospitals, setHospitals] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("hospitals"); // "hospitals" | "referrals" | "analytics" | "audit"
  const [hospFilter, setHospFilter] = useState("all");
  const [refFilter, setRefFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [expandedReferralId, setExpandedReferralId] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [actionFeedback, setActionFeedback] = useState(null);

  const adminActor = {
    name: userEmail ? `Admin (${userEmail.split("@")[0]})` : "Platform Super Admin",
    email: userEmail || "superadmin@relieflaser.health",
  };

  useEffect(() => {
    sweepExpiredCapacityHolds().catch(() => {});
    getHospitals().then(setHospitals).catch(() => {});
    getReferrals().then(setReferrals).catch(() => {});
    getNotifications().then(setNotifications).catch(() => {});
    setAuditLogs(getAdminAuditLogs());

    const unsubHosp = subscribeToHospitals(setHospitals);
    const unsubRefs = subscribeToReferrals(setReferrals);
    const unsubNotif = subscribeToNotifications(setNotifications);

    return () => {
      if (typeof unsubHosp === "function") unsubHosp();
      if (typeof unsubRefs === "function") unsubRefs();
      if (typeof unsubNotif === "function") unsubNotif();
    };
  }, []);

  const getHospitalStanding = (h) =>
    h.verificationStatus || (h.isDemoData ? "Verified" : "Pending Verification");

  const isCapacityStale = (h) => {
    if (!h?.lastUpdatedAt) return true;
    const hoursOld = (Date.now() - new Date(h.lastUpdatedAt).getTime()) / (1000 * 60 * 60);
    return hoursOld > STALE_CAPACITY_HOURS || !h.confirmedByHospital;
  };

  // Compute Dashboard Metrics
  const metrics = useMemo(() => {
    const verifiedHospitals = hospitals.filter((h) => getHospitalStanding(h) === "Verified").length;
    const pendingHospitals = hospitals.filter((h) => getHospitalStanding(h) === "Pending Verification").length;
    const suspendedHospitals = hospitals.filter((h) => getHospitalStanding(h) === "Suspended").length;
    const staleHospitals = hospitals.filter(isCapacityStale).length;

    const activeStatuses = new Set(["Created", "Pending", "Information Requested", "Accepted", "Transfer Initiated", "Patient Arrived", "Escalated"]);
    const awaitingStatuses = new Set(["Created", "Pending", "Information Requested"]);
    const acceptedStatuses = new Set(["Accepted", "Transfer Initiated", "Patient Arrived"]);

    return {
      totalHospitals: hospitals.length,
      verifiedHospitals,
      pendingHospitals,
      suspendedHospitals,
      staleHospitals,
      activeReferrals: referrals.filter((r) => activeStatuses.has(r.status)).length,
      acceptedReferrals: referrals.filter((r) => acceptedStatuses.has(r.status)).length,
      rejectedReferrals: referrals.filter((r) => r.status === "Rejected").length,
      awaitingConfirmation: referrals.filter((r) => awaitingStatuses.has(r.status)).length,
      completedReferrals: referrals.filter((r) => r.status === "Completed").length,
    };
  }, [hospitals, referrals]);

  // Repeated rejection detector per hospital
  const hospitalRejectionCounts = useMemo(() => {
    const counts = {};
    for (const r of referrals) {
      for (const rej of r.rejectionHistory || []) {
        if (rej.hospitalId) {
          counts[rej.hospitalId] = (counts[rej.hospitalId] || 0) + 1;
        }
      }
      if (r.status === "Rejected" && r.targetHospitalId) {
        counts[r.targetHospitalId] = counts[r.targetHospitalId] || 1;
      }
    }
    return counts;
  }, [referrals]);

  const filteredHospitals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hospitals.filter((h) => {
      const standing = getHospitalStanding(h);
      if (hospFilter === "verified" && standing !== "Verified") return false;
      if (hospFilter === "pending" && standing !== "Pending Verification") return false;
      if (hospFilter === "suspended" && standing !== "Suspended" && standing !== "Rejected") return false;
      if (hospFilter === "stale" && !isCapacityStale(h)) return false;
      if (!q) return true;
      return (
        (h.name || "").toLowerCase().includes(q) ||
        (h.id || "").toLowerCase().includes(q) ||
        (h.regNumber || "").toLowerCase().includes(q) ||
        (h.city || "").toLowerCase().includes(q)
      );
    });
  }, [hospitals, hospFilter, searchQuery]);

  const filteredReferrals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return referrals.filter((r) => {
      if (refFilter === "unresolved" && !["Created", "Pending", "Information Requested", "Rejected", "Escalated"].includes(r.status)) {
        return false;
      }
      if (refFilter === "rejected" && r.status !== "Rejected" && !(r.rejectionHistory?.length > 0)) {
        return false;
      }
      if (refFilter === "redirected" && !r.redirectionAttemptCount && !(r.rejectedHospitalIds?.length > 0)) {
        return false;
      }
      if (!q) return true;
      return (
        (r.id || "").toLowerCase().includes(q) ||
        (r.patient?.patientId || "").toLowerCase().includes(q) ||
        (r.targetHospitalName || "").toLowerCase().includes(q) ||
        (r.clinicalRequirements?.specialty || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q)
      );
    });
  }, [referrals, refFilter, searchQuery]);

  const selectedHospital = useMemo(
    () => hospitals.find((h) => h.id === selectedHospitalId) || null,
    [hospitals, selectedHospitalId]
  );

  const handleHospitalDecision = async (hospital, decision) => {
    const notes = decisionNote.trim();
    if ((decision === "Rejected" || decision === "Suspended") && !notes) {
      setActionFeedback({
        type: "error",
        message: `Please enter a short audit reason before marking ${hospital.name} as ${decision}.`,
      });
      return;
    }

    try {
      const updated = await verifyHospitalByAdmin(hospital.id, {
        decision,
        adminName: adminActor.name,
        adminEmail: adminActor.email,
        notes: notes || `Admin reviewed and set standing to ${decision}`,
      });
      setAuditLogs(getAdminAuditLogs());
      setDecisionNote("");
      setActionFeedback({
        type: "success",
        message: `${updated.name} standing updated to "${updated.verificationStatus}" and recorded in audit trail.`,
      });
    } catch (err) {
      setActionFeedback({ type: "error", message: err.message });
    }
  };

  const handleInspectReferralMetadata = (ref) => {
    const nextOpen = expandedReferralId === ref.id ? "" : ref.id;
    setExpandedReferralId(nextOpen);
    if (nextOpen) {
      appendAdminAuditLog({
        actionType: "ADMIN_REFERRAL_METADATA_VIEW",
        targetType: "referral",
        targetId: ref.id,
        targetName: `Patient Ref ${ref.patient?.patientId || "Redacted"}`,
        actorName: adminActor.name,
        actorEmail: adminActor.email,
        notes: "Reviewed least-privilege coordination metadata & alternative attempts (clinical files redacted).",
      });
      setAuditLogs(getAdminAuditLogs());
      setActionFeedback({
        type: "success",
        message: `Audited metadata review for ${ref.id}. Clinical documents remain restricted to treating clinicians.`,
      });
    }
  };

  // Analytics aggregations across all 6 requested KPIs
  const analyticsData = useMemo(() => {
    const total = referrals.length;
    const acceptedOrBeyondSet = new Set(["Accepted", "Transfer Initiated", "Patient Arrived", "Completed"]);
    const successCount = referrals.filter((r) => acceptedOrBeyondSet.has(r.status)).length;
    const completedCount = referrals.filter((r) => r.status === "Completed").length;

    const referralSuccessRate = total > 0 ? Math.round((successCount / total) * 100) : 0;
    const referralCompletionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    // 1. Coordination Status Funnel
    const statusOrder = ["Created", "Pending", "Information Requested", "Accepted", "Transfer Initiated", "Patient Arrived", "Completed", "Rejected", "Escalated"];
    const statusBars = statusOrder.map((st) => {
      const count = referrals.filter((r) => r.status === st).length;
      return { status: st, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 };
    });

    // 2. Per-Hospital Acceptance Rate
    const hospitalAcceptance = hospitals.map((h) => {
      const accepted = h.acceptedReferrals || 0;
      const rejected = Math.max(h.rejectedReferrals || 0, hospitalRejectionCounts[h.id] || 0);
      const denom = accepted + rejected;
      const rate = denom > 0 ? Math.round((accepted / denom) * 100) : null;
      return { id: h.id, name: h.name, accepted, rejected, rate };
    });

    // 3. Referral Response Time (actual elapsed ms from Created/Pending to first decision)
    const responseSamplesMins = [];
    for (const r of referrals) {
      const tl = r.timeline || [];
      const startEv = tl.find((e) => e.status === "Pending") || tl.find((e) => e.status === "Created");
      const respEv = tl.find((e) => ["Accepted", "Rejected", "Information Requested"].includes(e.status));
      if (startEv?.timestamp && respEv?.timestamp) {
        const diffMins = Math.max(1, Math.round((new Date(respEv.timestamp) - new Date(startEv.timestamp)) / 60000));
        if (Number.isFinite(diffMins)) {
          responseSamplesMins.push({ referralId: r.id, mins: diffMins });
        }
      }
    }
    const avgResponseMins = responseSamplesMins.length > 0
      ? Math.round(responseSamplesMins.reduce((acc, s) => acc + s.mins, 0) / responseSamplesMins.length)
      : null;
    const responseBuckets = [
      { label: "< 15 mins (Fast)", count: responseSamplesMins.filter((s) => s.mins < 15).length },
      { label: "15–60 mins (Standard)", count: responseSamplesMins.filter((s) => s.mins >= 15 && s.mins <= 60).length },
      { label: "> 60 mins (Delayed)", count: responseSamplesMins.filter((s) => s.mins > 60).length },
    ];

    // 4. Rejection Reasons Distribution
    const reasonMap = {};
    for (const r of referrals) {
      const hist = r.rejectionHistory || [];
      if (hist.length > 0) {
        for (const h of hist) {
          const reason = h.reason || "Unspecified";
          reasonMap[reason] = (reasonMap[reason] || 0) + 1;
        }
      } else if (r.status === "Rejected" && r.rejectionReason) {
        reasonMap[r.rejectionReason] = (reasonMap[r.rejectionReason] || 0) + 1;
      }
    }
    const totalRejections = Object.values(reasonMap).reduce((a, b) => a + b, 0);
    const rejectionReasons = Object.entries(reasonMap)
      .map(([reason, count]) => ({
        reason,
        count,
        pct: totalRejections > 0 ? Math.round((count / totalRejections) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      successCount,
      completedCount,
      referralSuccessRate,
      referralCompletionRate,
      statusBars,
      hospitalAcceptance,
      responseSamplesCount: responseSamplesMins.length,
      avgResponseMins,
      responseBuckets,
      rejectionReasons,
      totalRejections,
    };
  }, [referrals, hospitals, hospitalRejectionCounts]);

  return (
    <div className="admin-dash-wrap">
      {/* Header */}
      <div className="admin-header-bar">
        <div>
          <div className="hosp-pill-badge">
            <span className="live-pulse-dot" />
            <span>Route: /relief-laser-health/admin · Governance &amp; Network Operations</span>
          </div>
          <h2 className="admin-title">Super Admin Network &amp; Coordination Console</h2>
          <p className="admin-sub">
            Manage hospital verifications, audit capacity freshness, monitor referral escalations, and review platform coordination telemetry.
          </p>
        </div>

        <div className="admin-privacy-pill" title="Admins never have unrestricted access to raw patient diagnostic files.">
          🔒 Least-Privilege Mode Active · Clinical Reports Redacted
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div className={`admin-feedback-banner ${actionFeedback.type}`}>
          <span>{actionFeedback.message}</span>
          <button type="button" onClick={() => setActionFeedback(null)}>✕</button>
        </div>
      )}

      {/* 8 Requested Dashboard KPI Metrics */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span className="akc-label">Total Hospitals</span>
          <strong className="akc-val">{metrics.totalHospitals}</strong>
          <span className="akc-sub">{metrics.staleHospitals} outdated (&gt;24h)</span>
        </div>
        <div className="admin-kpi-card green">
          <span className="akc-label">Verified Hospitals</span>
          <strong className="akc-val">{metrics.verifiedHospitals}</strong>
          <span className="akc-sub">Active in matching</span>
        </div>
        <div className="admin-kpi-card amber">
          <span className="akc-label">Pending Verifications</span>
          <strong className="akc-val">{metrics.pendingHospitals}</strong>
          <span className="akc-sub">{metrics.suspendedHospitals} suspended</span>
        </div>
        <div className="admin-kpi-card blue">
          <span className="akc-label">Active Referrals</span>
          <strong className="akc-val">{metrics.activeReferrals}</strong>
          <span className="akc-sub">In coordination</span>
        </div>
        <div className="admin-kpi-card teal">
          <span className="akc-label">Accepted Referrals</span>
          <strong className="akc-val">{metrics.acceptedReferrals}</strong>
          <span className="akc-sub">Hospital confirmed</span>
        </div>
        <div className="admin-kpi-card red">
          <span className="akc-label">Rejected Referrals</span>
          <strong className="akc-val">{metrics.rejectedReferrals}</strong>
          <span className="akc-sub">Needs re-matching</span>
        </div>
        <div className="admin-kpi-card purple">
          <span className="akc-label">Awaiting Confirmation</span>
          <strong className="akc-val">{metrics.awaitingConfirmation}</strong>
          <span className="akc-sub">Pending / Info req</span>
        </div>
        <div className="admin-kpi-card emerald">
          <span className="akc-label">Completed Referrals</span>
          <strong className="akc-val">{metrics.completedReferrals}</strong>
          <span className="akc-sub">Admitted / closed</span>
        </div>
      </div>

      {/* Navigation Tabs + Search */}
      <div className="admin-controls-bar">
        <div className="admin-tab-group">
          {[
            { id: "hospitals", label: `🏥 Hospitals (${hospitals.length})` },
            { id: "referrals", label: `📋 Referral Monitoring (${referrals.length})` },
            { id: "analytics", label: "📊 Network Analytics" },
            { id: "audit", label: `🛡️ Audit Trail (${auditLogs.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="dash-input admin-search-input"
          placeholder="Search hospitals, reg #, referral IDs, cities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ── TAB 1: HOSPITAL MANAGEMENT ── */}
      {activeTab === "hospitals" && (
        <div className="admin-panel-section">
          <div className="admin-filter-row">
            {[
              { id: "all", label: "All Hospitals" },
              { id: "pending", label: `Pending Review (${metrics.pendingHospitals})` },
              { id: "verified", label: `Verified (${metrics.verifiedHospitals})` },
              { id: "suspended", label: `Suspended/Rejected (${metrics.suspendedHospitals})` },
              { id: "stale", label: `Outdated Capacity (${metrics.staleHospitals})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`admin-chip-btn ${hospFilter === f.id ? "active" : ""}`}
                onClick={() => setHospFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="admin-hosp-grid">
            {filteredHospitals.map((h) => {
              const standing = getHospitalStanding(h);
              const stale = isCapacityStale(h);
              const rejCount = hospitalRejectionCounts[h.id] || 0;

              return (
                <div key={h.id} className={`admin-hosp-card standing-${standing.toLowerCase().replace(/\s+/g, "-")}`}>
                  <div className="ahc-top">
                    <div>
                      <div className="ahc-badges">
                        <span className={`data-source-pill ${h.isDemoData ? "demo" : "live"}`}>
                          {h.isDemoData ? "Demo Sample" : "Live Hospital"}
                        </span>
                        <span className={`ahc-standing-pill ${standing.toLowerCase().replace(/\s+/g, "-")}`}>
                          {standing}
                        </span>
                        {stale && <span className="ahc-stale-pill">⚠ Stale Telemetry (&gt;24h)</span>}
                        {rejCount >= 2 && <span className="ahc-warn-pill">⚠ {rejCount} Rejections</span>}
                      </div>
                      <h3 className="ahc-name">{h.name}</h3>
                      <span className="ahc-meta">
                        ID: <strong className="mono-id">{h.id}</strong> · Reg: <strong>{h.regNumber || "Unlisted"}</strong> · {h.city}, {h.state}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="relief-secondary-btn compact"
                      onClick={() => setSelectedHospitalId(selectedHospitalId === h.id ? "" : h.id)}
                    >
                      {selectedHospitalId === h.id ? "Hide Details" : "Inspect & Verify"}
                    </button>
                  </div>

                  <div className="ahc-stats-strip">
                    <span>General Beds: <strong>{h.availableBeds ?? 0}/{h.generalBedCapacity ?? 0}</strong></span>
                    <span>ICU Open: <strong>{h.icuFacilities?.availableBeds ?? 0}/{h.icuBedCapacity ?? 0}</strong></span>
                    <span>Emergency: <strong>{h.availableEmergencyBeds ?? 0}</strong></span>
                    <span>Updated: <strong>{h.lastUpdatedAt ? new Date(h.lastUpdatedAt).toLocaleString() : "Never"}</strong></span>
                  </div>

                  {selectedHospital?.id === h.id && (
                    <div className="ahc-inspect-drawer">
                      <div className="aid-grid">
                        <div>
                          <span className="aid-label">Departments</span>
                          <p>{(h.departments || []).join(", ") || "None listed"}</p>
                        </div>
                        <div>
                          <span className="aid-label">Supported Treatments</span>
                          <p>{(h.availableTreatments || []).join(", ") || "None listed"}</p>
                        </div>
                        <div>
                          <span className="aid-label">Medical Equipment</span>
                          <p>{(h.medicalEquipment || []).join(", ") || "None listed"}</p>
                        </div>
                        <div>
                          <span className="aid-label">Authorized Staff Contacts</span>
                          <p>{(h.authorizedStaff || [h.email]).filter(Boolean).join(", ")}</p>
                        </div>
                      </div>

                      {/* Availability Update History */}
                      <div className="aid-history">
                        <strong>Availability &amp; Governance History</strong>
                        {!h.availabilityHistory || h.availabilityHistory.length === 0 ? (
                          <p className="aid-empty">No recent update events logged on this hospital record.</p>
                        ) : (
                          <ul>
                            {h.availabilityHistory.slice(0, 6).map((ev, i) => (
                              <li key={i}>
                                <span>{new Date(ev.timestamp).toLocaleString()}</span>
                                <strong>{ev.by}</strong>
                                <span>{ev.action}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Admin Decision Controls */}
                      <div className="aid-decision-box">
                        <input
                          type="text"
                          className="dash-input"
                          placeholder="Verification note or suspension reason (required for Reject / Suspend)..."
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                        />
                        <div className="aid-action-row">
                          <button
                            type="button"
                            className="action-btn-accept"
                            onClick={() => handleHospitalDecision(h, "Verified")}
                          >
                            ✓ Approve / Verify Hospital
                          </button>
                          <button
                            type="button"
                            className="action-btn-info"
                            onClick={() => handleHospitalDecision(h, "Rejected")}
                          >
                            ✕ Reject Registration
                          </button>
                          <button
                            type="button"
                            className="action-btn-reject"
                            onClick={() => handleHospitalDecision(h, standing === "Suspended" ? "Verified" : "Suspended")}
                          >
                            {standing === "Suspended" ? "↺ Reactivate Account" : "⛔ Suspend Unauthorized/Fraudulent"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: REFERRAL MONITORING ── */}
      {activeTab === "referrals" && (
        <div className="admin-panel-section">
          <div className="admin-filter-row">
            {[
              { id: "all", label: "All Referrals" },
              { id: "unresolved", label: "Unresolved / Escalated" },
              { id: "rejected", label: "Rejected / With Rejections" },
              { id: "redirected", label: "Alternative Attempts" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`admin-chip-btn ${refFilter === f.id ? "active" : ""}`}
                onClick={() => setRefFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Repeated Rejections Watchlist Alert */}
          {Object.entries(hospitalRejectionCounts).some(([, cnt]) => cnt >= 2) && (
            <div className="admin-feedback-banner error" style={{ marginBottom: "12px" }}>
              <span>
                ⚠ Repeated Hospital Rejections Detected:{" "}
                {Object.entries(hospitalRejectionCounts)
                  .filter(([, cnt]) => cnt >= 2)
                  .map(([hId, cnt]) => {
                    const hName = hospitals.find((h) => h.id === hId)?.name || hId;
                    return `${hName} (${cnt} rejections)`;
                  })
                  .join(", ")}
              </span>
            </div>
          )}

          <div className="admin-ref-list">
            {filteredReferrals.map((r) => {
              const targetHosp = hospitals.find((h) => h.id === r.targetHospitalId);
              const outdatedTarget = targetHosp ? isCapacityStale(targetHosp) : false;
              const altAttempts = r.redirectionAttemptCount || r.rejectedHospitalIds?.length || 0;
              const isExpanded = expandedReferralId === r.id;

              return (
                <div key={r.id} className="admin-ref-row">
                  <div className="arr-main">
                    <div className="arr-badges">
                      <strong className="mono-id">{r.id}</strong>
                      <span className={`data-source-pill ${r.isDemoData ? "demo" : "live"}`}>
                        {r.isDemoData ? "Demo Sample" : "Live Referral"}
                      </span>
                      <span className={`status-pill-sm ${(r.status || "").toLowerCase().replace(/\s+/g, "-")}`}>
                        {r.status}
                      </span>
                      <span className={`priority-badge ${(r.priority || "routine").toLowerCase()}`}>
                        {r.priority}
                      </span>
                      {altAttempts > 0 && (
                        <span className="ahc-warn-pill">🔄 {altAttempts} Alternative Attempt(s)</span>
                      )}
                      {outdatedTarget && (
                        <span className="ahc-stale-pill">⚠ Target Hospital Telemetry Outdated</span>
                      )}
                    </div>

                    <div className="arr-meta-grid">
                      <span>Patient Ref: <strong>{r.patient?.patientId || "ID Redacted"}</strong></span>
                      <span>Specialty: <strong>{r.clinicalRequirements?.specialty}</strong></span>
                      <span>Hospital: <strong>{r.targetHospitalName || "Unassigned"}</strong></span>
                      <span>Referring Doctor: <strong>{r.doctorName}</strong></span>
                      <span>Bed Hold: <strong>{r.capacityHold?.held && r.capacityHold?.status === "Active" ? `Active (${r.capacityHold.status})` : r.capacityHold?.releaseReason || r.capacityHold?.status || "None"}</strong></span>
                      <span>Medical Reports: <em>🔒 {r.documents?.length || 0} file(s) locked (Clinical Privacy Policy)</em></span>
                    </div>

                    {isExpanded && (
                      <div className="ahc-inspect-drawer" style={{ marginTop: "12px" }}>
                        <div className="aid-history">
                          <strong>Redacted Coordination &amp; Alternative Attempt Timeline</strong>
                          {(!r.rejectionHistory || r.rejectionHistory.length === 0) && (!r.timeline || r.timeline.length === 0) ? (
                            <p className="aid-empty">No coordination transitions recorded yet.</p>
                          ) : (
                            <ul>
                              {(r.rejectionHistory || []).map((rej, idx) => (
                                <li key={`rej-${idx}`}>
                                  <span>{new Date(rej.rejectedAt).toLocaleString()}</span>
                                  <strong>Declined by {rej.hospitalName || rej.hospitalId}</strong>
                                  <span>Reason: {rej.reason}</span>
                                </li>
                              ))}
                              {(r.timeline || []).map((ev, idx) => (
                                <li key={`tl-${idx}`}>
                                  <span>{new Date(ev.timestamp).toLocaleString()}</span>
                                  <strong>{ev.status}</strong>
                                  <span>By {ev.by} (clinical diagnosis notes hidden under admin least-privilege)</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="relief-secondary-btn compact"
                    onClick={() => handleInspectReferralMetadata(r)}
                  >
                    {isExpanded ? "Hide Audit View" : "Audit & Attempts"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: VISUAL ANALYTICS (6 Core Platform Charts) ── */}
      {activeTab === "analytics" && (
        <div className="admin-analytics-grid">
          {/* Chart 1: Referral Success Rate */}
          <div className="admin-chart-card">
            <h3>1. Referral Success Rate</h3>
            <p className="chart-sub">Accepted / Active Transfer / Admitted referrals vs total network referrals</p>
            <div className="analytics-gauge-row">
              <div className="gauge-circle">
                <strong>{analyticsData.referralSuccessRate}%</strong>
                <span>Success</span>
              </div>
              <div className="gauge-meta-list">
                <span>Successful Placements: <strong>{analyticsData.successCount} / {analyticsData.total}</strong></span>
                <span>Pending Confirmation: <strong>{metrics.awaitingConfirmation}</strong></span>
                <span>Currently Rejected: <strong>{metrics.rejectedReferrals}</strong></span>
              </div>
            </div>
          </div>

          {/* Chart 2: Referral Completion Rate */}
          <div className="admin-chart-card">
            <h3>2. Referral Completion Rate &amp; Status Funnel</h3>
            <p className="chart-sub">End-to-end admission completions ({analyticsData.referralCompletionRate}% completed across {analyticsData.total} referrals)</p>
            <div className="chart-bars">
              {analyticsData.statusBars.map((row) => (
                <div key={row.status} className="cbar-row">
                  <span className="cbar-label">{row.status}</span>
                  <div className="cbar-track">
                    <div
                      className={`cbar-fill st-${row.status.toLowerCase().replace(/\s+/g, "-")}`}
                      style={{ width: `${Math.max(row.pct, row.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="cbar-val">{row.count} ({row.pct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 3: Hospital Acceptance Rate */}
          <div className="admin-chart-card">
            <h3>3. Hospital Acceptance Rate</h3>
            <p className="chart-sub">Accepted vs declined decisions per participating medical center</p>
            <div className="chart-bars">
              {analyticsData.hospitalAcceptance.map((h) => (
                <div key={h.id} className="hosp-util-block">
                  <div className="hub-top">
                    <strong>{h.name}</strong>
                    <span>
                      {h.rate !== null ? `${h.rate}% accepted (${h.accepted} acc / ${h.rejected} rej)` : "No decisions yet"}
                    </span>
                  </div>
                  <div className="cbar-track">
                    <div
                      className="cbar-fill st-accepted"
                      style={{ width: `${h.rate !== null ? Math.max(h.rate, 6) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 4: Referral Response Time */}
          <div className="admin-chart-card">
            <h3>4. Referral Response Time</h3>
            <p className="chart-sub">
              {analyticsData.avgResponseMins !== null
                ? `Mean hospital response latency: ${analyticsData.avgResponseMins} mins across ${analyticsData.responseSamplesCount} timestamped decisions`
                : "No timestamped hospital decision pairs recorded yet"}
            </p>
            <div className="chart-bars">
              {analyticsData.responseBuckets.map((b) => {
                const pct = analyticsData.responseSamplesCount > 0
                  ? Math.round((b.count / analyticsData.responseSamplesCount) * 100)
                  : 0;
                return (
                  <div key={b.label} className="cbar-row">
                    <span className="cbar-label">{b.label}</span>
                    <div className="cbar-track">
                      <div className="cbar-fill" style={{ width: `${Math.max(pct, b.count > 0 ? 8 : 0)}%` }} />
                    </div>
                    <span className="cbar-val">{b.count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chart 5: Rejection Reasons */}
          <div className="admin-chart-card">
            <h3>5. Rejection Reasons Breakdown</h3>
            <p className="chart-sub">Root causes recorded across {analyticsData.totalRejections} hospital decline events</p>
            {analyticsData.rejectionReasons.length === 0 ? (
              <p className="aid-empty">No hospital rejections recorded yet.</p>
            ) : (
              <div className="chart-bars">
                {analyticsData.rejectionReasons.map((item) => (
                  <div key={item.reason} className="cbar-row">
                    <span className="cbar-label">{item.reason}</span>
                    <div className="cbar-track">
                      <div className="cbar-fill st-rejected" style={{ width: `${Math.max(item.pct, 8)}%` }} />
                    </div>
                    <span className="cbar-val">{item.count} ({item.pct}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chart 6: Hospital Capacity Trends */}
          <div className="admin-chart-card">
            <h3>6. Hospital Capacity Trends &amp; Open Ratios</h3>
            <p className="chart-sub">Current open general + ICU bed availability and recent update pulse counts</p>
            <div className="chart-bars">
              {hospitals.map((h) => {
                const cap = Math.max(h.generalBedCapacity || 1, 1);
                const availPct = Math.round(((h.availableBeds || 0) / cap) * 100);
                const updatesLogged = h.availabilityHistory?.length || 0;
                return (
                  <div key={h.id} className="hosp-util-block">
                    <div className="hub-top">
                      <strong>{h.name}</strong>
                      <span>
                        Gen: {h.availableBeds ?? 0}/{h.generalBedCapacity ?? 0} ({availPct}%) · ICU: {h.icuFacilities?.availableBeds ?? 0}/{h.icuBedCapacity ?? 0} · Updates: {updatesLogged}
                      </span>
                    </div>
                    <div className="cbar-track">
                      <div className="cbar-fill st-accepted" style={{ width: `${availPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: SUPER ADMIN AUDIT TRAIL ── */}
      {activeTab === "audit" && (
        <div className="admin-panel-section">
          <div className="audit-info-note">
            Showing immutable Super Admin verification, suspension, and metadata inspection records ({notifications.length} live system notifications dispatched).
          </div>
          {auditLogs.length === 0 ? (
            <div className="empty-state-box">
              <p>No admin verification or audit events recorded yet. Approve, reject, suspend, or audit a hospital above to log entries here.</p>
            </div>
          ) : (
            <div className="tracking-log-items">
              {auditLogs.map((log) => (
                <div key={log.id} className="tracking-log-row">
                  <span className="tlr-status">{log.actionType}</span>
                  <span className="tlr-note">
                    <strong>{log.targetName}</strong> ({log.targetId}) — {log.notes}
                  </span>
                  <span className="tlr-meta">
                    {log.actorName} · {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
