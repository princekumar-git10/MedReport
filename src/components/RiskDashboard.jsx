import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

const SYSTEM_ICONS = {
  "Blood / CBC": "🩸",
  "Blood Sugar": "⚡",
  "Lipid / Heart": "🫀",
  "Liver": "🩺",
  "Kidney": "🧬",
  "Thyroid": "🦋",
  "Electrolytes": "🧪",
  "Iron / Vitamins": "💊",
  "Inflammation": "🛡️",
  "Coagulation": "⏱️",
};

export default function RiskDashboard({ risk }) {
  const [expandedSys, setExpandedSys] = useState(null);
  const [copied, setCopied] = useState(false);
  const { t, tStatus, tCategory, tTestName } = useLanguage();

  const getLevelConfig = (level) => {
    switch (level) {
      case "critical":
        return {
          label: t("risk.levelCritical"),
          tier: t("risk.tierCritical"),
          color: "#ef4444",
          softBg: "rgba(239, 68, 68, 0.15)",
          border: "rgba(239, 68, 68, 0.5)",
          description: t("risk.descCritical"),
          actionBadge: t("risk.actionCritical"),
        };
      case "high":
        return {
          label: t("risk.levelHigh"),
          tier: t("risk.tierHigh"),
          color: "#f97316",
          softBg: "rgba(249, 115, 22, 0.12)",
          border: "rgba(249, 115, 22, 0.4)",
          description: t("risk.descHigh"),
          actionBadge: t("risk.actionHigh"),
        };
      case "moderate":
        return {
          label: t("risk.levelModerate"),
          tier: t("risk.tierModerate"),
          color: "#f59e0b",
          softBg: "rgba(245, 158, 11, 0.12)",
          border: "rgba(245, 158, 11, 0.35)",
          description: t("risk.descModerate"),
          actionBadge: t("risk.actionModerate"),
        };
      case "low":
      default:
        return {
          label: t("risk.levelLow"),
          tier: t("risk.tierLow"),
          color: "#10b981",
          softBg: "rgba(16, 185, 129, 0.1)",
          border: "rgba(16, 185, 129, 0.3)",
          description: t("risk.descLow"),
          actionBadge: t("risk.actionLow"),
        };
    }
  };

  const cfg = getLevelConfig(risk.level);

  // Compute needle angle for SVG Gauge (-90 deg to +90 deg)
  const angle = Math.min(Math.max((risk.score / 100) * 180 - 90, -90), 90);

  // Filter top driver tests
  const topDrivers = (risk.topDrivers || []).slice(0, 4);

  // Handle Copy Doctor Brief
  const handleCopyDoctorBrief = () => {
    const alertSystems = risk.systemBreakdown
      .filter((s) => s.abnormal > 0)
      .map((s) => `${tCategory(s.system)} (${s.abnormal}/${s.total} abnormal)`)
      .join(", ") || "None";

    const brief = [
      `=== MEDREPORT CLINICAL SUMMARY BRIEF ===`,
      `Deterioration Risk Score: ${risk.score}/100 [${cfg.label.toUpperCase()}] (${cfg.tier})`,
      `Key Alert Systems: ${alertSystems}`,
      ``,
      `Primary Deviating Biomarkers:`,
      ...topDrivers.map((d) => `• ${tTestName(d.test.name)}: ${d.value} ${d.test.unit} (Status: ${tStatus(d.status).toUpperCase()}, +${d.deviation}% variance vs Ref: ${d.low}-${d.high})`),
      ``,
      `AI Syndromic Flags:`,
      ...risk.comboWarnings.map((w) => `• ${w.warning}`),
      ``,
      `Physician Follow-up Suggestions:`,
      ...risk.recommendations.map((r, i) => `${i + 1}. ${r}`),
    ].join("\n");

    navigator.clipboard.writeText(brief).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    });
  };

  return (
    <div className="risk-dashboard-hud">
      {/* ── TOP TELEMETRY CARD: GAUGE & AI TRAJECTORY ── */}
      <section className="risk-hero-card">
        <div className="risk-card-top-bar">
          <div className="r-badge-row">
            <span className="r-tier-pill" style={{ background: cfg.softBg, color: cfg.color, borderColor: cfg.border }}>
              {cfg.tier}
            </span>
            <span className="r-sys-indicator">
              <span className="r-live-pip" />
              <span>{t("risk.protocolTag")}</span>
            </span>
          </div>
        </div>

        <div className="risk-hero-body">
          {/* Circular HUD Gauge */}
          <div className="risk-gauge-container">
            <div className="hud-dial-box">
              <svg viewBox="0 0 240 150" className="hud-gauge-svg" aria-hidden="true">
                {/* Arc Track Background */}
                <path
                  d="M 30 135 A 90 90 0 0 1 210 135"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="16"
                  strokeLinecap="round"
                />

                {/* Color Zone Multi-Segment Backing */}
                <path
                  d="M 30 135 A 90 90 0 0 1 75 60"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  opacity="0.35"
                />
                <path
                  d="M 75 60 A 90 90 0 0 1 120 45"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  opacity="0.35"
                />
                <path
                  d="M 120 45 A 90 90 0 0 1 165 60"
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="8"
                  opacity="0.35"
                />
                <path
                  d="M 165 60 A 90 90 0 0 1 210 135"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="8"
                  opacity="0.35"
                />

                {/* Active Dynamic Progress Arc */}
                <path
                  d="M 30 135 A 90 90 0 0 1 210 135"
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (risk.score / 100) * 283}
                  className="hud-gauge-progress"
                />

                {/* Center Pivot & Needle */}
                <g transform={`rotate(${angle} 120 135)`} className="hud-needle-group">
                  <line x1="120" y1="135" x2="120" y2="44" stroke={cfg.color} strokeWidth="3.5" strokeLinecap="round" />
                  <circle cx="120" cy="44" r="5" fill="#fff" stroke={cfg.color} strokeWidth="2.5" />
                </g>
                <circle cx="120" cy="135" r="10" fill="#1e293b" />
                <circle cx="120" cy="135" r="5" fill={cfg.color} />
              </svg>

              <div className="dial-value-overlay">
                <div className="dial-num" style={{ color: cfg.color }}>{risk.score}</div>
                <div className="dial-scale">{t("risk.dialScale")}</div>
              </div>
            </div>

            <div className="dial-status-chip" style={{ background: cfg.softBg, color: cfg.color, borderColor: cfg.border }}>
              <span className="dial-chip-dot" style={{ background: cfg.color }} />
              <strong>{cfg.label}</strong>
            </div>
          </div>

          {/* AI Clinical Trajectory Panel */}
          <div className="risk-clinical-context">
            <h3 className="r-context-title">{t("risk.predictiveTitle")}</h3>
            <p className="r-context-desc">{cfg.description}</p>

            <div className="r-driver-box">
              <span className="r-driver-tag">{t("risk.primaryDrivers")}</span>
              {topDrivers.length > 0 ? (
                <div className="r-driver-chips">
                  {topDrivers.map((d) => (
                    <span key={d.test.name} className={`driver-pill ${d.status}`}>
                      <strong className="driver-name">{tTestName(d.test.name)}</strong>
                      <span className="driver-val">{d.value} {d.test.unit}</span>
                      <span className="driver-dev">+{d.deviation}%</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="r-no-drivers">{t("risk.noDrivers")}</p>
              )}
            </div>

            <div className="r-action-row">
              <div className="r-triage-pill">
                <span className="triage-label">{t("risk.clinicalTriage")}</span>
                <span className="triage-val" style={{ color: cfg.color }}>{cfg.actionBadge}</span>
              </div>
              <button className="r-copy-brief-btn" onClick={handleCopyDoctorBrief}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 2H9a3 3 0 01-3-2z" />
                </svg>
                <span>{copied ? t("risk.copied") : t("risk.copyBrief")}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── EARLY WARNING SYNDROMIC PATTERNS ── */}
      {risk.comboWarnings.length > 0 && (
        <section className="risk-syndrome-section">
          <div className="sec-header">
            <span className="sec-icon">⚡</span>
            <div>
              <h3 className="sec-title">{t("risk.syndromicTitle")}</h3>
              <p className="sec-subtitle">{t("risk.syndromicSub")}</p>
            </div>
          </div>

          <div className="syndrome-grid">
            {risk.comboWarnings.map((c, i) => (
              <div key={i} className={`syndrome-card sev-${c.severity >= 3 ? "critical" : "guarded"}`}>
                <div className="syndrome-badge">
                  <span className="s-pip" />
                  <span>{c.severity >= 3 ? t("risk.criticalCombo") : t("risk.patternDetected")}</span>
                </div>
                <p className="syndrome-text">{c.warning}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── ORGAN SYSTEM HEALTH MATRIX ── */}
      <section className="risk-matrix-section">
        <div className="sec-header">
          <span className="sec-icon">🫀</span>
          <div>
            <h3 className="sec-title">{t("risk.organMatrixTitle")}</h3>
            <p className="sec-subtitle">{t("risk.organMatrixSub")}</p>
          </div>
        </div>

        <div className="matrix-cards-grid">
          {risk.systemBreakdown.map((s) => {
            const isCritical = s.level === "critical";
            const isWarn = s.level === "warning";
            const icon = SYSTEM_ICONS[s.system] || "🔬";
            const isOpen = expandedSys === s.system;

            // Integrity percentage
            const integrityPct = Math.round(((s.total - s.abnormal) / s.total) * 100);

            return (
              <div key={s.system} className={`matrix-card matrix-${s.level} ${isOpen ? "open" : ""}`}>
                <div className="matrix-card-head" onClick={() => setExpandedSys(isOpen ? null : s.system)}>
                  <div className="matrix-icon-badge">
                    <span className="m-icon">{icon}</span>
                  </div>

                  <div className="matrix-meta">
                    <div className="matrix-title-row">
                      <h4 className="matrix-sys-name">{tCategory(s.system)}</h4>
                      <span className={`matrix-status-chip chip-${s.level}`}>
                        {isCritical ? t("risk.criticalAlert") : isWarn ? t("risk.attentionNeeded") : t("risk.optimal")}
                      </span>
                    </div>

                    {/* Stability Progress Bar */}
                    <div className="matrix-progress-wrap">
                      <div className="matrix-progress-bar">
                        <div
                          className={`matrix-progress-fill fill-${s.level}`}
                          style={{ width: `${integrityPct}%` }}
                        />
                      </div>
                      <span className="matrix-progress-label">
                        {t("risk.systemStability", { pct: integrityPct, abnormal: s.abnormal, total: s.total })}
                      </span>
                    </div>
                  </div>

                  <button className="matrix-toggle-btn" aria-label={t("risk.toggleDetails")}>
                    <svg viewBox="0 0 20 20" fill="currentColor" className={`toggle-chevron ${isOpen ? "rotated" : ""}`}>
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Marker Detail Drawer */}
                {isOpen && (
                  <div className="matrix-detail-drawer">
                    <div className="drawer-table-header">
                      <span>{t("risk.colBiomarker")}</span>
                      <span>{t("risk.colLabValue")}</span>
                      <span>{t("risk.colRefRange")}</span>
                      <span>{t("risk.colStatus")}</span>
                    </div>
                    {s.tests.map((tItem) => (
                      <div key={tItem.test.name} className={`drawer-test-row row-${tItem.status}`}>
                        <div className="d-name">
                          <strong>{tTestName(tItem.test.name)}</strong>
                        </div>
                        <div className="d-val">
                          <strong>{tItem.value}</strong> <small>{tItem.test.unit}</small>
                        </div>
                        <div className="d-ref">
                          {tItem.low} – {tItem.high} {tItem.test.unit}
                        </div>
                        <div className="d-chip">
                          <span className={`badge-status ${tItem.status}`}>
                            {tItem.status === "normal"
                              ? tStatus(tItem.status).toUpperCase()
                              : `${tStatus(tItem.status).toUpperCase()} (+${tItem.deviation}%)`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ACTION PROTOCOL FOR PHYSICIAN CONSULTATION ── */}
      {risk.recommendations.length > 0 && (
        <section className="risk-protocol-card">
          <div className="sec-header">
            <span className="sec-icon">📋</span>
            <div>
              <h3 className="sec-title">{t("risk.actionStepsTitle")}</h3>
              <p className="sec-subtitle">{t("risk.actionStepsSub")}</p>
            </div>
          </div>

          <div className="protocol-checklist">
            {risk.recommendations.map((rec, i) => (
              <div key={i} className="protocol-item">
                <span className="protocol-idx">0{i + 1}</span>
                <p className="protocol-text">{rec}</p>
              </div>
            ))}
          </div>

          <div className="protocol-footer-note">
            <svg viewBox="0 0 20 20" fill="currentColor" className="info-icon">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span>
              <strong>{t("risk.guardrailTitle")}</strong> {t("risk.guardrailText")}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
