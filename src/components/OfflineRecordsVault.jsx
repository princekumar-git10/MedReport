import { useState, useEffect } from "react";
import { getOfflineVault, deleteReportFromVault, clearVault } from "../utils/offlineStorage";
import { useLanguage } from "../context/LanguageContext";

export default function OfflineRecordsVault({ onLoadReport, activeReportName }) {
  const [records, setRecords] = useState([]);
  const { t } = useLanguage();

  useEffect(() => {
    setRecords(getOfflineVault());
  }, []);

  const handleDelete = (id, e) => {
    e.stopPropagation();
    const updated = deleteReportFromVault(id);
    setRecords(updated);
  };

  const handleClearAll = () => {
    if (window.confirm(t("vault.confirmClear"))) {
      clearVault();
      setRecords([]);
    }
  };

  return (
    <div className="vault-container">
      <div className="vault-header">
        <div>
          <div className="vault-tag">
            <span className="v-pip" />
            <span>{t("vault.tag")}</span>
          </div>
          <h3 className="vault-title">{t("vault.title")}</h3>
          <p className="vault-sub">{t("vault.sub")}</p>
        </div>
        {records.length > 0 && (
          <button className="vault-clear-btn" onClick={handleClearAll}>
            {t("vault.clearBtn")}
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="vault-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="vault-empty-svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          <h4>{t("vault.emptyTitle")}</h4>
          <p>{t("vault.emptyText")}</p>
        </div>
      ) : (
        <div className="vault-cards-grid">
          {records.map((rec) => {
            const isActive = activeReportName === rec.name;
            return (
              <div
                key={rec.id}
                className={`vault-card ${isActive ? "active-rec" : ""}`}
                onClick={() => onLoadReport(rec.results, rec.name)}
              >
                <div className="vault-card-top">
                  <div className="v-doc-icon">📄</div>
                  <div className="v-meta">
                    <h4 className="v-name">{rec.name}</h4>
                    <span className="v-date">{rec.displayDate}</span>
                  </div>
                  {isActive && <span className="v-current-badge">{t("vault.activeBadge")}</span>}
                  <button
                    className="v-del-btn"
                    title={t("vault.removeTitle")}
                    onClick={(e) => handleDelete(rec.id, e)}
                  >
                    ✕
                  </button>
                </div>

                <div className="vault-stat-bar">
                  <span className="v-stat"><strong>{rec.resultsCount}</strong>{t("vault.statTests")}</span>
                  <span className="v-stat ok"><strong>{rec.normalCount}</strong>{t("vault.statNormal")}</span>
                  <span className="v-stat warn"><strong>{rec.abnormalCount}</strong>{t("vault.statAbnormal")}</span>
                  {rec.urgentCount > 0 && (
                    <span className="v-stat critical"><strong>{rec.urgentCount}</strong>{t("vault.statUrgent")}</span>
                  )}
                </div>

                <div className="vault-card-footer">
                  <span className="v-load-hint">{t("vault.clickToLoad")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
