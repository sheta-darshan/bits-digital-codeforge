/**
 * BITS Pilani Digital — Advanced Grading Console
 * Test Suite: test.js
 * 
 * Plain JavaScript unit test suite covering critical domain and edge cases:
 * 1. Boundary Cutoff Semantics (mark == cutoff, mark < cutoff)
 * 2. Exact Decimal Precision (no rounding corruption)
 * 3. Empty Cohort Handling (N = 0)
 * 4. Zero Variance Handling (std = 0, identical scores)
 * 5. Extreme Boundary Scores (0.0 and 100.0)
 * 6. Formula Injection (CWE-1236) Sanitization
 * 7. Monotonic Descending Cutoff Invariants
 * 8. Spreadsheet Validation (Duplicates, Non-numerics, Out-of-bounds)
 * 9. Weighted Component Aggregation
 * 
 * Run with: node test.js
 */

import {
  GRADES,
  DEFAULT_CUTOFFS,
  assignGrade,
  computeStats,
  calculateGaussianCutoffs,
  calculatePercentileCutoffs,
  validateSpreadsheetData,
  checkGuardrails,
  detectWeightedComponents,
  computeWeightedTotal,
  formatGradeRange
} from './grading.js';

import {
  escapeHTML,
  sanitizeFormula,
  buildCSV,
  buildXLSXWorkbook
} from './io.js';

import XLSX from 'xlsx';

let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failedTests++;
    failures.push(message);
    console.error(`  \x1b[31m✖\x1b[0m ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  assert(match, `${message} — Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
}

console.log("\n\x1b[1m\x1b[34m====================================================================\x1b[0m");
console.log("\x1b[1m\x1b[34m BITS Pilani Digital — Advanced Grading Console Test Suite (Phase 5)\x1b[0m");
console.log("\x1b[1m\x1b[34m====================================================================\x1b[0m\n");

// --------------------------------------------------------------------------
// TEST SUITE 1: BOUNDARY CUTOFF SEMANTICS [min, derivedMax)
// --------------------------------------------------------------------------
console.log("\x1b[1m1. Boundary Cutoff Semantics:\x1b[0m");
{
  const cutoffs = { ...DEFAULT_CUTOFFS };

  // Exact minimum cutoffs
  assertEquals(assignGrade(80.0, cutoffs), "A", "Score exactly at 80.0 qualifies for Grade A");
  assertEquals(assignGrade(79.99, cutoffs), "A-", "Score of 79.99 falls strictly into Grade A-");
  assertEquals(assignGrade(70.0, cutoffs), "A-", "Score exactly at 70.0 qualifies for Grade A-");
  assertEquals(assignGrade(69.99, cutoffs), "B", "Score of 69.99 falls strictly into Grade B");
  assertEquals(assignGrade(60.0, cutoffs), "B", "Score exactly at 60.0 qualifies for Grade B");
  assertEquals(assignGrade(50.0, cutoffs), "B-", "Score exactly at 50.0 qualifies for Grade B-");
  assertEquals(assignGrade(40.0, cutoffs), "C", "Score exactly at 40.0 qualifies for Grade C");
  assertEquals(assignGrade(30.0, cutoffs), "C-", "Score exactly at 30.0 qualifies for Grade C-");
  assertEquals(assignGrade(29.9, cutoffs), "D", "Score below 30.0 (29.9) falls strictly into Grade D");
  assertEquals(assignGrade(20.0, cutoffs), "D", "Score exactly at 20.0 qualifies for Grade D");
  assertEquals(assignGrade(19.9, cutoffs), "E", "Score below 20.0 (19.9) receives Grade E");
  assertEquals(assignGrade(0.0, cutoffs), "E", "Baseline score of 0.0 receives Grade E");
  assertEquals(assignGrade(NaN, cutoffs), "NC", "Invalid NaN score returns NC (Not Computed)");
  assertEquals(assignGrade(null, cutoffs), "NC", "Null score returns NC");
}

