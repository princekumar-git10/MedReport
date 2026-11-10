import { useState } from "react";
import HealthBot from "./HealthBot";
import HealthLibrary from "./HealthLibrary";
import OfflineRecordsVault from "./OfflineRecordsVault";
import { useLanguage } from "../context/LanguageContext";

export default function HealthHubPage({ results = [], onLoadVaultReport, activeReportName }) {
  const [activeSubTab, setActiveSubTab] = useState("bot");
  const [initialBotQuery, setInitialBotQuery] = useState("");
  const { t } = useLanguage();

  const handleAskMarker = (query) => {
    setInitialBotQuery(query);
    setActiveSubTab("bot");
  };

  return (
    <div className="health-hub-view">
      {/* ── Tab Content (Chatbot / Library / Vault) ── */}
      <div className="hub-tab-body">
        {activeSubTab === "bot" && (
          <HealthBot results={results} initialQuery={initialBotQuery} />
        )}

        {activeSubTab === "library" && (
          <HealthLibrary results={results} onAskMarker={handleAskMarker} />
        )}

        {activeSubTab === "vault" && (
          <OfflineRecordsVault
            onLoadReport={onLoadVaultReport}
            activeReportName={activeReportName}
          />
        )}
      </div>

      {/* ── Sub Navigation Dock (Below Content) ── */}
      <div className="hub-subnav-dock">
        <button
          className={`hub-sub-btn ${activeSubTab === "bot" ? "active" : ""}`}
          onClick={() => setActiveSubTab("bot")}
        >
          <span className="hub-sub-icon">🤖</span>
          <span className="hub-sub-title">{t("bot.tabBot")}</span>
          <span className="hub-sub-tag">{t("bot.tabBotTag")}</span>
        </button>

        <button
          className={`hub-sub-btn ${activeSubTab === "library" ? "active" : ""}`}
          onClick={() => setActiveSubTab("library")}
        >
          <span className="hub-sub-icon">📚</span>
          <span className="hub-sub-title">{t("bot.tabLibrary")}</span>
          <span className="hub-sub-tag">{t("bot.tabLibraryTag")}</span>
        </button>

        <button
          className={`hub-sub-btn ${activeSubTab === "vault" ? "active" : ""}`}
          onClick={() => setActiveSubTab("vault")}
        >
          <span className="hub-sub-icon">📁</span>
          <span className="hub-sub-title">{t("bot.tabVault")}</span>
          <span className="hub-sub-tag">{t("bot.tabVaultTag")}</span>
        </button>
      </div>
    </div>
  );
}
