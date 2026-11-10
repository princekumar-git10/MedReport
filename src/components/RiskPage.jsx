import RiskDashboard from "./RiskDashboard";
import { computeRisk } from "../utils/riskEngine";
import { useLanguage } from "../context/LanguageContext";

export default function RiskPage({ results, onNavigate }) {
  const { t } = useLanguage();

  if (results.length === 0) {
    return (
      <div className="risk-empty-shell">
        <div className="risk-empty-orb">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="empty-svg-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h2 className="empty-title">{t("risk.emptyTitle")}</h2>
        <p className="empty-text">{t("risk.emptyText")}</p>
        {onNavigate && (
          <button className="empty-action-btn" onClick={() => onNavigate("report")}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span>{t("risk.btnUpload")}</span>
          </button>
        )}
      </div>
    );
  }

  const risk = computeRisk(results);
  const normal = results.filter((r) => r.status === "normal").length;
  const abnormal = results.filter((r) => r.status !== "normal").length;
  const urgent = results.filter((r) => r.needsAttention).length;

  const normalPct = Math.round((normal / results.length) * 100);
  const abnormalPct = Math.round((abnormal / results.length) * 100);

  return (
    <div className="risk-page-view">
      {/* ── Page Header with Clinical Subtitle & Status Badge ── */}
      <div className="risk-header-flex">
        <div>
          <div className="clinical-header-tag">
            <span className="c-pip" />
            <span>{t("risk.cdssTag")}</span>
          </div>
          <h1 className="risk-page-title">{t("risk.pageTitle")}</h1>
          <p className="risk-page-sub">{t("risk.pageSub")}</p>
        </div>
      </div>

      {/* ── High-Tech KPI Telemetry Cards ── */}
      <div className="risk-telemetry-grid">
        {/* Total Tests */}
        <div className="kpi-telemetry-card kpi-total">
          <div className="kpi-top">
            <div className="kpi-icon-shield total-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="kpi-svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <span className="kpi-badge total-badge">{t("risk.kpiTotalBadge")}</span>
          </div>
          <div className="kpi-middle">
            <span className="kpi-big-num">{results.length}</span>
            <span className="kpi-unit">{t("risk.kpiTotalUnit")}</span>
          </div>
          <span className="kpi-label">{t("risk.kpiTotalLabel")}</span>
        </div>

        {/* Normal Tests */}
        <div className="kpi-telemetry-card kpi-ok">
          <div className="kpi-top">
            <div className="kpi-icon-shield ok-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="kpi-svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="kpi-badge ok-badge">{t("risk.kpiNormalBadge", { pct: normalPct })}</span>
          </div>
          <div className="kpi-middle">
            <span className="kpi-big-num ok-color">{normal}</span>
            <span className="kpi-unit">{t("risk.kpiNormalUnit")}</span>
          </div>
          <span className="kpi-label">{t("risk.kpiNormalLabel")}</span>
        </div>

        {/* Abnormal Tests */}
        <div className="kpi-telemetry-card kpi-warn">
          <div className="kpi-top">
            <div className="kpi-icon-shield warn-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="kpi-svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <span className="kpi-badge warn-badge">{t("risk.kpiAbnormalBadge", { pct: abnormalPct })}</span>
          </div>
          <div className="kpi-middle">
            <span className="kpi-big-num warn-color">{abnormal}</span>
            <span className="kpi-unit">{t("risk.kpiAbnormalUnit")}</span>
          </div>
          <span className="kpi-label">{t("risk.kpiAbnormalLabel")}</span>
        </div>

        {/* Critical Attention */}
        <div className="kpi-telemetry-card kpi-critical">
          <div className="kpi-top">
            <div className="kpi-icon-shield critical-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="kpi-svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.5a9 9 0 110 18 9 9 0 010-18zm.008 14.25h-.016a1.125 1.125 0 100 2.25h.016a1.125 1.125 0 000-2.25z" />
              </svg>
            </div>
            <span className="kpi-badge critical-badge">
              {urgent > 0 ? t("risk.kpiUrgentBadgeAlert") : t("risk.kpiUrgentBadgeZero")}
            </span>
          </div>
          <div className="kpi-middle">
            <span className="kpi-big-num critical-color">{urgent}</span>
            <span className="kpi-unit">{t("risk.kpiUrgentUnit")}</span>
          </div>
          <span className="kpi-label">{t("risk.kpiUrgentLabel")}</span>
        </div>
      </div>

      {/* ── Main Risk Intelligence Hub ── */}
      <RiskDashboard risk={risk} />

      <footer className="risk-view-footer">
        {t("common.riskDisclaimer")}
      </footer>
    </div>
  );
}
