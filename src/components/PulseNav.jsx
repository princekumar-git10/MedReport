import { useLanguage } from "../context/LanguageContext";

export default function PulseNav({ activePage, onNavigate, userEmail, onLogout, resultsCount, riskScore }) {
  const { t, lang, setLang, languages } = useLanguage();

  const pages = [
    {
      id: "home",
      label: t("nav.medsync"),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
          <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 16.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
        </svg>
      ),
      badge: null,
    },
    {
      id: "report",
      label: t("nav.report"),
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="nav-svg">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
      badge: resultsCount ? `${resultsCount}` : null,
    },
    {
      id: "risk",
      label: t("nav.risk"),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="nav-svg">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      badge: riskScore !== undefined && riskScore > 0 ? `${riskScore}` : null,
      badgeType: riskScore > 30 ? "warn" : "ok",
    },
    {
      id: "cost",
      label: t("nav.cost"),
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="nav-svg">
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
        </svg>
      ),
      badge: null,
    },
  ];

  /* Exit / logout SVG icon */
  const ExitIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round" width="17" height="17" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );

  return (
    <nav className="pulse-nav" role="navigation" aria-label={t("nav.mainNav")}>
      {/* ── Brand Logo: Compact without subtitle ── */}
      <div className="pn-brand" onClick={() => onNavigate("home")}>
        <div className="pn-logo-mark">
          <svg viewBox="0 0 32 32" fill="none" className="pn-logo-svg" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="url(#logoGrad)" />
            <path d="M16 6v6m0 8v6M6 16h6m8 0h6"
              stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" />
            <path d="M10 16h3.5l1.8-4 2 8 1.7-4H22"
              stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22" cy="16" r="2" fill="#10b981" />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0f5c63" />
                <stop offset="1" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="pn-brand-text-wrap">
          <div className="pn-brand-title">
            <span className="brand-med">Med</span>
            <span className="brand-report">Sync</span>
            <span className="brand-ai-badge">AI</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Tab Strip ── */}
      <div className="pn-center">
        <div className="pn-tabs-scroll-track">
          <div className="pn-tabs">
            {pages.map((p) => {
              const isActive = activePage === p.id;
              return (
                <button
                  key={p.id}
                  className={`pn-tab ${isActive ? "active" : ""}`}
                  onClick={() => onNavigate(p.id)}
                  aria-current={isActive ? "page" : undefined}
                  title={p.label}
                >
                  <span className="pn-tab-icon">{p.icon}</span>
                  <span className="pn-tab-text">{p.label}</span>
                  {p.badge && (
                    <span className={`pn-tab-badge ${p.badgeType || ""}`}>
                      {p.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Attractive Language Pill + User Avatar + Exit ── */}
      <div className="pn-user-portal">
        {/* Beautiful Language Pill Switcher */}
        <div className="pn-lang-switch-wrap" title={t("nav.selectLang")}>
          <span className="lang-globe-icon" aria-hidden="true">🌐</span>
          <select
            className="pn-lang-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t("nav.selectLang")}
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.native}
              </option>
            ))}
          </select>
        </div>

        <div className="pn-user-info" title={userEmail} aria-label={t("nav.signedInAs", { email: userEmail })}>
          <div className="pn-avatar-wrap">
            <span className="pn-avatar">{userEmail?.[0]?.toUpperCase() || "U"}</span>
            <span className="pn-status-pip" />
          </div>
        </div>

        {/* Icon-only logout button */}
        <button
          className="pn-logout-btn"
          onClick={onLogout}
          title={t("nav.signOut")}
          aria-label={t("nav.signOut")}
        >
          <ExitIcon />
        </button>
      </div>

      {/* Ambient ECG Pulse Beam */}
      <div className="pn-ambient-pulse" aria-hidden="true">
        <svg viewBox="0 0 800 12" preserveAspectRatio="none" className="ambient-ecg-svg">
          <path
            d="M 0,6 L 250,6 L 260,2 L 268,10 L 276,0 L 284,11 L 292,6 L 500,6 L 510,2 L 518,10 L 526,0 L 534,11 L 542,6 L 800,6"
            fill="none"
            stroke="url(#ambientPulseGrad)"
            strokeWidth="1.8"
            className="ambient-path"
          />
          <defs>
            <linearGradient id="ambientPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0f5c63" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0f5c63" stopOpacity="0.05" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </nav>
  );
}
