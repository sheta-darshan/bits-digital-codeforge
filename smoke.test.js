/**
 * BITS Pilani Digital — Advanced Grading Console
 * Phase 3 Smoke Test: sample_marks.xlsx Ingestion & DOM Wiring Verification
 * 
 * Run via: node smoke.test.js (or npm run smoke)
 */

import fs from 'node:fs';
import XLSX from 'xlsx';
import { parseSpreadsheet } from './io.js';
import { validateSpreadsheetData } from './grading.js';

console.log("\n\x1b[1m\x1b[34m====================================================================\x1b[0m");
console.log("\x1b[1m\x1b[34m BITS Pilani Digital — Smoke Test Suite (sample_marks.xlsx & DOM) \x1b[0m");
console.log("\x1b[1m\x1b[34m====================================================================\x1b[0m\n");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${message}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✖\x1b[0m ${message}`);
  }
}

function assertEquals(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${message} — Expected: ${expectedStr}, Got: ${actualStr}`);
  } else {
    failed++;
    console.error(`  \x1b[31m✖\x1b[0m ${message} — Expected: ${expectedStr}, Got: ${actualStr}`);
  }
}

async function runSmokeTests() {
  console.log("\x1b[1m1. Spreadsheet Ingestion & Validation (sample_marks.xlsx):\x1b[0m");

  assert(typeof XLSX?.read === "function", "SheetJS (XLSX) local package loaded successfully (offline/CI ready)");

  // Read sample_marks.xlsx
  const fileBuffer = fs.readFileSync("sample_marks.xlsx");
  const u8Array = new Uint8Array(fileBuffer);

  const parseResult = parseSpreadsheet(u8Array, XLSX);
  assertEquals(parseResult.success, true, "parseSpreadsheet successfully parses sample_marks.xlsx");
  assertEquals(parseResult.rows?.length, 180, "Spreadsheet contains exactly 180 raw records");

  const validationResult = validateSpreadsheetData(parseResult.rows);
  assertEquals(validationResult.valid, true, "Dataset validation reports overall valid status (valid = true)");
  assertEquals(validationResult.errors.length, 0, "Spreadsheet has exactly zero data validation errors");
  assertEquals(validationResult.cleanRows.length, 180, "Spreadsheet yields exactly 180 clean, usable student rows");

  // Verify Course Groupings
  const courses = [...new Set(validationResult.cleanRows.map(r => r.Course))];
  assertEquals(courses.length, 3, "Dataset contains exactly 3 distinct courses");

  // Expected course stats per sample_marks.xlsx:
  // CS F211 Data Structures: 60 students, min 31, max 100
  // MATH F111 Mathematics I: 60 students, min 25, max 90
  // ECON F211 Principles of Economics: 60 students, min 40, max 96
  const expectedCourseStats = {
    "CS F211 Data Structures": { count: 60, min: 31, max: 100 },
    "MATH F111 Mathematics I": { count: 60, min: 25, max: 90 },
    "ECON F211 Principles of Economics": { count: 60, min: 40, max: 96 }
  };

  for (const [courseName, expected] of Object.entries(expectedCourseStats)) {
    const courseRows = validationResult.cleanRows.filter(r => r.Course === courseName);
    assertEquals(courseRows.length, expected.count, `${courseName} cohort size matches expected (${expected.count})`);

    const marks = courseRows.map(r => Number(r["Total Marks"]));
    const actualMin = Math.min(...marks);
    const actualMax = Math.max(...marks);

    assertEquals(actualMin, expected.min, `${courseName} minimum mark matches data (${expected.min})`);
    assertEquals(actualMax, expected.max, `${courseName} maximum mark matches data (${expected.max})`);
  }

  // --------------------------------------------------------------------------
  // DOM ELEMENT ID CROSS-CHECK (ui.js vs index.html)
  // --------------------------------------------------------------------------
  console.log("\n\x1b[1m2. DOM Wiring Audit (ui.js references vs index.html declarations):\x1b[0m");

  const uiContent = fs.readFileSync("ui.js", "utf8");
  const htmlContent = fs.readFileSync("index.html", "utf8");

  // Extract all IDs declared in index.html
  const htmlIds = new Set([...htmlContent.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]));

  // Extract static getElementById, getEl, and querySelector(#id) in ui.js
  const idCalls = [...uiContent.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(m => m[1]);
  const getElCalls = [...uiContent.matchAll(/getEl\(["']([^"']+)["']/g)].map(m => m[1]);
  const qsCalls = [...uiContent.matchAll(/querySelector\(["']#([^"'\s,>+~:]+)["']\)/g)].map(m => m[1]);

  const allStaticReferencedIds = [...new Set([...idCalls, ...getElCalls, ...qsCalls])];

  const missingIds = [];
  for (const id of allStaticReferencedIds) {
    if (!htmlIds.has(id)) {
      missingIds.push(id);
    }
  }

  assertEquals(missingIds.length, 0, `All static DOM IDs referenced in ui.js exist in index.html (Found: ${allStaticReferencedIds.length}, Missing: 0)`);
  if (missingIds.length > 0) {
    console.error("  Missing IDs:", missingIds);
  }

  // --------------------------------------------------------------------------
  // DYNAMIC TEMPLATE-LITERAL ID AUDIT
  // --------------------------------------------------------------------------
  console.log("\n\x1b[1m3. Dynamic Template-Literal ID Audit:\x1b[0m");
  const dynamicTemplateMatches = [
    ...uiContent.matchAll(/getElementById\(`([^`]*\$\{[^`]+}[^`]*)`\)/g),
    ...uiContent.matchAll(/getEl\(`([^`]*\$\{[^`]+}[^`]*)`\)/g),
    ...uiContent.matchAll(/querySelector\(`#([^`]*\$\{[^`]+}[^`]*)`\)/g)
  ].map(m => m[1]);
  const uniqueDynamicPatterns = [...new Set(dynamicTemplateMatches)];

  const dynamicVerifications = [
    { pattern: "${g}min", description: "Grade cutoff minimum input elements (`Amin`..`Emin`) generated dynamically in renderGradeCutoffInputs" },
    { pattern: "${g}max", description: "Derived grade cutoff maximum elements (`Amax`..`Emax`) generated dynamically in renderGradeCutoffInputs" },
    { pattern: "chip_${g}", description: "Grade distribution student count chips (`chip_A`..`chip_E`) rendered in grade cards" },
    { pattern: "thScen${sIdx}", description: "Scenario comparison matrix column headers (`thScen0`..`thScen2`) generated in updateScenarioUI" },
    { pattern: "label_val_", description: "Validation modal course selection checkboxes generated in showValidationModal" }
  ];

  for (const dv of dynamicVerifications) {
    const presentInUi = uniqueDynamicPatterns.some(p => p.includes(dv.pattern));
    assert(presentInUi, `Dynamic template ID \`${dv.pattern}\`: ${dv.description} [dynamic, manually verified]`);
  }

  // --------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------");
  console.log(`Smoke Test Assertions: ${passed + failed}`);
  console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${failed}\x1b[0m`);
  console.log("--------------------------------------------------------------------\n");

  if (failed > 0) {
    console.error(`\x1b[31m✖ Smoke test failed with ${failed} failing assertion(s).\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✔ All smoke test assertions passed successfully!\x1b[0m\n`);
    process.exit(0);
  }
}

runSmokeTests();
