/**
 * BITS Pilani Digital — Advanced Grading Console
 * Module: grading.js
 * 
 * Pure domain logic: grade assignment engine, monotonic curving presets,
 * statistical evaluations, configurable distribution guardrails (default thresholds are illustrative), and validation.
 * Runs in both browser (ES module) and Node.js without build step.
 */

export const GRADES = ["A", "A-", "B", "B-", "C", "C-", "D", "E"];

export const DEFAULT_CUTOFFS = {
  "A": 80,
  "A-": 70,
  "B": 60,
  "B-": 50,
  "C": 40,
  "C-": 30,
  "D": 20,
  "E": 0
};

export const GRADE_POINTS = {
  "A": 10,
  "A-": 9,
  "B": 8,
  "B-": 7,
  "C": 6,
  "C-": 5,
  "D": 4,
  "E": 2
};

export const GRADE_DESCRIPTIONS = {
  "A": "Excellent / Highest Distinction",
  "A-": "Very Good",
  "B": "Good",
  "B-": "Above Average",
  "C": "Average",
  "C-": "Below Average",
  "D": "Marginal / Minimum Passing",
  "E": "Exposed / Fail"
};

export const BITS_COURSES = [
  "CS F211 Data Structures",
  "CS F111 Computer Programming",
  "MATH F111 Mathematics I",
  "BITS F110 Technical Report Writing",
  "EEE F111 Electrical Sciences"
];

/**
 * PURE FUNCTION: Assigns letter grade based on minimum cutoff thresholds.
 * Interval rule: mark >= cutoff(G) and mark < cutoff(G_above).
 *
 * @param {number} mark - Student score (supports floating-point precision)
 * @param {Record<string, number>} cutoffs - Minimum threshold per grade
 * @returns {string} Grade letter ("A".."E") or "NC" (Not Computed)
 */
export function assignGrade(mark, cutoffs) {
  if (typeof mark !== "number" || isNaN(mark) || mark === null || mark === undefined) {
    return "NC";
  }
  for (let i = 0; i < GRADES.length; i++) {
    const g = GRADES[i];
    const minCutoff = cutoffs[g];
    if (minCutoff !== undefined && minCutoff !== null && mark >= minCutoff) {
      return g;
    }
  }
  return "E";
}

/**
 * Formats a clean mathematical interval string for a given grade's cutoff range.
 * Grade A is a closed interval: [cutoff(A), 100] (e.g. [80, 100]).
 * All other grades (A-, B, B-, C, C-, D, E) are half-open intervals [min, max)
 * where min is cutoff(G) and max is the cutoff of the grade immediately above G.
 *
 * @param {string} grade - Letter grade (e.g. "A", "A-", "B", etc.)
 * @param {Record<string, number>} cutoffs - Minimum threshold per grade
 * @returns {string} Clean mathematical range string, e.g. "[80, 100]" or "[70, 80)"
 */
export function formatGradeRange(grade, cutoffs) {
  const gIdx = GRADES.indexOf(grade);
  if (gIdx === -1) return "-";
  const minVal = (cutoffs && cutoffs[grade] !== undefined) ? cutoffs[grade] : 0;
  if (gIdx === 0) {
    return `[${minVal}, 100]`;
  }
  const upperGrade = GRADES[gIdx - 1];
  const maxVal = (cutoffs && cutoffs[upperGrade] !== undefined) ? cutoffs[upperGrade] : 100;
  return `[${minVal}, ${maxVal})`;
}

/**
 * Computes descriptive statistical metrics for a numeric cohort.
 *
 * @param {number[]} marks - Array of student total marks
 * @returns {{ count: number, min: number|string, max: number|string, mean: string, median: string, std: string }}
 */
export function computeStats(marks) {
  const valid = marks.filter(m => typeof m === "number" && !isNaN(m));
  if (!valid.length) {
    return { count: 0, min: "-", max: "-", mean: "-", median: "-", std: "0.00" };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = valid.reduce((acc, v) => acc + v, 0);
  const meanVal = sum / valid.length;

  let medianVal;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    medianVal = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    medianVal = sorted[mid];
  }

  let stdVal = 0;
  if (valid.length > 1) {
    const variance = valid.reduce((acc, v) => acc + (v - meanVal) ** 2, 0) / valid.length;
    stdVal = Math.sqrt(variance);
  }

  return {
    count: valid.length,
    min,
    max,
    mean: meanVal.toFixed(2),
    median: medianVal.toFixed(2),
    std: stdVal.toFixed(2)
  };
}