// --------------------------------------------------------------------------
// TEST SUITE 2: DECIMAL MARKS PRECISION
// --------------------------------------------------------------------------
console.log("\n\x1b[1m2. Decimal Marks Precision (No Math.round corruption):\x1b[0m");
{
  const cutoffs = { ...DEFAULT_CUTOFFS };

  // In legacy implementation, 79.5 rounded up to 80 (Grade A). In Phase 1+ it must be A-
  assertEquals(assignGrade(79.5, cutoffs), "A-", "Score 79.5 is strictly < 80.0, resulting in A-");
  assertEquals(assignGrade(79.95, cutoffs), "A-", "Score 79.95 is strictly < 80.0, resulting in A-");
  assertEquals(assignGrade(64.25, cutoffs), "B", "Score 64.25 evaluates to Grade B");
  assertEquals(assignGrade(34.8, cutoffs), "C-", "Score 34.8 evaluates to Grade C- (>= 30.0 and < 40.0)");
  assertEquals(assignGrade(29.9, cutoffs), "D", "Score 29.9 evaluates to Grade D (>= 20.0 and < 30.0)");
  assertEquals(assignGrade(20.0, cutoffs), "D", "Score 20.0 evaluates to Grade D");
  assertEquals(assignGrade(19.9, cutoffs), "E", "Score 19.9 evaluates to Grade E (< 20.0)");
  assertEquals(assignGrade(0.5, cutoffs), "E", "Score 0.5 evaluates to Grade E");
}

// --------------------------------------------------------------------------
// TEST SUITE 3: EMPTY COHORT HANDLING (N = 0)
// --------------------------------------------------------------------------
console.log("\n\x1b[1m3. Empty Cohort Handling (N = 0):\x1b[0m");
{
  const emptyMarks = [];
  const stats = computeStats(emptyMarks);
  assertEquals(stats.count, 0, "Empty cohort count is 0");
  assertEquals(stats.mean, "-", "Empty cohort mean is placeholder '-'");
  assertEquals(stats.median, "-", "Empty cohort median is placeholder '-'");
  assertEquals(stats.min, "-", "Empty cohort min is placeholder '-'");
  assertEquals(stats.max, "-", "Empty cohort max is placeholder '-'");

  const gRes = calculateGaussianCutoffs(emptyMarks);
  assert(gRes.warning !== undefined, "Gaussian curving detects empty cohort and generates warning");
  assertEquals(gRes.cutoffs, DEFAULT_CUTOFFS, "Gaussian curving safely falls back to standard defaults for N=0");

  const pRes = calculatePercentileCutoffs(emptyMarks);
  assert(pRes.warning !== undefined, "Percentile curving detects empty cohort and generates warning");
  assertEquals(pRes.cutoffs, DEFAULT_CUTOFFS, "Percentile curving safely falls back to standard defaults for N=0");

  const guard = checkGuardrails(emptyMarks, DEFAULT_CUTOFFS);
  assertEquals(guard.compliant, true, "Empty cohort complies with guardrails without exceptions");
}

// --------------------------------------------------------------------------
// TEST SUITE 4: ZERO VARIANCE COHORT (std = 0)
// --------------------------------------------------------------------------
console.log("\n\x1b[1m4. Zero Variance Cohort (std = 0, Identical Marks):\x1b[0m");
{
  const uniformMarks = [75, 75, 75, 75, 75, 75, 75];
  const stats = computeStats(uniformMarks);
  assertEquals(stats.mean, "75.00", "Mean of uniform marks is 75.00");
  assertEquals(stats.std, "0.00", "Standard deviation of uniform cohort is strictly 0.00");

  const gRes = calculateGaussianCutoffs(uniformMarks);
  assert(gRes.warning !== undefined && gRes.warning.includes("Zero score variance"), "Gaussian curving identifies std=0 condition");
  assertEquals(gRes.cutoffs, DEFAULT_CUTOFFS, "Zero variance cohort safely falls back to standard defaults (no division by zero)");
}

// --------------------------------------------------------------------------
// TEST SUITE 5: EXTREME BOUNDARY SCORES (0 and 100)
// --------------------------------------------------------------------------
console.log("\n\x1b[1m5. Extreme Boundary Scores (0.0 and 100.0):\x1b[0m");
{
  const extremeMarks = [0, 50, 100];
  const stats = computeStats(extremeMarks);
  assertEquals(stats.min, 0, "Minimum score correctly reports 0");
  assertEquals(stats.max, 100, "Maximum score correctly reports 100");
  assertEquals(stats.mean, "50.00", "Mean score correctly computes 50.00");
  assertEquals(assignGrade(100.0, DEFAULT_CUTOFFS), "A", "Score 100.0 awards Grade A");
  assertEquals(assignGrade(0.0, DEFAULT_CUTOFFS), "E", "Score 0.0 awards Grade E");
}

