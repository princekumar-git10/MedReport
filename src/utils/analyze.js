export function analyze(item) {
  let status = "normal";
  if (item.value < item.low) status = "low";
  else if (item.value > item.high) status = "high";

  // how far outside the range, as a percentage
  let deviation = 0;
  if (status === "low") deviation = ((item.low - item.value) / item.low) * 100;
  if (status === "high") deviation = ((item.value - item.high) / item.high) * 100;

  const needsAttention = deviation > 25; // your own rule, so say so openly

  return { ...item, status, deviation: Math.round(deviation), needsAttention };
}