/**
 * Calculates strictly descending monotonic Gaussian cutoffs (μ ± kσ).
 * Enforces c_A > c_A- > c_B > c_B- > c_C > c_C- > c_D > c_E = 0.
 *
 * @param {number[]} marks - Array of student scores
 * @param {Record<string, number>} [fallbackCutoffs] - Default cutoffs for zero variance / small cohort
 * @returns {{ cutoffs: Record<string, number>, warning?: string }}
 */
export function calculateGaussianCutoffs(marks, fallbackCutoffs = DEFAULT_CUTOFFS) {
  const valid = marks.filter(m => typeof m === "number" && !isNaN(m));
  if (valid.length < 3) {
    return {
      cutoffs: { ...fallbackCutoffs },
      warning: "Cohort size is too small (N < 3) for bell curving. Standard BITS defaults applied."
    };
  }

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const std = Math.sqrt(valid.reduce((acc, m) => acc + (m - mean) ** 2, 0) / valid.length);

  if (std === 0 || isNaN(std)) {
    return {
      cutoffs: { ...fallbackCutoffs },
      warning: "Zero score variance detected (all marks identical). Standard BITS defaults applied."
    };
  }

  const raw = {
    "A":  Math.round((mean + 1.5 * std) * 10) / 10,
    "A-": Math.round((mean + 1.0 * std) * 10) / 10,
    "B":  Math.round((mean + 0.5 * std) * 10) / 10,
    "B-": Math.round(mean * 10) / 10,
    "C":  Math.round((mean - 0.5 * std) * 10) / 10,
    "C-": Math.round((mean - 1.0 * std) * 10) / 10,
    "D":  Math.round((mean - 1.5 * std) * 10) / 10,
    "E":  0
  };

  // General clamp to [1, 100] for all grades above E, baseline E = 0
  const clamped = { ...raw };
  const desc = ["A", "A-", "B", "B-", "C", "C-", "D"];
  for (const g of desc) {
    clamped[g] = Math.min(100, Math.max(1, clamped[g]));
  }
  clamped["E"] = 0;

  // Forward pass: ensure strictly descending
  for (let i = 1; i < desc.length; i++) {
    const cur = desc[i];
    const above = desc[i - 1];
    if (clamped[cur] >= clamped[above]) {
      clamped[cur] = Math.max(1, Math.round((clamped[above] - 1) * 10) / 10);
    }
  }

  // Backward relaxation pass to guarantee strict inequality: c[i] > c[i-1] (E -> A)
  const ordered = ["E", "D", "C-", "C", "B-", "B", "A-", "A"];
  for (let i = 1; i < ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    if (clamped[cur] <= clamped[prev]) {
      clamped[cur] = Math.round((clamped[prev] + 1) * 10) / 10;
    }
  }

  // Guarantee no cutoff exceeds 100 after backward relaxation pass
  for (let i = 0; i < desc.length; i++) {
    const cur = desc[i];
    if (clamped[cur] > 100) {
      clamped[cur] = 100;
    }
    if (i > 0) {
      const above = desc[i - 1];
      if (clamped[cur] >= clamped[above]) {
        clamped[cur] = Math.max(1, Math.round((clamped[above] - 1) * 10) / 10);
      }
    }
  }
  clamped["E"] = 0;

  return { cutoffs: clamped };
}

/**
 * Calculates strictly descending monotonic percentile / relative cutoffs.
 *
 * @param {number[]} marks - Array of student scores
 * @param {Record<string, number>} [fallbackCutoffs] - Default cutoffs for small cohort
 * @returns {{ cutoffs: Record<string, number>, warning?: string }}
 */
