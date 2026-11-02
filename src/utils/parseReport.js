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

    // the alias must match as a whole word, so "hb" can't match inside "hba1c"
    const hit = aliasList.find(({ alias }) => {
      if (!lower.startsWith(alias)) return false;
      const next = lower[alias.length];
      return !next || !/[a-z0-9]/.test(next);
    });
    if (!hit || seen.has(hit.test.name)) continue;

    const rest = line.slice(hit.alias.length);
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