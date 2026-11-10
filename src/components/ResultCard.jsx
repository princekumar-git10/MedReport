import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function ResultCard({ r }) {
  const [open, setOpen] = useState(false);
  const { test, value, low, high, status, needsAttention } = r;
  const { t, tStatus, tTestName, lang, languages } = useLanguage();

  function speak() {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const reason = status === "low" ? test.whyLow : status === "high" ? test.whyHigh : "";
    const localizedName = tTestName(test.name);
    const localizedStatus = tStatus(status);
    const text = `${localizedName}: ${value} ${test.unit}. ${t("card.normalRange", { low, high })}. ${localizedStatus}. ${test.what} ${reason}`;
    const u = new SpeechSynthesisUtterance(text);
    const voiceLang = languages.find((l) => l.code === lang)?.voiceLang || "en-IN";
    u.lang = voiceLang;
    window.speechSynthesis.speak(u);
  }

  return (
    <div className={`card ${status}`}>
      <div className="row" onClick={() => setOpen(!open)}>
        <strong>{tTestName(test.name)}</strong>
        <span>{value} {test.unit}</span>
        <span className="range">{t("card.normalRange", { low, high })}</span>
        <span className={`chip ${status}`}>{tStatus(status).toUpperCase()}</span>
      </div>

      {open && (
        <div className="details">
          <button className="speakBtn" onClick={speak}>{t("card.readAloud")}</button>
          <p><b>{t("card.whatItIs")}</b> {test.what}</p>
          {status === "low" && <p><b>{t("card.whyLow")}</b> {test.whyLow}</p>}
          {status === "high" && <p><b>{t("card.whyHigh")}</b> {test.whyHigh}</p>}
          {needsAttention && (
            <p className="alert">{t("card.alertOutside")}</p>
          )}
          {status !== "normal" && (
            <>
              <b>{t("card.askDoctor")}</b>
              <ul>{test.questions.map((q) => <li key={q}>{q}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
