import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "../context/LanguageContext";
import HospitalManagement from "./HospitalManagement";
import DoctorReferralDesk from "./DoctorReferralDesk";
import PatientDashboard from "./PatientDashboard";
import SuperAdminDashboard from "./SuperAdminDashboard";
import NotificationCenter from "./NotificationCenter";
import {
  getReferrals,
  subscribeToReferrals,
  sweepExpiredCapacityHolds,
} from "../services/referralService.js";
import {
  getHospitals,
  subscribeToHospitals,
} from "../services/hospitalService.js";

export default function ReliefLaserHealth({ results = [], userEmail, onNavigate }) {
  const { t, lang } = useLanguage();

  // Initialize sub-route from URL pathname if present, otherwise default to "overview"
  const getInitialSubRoute = () => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.includes("/doctor")) return "doctor";
      if (path.includes("/hospitals")) return "hospitals";
      if (path.includes("/patient")) return "patient";
      if (path.includes("/referrals")) return "referrals";
      if (path.includes("/admin")) return "admin";
    }
    return "overview";
  };

  const [subRoute, setSubRouteState] = useState(getInitialSubRoute);
  const [liveReferrals, setLiveReferrals] = useState([]);
  const [liveHospitals, setLiveHospitals] = useState([]);
  const [trackingQuery, setTrackingQuery] = useState("");
  const [selectedTrackingId, setSelectedTrackingId] = useState("");

  useEffect(() => {
    sweepExpiredCapacityHolds().catch(() => {});
    getReferrals()
      .then((refs) => {
        setLiveReferrals(refs);
        if (refs.length > 0) setSelectedTrackingId((prev) => prev || refs[0].id);
      })
      .catch(() => {});
    getHospitals().then(setLiveHospitals).catch(() => {});

    const unsubRefs = subscribeToReferrals((refs) => {
      setLiveReferrals(refs);
      if (refs.length > 0) {
        setSelectedTrackingId((prev) => (refs.some((r) => r.id === prev) ? prev : refs[0].id));
      }
    });
    const unsubHosp = subscribeToHospitals(setLiveHospitals);

    return () => {
      if (typeof unsubRefs === "function") unsubRefs();
      if (typeof unsubHosp === "function") unsubHosp();
    };
  }, []);

  const filteredTrackingReferrals = useMemo(() => {
    const q = trackingQuery.trim().toLowerCase();
    if (!q) return liveReferrals;
    return liveReferrals.filter((r) => {
      return (
        (r.id || "").toLowerCase().includes(q) ||
        (r.patient?.name || "").toLowerCase().includes(q) ||
        (r.patient?.patientId || "").toLowerCase().includes(q) ||
        (r.targetHospitalName || "").toLowerCase().includes(q) ||
        (r.status || "").toLowerCase().includes(q) ||
        (r.clinicalRequirements?.specialty || "").toLowerCase().includes(q)
      );
    });
  }, [liveReferrals, trackingQuery]);

  const activeTrackingReferral = useMemo(() => {
    return (
      filteredTrackingReferrals.find((r) => r.id === selectedTrackingId) ||
      filteredTrackingReferrals[0] ||
      liveReferrals[0] ||
      null
    );
  }, [filteredTrackingReferrals, liveReferrals, selectedTrackingId]);

  // Sync sub-route with browser URL
  const setSubRoute = (routeKey) => {
    setSubRouteState(routeKey);
    const path = routeKey === "overview" 
      ? "/relief-laser-health" 
      : `/relief-laser-health/${routeKey}`;
    
    if (typeof window !== "undefined" && window.history) {
      window.history.pushState({ subRoute: routeKey }, "", path);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setSubRouteState(getInitialSubRoute());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sub-routes definition
  const subRoutes = [
    {
      id: "overview",
      label: "Network Overview",
      path: "/relief-laser-health",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sub-icon">
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
      ),
    },
    {
      id: "doctor",
      label: "Doctor Referral Portal",
      path: "/relief-laser-health/doctor",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sub-icon">
          <path d="M4.5 12.5l3.5-3.5 4 4 7.5-7.5" />
          <path d="M14 5.5h5.5V11" />
          <path d="M4 20h16" />
        </svg>
      ),
    },
    {
      id: "hospitals",
      label: "Hospital Network",
      path: "/relief-laser-health/hospitals",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sub-icon">
          <path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
          <path d="M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4" />
          <path d="M10 9h4M12 7v4" />
        </svg>
      ),
    },
    {
      id: "patient",
      label: "Patient Care Match",
      path: "/relief-laser-health/patient",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sub-icon">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "referrals",
      label: "Referral Tracking",
      path: "/relief-laser-health/referrals",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sub-icon">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      ),
    },
    {
      id: "admin",
      label: "Super Admin",
      path: "/relief-laser-health/admin",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sub-icon">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relief-laser-container">
      {/* ── Sub Navigation Track (Routes: /relief-laser-health/*) ── */}
      <div className="relief-subnav-dock" role="navigation" aria-label="Relief Laser Health Navigation">
        <div className="relief-subnav-track">
          {subRoutes.map((r) => {
            const isActive = subRoute === r.id;
            return (
              <button
                key={r.id}
                className={`relief-subnav-btn ${isActive ? "active" : ""}`}
                onClick={() => setSubRoute(r.id)}
                type="button"
              >
                {r.icon}
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>
        <NotificationCenter
          activeRoleFilter={
            subRoute === "doctor"
              ? "doctor"
              : subRoute === "hospitals"
              ? "hospital"
              : subRoute === "patient"
              ? "patient"
              : "all"
          }
        />
      </div>

      {/* ── VIEW 1: Main Landing Page Overview (/relief-laser-health) ── */}
      {subRoute === "overview" && (
        <div className="relief-overview-view">
          {/* Hero Section */}
          <section className="relief-hero-card">
            <div className="relief-hero-badge">
              <span className="live-pulse-dot" />
              <span>Smart Hospital Referral & Availability Network</span>
            </div>

            <h1 className="relief-hero-title">
              Find the Right Hospital Before You Arrive.
            </h1>

            <p className="relief-hero-sub">
              Connect patients, doctors and hospitals through intelligent treatment matching, verified availability and digital referral coordination.
            </p>

            {/* Primary Action Buttons */}
            <div className="relief-cta-row">
              <button
                className="relief-primary-btn"
                onClick={() => setSubRoute("doctor")}
                type="button"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Create a Referral</span>
              </button>

              <button
                className="relief-secondary-btn"
                onClick={() => setSubRoute("hospitals")}
                type="button"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Explore Hospital Network</span>
              </button>
            </div>

            {/* Network Trust Telemetry Strip */}
            <div className="relief-trust-metrics">
              <div className="trust-metric-col">
                <strong className="metric-val">150+</strong>
                <span className="metric-label">Verified Hospitals</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-metric-col">
                <strong className="metric-val">98.4%</strong>
                <span className="metric-label">Admission Confirmation</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-metric-col">
                <strong className="metric-val">&lt; 15 min</strong>
                <span className="metric-label">Referral Response Time</span>
              </div>
              <div className="trust-divider" />
              <div className="trust-metric-col">
                <strong className="metric-val">24/7</strong>
                <span className="metric-label">Emergency Desk</span>
              </div>
            </div>
          </section>

          {/* Four Main Feature Cards */}
          <section className="relief-features-section">
            <div className="relief-section-header">
              <h2 className="section-title">Coordinated Care Infrastructure</h2>
              <p className="section-sub">
                Designed for clinical precision, transparency, and frictionless patient transfer across verified healthcare facilities.
              </p>
            </div>

            <div className="relief-grid-cards">
              {/* Card 1: Smart Hospital Matching */}
              <div className="relief-card" onClick={() => setSubRoute("hospitals")}>
                <div className="card-icon-wrap icon-blue">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </div>
                <h3 className="card-title">1. Smart Hospital Matching</h3>
                <p className="card-desc">
                  Intelligent clinical matching that routes patients to the right accredited facility based on surgical specialty, laser technology capabilities, and clinical urgency.
                </p>
                <div className="card-footer-pill">
                  <span>Specialty &amp; Laser Alignment →</span>
                </div>
              </div>

              {/* Card 2: Real-Time Hospital Capacity */}
              <div className="relief-card" onClick={() => setSubRoute("hospitals")}>
                <div className="card-icon-wrap icon-teal">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <h3 className="card-title">2. Real-Time Hospital Capacity</h3>
                <p className="card-desc">
                  Live occupancy telemetry tracking available ICU beds, private rooms, and operating theater slots before the patient departs for the hospital.
                </p>
                <div className="card-footer-pill">
                  <span>Verified Bed Telemetry →</span>
                </div>
              </div>

              {/* Card 3: Digital Doctor Referrals */}
              <div className="relief-card" onClick={() => setSubRoute("doctor")}>
                <div className="card-icon-wrap icon-indigo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <h3 className="card-title">3. Digital Doctor Referrals</h3>
                <p className="card-desc">
                  Seamless physician-to-hospital handover with attached diagnostic lab reports, clinical notes, and pre-authorized admission priority.
                </p>
                <div className="card-footer-pill">
                  <span>Paperless Doctor Desk →</span>
                </div>
              </div>

              {/* Card 4: Referral Tracking */}
              <div className="relief-card" onClick={() => setSubRoute("referrals")}>
                <div className="card-icon-wrap icon-amber">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="24" height="24">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <h3 className="card-title">4. Referral Tracking</h3>
                <p className="card-desc">
                  End-to-end milestone visibility for referring clinicians and patients, from referral issue and hospital acknowledgment to bed reservation and discharge.
                </p>
                <div className="card-footer-pill">
                  <span>Track Status &amp; Passes →</span>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Launch Bottom Banner */}
          <section className="relief-bottom-dock">
            <div className="relief-dock-text">
              <h4>Ready to coordinate hospital admission?</h4>
              <p>Generate an accredited digital referral pass or inspect verified city network hospitals.</p>
            </div>
            <div className="relief-dock-actions">
              <button className="relief-primary-btn compact" onClick={() => setSubRoute("doctor")} type="button">
                Start Referral
              </button>
              <button className="relief-secondary-btn compact" onClick={() => setSubRoute("hospitals")} type="button">
                View Network
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── VIEW 2: Doctor Referral Desk (/relief-laser-health/doctor) ── */}
      {subRoute === "doctor" && (
        <div className="relief-subview-panel full-width">
          <DoctorReferralDesk
            userEmail={userEmail}
            results={results}
            onNavigateToPass={() => setSubRoute("referrals")}
          />
        </div>
      )}

      {/* ── VIEW 3: Hospital Management Module (/relief-laser-health/hospitals) ── */}
      {subRoute === "hospitals" && (
        <div className="relief-subview-panel full-width">
          <HospitalManagement
            userEmail={userEmail}
            onNavigateToDoctor={() => setSubRoute("doctor")}
          />
        </div>
      )}

      {/* ── VIEW 4: Patient Dashboard (/relief-laser-health/patient) ── */}
      {subRoute === "patient" && (
        <div className="relief-subview-panel full-width">
          <PatientDashboard userEmail={userEmail} />
        </div>
      )}

      {/* ── VIEW 6: Super Admin Dashboard (/relief-laser-health/admin) ── */}
      {subRoute === "admin" && (
        <div className="relief-subview-panel full-width">
          <SuperAdminDashboard userEmail={userEmail} />
        </div>
      )}

      {/* ── VIEW 5: Live Referral Tracking (/relief-laser-health/referrals) ── */}
      {subRoute === "referrals" && (
        <div className="relief-subview-panel">
          <div className="subview-header">
            <div>
              <span className="subview-badge">Route: /relief-laser-health/referrals</span>
              <h2 className="subview-title">Live Referral Tracking &amp; Digital Passes</h2>
              <p className="subview-sub">
                Real-time coordination status across Doctor, Hospital Capacity Holds, and Patient Admission milestones.
              </p>
            </div>
            <button className="relief-secondary-btn compact" onClick={() => setSubRoute("overview")} type="button">
              ← Back to Overview
            </button>
          </div>

          <div className="tracking-toolbar-row">
            <input
              type="text"
              className="dash-input"
              placeholder="Search by Referral ID, Patient Name, Hospital, Specialty, or Status..."
              value={trackingQuery}
              onChange={(e) => setTrackingQuery(e.target.value)}
            />
            <span className="tracking-count-pill">
              {filteredTrackingReferrals.length} Referral{filteredTrackingReferrals.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredTrackingReferrals.length === 0 ? (
            <div className="empty-state-box">
              <p>No matching referrals found in the database.</p>
            </div>
          ) : (
            <>
              <div className="tracking-selector-strip">
                {filteredTrackingReferrals.map((refItem) => (
                  <button
                    key={refItem.id}
                    type="button"
                    className={`tracking-selector-chip ${activeTrackingReferral?.id === refItem.id ? "active" : ""}`}
                    onClick={() => setSelectedTrackingId(refItem.id)}
                  >
                    <span className="mono-id">{refItem.id}</span>
                    <span>{refItem.patient?.name || "Unnamed Patient"}</span>
                    <span className={`data-source-pill ${refItem.isDemoData ? "demo" : "live"}`}>
                      {refItem.isDemoData ? "Demo" : "Live"}
                    </span>
                    <span className={`status-pill-sm ${(refItem.status || "pending").toLowerCase().replace(/\s+/g, "-")}`}>
                      {refItem.status}
                    </span>
                  </button>
                ))}
              </div>

              {activeTrackingReferral && (() => {
                const targetHosp = liveHospitals.find((h) => h.id === activeTrackingReferral.targetHospitalId) || null;
                const holdActive = Boolean(activeTrackingReferral.capacityHold?.held && activeTrackingReferral.capacityHold?.status === "Active");
                const holdStatusText = holdActive
                  ? `Held (${activeTrackingReferral.capacityHold.bedType || (activeTrackingReferral.clinicalRequirements?.icuRequired ? "ICU Bed" : "General Bed")} until ${new Date(activeTrackingReferral.capacityHold.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
                  : activeTrackingReferral.capacityHold?.releaseReason || activeTrackingReferral.capacityHold?.status
                  ? `Released (${activeTrackingReferral.capacityHold.releaseReason || activeTrackingReferral.capacityHold.status})`
                  : "No Bed Hold";

                const timelineStatuses = new Set((activeTrackingReferral.timeline || []).map((t) => t.status));
                const isAcceptedOrBeyond = ["Accepted", "Transfer Initiated", "Patient Arrived", "Completed"].includes(activeTrackingReferral.status);
                const isTransferOrBeyond = ["Transfer Initiated", "Patient Arrived", "Completed"].includes(activeTrackingReferral.status);
                const isCompleted = activeTrackingReferral.status === "Completed";

                return (
                  <div className="referral-pass-card">
                    <div className="pass-header">
                      <div className="pass-brand">
                        <span className="pass-logo-cross">+</span>
                        <strong>RELIEF LASER HEALTH DIGITAL PASS</strong>
                        <span className={`data-source-pill ${activeTrackingReferral.isDemoData ? "demo" : "live"}`}>
                          {activeTrackingReferral.isDemoData ? "Demo Sample" : "Live Referral"}
                        </span>
                      </div>
                      <span className={`pass-status-badge status-${(activeTrackingReferral.status || "pending").toLowerCase().replace(/\s+/g, "-")}`}>
                        ● {(activeTrackingReferral.status || "Pending").toUpperCase()}
                      </span>
                    </div>

                    <div className="pass-body">
                      <div className="pass-info-grid">
                        <div>
                          <span className="info-k">Patient Name &amp; ID</span>
                          <strong className="info-v">
                            {activeTrackingReferral.patient?.name} ({activeTrackingReferral.patient?.patientId})
                          </strong>
                        </div>
                        <div>
                          <span className="info-k">Referral Token ID</span>
                          <strong className="info-v mono-id">{activeTrackingReferral.id}</strong>
                        </div>
                        <div>
                          <span className="info-k">Specialty &amp; Procedure</span>
                          <strong className="info-v">
                            {activeTrackingReferral.clinicalRequirements?.specialty} — {activeTrackingReferral.clinicalRequirements?.procedure}
                          </strong>
                        </div>
                        <div>
                          <span className="info-k">Target Hospital</span>
                          <strong className="info-v">
                            {activeTrackingReferral.targetHospitalName || targetHosp?.name || "Awaiting Selection"}
                          </strong>
                        </div>
                        <div>
                          <span className="info-k">Referring Doctor</span>
                          <strong className="info-v">{activeTrackingReferral.doctorName}</strong>
                        </div>
                        <div>
                          <span className="info-k">Capacity Hold State</span>
                          <strong className="info-v">{holdStatusText}</strong>
                        </div>
                      </div>

                      <div className="pass-timeline">
                        <div className={`timeline-node ${timelineStatuses.has("Created") ? "done" : ""}`}>
                          <span className="t-dot" />
                          <span className="t-label">Referral Created</span>
                        </div>
                        <div className={`timeline-line ${timelineStatuses.has("Pending") || isAcceptedOrBeyond ? "done" : ""}`} />
                        <div className={`timeline-node ${timelineStatuses.has("Pending") || isAcceptedOrBeyond ? "done" : ""}`}>
                          <span className="t-dot" />
                          <span className="t-label">Sent to Hospital</span>
                        </div>
                        <div className={`timeline-line ${isAcceptedOrBeyond ? "done" : ""}`} />
                        <div className={`timeline-node ${isAcceptedOrBeyond ? "done" : activeTrackingReferral.status === "Rejected" ? "rejected" : "active"}`}>
                          <span className="t-dot" />
                          <span className="t-label">{holdActive ? "Bed Reserved" : "Hospital Decision"}</span>
                        </div>
                        <div className={`timeline-line ${isTransferOrBeyond ? "done" : ""}`} />
                        <div className={`timeline-node ${isCompleted ? "done" : isTransferOrBeyond ? "active" : ""}`}>
                          <span className="t-dot" />
                          <span className="t-label">{isCompleted ? "Admitted ✓" : "Transfer & Check-in"}</span>
                        </div>
                      </div>

                      {activeTrackingReferral.timeline?.length > 0 && (
                        <div className="tracking-live-log">
                          <h4>Live Coordination Audit Log</h4>
                          <div className="tracking-log-items">
                            {[...activeTrackingReferral.timeline].reverse().slice(0, 6).map((ev, i) => (
                              <div key={i} className="tracking-log-row">
                                <span className="tlr-status">{ev.status}</span>
                                <span className="tlr-note">{ev.note}</span>
                                <span className="tlr-meta">
                                  {ev.by} · {new Date(ev.timestamp).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="tracking-quick-actions">
                        <button type="button" className="relief-secondary-btn compact" onClick={() => setSubRoute("doctor")}>
                          Open Doctor Portal
                        </button>
                        <button type="button" className="relief-secondary-btn compact" onClick={() => setSubRoute("hospitals")}>
                          Open Hospital Desk
                        </button>
                        <button type="button" className="relief-primary-btn compact" onClick={() => setSubRoute("patient")}>
                          Open Patient Journey
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}

