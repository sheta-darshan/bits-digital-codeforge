# BITS Pilani Advanced Grading Console — Changelog

All notable changes across development phases are documented in this file.

---

## [Phase 1] — Correctness & Refactor

### Summary of Changes
1. **Unified Grade Assignment Engine (`assignGrade`)**:
   - Replaced four separate, divergent grade-assignment loops (student roster rendering, CSV export, multi-sheet XLSX export, and summary grade count pills) with a single, pure, side-effect-free function:
     ```js
     function assignGrade(mark, cutoffs)
     ```
   - Standardized unassignable / invalid marks to return `"NC"` (Not Computed).

2. **Exact Decimal Marks & Minimum-Cutoff Grade Bands**:
   - Eliminated `Math.round()` from mark ingestion, KPI calculations, and roster display, fully supporting decimal marks (e.g., `79.5`, `64.25`).
   - Defined grade bands strictly by their minimum cutoff:
     $$\text{Grade } G_i \iff \text{mark} \ge \text{cutoff}(G_i) \text{ and } \text{mark} < \text{cutoff}(G_{i-1})$$
     (with Grade A having an upper bound of $100.0$ and Grade E having a fixed baseline of $0.0$).
   - Mathematically eliminates the possibility of gaps or overlaps between neighboring grade bands.
   - Refactored the UI so that the "Max" input for each grade is automatically derived and displayed as `< Cutoff(UpperGrade)` (read-only and disabled), while the editable "Min" input drives the threshold.

3. **Robust Gaussian & Percentile Presets**:
   - Replaced legacy arbitrary clamps and fixed floors with a general clamp to `[1, 100]` (with $E=0$), followed by forward and backward strictly descending monotonic passes, with an upper cap at 100.
   - Enforced strict monotonic descending order ($c_A > c_{A-} > c_B > c_{B-} > c_C > c_{C-} > c_D > c_E = 0$) using forward and backward constrained relaxation passes.
   - Added guards for zero-variance cohorts ($\sigma = 0$ / identical scores) and small classes ($N < 3$), falling back to BITS standard defaults with a non-intrusive warning toast notification.

4. **Spreadsheet Upload Validation Engine & Reconciliation Modal**:
   - Created `validateSpreadsheetData(rows)` to analyze uploaded files before applying data to state.
   - Identifies:
     - Missing mandatory columns (`BITS ID`, `Course`, `Total Marks` with flexible alias matching).
     - Duplicate student BITS IDs within the same course.
     - Blank or non-numeric marks.
     - Out-of-bounds marks ($< 0$ or $> 100$).
   - Introduced an interactive validation modal allowing professors to review row-by-row errors and choose to **"Exclude Flagged Rows & Proceed"** or **"Cancel Upload"**.

---

### Grade Alteration Flags & Assumptions

> [!WARNING]
> **Behavioral Change Altering Student Grades**:
> 1. **Decimal Precision vs. Integer Rounding**:
>    - *Previous Behavior*: Student marks were coerced via `Math.round(mark)`. A student scoring `79.5` was rounded up to `80`, qualifying for grade `A` under default cutoffs (`A >= 80`).
>    - *Phase 1 Behavior*: Marks retain true floating-point values without rounding. A mark of `79.5` is strictly `< 80.0`, resulting in grade `A-` unless the instructor adjusts the cutoff threshold to `79.5`.
> 2. **Derived Upper-Bound Interval Semantics**:
>    - Grade bands now strictly operate on semi-open intervals $[c_{G_i}, c_{G_{i-1}})$. A score exactly matching an upper grade's cutoff moves into the upper grade.
> 3. **E Grade Baseline**:
>    - Assumption: Grade `E` represents the failing / lowest baseline and its minimum cutoff is anchored at `0.0`.

---

## [Phase 2] — Security & Robustness

### Summary of Changes
1. **DOM XSS Sanitization (`escapeHTML`)**:
   - Implemented standard HTML entity encoder `escapeHTML(str)` to neutralize `<`, `>`, `&`, `"`, and `'`.
   - Sanitized all dynamic user-controlled strings (student `BITS ID`, `Course` names, `Instructor Name`, validation error messages, and table row indices) prior to rendering inside `rosterBody.innerHTML` and `validationTableBody.innerHTML`.

