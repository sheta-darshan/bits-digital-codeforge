# BITS Pilani Digital — Advanced Grading Console

Live URL: https://sheta-darshan.github.io/bits-digital-codeforge/  
GitHub Repository: https://github.com/sheta-darshan/bits-digital-codeforge

> **Enhancement Highlights**: Architected a modular zero-build ES system with authentic BITS Pilani Digital branding, intelligent real-time borderline student detection, configurable distribution guardrails, interactive canvas histogram with draggable cutoff markers, and formal Senate Academic Council print audit reports. Hardened against CWE-1236 CSV injection and DOM XSS, with automated test suites verifying strict monotonic invariants and edge cases.

Institutional evaluation and grade distribution console built for BITS Pilani faculty.

---

## 🚀 How to Run Locally

This application is built with vanilla JavaScript (ES modules), modern CSS, SheetJS, and HTML5 Canvas. It runs locally in any modern browser without requiring node build pipelines, bundlers, or compilation.

### ⚠️ Note on ES Modules & `file://` Protocol
Modern browsers enforce CORS restrictions on native JavaScript modules (`<script type="module">`) when loaded directly from the filesystem (`file://` protocol). Double-clicking `index.html` directly from a file browser will trigger a browser module security block.

**The application must be served over a local HTTP server:**

```bash
# Option A: Using Python 3 (built-in, recommended)
python -m http.server 8080

# Option B: Using Node / npx
npx serve .
```

Once the server is running, navigate to:
- **Main Application**: `http://localhost:8080/index.html`
- **Unit Test Runner (Browser)**: `http://localhost:8080/tests.html`
- **Smoke Test Runner (Browser)**: `http://localhost:8080/smoke.html`

---

## 🏛️ Modular Project Architecture (Zero Build Step)

The codebase is organized into focused, single-responsibility ES modules with **zero compilation, zero bundling, and zero transpilation**:

| File | Type | Purpose & Responsibility |
|:---|:---|:---|
| [`index.html`](index.html) | HTML | Semantic layout, accessible controls, modals, and container shells |
| [`styles.css`](styles.css) | CSS | Brand tokens (`logo.svg`), dark mode theme, component styling, WCAG AA contrast, stacked toasts, and `@media print` |
| [`grading.js`](grading.js) | ES Module | Pure domain logic: `assignGrade`, `validateSpreadsheetData`, Gaussian/Percentile presets, stats, configurable distribution guardrails, `formatGradeRange`, weights |
| [`io.js`](io.js) | ES Module | File ingestion (SheetJS), `sanitizeFormula` (CWE-1236), RFC 4180 CSV export, multi-sheet XLSX export, autosave |
| [`charts.js`](charts.js) | ES Module | HTML5 canvas histogram, normal distribution bell curve, draggable cutoff markers, accessible table data |
| [`ui.js`](ui.js) | ES Module | Orchestration, state management, event listeners, pagination, undo/redo, scenarios, Senate print preparation |
| [`test.js`](test.js) | Node / CLI | Unit test suite for terminal execution (`node test.js` or `npm test`) with 109 assertions |
| [`tests.html`](tests.html) | HTML / UI | In-browser visual test runner with real-time pass/fail metrics |
| [`smoke.test.js`](smoke.test.js) | Node / CLI | Automated smoke test validating `sample_marks.xlsx` (180 rows, 3 courses) and DOM element wiring (`npm run smoke`) with 22 assertions |
| [`smoke.html`](smoke.html) | HTML / UI | In-browser automated smoke test runner with visual badge output |

---

## 🧪 Automated Test Suite Execution

### 1. Terminal Unit Tests (`node test.js` or `npm test`):
```bash
npm test
```
Executes **109 automated unit assertions** covering:
- Standard BITS default cutoffs (A: 80, A-: 70, B: 60, B-: 50, C: 40, C-: 30, D: 20, E: 0) and semi-open interval boundaries $[c_i, c_{i-1})$.
- Exact decimal floating-point precision (no rounding corruption).
- Boundary tests for cutoff transitions (20, 19.9, 30, 29.9).
- Empty cohorts ($N=0$) and zero variance ($\sigma=0$) safety fallbacks.
- General clamp $[1, 100]$ and cap at 100 for Gaussian and Percentile presets, including high-score cohorts (`[98, 99, 100, 100, 100]` and `[95, 96, 97, 98, 99, 100]`).
- Monotonic invariants ensuring $c_A > c_{A-} > \dots > c_E = 0$.
- Formula injection sanitization (CWE-1236) and HTML entity escaping.
- Spreadsheet validation and error classification.
- Mathematical grade range interval formatting for UI, CSV, and XLSX (`formatGradeRange`).

