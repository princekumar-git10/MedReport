import { useState } from "react";

export default function UploadBox({ onFile, loading, loadSample }) {
  const [drag, setDrag] = useState(false);

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
        <strong>{loading ? "Reading your report…" : "Upload your lab report"}</strong>
        <span className="hint">Drop a PDF here or click to choose one. Text-based PDFs only.</span>
      </label>

      <div className="or">
        <button className="sampleBtn" onClick={loadSample} disabled={loading}>
          Try a sample report
        </button>
      </div>
    </div>
  );
}