2. **CSV & Spreadsheet Formula Injection Guard (`sanitizeFormula`)**:
   - Addressed CWE-1236 (Improper Neutralization of Formula Elements in CSV/Spreadsheet File).
   - Sanitized all exported cells starting with `= `, `+`, `-`, `@`, `\t`, or `\r` by prefixing a single quote `'` in both RFC 4180 CSV export (`btnExportCSV`) and multi-sheet Excel export (`btnExportXLSX`).
   - Prevents arbitrary formula execution, external command execution (DDE), and hyperlink execution when faculty open exported spreadsheets in Microsoft Excel, Apple Numbers, or LibreOffice Calc.

3. **Pinned SheetJS Dependency & Load-Failure Error Boundary**:
   - Pinned SheetJS CDN from floating latest to exact production release `xlsx@0.18.5`:
     ```html
     <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js" onerror="handleSheetJSLoadError()"></script>
     ```
   - Added `handleSheetJSLoadError()` and `#cdnErrorBanner` warning alert. If the CDN fails to load (due to an active ad-blocker, firewall, or offline network):
     - Displays a branded, accessible warning alert explaining that Excel features are offline.
     - Gracefully disables the Excel upload and XLSX export buttons with helpful tooltips.
     - Preserves CSV export and manual/demo grading capabilities.

4. **Robust File Ingestion Error Handling**:
   - Wrapped file reading and SheetJS parsing in comprehensive `try/catch` error boundaries.
   - Added specific diagnostics for:
     - Password-protected / encrypted spreadsheets.
     - Corrupted or unrecognized workbook formats.
     - Empty workbooks or missing sheets.
     - Empty data sheets lacking student records.
   - Handled `FileReader.onerror` for disk permission failures, ensuring the UI never gets stuck in a loading state.

---

### Grade Alteration Flags & Assumptions

> [!NOTE]
> **No Grade Alterations in Phase 2**:
> All Phase 2 enhancements are focused on security, data sanitization, CDN fault-tolerance, and error boundaries. No grade calculation logic, cutoffs, or rounding rules were changed in this phase.

---

## [Phase 3] — Features & Advanced Analytics

### Summary of Changes
1. **Autosave Session & Privacy-Compliant Restoration**:
   - Implemented debounced `localStorage` persistence saving course name, instructor name, active cutoffs, active filters, guardrail criteria, and saved scenarios.
   - **Privacy Protection**: Student marks and IDs are strictly excluded from local storage unless the instructor explicitly authorizes storage via the `#chkPersistStudentData` consent checkbox.
   - On page load, detects previous autosaved sessions and displays a branded restore prompt banner (`#restoreBanner`) with session timestamp, course, and instructor metadata.

2. **Undo / Redo Architecture (`Ctrl+Z` / `Ctrl+Y`) & Live Change Log**:
   - Maintained state history stacks (`undoStack` and `redoStack`) tracking cutoff adjustments.
   - Wired keyboard shortcuts (`Ctrl+Z` to undo, `Ctrl+Y` / `Ctrl+Shift+Z` to redo) with corresponding toolbar buttons.
   - Built a collapsible **Audit Change Log** displaying a chronological record of adjustments (timestamp, affected grade, previous cutoff, new cutoff, and delta).
   - Embedded the change log into RFC 4180 CSV export (as an appendix section) and multi-sheet Excel export (as a dedicated `"Audit Change Log"` worksheet tab).

3. **Scenario Comparison (Up to 3 Named Cutoff Sets)**:
   - Added ability to save up to 3 named cutoff sets (e.g., "Conservative", "Lenient Relative", "Senate Proposal").
   - Built an interactive comparison matrix displaying:
     - Cutoffs and student counts across the Active Set and all saved scenarios.
     - **Grade Shift Metric**: Calculates the exact number and percentage of students whose letter grade would change under each scenario compared to the active baseline.
     - One-click `Apply` (loads scenario into active cutoffs) and `Delete` actions.

4. **Distribution Guardrails**:
   - Added real-time inline distribution monitoring against institutional guidelines:
     - Maximum Grade 'A' ceiling (default: 15%).
     - Maximum Fail Grade 'E' ceiling (default: 20%).
     - Minimum Middle Grades 'B'/'B-'/'C' recommendation (default: 35%).
   - Displays inline color-coded status badges (`✅ Compliant`, `⚠️ Warning`, or `🚨 Danger Alert`) adjacent to the histogram.
   - Added a configuration modal allowing professors to adjust institutional thresholds per course.

