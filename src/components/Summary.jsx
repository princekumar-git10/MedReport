import { useLanguage } from "../context/LanguageContext";

export default function Summary({ results }) {
  const { t } = useLanguage();
  const flagged = results.filter((r) => r.status !== "normal");
  const urgent = results.filter((r) => r.needsAttention);

  return (
    <div className="summary">
      <h2>{t("report.testsFound", { count: results.length })}</h2>
      <p>{t("report.testsFlagged", { flagged: flagged.length, urgent: urgent.length })}</p>
    </div>
  );
}