export function calculatePercentileCutoffs(marks, fallbackCutoffs = DEFAULT_CUTOFFS) {
  const valid = marks.filter(m => typeof m === "number" && !isNaN(m));
  if (valid.length < 3) {
    return {
      cutoffs: { ...fallbackCutoffs },
      warning: "Cohort size is too small (N < 3) for percentile distribution. Standard BITS defaults applied."
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const getPercentile = (p) => {
    const rank = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(rank);
    const upper = Math.ceil(rank);
    const weight = rank - lower;
    if (upper >= sorted.length) return sorted[sorted.length - 1];
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  };

  const raw = {
    "A":  Math.round(getPercentile(90) * 10) / 10,
    "A-": Math.round(getPercentile(75) * 10) / 10,
    "B":  Math.round(getPercentile(60) * 10) / 10,
    "B-": Math.round(getPercentile(45) * 10) / 10,
    "C":  Math.round(getPercentile(30) * 10) / 10,
    "C-": Math.round(getPercentile(20) * 10) / 10,
    "D":  Math.round(getPercentile(10) * 10) / 10,
    "E":  0
  };

  // General clamp to [1, 100] for all grades above E, baseline E = 0
  const clamped = { ...raw };
  const desc = ["A", "A-", "B", "B-", "C", "C-", "D"];
  for (const g of desc) {
    clamped[g] = Math.min(100, Math.max(1, clamped[g]));
  }
  clamped["E"] = 0;

  // Forward pass: ensure strictly descending
  for (let i = 1; i < desc.length; i++) {
    const cur = desc[i];
    const above = desc[i - 1];
    if (clamped[cur] >= clamped[above]) {
      clamped[cur] = Math.max(1, Math.round((clamped[above] - 1) * 10) / 10);
    }
  }

  // Backward relaxation pass to guarantee strict inequality: c[i] > c[i-1] (E -> A)
  const ordered = ["E", "D", "C-", "C", "B-", "B", "A-", "A"];
  for (let i = 1; i < ordered.length; i++) {
    const cur = ordered[i];
    const prev = ordered[i - 1];
    if (clamped[cur] <= clamped[prev]) {
      clamped[cur] = Math.round((clamped[prev] + 1) * 10) / 10;
    }
  }

  // Guarantee no cutoff exceeds 100 after backward relaxation pass
  for (let i = 0; i < desc.length; i++) {
    const cur = desc[i];
    if (clamped[cur] > 100) {
      clamped[cur] = 100;
    }
    if (i > 0) {
      const above = desc[i - 1];
      if (clamped[cur] >= clamped[above]) {
        clamped[cur] = Math.max(1, Math.round((clamped[above] - 1) * 10) / 10);
      }
    }
  }
  clamped["E"] = 0;

  return { cutoffs: clamped };
}

/**
 * Validates raw spreadsheet rows against institutional data standards.
 *
 * @param {Array<Record<string, any>>} rows - Raw rows parsed from Excel/CSV
 * @returns {{ valid: boolean, cleanRows: Array<Record<string, any>>, errors: Array<{ row: number, id: string, message: string }>, summary: { total: number, validCount: number, errorCount: number } }}
 */
export function validateSpreadsheetData(rows) {
  const errors = [];
  const cleanRows = [];
  const seenStudentCourses = new Set();

  if (!rows || !rows.length) {
    return {
      valid: false,
      cleanRows: [],
      errors: [{ row: 0, id: "FILE_EMPTY", message: "Spreadsheet contains no records or data rows." }],
      summary: { total: 0, validCount: 0, errorCount: 1 }
    };
  }

  // Header Aliasing & Normalization
  const sample = rows[0];
  const keys = Object.keys(sample);

  const idKey = keys.find(k => /bits[\s_-]*id|student[\s_-]*id|id|enrollment/i.test(k.trim()));
  const courseKey = keys.find(k => /course[\s_-]*(code|name|title)?|subject/i.test(k.trim()));
  const marksKey = keys.find(k => /total[\s_-]*marks|final[\s_-]*score|marks|score|total/i.test(k.trim()));

  if (!idKey || !courseKey || !marksKey) {
    const missing = [];
    if (!idKey) missing.push("BITS ID");
    if (!courseKey) missing.push("Course");
    if (!marksKey) missing.push("Total Marks");

    return {
      valid: false,
      cleanRows: [],
      errors: [{
        row: 1,
        id: "HEADER_MISSING",
        message: `Missing mandatory column header(s): ${missing.join(", ")}. Found columns: [${keys.join(", ")}]`
      }],
      summary: { total: rows.length, validCount: 0, errorCount: 1 }
    };
  }

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-based index plus header row
    const rawId = row[idKey];
    const rawCourse = row[courseKey];
    const rawMarks = row[marksKey];

    // 1. Check ID existence
    if (rawId === undefined || rawId === null || String(rawId).trim() === "") {
      errors.push({ row: rowNum, id: "BLANK_ID", message: "Student BITS ID is blank or missing." });
      return;
    }
    const id = String(rawId).trim().toUpperCase();

    // 2. Check Course existence
    if (rawCourse === undefined || rawCourse === null || String(rawCourse).trim() === "") {
      errors.push({ row: rowNum, id, message: "Course name is blank." });
      return;
    }
    const course = String(rawCourse).trim();

    // 3. Duplicate ID check per course
    const compositeKey = `${course}::${id}`;
    if (seenStudentCourses.has(compositeKey)) {
      errors.push({ row: rowNum, id, message: `Duplicate BITS ID '${id}' found for course '${course}'.` });
      return;
    }
    seenStudentCourses.add(compositeKey);

    // 4. Numeric check
    if (rawMarks === undefined || rawMarks === null || String(rawMarks).trim() === "") {
      errors.push({ row: rowNum, id, message: "Total Marks value is empty/missing." });
      return;
    }
    const marksNum = Number(rawMarks);
    if (isNaN(marksNum)) {
      errors.push({ row: rowNum, id, message: `Marks value '${rawMarks}' is not a valid number.` });
      return;
    }

    // 5. Bounds check: 0 to 100
    if (marksNum < 0 || marksNum > 100) {
      errors.push({ row: rowNum, id, message: `Marks value (${marksNum}) is out of permissible range (0 to 100).` });
      return;
    }

    // Row is clean
    const cleanRow = {
      "BITS ID": id,
      "Course": course,
      "Total Marks": marksNum
    };

    // Preserve any auxiliary multi-component exam columns
    for (const [k, v] of Object.entries(row)) {
      if (k !== idKey && k !== courseKey && k !== marksKey) {
        cleanRow[k] = v;
      }
    }

    cleanRows.push(cleanRow);
  });

  return {
    valid: errors.length === 0,
    cleanRows,
    errors,
    summary: {
      total: rows.length,
      validCount: cleanRows.length,
      errorCount: errors.length
    }
  };
}

