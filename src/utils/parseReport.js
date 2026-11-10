import tests from "../data/tests.json";

// flat list of every alias, longest first (so "hba1c" is checked before "hb")
const aliasList = tests
  .flatMap((t) => t.aliases.map((alias) => ({ alias, test: t })))
  .sort((a, b) => b.alias.length - a.alias.length);

const numberRegex = /(\d+\.?\d*)/;
const rangeRegex = /(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/;

export function parseLines(lines) {
  const results = [];
  const seen = new Set(); // stops the same test appearing twice

  for (const line of lines) {
    const lower = line.toLowerCase();

    // find the alias anywhere in the line (not just at the start)
    const hit = aliasList.find(({ alias }) => {
      const pos = lower.indexOf(alias);
      if (pos === -1) return false;
      // character before must be a non-alphanumeric (or start of line)
      const prev = lower[pos - 1];
      if (prev && /[a-z0-9]/.test(prev)) return false;
      // character after must be a non-alphanumeric (or end of line)
      const next = lower[pos + alias.length];
      if (next && /[a-z0-9]/.test(next)) return false;
      return true;
    });
    if (!hit || seen.has(hit.test.name)) continue;

    // grab the portion of the line AFTER the alias match
    const pos = lower.indexOf(hit.alias);
    const rest = line.slice(pos + hit.alias.length);
    const valueMatch = rest.match(numberRegex);
    if (!valueMatch) continue;

    const value = parseFloat(valueMatch[1]);
    const afterValue = rest.slice(valueMatch.index + valueMatch[0].length);
    const rangeMatch = afterValue.match(rangeRegex);

    seen.add(hit.test.name);
    results.push({
      test: hit.test,
      value,
      // prefer the lab's own range; fall back to your defaults
      low: rangeMatch ? parseFloat(rangeMatch[1]) : hit.test.low,
      high: rangeMatch ? parseFloat(rangeMatch[2]) : hit.test.high,
      usedReportRange: Boolean(rangeMatch),
    });
  }
  return results;
}
