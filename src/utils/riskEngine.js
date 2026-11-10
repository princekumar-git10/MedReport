// Categorise tests into organ/body systems
const SYSTEM_MAP = {
  "Blood / CBC": [
    "Hemoglobin", "RBC Count", "PCV / Hematocrit", "MCV", "MCH", "MCHC",
    "RDW", "WBC Count", "Neutrophils", "Lymphocytes", "Monocytes",
    "Eosinophils", "Basophils", "Platelet Count", "MPV", "ESR",
    "Reticulocyte Count",
  ],
  "Blood Sugar": [
    "Fasting Glucose", "Post Prandial Glucose", "HbA1c",
  ],
  "Lipid / Heart": [
    "Total Cholesterol", "LDL Cholesterol", "HDL Cholesterol",
    "VLDL Cholesterol", "Triglycerides",
  ],
  "Liver": [
    "Total Bilirubin", "Direct Bilirubin", "Indirect Bilirubin",
    "SGOT / AST", "SGPT / ALT", "ALP", "GGT",
    "Total Protein", "Albumin", "Globulin", "A/G Ratio",
  ],
  "Kidney": [
    "Urea / BUN", "Creatinine", "Uric Acid", "GFR / eGFR",
  ],
  "Thyroid": [
    "TSH", "T3", "T4", "Free T3", "Free T4",
  ],
  "Electrolytes": [
    "Sodium", "Potassium", "Chloride", "Calcium", "Phosphorus",
    "Magnesium", "Bicarbonate",
  ],
  "Iron / Vitamins": [
    "Iron", "TIBC", "Ferritin", "Vitamin D", "Vitamin B12", "Folate",
  ],
  "Inflammation": [
    "CRP", "LDH",
  ],
  "Coagulation": [
    "Prothrombin Time", "INR", "aPTT",
  ],
};

// Known dangerous combos that amplify risk
const COMBO_RULES = [
  {
    tests: ["Fasting Glucose", "HbA1c"],
    condition: (r) => r.every((t) => t.status === "high"),
    warning: "Both fasting glucose and HbA1c are elevated — this pattern is strongly associated with diabetes risk.",
    severity: 3,
  },
  {
    tests: ["SGOT / AST", "SGPT / ALT"],
    condition: (r) => r.every((t) => t.status === "high"),
    warning: "Both liver enzymes (AST & ALT) are elevated — may indicate liver stress or damage.",
    severity: 2,
  },
  {
    tests: ["Urea / BUN", "Creatinine"],
    condition: (r) => r.every((t) => t.status === "high"),
    warning: "Both urea and creatinine are high — may suggest reduced kidney function.",
    severity: 3,
  },
  {
    tests: ["LDL Cholesterol", "Triglycerides"],
    condition: (r) => r.every((t) => t.status === "high"),
    warning: "LDL and triglycerides are both elevated — increased cardiovascular risk.",
    severity: 2,
  },
  {
    tests: ["LDL Cholesterol", "HDL Cholesterol"],
    condition: (r) => {
      const ldl = r.find((t) => t.test.name === "LDL Cholesterol");
      const hdl = r.find((t) => t.test.name === "HDL Cholesterol");
      return ldl?.status === "high" && hdl?.status === "low";
    },
    warning: "High LDL with low HDL — unfavourable cholesterol ratio for heart health.",
    severity: 2,
  },
  {
    tests: ["Hemoglobin", "Iron"],
    condition: (r) => r.every((t) => t.status === "low"),
    warning: "Low hemoglobin with low iron — consistent with iron-deficiency anaemia.",
    severity: 2,
  },
  {
    tests: ["Hemoglobin", "Vitamin B12"],
    condition: (r) => r.every((t) => t.status === "low"),
    warning: "Low hemoglobin with low B12 — may indicate megaloblastic anaemia.",
    severity: 2,
  },
  {
    tests: ["TSH", "Free T4"],
    condition: (r) => {
      const tsh = r.find((t) => t.test.name === "TSH");
      const ft4 = r.find((t) => t.test.name === "Free T4");
      return tsh?.status === "high" && ft4?.status === "low";
    },
    warning: "High TSH with low Free T4 — pattern consistent with hypothyroidism.",
    severity: 2,
  },
  {
    tests: ["WBC Count", "CRP"],
    condition: (r) => r.every((t) => t.status === "high"),
    warning: "Elevated WBC and CRP together — suggests active infection or significant inflammation.",
    severity: 2,
  },
  {
    tests: ["Calcium", "Vitamin D"],
    condition: (r) => r.every((t) => t.status === "low"),
    warning: "Both calcium and vitamin D are low — risk for bone health issues.",
    severity: 2,
  },
  {
    tests: ["Potassium"],
    condition: (r) => {
      const k = r[0];
      return k.status !== "normal" && k.deviation > 20;
    },
    warning: "Potassium is significantly abnormal — can affect heart rhythm. Needs prompt attention.",
    severity: 3,
  },
];