/**
 * Audits student distribution against configurable distribution guardrails (default thresholds are illustrative).
 *
 * @param {number[]} marks - Array of student total marks
 * @param {Record<string, number>} cutoffs - Minimum threshold per grade
 * @param {{ maxA: number, maxE: number, minMid: number }} [rules] - Percentage thresholds
 * @returns {{ compliant: boolean, severity: "ok"|"warn"|"danger", message: string, metrics: { pctA: number, pctE: number, pctMid: number } }}
 */
export function checkGuardrails(marks, cutoffs, rules = { maxA: 15, maxE: 20, minMid: 35 }) {
  if (!marks || !marks.length) {
    return {
      compliant: true,
      severity: "ok",
      message: "No active cohort selected.",
      metrics: { pctA: 0, pctE: 0, pctMid: 0 }
    };
  }

  const total = marks.length;
  let countA = 0;
  let countE = 0;
  let countMid = 0;

  marks.forEach(m => {
    const g = assignGrade(m, cutoffs);
    if (g === "A") countA++;
    else if (g === "E") countE++;
    else if (g === "B" || g === "B-" || g === "C") countMid++;
  });

  const pctA = Math.round((countA / total) * 1000) / 10;
  const pctE = Math.round((countE / total) * 1000) / 10;
  const pctMid = Math.round((countMid / total) * 1000) / 10;

  const violations = [];
  let isDanger = false;

  if (pctA > rules.maxA) {
    violations.push(`Grade 'A' allocation (${pctA}%) exceeds institutional ceiling (${rules.maxA}%)`);
    isDanger = true;
  }
  if (pctE > rules.maxE) {
    violations.push(`Fail Grade 'E' allocation (${pctE}%) exceeds limit (${rules.maxE}%)`);
    isDanger = true;
  }
  if (pctMid < rules.minMid) {
    violations.push(`Middle Grades B/B-/C (${pctMid}%) fall below recommended floor (${rules.minMid}%)`);
  }

  if (violations.length === 0) {
    return {
      compliant: true,
      severity: "ok",
      message: `Distribution complies with institutional guidelines (A: ${pctA}%, E: ${pctE}%, Mid: ${pctMid}%)`,
      metrics: { pctA, pctE, pctMid }
    };
  }

  return {
    compliant: false,
    severity: isDanger ? "danger" : "warn",
    message: violations.join(" • "),
    metrics: { pctA, pctE, pctMid }
  };
}

/**
 * Detects whether the spreadsheet contains multi-assessment component columns.
 *
 * @param {Array<Record<string, any>>} rows - Clean student rows
 * @returns {string[]} List of detected assessment component column names
 */
export function detectWeightedComponents(rows) {
  if (!rows || !rows.length) return [];
  const sample = rows[0];
  const keys = Object.keys(sample);
  const pattern = /quiz|midsem|compre|test|assignment|lab|project|practical/i;
  return keys.filter(k => {
    if (k === "BITS ID" || k === "Course" || k === "Total Marks") return false;
    return pattern.test(k);
  });
}

/**
 * Computes weighted total marks from raw assessment components.
 *
 * @param {Record<string, any>} row - Student row containing component marks
 * @param {Record<string, number>} weights - Weight map (e.g. { "Quiz": 20, "Midsem": 30, "Compre": 50 })
 * @returns {number} Computed total marks
 */
export function computeWeightedTotal(row, weights) {
  let total = 0;
  for (const [col, weight] of Object.entries(weights)) {
    const rawVal = parseFloat(row[col]);
    if (!isNaN(rawVal)) {
      total += rawVal * (weight / 100);
    }
  }
  return Math.round(total * 100) / 100;
}