5. **Draggable Cutoff Markers on Histogram Canvas**:
   - Enhanced the HTML5 canvas histogram by rendering interactive pill handles with grade letters atop each cutoff marker.
   - Supported mouse dragging (`mousedown`, `mousemove`, `mouseup`) and mobile/tablet touch gestures (`touchstart`, `touchmove`, `touchend`).
   - Dragging handles updates cutoffs, derived upper bounds, KPIs, and student rosters in real time with smooth 0.5-mark snap resolution.

6. **Optional Weighted Components**:
   - Automatically detects spreadsheets with multi-component assessment columns (e.g., `Quiz`, `Midsem`, `Comprehensive`, `Lab`, `Assignment`).
   - When $\ge 2$ assessment columns are found, reveals the **Weighted Component Marks Calculator** (`#weightedCard`).
   - Allows instructors to set percentage weightages (with automatic sum validation and reset to equal weights).
   - Computes weighted `Total Marks` for each student dynamically while preserving original component scores.

---

### Grade Alteration Flags & Assumptions

> [!WARNING]
> **Behavioral Notes on Phase 3 Features**:
> 1. **Weighted Component Computation**:
>    - When faculty use the "Weighted Component Marks Calculator", `Total Marks` are recomputed as $\sum (\text{Component}_i \times \text{Weight}_i / 100)$. This intentionally recalculates student scores and subsequent letter grades according to the instructor's custom syllabus weighting.
> 2. **Scenario Application**:
>    - Applying a saved scenario instantly updates active cutoffs and shifts student grades to match the scenario's thresholds. The change is fully reversible via `Ctrl+Z` (Undo).

---

## [Phase 4] — Audit Report & UX

### Summary of Changes
1. **Dedicated `@media print` Senate Audit Stylesheet & Document**:
   - Engineered a comprehensive institutional Senate submission document (`#senateAuditPrintSection`) adhering to BITS Pilani Senate Academic Council grading standards.
   - During print (`@media print` / `window.print()`):
     - Automatically hides all web application chrome, buttons, inputs, file uploaders, search bars, theme toggles, dropzones, error banners, scenario panels, and timers (`display: none !important`).
     - Renders an A4 portrait layout with BITS Pilani logo, session metadata, course code, instructor name, and submission timestamp.
     - **Section 1**: Approved Cutoff Thresholds & Distribution Table (Grade Band, `[Min, Max)` interval, Grade Points, Student Count, Class Share %, Academic Standing).
     - **Section 2**: Cohort Statistical Metrics Summary (Evaluated cohort size, Min, Max, Mean $\mu$, Median, Standard Deviation $\sigma$).
     - **Section 3**: High-Resolution Graphical Distribution Snapshot (directly captures the HTML5 canvas histogram via `toDataURL("image/png")` for native print fidelity).
     - **Section 4**: Borderline Student Audit (itemized list of students scoring within 2.0 marks of higher grade thresholds).
     - **Section 5**: Cutoff Adjustment Audit Trail (complete history of modifications made during the grading session).
     - **Section 6**: Official Institutional Sign-Off Block (formal printed signature lines for Course Evaluator / Instructor-in-Charge, Head of Department, and Associate Dean / Senate Convener).

2. **Accessibility (WCAG AA Compliance & A11y)**:
   - **Accessible Data Table Alternative**: Added `#histAccessibleTable` with a toggle button (`#btnToggleHistTable`) providing a screen-reader accessible tabular representation of score bins, frequency counts, cohort percentages, and overlapping grade bands.
   - **Keyboard-Operable Cutoff Adjustments**:
     - Configured `ArrowUp` / `ArrowDown` (0.5-mark step) and `PageUp` / `PageDown` / `Shift+Arrow` (5.0-mark step) on all grade minimum cutoff inputs with live boundary cascades.
     - Added keyboard navigation on the HTML5 canvas (`ArrowLeft` / `ArrowRight` to increment/decrement active cutoff markers; `[` and `]` to cycle between grade handles).
   - **High-Contrast Text Tokens (WCAG AA)**:
     - Hardened `--text-muted` to `#475569` in light mode (4.7:1 contrast on `#F6F8FC` and >5:1 on `#FFFFFF`) and `#94A3B8` in dark mode (5.5:1 contrast on `#141B2D`).
     - Upgraded grade badge text colors (`#14532D` on `#DCFCE7`, `#075985` on `#E0F2FE`, `#991B1B` on crimson, `#1E293B` on `#F1F5F9`) to exceed 4.5:1 contrast ratios.
     - Added global `:focus-visible` styling (`outline: 2px solid var(--bits-purple); outline-offset: 2px;`) across all interactive elements.
   - **Comprehensive ARIA Semantics**:
     - Added `role="region"`, `role="img"`, `role="table"`, `role="button"`, and descriptive `aria-label` / `aria-labelledby` across all cards, controls, search inputs, and modals.
     - Added `aria-sort` (`ascending`, `descending`, `none`) to roster table headers with keyboard activation (`Enter` / `Space`).