// --------------------------------------------------------------------------
// TEST SUITE 6: MONOTONIC CUTOFF PRESERVATION INVARIANTS
// --------------------------------------------------------------------------
console.log("\n\x1b[1m6. Monotonic Descending Cutoff Invariants:\x1b[0m");
{
  const marks = [24, 38, 42, 55, 61, 68, 72, 79, 84, 91, 98];
  const gRes = calculateGaussianCutoffs(marks);
  const pRes = calculatePercentileCutoffs(marks);

  function verifyStrictlyDescending(cutoffs, label) {
    let ok = true;
    for (let i = 0; i < GRADES.length - 1; i++) {
      const gHigh = GRADES[i];
      const gLow = GRADES[i + 1];
      if (cutoffs[gHigh] <= cutoffs[gLow]) {
        ok = false;
        break;
      }
    }
    assert(ok, `${label} maintains strictly descending order: c(A) > c(A-) > ... > c(E)=0`);
  }

  verifyStrictlyDescending(gRes.cutoffs, "Gaussian Presets");
  verifyStrictlyDescending(pRes.cutoffs, "Percentile Presets");

  // High-score cohorts test (Phase 2): [98, 99, 100, 100, 100] and [95, 96, 97, 98, 99, 100]
  const highScores1 = [98, 99, 100, 100, 100];
  const highScores2 = [95, 96, 97, 98, 99, 100];

  function verifyHighScores(cutoffs, label) {
    verifyStrictlyDescending(cutoffs, label);
    assertEquals(cutoffs["E"], 0, `${label} strictly sets E = 0`);
    for (const g of GRADES) {
      assert(cutoffs[g] <= 100, `${label} cutoff for Grade ${g} (${cutoffs[g]}) is <= 100`);
    }
  }

  const gHigh1 = calculateGaussianCutoffs(highScores1);
  const pHigh1 = calculatePercentileCutoffs(highScores1);
  verifyHighScores(gHigh1.cutoffs, "Gaussian high-score cohort 1 [98..100]");
  verifyHighScores(pHigh1.cutoffs, "Percentile high-score cohort 1 [98..100]");

  const gHigh2 = calculateGaussianCutoffs(highScores2);
  const pHigh2 = calculatePercentileCutoffs(highScores2);
  verifyHighScores(gHigh2.cutoffs, "Gaussian high-score cohort 2 [95..100]");
  verifyHighScores(pHigh2.cutoffs, "Percentile high-score cohort 2 [95..100]");
}

// --------------------------------------------------------------------------
// TEST SUITE 7: FORMULA INJECTION SANITIZATION (CWE-1236)
// --------------------------------------------------------------------------
console.log("\n\x1b[1m7. Formula Injection Sanitization (CWE-1236):\x1b[0m");
{
  assertEquals(sanitizeFormula("=cmd|'/C calc'!A0"), "'=cmd|'/C calc'!A0", "Neutralizes formula starting with '='");
  assertEquals(sanitizeFormula("+12345"), "'+12345", "Neutralizes formula starting with '+'");
  assertEquals(sanitizeFormula("-2+5"), "'-2+5", "Neutralizes formula starting with '-'");
  assertEquals(sanitizeFormula("@SUM(A1:A10)"), "'@SUM(A1:A10)", "Neutralizes formula starting with '@'");
  assertEquals(sanitizeFormula("\tHYPERLINK"), "'\tHYPERLINK", "Neutralizes tab character prefix");
  assertEquals(sanitizeFormula("2024A7PS0012P"), "2024A7PS0012P", "Safe student ID string is preserved unaltered");
}

// --------------------------------------------------------------------------
// TEST SUITE 8: SPREADSHEET VALIDATION ENGINE
// --------------------------------------------------------------------------
console.log("\n\x1b[1m8. Spreadsheet Validation Engine:\x1b[0m");
{
  // Test Missing Column Headers
  const invalidHeaders = [{ "Student": "2024A7PS0001P", "Marks": 80 }];
  const val1 = validateSpreadsheetData(invalidHeaders);
  assertEquals(val1.valid, false, "Flags missing mandatory columns");
  assertEquals(val1.errors[0].id, "HEADER_MISSING", "Reports HEADER_MISSING error code");

  // Test Out-of-bounds, duplicate ID, and non-numeric
  const dirtyData = [
    { "BITS ID": "2024A7PS0001P", "Course": "CS F211", "Total Marks": 85 },
    { "BITS ID": "2024A7PS0001P", "Course": "CS F211", "Total Marks": 90 }, // Duplicate
    { "BITS ID": "2024A7PS0002P", "Course": "CS F211", "Total Marks": -5 },  // Out of bounds (<0)
    { "BITS ID": "2024A7PS0003P", "Course": "CS F211", "Total Marks": 105 }, // Out of bounds (>100)
    { "BITS ID": "2024A7PS0004P", "Course": "CS F211", "Total Marks": "AB" }, // Non-numeric
    { "BITS ID": "2024A7PS0005P", "Course": "CS F211", "Total Marks": 76.5 }  // Valid decimal
  ];
  const val2 = validateSpreadsheetData(dirtyData);
  assertEquals(val2.valid, false, "Flags dataset containing dirty rows");
  assertEquals(val2.summary.validCount, 2, "Identifies exactly 2 valid student rows");
  assertEquals(val2.summary.errorCount, 4, "Identifies exactly 4 erroneous rows");
  assertEquals(val2.cleanRows[0]["Total Marks"], 85, "Preserves valid student mark");
  assertEquals(val2.cleanRows[1]["Total Marks"], 76.5, "Preserves valid decimal student mark");
}

