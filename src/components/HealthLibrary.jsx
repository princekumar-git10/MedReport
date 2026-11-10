import { useState, useMemo } from "react";
import testsDB from "../data/tests.json";
import { useLanguage } from "../context/LanguageContext";

const CATEGORIES = [
  "All",
  "Blood / CBC",
  "Blood Sugar",
  "Lipid / Heart",
  "Liver",
  "Kidney",
  "Thyroid",
  "Electrolytes",
  "Iron / Vitamins",
  "Inflammation",
];

const CAT_SYSTEMS = {
  "Blood / CBC": ["Hemoglobin", "RBC Count", "PCV / Hematocrit", "MCV", "MCH", "MCHC", "RDW", "WBC Count", "Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", "Basophils", "Platelet Count", "MPV", "ESR", "Reticulocyte Count"],
  "Blood Sugar": ["Fasting Glucose", "Post Prandial Glucose", "HbA1c"],
  "Lipid / Heart": ["Total Cholesterol", "LDL Cholesterol", "HDL Cholesterol", "VLDL Cholesterol", "Triglycerides"],
  "Liver": ["Total Bilirubin", "Direct Bilirubin", "Indirect Bilirubin", "SGOT / AST", "SGPT / ALT", "ALP", "GGT", "Total Protein", "Albumin", "Globulin", "A/G Ratio"],
  "Kidney": ["Urea / BUN", "Creatinine", "Uric Acid", "GFR / eGFR"],
  "Thyroid": ["TSH", "T3", "T4", "Free T3", "Free T4"],
  "Electrolytes": ["Sodium", "Potassium", "Chloride", "Calcium", "Phosphorus", "Magnesium", "Bicarbonate"],
  "Iron / Vitamins": ["Iron", "TIBC", "Ferritin", "Vitamin D", "Vitamin B12", "Folate"],
  "Inflammation": ["CRP", "LDH"],
};

export default function HealthLibrary({ results = [], onAskMarker }) {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [expandedMarker, setExpandedMarker] = useState(null);
  const { t, tStatus, tCategory, tTestName } = useLanguage();

  // Map user's existing results for fast lookup
  const userResultsMap = useMemo(() => {
    const map = {};
    results.forEach((r) => {
      map[r.test.name] = r;
    });
    return map;
  }, [results]);

  const filteredTests = useMemo(() => {
    return testsDB.filter((testItem) => {
      // Category filter
      if (selectedCat !== "All") {
        const allowed = CAT_SYSTEMS[selectedCat] || [];
        if (!allowed.includes(testItem.name)) return false;
      }
      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const matchName = testItem.name.toLowerCase().includes(q);
      const matchAliases = testItem.aliases?.some((a) => a.toLowerCase().includes(q));
      const matchWhat = testItem.what?.toLowerCase().includes(q);
      const localizedName = tTestName(testItem.name).toLowerCase();
      const matchLocalized = localizedName.includes(q);
      return matchName || matchAliases || matchWhat || matchLocalized;
    });
  }, [selectedCat, search, tTestName]);

  return (
    <div className="health-library-view">
      {/* ── Library Hero Banner ── */}
      <div className="lib-banner">
        <div>
          <div className="lib-offline-badge">
            <span className="lib-dot-online" />
            <span>{t("library.badge")}</span>
          </div>
          <h2 className="lib-title">{t("library.title")}</h2>
          <p className="lib-subtitle">{t("library.sub")}</p>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="lib-controls">
        <div className="lib-search-box">
          <svg viewBox="0 0 20 20" fill="currentColor" className="search-svg">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            className="lib-search-input"
            placeholder={t("library.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="lib-clear-btn" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Category Pills */}
        <div className="lib-pills-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`lib-cat-pill ${selectedCat === cat ? "active" : ""}`}
              onClick={() => setSelectedCat(cat)}
            >
              {tCategory(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Library Grid ── */}
      <div className="lib-results-count">
        {t("library.showingCount", { count: filteredTests.length })}
      </div>

      <div className="lib-cards-grid">
        {filteredTests.map((test) => {
          const userResult = userResultsMap[test.name];
          const isExpanded = expandedMarker === test.name;

          return (
            <div
              key={test.name}
              className={`lib-card ${userResult ? `user-${userResult.status}` : ""} ${isExpanded ? "expanded" : ""}`}
            >
              <div className="lib-card-top" onClick={() => setExpandedMarker(isExpanded ? null : test.name)}>
                <div>
                  <div className="lib-name-row">
                    <h3 className="lib-test-name">{tTestName(test.name)}</h3>
                    {userResult && (
                      <span className={`lib-patient-chip ${userResult.status}`}>
                        {t("library.yourValue", {
                          value: userResult.value,
                          unit: test.unit,
                          status: tStatus(userResult.status).toUpperCase(),
                        })}
                      </span>
                    )}
                  </div>
                  <div className="lib-range-pill">
                    {t("library.standardRange", { low: test.low, high: test.high, unit: test.unit })}
                  </div>
                </div>

                <button className="lib-expand-btn" aria-label={t("library.toggleDetails")}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className={`lib-chevron ${isExpanded ? "open" : ""}`}>
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <p className="lib-what-text">{test.what}</p>

              {/* Expanded Etiology & Doctor Guidance */}
              {isExpanded && (
                <div className="lib-expanded-pane">
                  <div className="lib-etiology-grid">
                    <div className="lib-et-box high-box">
                      <span className="et-tag">{t("library.elevatedAssoc")}</span>
                      <p>{test.whyHigh || t("library.elevatedFallback")}</p>
                    </div>
                    <div className="lib-et-box low-box">
                      <span className="et-tag">{t("library.deficitAssoc")}</span>
                      <p>{test.whyLow || t("library.deficitFallback")}</p>
                    </div>
                  </div>

                  {test.questions && test.questions.length > 0 && (
                    <div className="lib-doc-questions">
                      <span className="doc-q-title">{t("library.priorityDoctor")}</span>
                      <ul>
                        {test.questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {onAskMarker && (
                    <button
                      className="lib-ask-bot-btn"
                      onClick={() => onAskMarker(t("library.explainPlain", { name: test.name }))}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="btn-icon">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                      <span>{t("library.askAiBot", { name: tTestName(test.name) })}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
