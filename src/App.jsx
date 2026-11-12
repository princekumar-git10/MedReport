import { useState, useEffect } from "react";
import PulseNav from "./components/PulseNav";
import MedSyncHome from "./components/MedSyncHome";
import ReliefLaserHealth from "./components/ReliefLaserHealth";
import UploadBox from "./components/UploadBox";
import ResultCard from "./components/ResultCard";
import Summary from "./components/Summary";
import AttentionCard from "./components/AttentionCard";
import RiskPage from "./components/RiskPage";
import HealthHubPage from "./components/HealthHubPage";
import CostHubPage from "./components/CostHubPage";
import { computeRisk } from "./utils/riskEngine";
import { extractLines } from "./utils/extractText";
import { parseLines } from "./utils/parseReport";
import { analyze } from "./utils/analyze";
import { saveReportToVault } from "./utils/offlineStorage";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import { useLanguage } from "./context/LanguageContext";
import "./App.css";

export default function App() {
  const getInitialPage = () => {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/relief-laser-health")) {
      return "relief";
    }
    return "home";
  };

  const [activePage, setActivePage] = useState(getInitialPage);
  const [results, setResults] = useState([]);
  const [activeReportName, setActiveReportName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { t } = useLanguage();

  const handleNavigate = (page) => {
    setActivePage(page);
    if (typeof window !== "undefined" && window.history) {
      if (page === "relief") {
        window.history.pushState({}, "", "/relief-laser-health");
      } else if (page === "home") {
        window.history.pushState({}, "", "/");
      }
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  useEffect(() => {
    const onPopState = () => {
      if (window.location.pathname.startsWith("/relief-laser-health")) {
        setActivePage("relief");
      } else {
        setActivePage("home");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function handleFile(file) {
    setLoading(true);
    setError("");
    try {
      const lines = await extractLines(file);
      const parsed = await Promise.all(parseLines(lines).map(analyze));
      if (parsed.length === 0) {
        setError(t("report.errNoTests"));
      } else {
        const reportName = file.name || t("report.fallbackName");
        setResults(parsed);
        setActiveReportName(reportName);
        saveReportToVault(parsed, reportName);
        setActivePage("report");
      }
    } catch (e) {
      console.error(e);
      setError(t("report.errReadPdf"));
    }
    setLoading(false);
  }

  async function loadSample() {
    try {
      setError("");
      const res = await fetch("/sample_lab_report.pdf");
      const blob = await res.blob();
      if (!res.ok || blob.type.includes("html")) {
        throw new Error("not found");
      }
      const file = new File([blob], "sample_lab_report.pdf", { type: "application/pdf" });
      await handleFile(file);
    } catch (e) {
      setError(t("report.errLoadSample"));
    }
  }

  return (
    <div className="app">
      {/* ── Unique ECG Heartbeat Pulse Navbar ── */}
      <PulseNav
        activePage={activePage}
        onNavigate={handleNavigate}
        userEmail={auth.currentUser?.email}
        onLogout={() => signOut(auth)}
        resultsCount={results.length}
        riskScore={results.length > 0 ? computeRisk(results).score : undefined}
      />

      {/* ── 1. MedSync AI Home Screen (inspired by user design) ── */}
      {activePage === "home" && (
        <main className="page-fade">
          <MedSyncHome
            userEmail={auth.currentUser?.email}
            onNavigate={handleNavigate}
            results={results}
          />
        </main>
      )}

      {/* ── 2. Relief Laser Health (Smart Hospital Referral & Availability Network) ── */}
      {activePage === "relief" && (
        <main className="page-fade">
          <ReliefLaserHealth
            userEmail={auth.currentUser?.email}
            onNavigate={handleNavigate}
            results={results}
          />
        </main>
      )}

      {/* ── 3. Diagnostic Report ── */}
      {activePage === "report" && (
        <main className="page-fade">
          <header>
            <div className="report-header-top">
              <h1>{t("report.title")}</h1>
              {activeReportName && (
                <span className="offline-active-indicator" title={t("report.savedToVault")}>
                  <span className="rec-dot" />
                  <span>{t("report.emrPrefix")} {activeReportName}</span>
                </span>
              )}
            </div>
            <p className="tag">
              {t("report.tag")}
            </p>
          </header>

          <UploadBox onFile={handleFile} loading={loading} loadSample={loadSample} />

          {error && <p className="error" role="alert">{error}</p>}

          {results.length > 0 && (
            <>
              {/* Dual Action Telemetry Banner */}
              <div className="risk-jump-banner">
                <div>
                  <strong>{t("report.bannerTitle")}</strong>
                  <p>{t("report.bannerDesc", { count: results.length })}</p>
                </div>
                <div className="banner-btn-group">
                  <button
                    className="risk-jump-btn"
                    onClick={() => handleNavigate("risk")}
                  >
                    {t("report.btnDeterioration")}
                  </button>
                  <button
                    className="bot-jump-btn"
                    onClick={() => handleNavigate("bot")}
                  >
                    {t("report.btnAskBot")}
                  </button>
                </div>
              </div>

              <Summary results={results} />
              <AttentionCard results={results} />
              {[...results]
                .sort(
                  (a, b) =>
                    (b.needsAttention - a.needsAttention) ||
                    ((b.status !== "normal") - (a.status !== "normal"))
                )
                .map((r) => (
                  <ResultCard key={r.test.name} r={r} />
                ))}
            </>
          )}

          <footer>
            {t("common.disclaimer")}
          </footer>
        </main>
      )}

      {/* ── 3. Alerts (Deterioration AI) ── */}
      {activePage === "risk" && (
        <main className="page-fade">
          <RiskPage results={results} onNavigate={handleNavigate} />
        </main>
      )}

      {/* ── 4. Hospital Costs ── */}
      {activePage === "cost" && (
        <main className="page-fade">
          <CostHubPage results={results} />
        </main>
      )}

      {/* ── Sub-hub fallback (Bot / Library / Vault) ── */}
      {activePage === "bot" && (
        <main className="page-fade">
          <HealthHubPage
            results={results}
            onLoadVaultReport={(vaultResults, name) => {
              setResults(vaultResults);
              setActiveReportName(name);
              handleNavigate("report");
            }}
            activeReportName={activeReportName}
          />
        </main>
      )}
    </div>
  );
}
