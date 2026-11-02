export default function AttentionCard({ results }) {
  const urgent = results.filter((r) => r.needsAttention);
  if (urgent.length === 0) return null;

  return (
    <div className="attention">
      <h3>Needs attention soon</h3>
      <ul>
        {urgent.map((r) => (
          <li key={r.test.name}>
            <b>{r.test.name}</b>: {r.value} {r.test.unit} ({r.status}, about {r.deviation}% outside the normal range)
          </li>
        ))}
      </ul>
      <p>Please talk to your doctor soon about these results.</p>
    </div>
  );
}