3. **High-Performance Roster Rendering (2,000+ Students)**:
   - Implemented a paginated rendering engine with configurable page sizes (`50`, `100`, `250`, `500`, `All`).
   - Slices filtered datasets into paginated DOM fragments, preventing browser frame drops and DOM thrashing on large institutional cohorts (2,000+ students).
   - Integrated full pagination controls: `First (⏮)`, `Previous (◀)`, `Page P of N`, `Next (▶)`, `Last (⏭)`, with dynamic item count updates (`Showing X – Y of Z students`).
   - Implemented a 250ms debounced search function (`debounce`) on `studentSearch.oninput` to ensure zero typing latency during student ID lookups.

---

### Grade Alteration Flags & Assumptions

> [!NOTE]
> **No Grade Alterations in Phase 4**:
> Phase 4 introduces print layout formatting, accessibility enhancements, debounced search, and pagination. No grade assignment algorithms, boundary intervals, or cutoff calculations were altered.

---

## [Phase 5] — Structure & Tests

### Summary of Changes
1. **Modular Architecture Decomposition (Zero Build Step)**:
   - Decomposed the single-file monolithic `index.html` into clean, maintainable, single-responsibility files adhering to standard ES modules (`type="module"`):
     - [`index.html`](index.html): Semantic HTML structure, accessible forms, data tables, modals, and container shells.
     - [`styles.css`](styles.css): Complete styling architecture including design tokens, CSS variables, dark mode theme, component layouts, WCAG AA contrast, and print stylesheets.
     - [`grading.js`](grading.js): Pure domain logic module exporting `assignGrade`, `validateSpreadsheetData`, `computeStats`, `calculateGaussianCutoffs`, `calculatePercentileCutoffs`, `checkGuardrails`, `detectWeightedComponents`, and `computeWeightedTotal`.
     - [`io.js`](io.js): Input/output and data processing module exporting `escapeHTML`, `sanitizeFormula` (CWE-1236), SheetJS parsing (`parseSpreadsheet`), `buildCSV`, `buildXLSXWorkbook`, and privacy-compliant `localStorage` autosave.
     - [`charts.js`](charts.js): HTML5 canvas visualization module exporting `drawHistogram`, `getCutoffAtCanvasPos`, and `generateAccessibleBins`.
     - [`ui.js`](ui.js): Application coordinator importing domain modules, managing session state, DOM event listeners, pagination, undo/redo stacks, scenario matrix, guardrails modal, and Senate print report preparation.
   - Operates natively in modern browsers with **zero build step, zero bundling, and zero transpilation**.