/**
 * Build risk assessment from analysed results.
 * Returns { score, level, systemBreakdown, comboWarnings, recommendations }
 */
export function computeRisk(results) {
  if (!results || results.length === 0) {
    return { score: 0, level: "none", systemBreakdown: [], comboWarnings: [], recommendations: [] };
  }

  // --- 1. Per-test severity points ---
  let totalPoints = 0;
  const maxPossible = results.length * 10; // max 10 pts per test

  for (const r of results) {
    if (r.status === "normal") continue;
    // base: 2 pts for any out-of-range
    let pts = 2;
    // scale by deviation: mild (<10%) +1, moderate (10-25%) +3, severe (>25%) +5, critical (>50%) +8
    if (r.deviation > 50) pts += 8;
    else if (r.deviation > 25) pts += 5;
    else if (r.deviation > 10) pts += 3;
    else pts += 1;
    totalPoints += Math.min(pts, 10);
  }

  // --- 2. Combo bonus ---
  const comboWarnings = [];
  const resultsByName = {};
  for (const r of results) {
    resultsByName[r.test.name] = r;
  }

  for (const rule of COMBO_RULES) {
    const matched = rule.tests.map((n) => resultsByName[n]).filter(Boolean);
    if (matched.length === rule.tests.length && rule.condition(matched)) {
      comboWarnings.push({ warning: rule.warning, severity: rule.severity });
      totalPoints += rule.severity * 3; // combo bonus adds extra weight
    }
  }

  // --- 3. Normalise to 0-100 ---
  const rawScore = Math.min((totalPoints / Math.max(maxPossible, 1)) * 100, 100);
  const score = Math.round(rawScore);

  // --- 4. Level ---
  let level;
  if (score <= 10) level = "low";
  else if (score <= 30) level = "moderate";
  else if (score <= 55) level = "high";
  else level = "critical";

  // --- 5. System breakdown ---
  const systemBreakdown = [];
  for (const [system, testNames] of Object.entries(SYSTEM_MAP)) {
    const inSystem = results.filter((r) => testNames.includes(r.test.name));
    if (inSystem.length === 0) continue;
    const abnormal = inSystem.filter((r) => r.status !== "normal");
    const worstDev = abnormal.length > 0 ? Math.max(...abnormal.map((r) => r.deviation)) : 0;

    let sysLevel = "ok";
    if (abnormal.some((r) => r.deviation > 25)) sysLevel = "critical";
    else if (abnormal.length > 0) sysLevel = "warning";

    systemBreakdown.push({
      system,
      total: inSystem.length,
      abnormal: abnormal.length,
      worstDeviation: worstDev,
      level: sysLevel,
      tests: inSystem,
    });
  }

  // sort: critical first, then warning, then ok
  const levelOrder = { critical: 0, warning: 1, ok: 2 };
  systemBreakdown.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  // --- 6. Recommendations ---
  const recommendations = [];
  if (comboWarnings.some((c) => c.severity >= 3)) {
    recommendations.push("Schedule a doctor's appointment as soon as possible to discuss the flagged combinations.");
  }
  if (systemBreakdown.some((s) => s.level === "critical")) {
    const critSystems = systemBreakdown.filter((s) => s.level === "critical").map((s) => s.system);
    recommendations.push(`Request a focused evaluation for: ${critSystems.join(", ")}.`);
  }
  if (level === "critical" || level === "high") {
    recommendations.push("Do not delay — share this report with your physician at the earliest.");
    recommendations.push("Bring a list of your current medications and supplements to the appointment.");
  }
  if (level === "moderate") {
    recommendations.push("Discuss these results at your next scheduled visit.");
    recommendations.push("Consider lifestyle changes such as diet and exercise in the meantime.");
  }
  if (level === "low") {
    recommendations.push("Your results are mostly within normal limits. Maintain your healthy habits!");
    recommendations.push("Continue routine check-ups as recommended by your doctor.");
  }

  return { score, level, systemBreakdown, comboWarnings, recommendations };
}

