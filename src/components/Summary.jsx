export default function Summary({ results }) {
  const flagged = results.filter((r) => r.status !== "normal");
  const urgent = results.filter((r) => r.needsAttention);
  return (
    <div className="summary">
      <h2>{results.length} tests found</h2>
      <p>{flagged.length} outside the normal range · {urgent.length} need attention soon</p>
    </div>
  );
}