// --------------------------------------------------------------------------
// TEST SUITE 9: WEIGHTED ASSESSMENT COMPONENTS
// --------------------------------------------------------------------------
console.log("\n\x1b[1m9. Weighted Assessment Components:\x1b[0m");
{
  const student = {
    "BITS ID": "2024A7PS0050P",
    "Quiz": 80,      // 20% weight = 16
    "Midsem": 70,    // 30% weight = 21
    "Compre": 90     // 50% weight = 45
  };
  const weights = { "Quiz": 20, "Midsem": 30, "Compre": 50 };
  const total = computeWeightedTotal(student, weights);
  assertEquals(total, 82, "Accurately computes weighted total: 16 + 21 + 45 = 82");

  const sampleRows = [
    { "BITS ID": "1", "Course": "CS", "Total Marks": 50, "Quiz": 10, "Midsem": 20, "Compre": 30, "RandomNote": "hello" }
  ];
  const detected = detectWeightedComponents(sampleRows);
  assertEquals(detected, ["Quiz", "Midsem", "Compre"], "Detects Quiz, Midsem, Compre and ignores non-exam columns");
}

// --------------------------------------------------------------------------
// TEST SUITE 10: MATHEMATICAL GRADE RANGE INTERVAL FORMATTING (XLSX & UI)
// --------------------------------------------------------------------------
console.log("\n\x1b[1m10. Mathematical Grade Range Interval Formatting:\x1b[0m");
{
  const expectedRanges = {
    "A": "[80, 100]",
    "A-": "[70, 80)",
    "B": "[60, 70)",
    "B-": "[50, 60)",
    "C": "[40, 50)",
    "C-": "[30, 40)",
    "D": "[20, 30)",
    "E": "[0, 20)"
  };

  for (const grade of GRADES) {
    const formatted = formatGradeRange(grade, DEFAULT_CUTOFFS);
    assertEquals(formatted, expectedRanges[grade], `Grade ${grade} interval is formatted cleanly as ${expectedRanges[grade]}`);
  }

  // Verify that buildXLSXWorkbook writes these exact clean intervals into Grading Criteria sheet
  const wb = buildXLSXWorkbook({
    instructor: "Dr. Faculty",
    course: "CS F211 Data Structures",
    students: [{ "BITS ID": "2024A7PS0001P", "Total Marks": 85 }],
    cutoffs: DEFAULT_CUTOFFS,
    XLSXLib: XLSX
  });
  const criteriaSheet = wb.Sheets["Grading Criteria"];
  const rows = XLSX.utils.sheet_to_json(criteriaSheet);
  const aRow = rows.find(r => r.Metric === "Grade A Range");
  const aMinusRow = rows.find(r => r.Metric === "Grade A- Range");
  const eRow = rows.find(r => r.Metric === "Grade E Range");
  assertEquals(aRow?.Value, "[80, 100]", "XLSX Grading Criteria contains Grade A Range [80, 100]");
  assertEquals(aMinusRow?.Value, "[70, 80)", "XLSX Grading Criteria contains Grade A- Range [70, 80)");
  assertEquals(eRow?.Value, "[0, 20)", "XLSX Grading Criteria contains Grade E Range [0, 20)");
}

// --------------------------------------------------------------------------
// FINAL TEST SUMMARY REPORT
// --------------------------------------------------------------------------
console.log("\n\x1b[1m\x1b[34m--------------------------------------------------------------------\x1b[0m");
console.log(`\x1b[1mTotal Tests:\x1b[0m ${passedTests + failedTests}`);
console.log(`\x1b[1m\x1b[32mPassed:\x1b[0m ${passedTests}`);
console.log(`\x1b[1m\x1b[31mFailed:\x1b[0m ${failedTests}`);
console.log("\x1b[1m\x1b[34m--------------------------------------------------------------------\x1b[0m\n");

if (failedTests > 0) {
  console.error("\x1b[31mFailures occurred in the test suite:\x1b[0m");
  failures.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log("\x1b[1m\x1b[32m✔ All test suites passed successfully with zero failures!\x1b[0m\n");
  process.exit(0);
}
