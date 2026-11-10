import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { processHealthQuery } from "../utils/multilingualBot";

export default function MedSyncHome({ userEmail, onNavigate, results = [] }) {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  // Extract a friendly name from email or default to "Prince"
  const extractName = () => {
    if (!userEmail) return "Prince";
    const namePart = userEmail.split("@")[0].replace(/[0-9_.-]/g, "");
    if (!namePart) return "Prince";
    return namePart.charAt(0).toUpperCase() + namePart.slice(1);
  };

  const userName = extractName();

  const handleSearch = async (textToSearch) => {
    const q = textToSearch || query;
    if (!q.trim() || loading) return;

    setLoading(true);
    setAnswer({ query: q, text: "", loading: true });

    const reportContext = results.map((r) => ({
      name: r.test?.name || r.name,
      value: r.value,
      unit: r.test?.unit || r.unit,
      status: r.status,
      low: r.test?.low,
      high: r.test?.high,
    }));

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: q }],
          reportContext,
          language: lang,
          stream: false,
        }),
      });

      if (!resp.ok) throw new Error("Server error");
      const data = await resp.json();
      setAnswer({ query: q, text: data.reply || processHealthQuery(q, results, lang), model: data.model });
    } catch (e) {
      console.warn("Home search API fallback:", e);
      const fallbackReply = processHealthQuery(q, results, lang);
      setAnswer({ query: q, text: fallbackReply, isFallback: true });
    } finally {
      setLoading(false);
    }
  };

  const handlePillClick = (actionType) => {
    if (actionType === "compare") {
      onNavigate("cost");
    } else if (actionType === "explain") {
      if (results.length > 0) {
        onNavigate("report");
      } else {
        handleSearch("Explain how to read my blood lab report and normal ranges");
      }
    } else if (actionType === "risks") {
      onNavigate("risk");
    } else if (actionType === "next") {
      handleSearch("What should I ask my doctor during my next clinic consultation?");
    }
  };

  return (
    <div className="medsync-home-view">
      {/* ── Soft Ambient Medical Cross Accents ── */}
      <div className="amb-cross amb-cross-tl" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" />
        </svg>
      </div>
      <div className="amb-cross amb-cross-tr" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" />
        </svg>
      </div>
      <div className="amb-cross amb-cross-br" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" />
        </svg>
      </div>

      {/* ── Centerpiece: Glowing Pulse Tile with Sparkles ── */}
      <div className="home-emblem-wrapper">
        <div className="sparkle sparkle-1" aria-hidden="true">✦</div>
        <div className="sparkle sparkle-2" aria-hidden="true">✦</div>
        <div className="sparkle sparkle-3" aria-hidden="true">✦</div>

        <div className="home-orbit-ring" aria-hidden="true" />

        <div className="home-pulse-card">
          <svg viewBox="0 0 48 48" fill="none" className="home-ecg-svg" aria-hidden="true">
            <path
              d="M 6 24 L 16 24 L 20 12 L 25 36 L 29 20 L 33 26 L 42 24"
              stroke="#0f5c63"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* ── Main Greeting & Subtitle ── */}
      <h1 className="home-title">
        {t("home.greeting", { name: userName })}
      </h1>

      <p className="home-subtitle">
        {t("home.subtitle")}
      </p>

      {/* ── Active Status Indicator ── */}
      {results.length > 0 && (
        <div className="home-active-pill" onClick={() => onNavigate("report")}>
          <span className="h-pip" />
          <span>{t("home.reportLoadedBadge", { count: results.length })}</span>
          <span className="h-link-arrow">→</span>
        </div>
      )}

      {/* ── Search Bar Dock ── */}
      <div className="home-search-container">
        <div className="home-search-pill">
          <span className="search-sparkle-icon" aria-hidden="true">✦</span>
          <input
            type="text"
            className="home-search-input"
            placeholder={t("home.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <div className="search-divider" />
          <button
            className="home-send-btn"
            onClick={() => handleSearch()}
            disabled={loading}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="send-arrow-svg">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Quick Action Suggestion Pills ── */}
      <div className="home-quick-pills">
        <button className="q-pill" onClick={() => handlePillClick("compare")}>
          <span className="q-icon">📈</span>
          <span>{t("home.pillCompare")}</span>
        </button>

        <button className="q-pill" onClick={() => handlePillClick("explain")}>
          <span className="q-icon">📑</span>
          <span>{t("home.pillExplain")}</span>
        </button>

        <button className="q-pill" onClick={() => handlePillClick("risks")}>
          <span className="q-icon">🛡️</span>
          <span>{t("home.pillRisks")}</span>
        </button>

        <button className="q-pill" onClick={() => handlePillClick("next")}>
          <span className="q-icon">💡</span>
          <span>{t("home.pillNext")}</span>
        </button>
      </div>

      {/* ── Dynamic Inline AI Clinical Response (if query submitted) ── */}
      {answer && (
        <div className="home-response-card">
          <div className="response-header">
            <div className="resp-badge">
              <span className="resp-dot" />
              <span>MedSync Clinical Synthesis</span>
            </div>
            <button className="resp-close-btn" onClick={() => setAnswer(null)}>✕</button>
          </div>
          <div className="resp-body">
            {answer.text.split("\n").map((line, idx) => (
              <p key={idx} className="resp-line">
                {line.startsWith("###") ? (
                  <strong className="resp-h3">{line.replace("###", "")}</strong>
                ) : line.startsWith("•") || line.startsWith("*") ? (
                  <span className="resp-bullet">{line}</span>
                ) : (
                  line
                )}
              </p>
            ))}
          </div>
          {results.length === 0 && (
            <div className="resp-action-bar">
              <button className="resp-cta-btn" onClick={() => onNavigate("report")}>
                Upload Report for Personalized Analysis →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Tagline with Divider Lines ── */}
      <div className="home-footer-tagline">
        <div className="tagline-rule" />
        <div className="tagline-pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shield-check-svg">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span>{t("home.tagline")}</span>
        </div>
        <div className="tagline-rule" />
      </div>
    </div>
  );
}

