export default function Splash({ leaving }) {
  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="status" aria-label="Loading">
      <svg className="pulse" viewBox="0 0 120 40" aria-hidden="true">
        <polyline points="0,20 30,20 40,20 46,6 54,34 62,12 68,20 120,20" />
      </svg>
      <div className="title">Medical Report Explainer</div>
      <p>Understand your lab report in plain language</p>
      <div className="bar"><span /></div>
    </div>
  );
}