import { useLanguage } from "../context/LanguageContext";

export default function Splash({ leaving }) {
  const { t } = useLanguage();

  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="status" aria-label={t("common.loading")}>
      <svg className="pulse" viewBox="0 0 120 40" aria-hidden="true">
        <polyline points="0,20 30,20 40,20 46,6 54,34 62,12 68,20 120,20" />
      </svg>
      <div className="title">{t("splash.title")}</div>
      <p>{t("splash.subtitle")}</p>
      <div className="bar"><span /></div>
    </div>
  );
}
