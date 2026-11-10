import { useLanguage } from "../context/LanguageContext";

export default function AttentionCard({ results }) {
  const { t, tStatus, tTestName } = useLanguage();
  const urgent = results.filter((r) => r.needsAttention);
  if (urgent.length === 0) return null;

  return (
    <div className="attention">
      <h3>{t("report.attentionTitle")}</h3>
      <ul>
        {urgent.map((r) => (
          <li key={r.test.name}>
            <b>{tTestName(r.test.name)}</b>: {r.value} {r.test.unit} ({tStatus(r.status)}, {t("report.attentionDeviation", { dev: r.deviation })})
          </li>
        ))}
      </ul>
      <p>{t("report.attentionDoctor")}</p>
    </div>
  );
}
