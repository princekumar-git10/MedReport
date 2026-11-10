import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";

export default function UploadBox({ onFile, loading, loadSample }) {
  const [drag, setDrag] = useState(false);
  const { t } = useLanguage();

  function handleDrop(e) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") onFile(file);
  }

  return (
    <div className="uploadWrap">
      <label
        className={`upload ${drag ? "drag" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files[0];
            if (f) { onFile(f); e.target.value = ""; }
          }}
        />
        <strong>{loading ? t("report.uploadReading") : t("report.uploadTitle")}</strong>
        <span className="hint">{t("report.uploadHint")}</span>
      </label>

      <div className="or">
        <button className="sampleBtn" onClick={loadSample} disabled={loading}>
          {t("report.trySample")}
        </button>
      </div>
    </div>
  );
}