2. **Plain JavaScript Test Suite & Automated Verification**:
   - Built a comprehensive unit test suite executable both in Node.js and in the browser:
     - [`test.js`](test.js): Terminal test runner (`node test.js`) with 98 automated assertions.
     - [`tests.html`](tests.html): In-browser visual test runner with live pass/fail counters.
     - [`smoke.test.js`](smoke.test.js): Automated CLI smoke test verifying `sample_marks.xlsx` ingestion (181 rows, 3 courses) and DOM element wiring.
     - [`smoke.html`](smoke.html): In-browser automated smoke test runner with visual badge output.
   - Covers critical academic grading edge cases and mathematical invariants:
     - **Exact Cutoff Boundaries**: `mark == cutoff` (e.g., 80.0 is Grade 'A', 79.99 is Grade 'A-').
     - **Exact Decimal Precision**: `79.5` correctly maps to Grade 'A-' without rounding corruption.
     - **Empty Cohort ($N = 0$)**: Graceful placeholder stats (`-`), safe fallback cutoffs without division by zero or NaN.
     - **Zero Variance Cohort ($\sigma = 0$)**: Identical marks cohort safely falls back to standard BITS defaults with non-intrusive warnings.
     - **Extreme Scores (0.0 and 100.0)**: Correctly bounded without index overflow or clipping.
     - **Monotonic Descending Invariants**: Gaussian and Percentile presets always maintain strictly descending cutoffs ($c_A > c_{A-} > \dots > c_E = 0$).
     - **Spreadsheet Validation Engine**: Identifies missing headers (`HEADER_MISSING`), blank IDs, duplicate enrollment numbers within course, non-numerics, and out-of-range marks ($< 0$ or $> 100$).
     - **Formula Injection (CWE-1236)**: Sanitizes cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` by prefixing `'`.
     - **Weighted Component Marks**: Accurately computes custom syllabus component percentages.
   - **Verification Results**: 100% test pass rate (98/98 unit tests in Node CLI and browser, 17/17 smoke assertions) with zero console errors.

---

### Grade Alteration Flags & Assumptions

> [!NOTE]
> **No Grade Alterations in Phase 5**:
> Phase 5 refactors the codebase into clean ES modules and introduces automated testing. No calculation logic, grading formulas, or rounding behaviors were changed.

---

## [QA & Bug Fix Pass] — DOM Wiring, Cutoff Alignment & Verification

### Summary of Changes
1. **DOM Wiring & Element Alignment (`ui.js`, `index.html`, `styles.css`)**:
   - Replaced dead `#toastNotice` with stacked `#toastContainer` supporting multiple toasts and CSS slide-out animation.
   - Fixed validation modal button bindings: wired `#btnProceedCleanRows` to load clean rows and `#btnCancelUploadModal` to reset staged file state.
   - Synchronized guardrail configuration modal bindings: replaced legacy IDs (`cfgMaxA`, `cfgMaxE`, `cfgMinMid`, `btnDismissGuardrailModal`) with exact HTML IDs (`guardrailMaxAPct`, `guardrailMaxEPct`, `guardrailMinMidPct`, `btnCloseGuardrailModal`).
   - Replaced synchronous `prompt()` with modal workflow for Scenario naming (`scenarioModal`, `scenarioNameInput`, `btnConfirmSaveScenario`, `btnCancelScenarioModal`, `btnCloseScenarioModal`).
   - Implemented `getEl(id, required)` null-guard and console warning helper across all DOM lookups in `ui.js`.
   - Verified 100% static match across all 105 DOM element IDs.

2. **Grade Band & Cutoff Alignment (`grading.js`, `test.js`, `tests.html`)**:
   - Corrected `DEFAULT_CUTOFFS` to challenge spec bands:
     - `A`: 80, `A-`: 70, `B`: 60, `B-`: 50, `C`: 40, `C-`: 30, `D`: 20, `E`: 0.
   - Updated Gaussian and Percentile curving algorithms: replaced hardcoded arbitrary floors (18, 16, 14, 12, 10, 5) with a general clamp to `[1, 100]` and backward relaxation cap guaranteeing cutoffs never exceed 100.
   - Added high-score cohort test coverage (`[98, 99, 100, 100, 100]` and `[95, 96, 97, 98, 99, 100]`), verifying $c_i \le 100$ and strictly descending order.
   - Expanded unit test assertions from 54 to 98.

3. **End-to-End Smoke Test Suite (`smoke.test.js`, `smoke.html`)**:
   - Built standalone CLI and browser smoke tests validating `sample_marks.xlsx` ingestion.
   - Verified 181 valid rows across 3 courses (`CS F211`: 60 students, `MATH F111`: 60 students, `ECON F211`: 61 students) with 0 errors.
   - Verified exact course minimum and maximum score extremes.
   - Verified all 105 static DOM element references between `ui.js` and `index.html`.

4. **Documentation & Terminology Standardization**:
   - Standardized all repository documentation to relative links.
   - Added Prototype Notice in `index.html`, print reports, and documentation: *"Prototype built for the BITS Digital CodeForge challenge. Not an official BITS Pilani grading tool."*
   - Renamed "institutional guardrails" to "configurable distribution guardrails (default thresholds are illustrative)" in UI and docs.
   - Documented ES module local HTTP execution requirements and GitHub Pages deployment.




