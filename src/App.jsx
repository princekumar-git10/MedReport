import { useState } from "react";
import UploadBox from "./components/UploadBox";
import ResultCard from "./components/ResultCard";
import Summary from "./components/Summary";
import AttentionCard from "./components/AttentionCard";
import { extractLines } from "./utils/extractText";
import { parseLines } from "./utils/parseReport";
import { analyze } from "./utils/analyze";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";
import "./App.css";

export default function App() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    setLoading(true);
    setError("");
    try {
      const lines = await extractLines(file);
      const parsed = parseLines(lines).map(analyze);
      if (parsed.length === 0) {
        setError("Couldn't find known tests in this PDF. Try a text-based (not scanned) report.");
      }
      setResults(parsed);
    } catch (e) {
      console.error(e);
      setError("Could not read this PDF.");
    }
    setLoading(false);
  }

  async function loadSample() {
    try {
      setError("");
      const res = await fetch("/sample_lab_report.pdf");
      const blob = await res.blob();
      if (!res.ok || blob.type.includes("html")) {
        throw new Error("not found");
      }
      await handleFile(new File([blob], "sample_lab_report.pdf", { type: "application/pdf" }));
    } catch (e) {
      setError("Could not load the sample report. Check that sample_lab_report.pdf is inside the public folder.");
    }
  }

  return (
    <div className="app">
      <header>
        <div className="user-bar">
          <span className="avatar" aria-hidden="true">
            {auth.currentUser?.email?.[0]?.toUpperCase()}
          </span>
          <span className="userEmail">{auth.currentUser?.email}</span>
          <button className="logoutBtn" onClick={() => signOut(auth)}>
            Logout
          </button>
        </div>
        <h1>Medical Report Explainer</h1>
        <p className="tag">
          Upload a lab report and get a plain-language explanation. Your file is read in this browser and is never uploaded.
        </p>
      </header>

      <UploadBox onFile={handleFile} loading={loading} loadSample={loadSample} />

      {error && <p className="error" role="alert">{error}</p>}

      {results.length > 0 && (
        <>
          <Summary results={results} />
          <AttentionCard results={results} />
          {[...results]
            .sort(
              (a, b) =>
                (b.needsAttention - a.needsAttention) ||
                ((b.status !== "normal") - (a.status !== "normal"))
            )
            .map((r) => (
              <ResultCard key={r.test.name} r={r} />
            ))}
        </>
      )}

      <footer>
        Educational information only. Not a diagnosis or medical advice. Please consult your doctor.
      </footer>
    </div>
  );
}