### 2. Terminal Smoke Tests (`node smoke.test.js` or `npm run smoke`):
```bash
npm run smoke
```
Executes **22 automated end-to-end smoke assertions** verifying:
- Ingestion of real `sample_marks.xlsx` with SheetJS (`parseSpreadsheet`).
- Detection of all 3 academic courses: `CS F211 Data Structures` (60 students), `MATH F111 Mathematics I` (60 students), `ECON F211 Principles of Economics` (60 students).
- Total clean record count of exactly 180 rows with 0 validation errors.
- Exact course minimum and maximum score ranges:
  - `CS F211`: Min 31.0, Max 100.0
  - `MATH F111`: Min 25.0, Max 90.0
  - `ECON F211`: Min 40.0, Max 96.0
- Complete static DOM audit confirming that every element ID referenced in `ui.js` exists in `index.html`.
- Verification of dynamic template-literal DOM IDs (`${g}min`, `${g}max`, `chip_${g}`, `thScen${sIdx}`, `label_val_`).

### 3. In-Browser Verification:
- Launch `http://localhost:8080/tests.html` for the interactive visual unit test suite.
- Launch `http://localhost:8080/smoke.html` for the in-browser smoke test suite.

---

## 🧪 How to Test

### 1. Instant 1-Click Evaluation
1. Launch the console in your browser via local HTTP server.
2. Click **"Load BITS Demo Data"**.
3. Enter an Instructor Name (e.g. `Dr. S. K. Sharma`).
4. Select a course (e.g. `CS F211 Data Structures`).
5. Observe the live KPI cards, histogram with bell curve, borderline cases, and student roster.

### 2. Custom Spreadsheet Upload & Validation Test
1. Drag and drop or browse [`sample_marks.xlsx`](sample_marks.xlsx).
2. Click **"📤 Upload & Process File"**.
3. All 180 clean records across 3 courses are parsed with zero errors.
4. If invalid rows are introduced (duplicate IDs, out-of-range marks `< 0` or `> 100`, non-numeric marks), the **Data Validation Reconciliation Modal** opens, allowing exclusion of invalid rows before proceeding.

### 3. Presets & Monotonic Cutoff Test
1. Click **"Gaussian (Normal)"** or **"Percentile (Relative)"**.
2. Notice cutoffs automatically recalculate with strictly descending thresholds ($c_A > c_{A-} > \dots > c_E = 0$) bounded strictly within $[1, 100]$ (with $E=0$).
3. Adjust any grade's "Min" input; notice the derived "Max" input of the grade below updates automatically to `< Cutoff(Upper)`.

### 4. Advanced Analytics & Productivity Tests
1. **Undo / Redo & Live Audit Log**:
   - Change a cutoff (e.g. adjust Grade 'A' from 80 to 82).
   - Press `Ctrl+Z` or click **"↩ Undo"**; observe the cutoff revert to 80.
   - Press `Ctrl+Y` or click **"↪ Redo"**; observe the cutoff restore to 82.
   - Expand the **Audit Change Log** to review the history table with timestamps and delta adjustments.
2. **Scenario Comparison (Up to 3 Named Sets)**:
   - In the Scenario panel, click **"Save Active as Scenario"**, enter a name (e.g. `Senate Proposal`) and confirm.
   - Modify any cutoffs (e.g. set Grade 'A' to 85).
   - Observe the **Grade Shift %** in the matrix showing the exact proportion of students whose letter grade would change.
   - Click **"Apply"** to load the scenario, or **"Delete"** to free the slot.
3. **Configurable Distribution Guardrails (Default Thresholds are Illustrative)**:
   - Observe the inline guardrail status badge (`✅ Compliant` or `⚠️ Alert`).
   - Click **"⚙️ Configure Thresholds"** to customize distribution caps (e.g. Max Grade 'A' %, Max Fail Grade 'E' %, Min Middle Grades %).
4. **Interactive Draggable Cutoffs on Canvas**:
   - Hover over cutoff markers on the histogram canvas; notice cursor switches to `ew-resize`.
   - Click and drag any grade marker (e.g. `A`, `B`, `C`) left or right. Notice cutoffs, derived max values, and student roster update dynamically with 0.5-mark resolution.
5. **Autosave & Privacy Consent**:
   - Check or uncheck **"Allow saving student marks in browser local storage"**. By default, sensitive student marks are never written to `localStorage`.
   - Refresh the page; observe the session restoration banner restoring your course name and cutoffs.

### 5. Accessibility, Roster Performance & Senate Print Audit Tests
1. **Accessible Histogram Data Table Alternative**:
   - Click **"👁️ View Histogram as Accessible Data Table"** beneath the chart.
   - Observe the accessible tabular presentation showing Score Bin Ranges, Student Frequencies, Cohort Share %, and Overlapping Grade Bands.
   - Click again to collapse and verify `aria-expanded` state synchronization.
2. **Keyboard-Operable Cutoff Adjustments**:
   - Focus the Min input for any grade (e.g. Grade 'A').
   - Press `ArrowUp` / `ArrowDown` to adjust by $0.5$ marks; press `PageUp` / `PageDown` or `Shift+Arrow` to adjust by $5.0$ marks.
   - On the histogram canvas, press `ArrowLeft` / `ArrowRight` to increment/decrement active cutoff markers, and `[` or `]` to cycle between grade handles.
3. **High-Performance Paginated Roster (2,000+ Students)**:
   - Observe the pagination footer: `Showing 1 – 50 of 60 students` and `Page 1 of 2`.
   - Click **"▶"** (Next Page) to advance to page 2 (`51 – 60`); click **"◀"** to return to page 1.
   - Change **"Rows per page"** to `100` or `All`; observe instantaneous re-slicing without frame drops.
   - Type in **"Search BITS ID..."**; observe the 250ms debounced filtering in action.
   - Click or press `Enter`/`Space` on table column headers (`#`, `BITS Student ID`, `Total Marks`, `Awarded Grade`) to test accessible sorting with `aria-sort`.
4. **Official Senate Audit Report Print View**:
   - Click **"🖨️ Audit Report"** in the top navigation bar.
   - Notice the dedicated print layout: browser controls, inputs, search bars, and theme toggles are hidden, and the institutional **Senate Academic Council Course Grading & Cutoff Audit Report** is formatted for A4 portrait with:
     - Header metadata & BITS Pilani logo
     - Approved Cutoff & Distribution Table with academic standings
     - Cohort Statistical Evaluation Metrics ($\mu, \sigma$, median, min, max)
     - High-resolution distribution chart snapshot
     - Borderline student audit table
     - Cutoff adjustment change log trail
     - 3-column institutional sign-off block (Evaluator, HoD, Associate Dean)

### 6. Export Verification
1. Click **"Export CSV (RFC 4180)"** to download the student grades roster including the audit changelog appendix.
2. Click **"Export Multi-Sheet Excel"** to download the comprehensive workbook with "Grading Criteria", "Student Roster", and "Audit Change Log" sheets.
3. Click **"Print / PDF Report"** to inspect the formal Senate audit print view.

---

## 🌐 Deployment Instructions (GitHub Pages)

Because all internal asset paths are relative (`styles.css`, `logo.svg`, `./ui.js`, `./grading.js`, etc.), this repository is directly hostable on **GitHub Pages**, **Vercel**, or **Netlify** with zero configuration files needed.

### Steps to Deploy on GitHub Pages:
1. Initialize a git repository and commit all files:
   ```bash
   git init
   git add .
   git commit -m "feat: BITS Pilani Digital Advanced Grading Console v2.0"
   ```
2. Create a new repository on GitHub and push the code:
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git branch -M main
   git push -u origin main
   ```
3. In your GitHub repository:
   - Navigate to **Settings -> Pages**.
   - Under **Build and deployment -> Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and root folder `/` and click **Save**.
4. GitHub Pages will build and deploy the application within 1-2 minutes at:
   `https://<your-username>.github.io/<repo-name>/`

---

## 📜 Prototype Notice
*Prototype built for the BITS Digital CodeForge challenge. Not an official BITS Pilani grading tool.*
