/**
 * BITS Pilani Digital — Advanced Grading Console
 * Module: ui.js
 * 
 * Application coordinator & DOM controller:
 * State management, event binding, pagination, canvas interactions,
 * modal dialogs, undo/redo history, presets, exports, and print view.
 * Runs in the browser via <script type="module" src="ui.js"></script>.
 */

import {
  GRADES,
  DEFAULT_CUTOFFS,
  GRADE_POINTS,
  GRADE_DESCRIPTIONS,
  BITS_COURSES,
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
  parseSpreadsheet,
  buildCSV,
  buildXLSXWorkbook,
  saveAutosave,
  loadAutosave,
  clearAutosave
} from './io.js';

import {
  drawHistogram,
  getCutoffAtCanvasPos,
  generateAccessibleBins
} from './charts.js';

/* --------------------------------------------------------------------------
   APPLICATION STATE
   -------------------------------------------------------------------------- */
let rawData = [];
let activeCourse = "";
let currentCutoffs = { ...DEFAULT_CUTOFFS };
let stagedFile = null;

// Undo / Redo & Audit History
let undoStack = [];
let redoStack = [];
let cutoffChangeLog = [];
let isApplyingHistory = false;

// Scenarios & Guardrails
let savedScenarios = [];
let guardrailRules = { maxA: 15, maxE: 20, minMid: 35 };

// Weighted Assessment Components
let detectedComponentColumns = [];
let componentWeights = {};

// Roster Filtering & Pagination
let sortCol = "index";
let sortAsc = true;
let activeGradeFilter = null;
let onlyBorderlines = false;
let currentPage = 1;
let pageSize = 50;

// Canvas Dragging
let draggingGrade = null;
let dragInitialCutoff = null;
let currentBinData = [];
let focusedCanvasMarkerIdx = 0;

// Timer & Session
let gradingStartTime = null;
let gradingTimerInterval = null;
let finalizeCounter = 0;
const AUTOSAVE_STORAGE_KEY = "BITS_GRADING_CONSOLE_AUTOSAVE_V2";

/* --------------------------------------------------------------------------
   DOM ELEMENT REFERENCES
   -------------------------------------------------------------------------- */
/**
 * Null-guard and element retrieval helper.
 * Returns the DOM element, logging a warning if an expected element is missing.
 */
export function getEl(id, required = false) {
  const el = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (!el && required && typeof console !== "undefined") {
    console.warn(`[UI Warning] Expected DOM element #${id} was not found.`);
  }
  return el;
}

const instructorNameInput = getEl("instructorName", true);
const nameError = getEl("nameError");
const marksFileInput = getEl("marksFile", true);
const dropZone = getEl("dropZone");
const dropzoneText = getEl("dropzoneText");
const selectedFileChip = getEl("selectedFileChip");
const chipFileName = getEl("chipFileName");
const chipFileSize = getEl("chipFileSize");
const btnClearFile = getEl("btnClearFile");
const btnUploadFile = getEl("btnUploadFile");
const btnLoadDemo = getEl("btnLoadDemo");
const courseSelect = getEl("courseSelect", true);
const courseCountTag = getEl("courseCountTag");
const fileStatusBanner = getEl("fileStatusBanner");
const fileStatusText = getEl("fileStatusText");
const histCanvas = getEl("histCanvas", true);
const chartTooltip = getEl("chartTooltip");
const gradeGrid = getEl("gradeGrid", true);
const rangeAlert = getEl("rangeAlert");
const rangeAlertText = getEl("rangeAlertText");
const studentCountBadge = getEl("studentCountBadge");
const gradePillsContainer = getEl("gradePillsContainer");
const studentSearch = getEl("studentSearch");
const btnFilterBorderline = getEl("btnFilterBorderline");
const rosterBody = getEl("rosterBody", true);
const borderlineCountChip = getEl("borderlineCountChip");
const borderlineCountText = getEl("borderlineCountText");
const timerClock = getEl("timerClock");
const timerStatusNotice = getEl("timerStatusNotice");
const timerArc = getEl("timerArc");
const btnResetSession = getEl("btnResetSession");
const themeToggle = getEl("themeToggle");
const btnReport = getEl("btnReport");
const btnExportCSV = getEl("btnExportCSV");
const btnExportXLSX = getEl("btnExportXLSX");
const btnResetRanges = getEl("btnResetRanges");
const btnResetRangesBottom = getEl("btnResetRangesBottom");
const cdnErrorBanner = getEl("cdnErrorBanner");
const restoreBanner = getEl("restoreBanner");
const btnRestoreSession = getEl("btnRestoreSession");
const btnDismissRestore = getEl("btnDismissRestore");
const chkPersistStudentData = getEl("chkPersistStudentData");
const validationModal = getEl("validationModal");
const validationTableBody = getEl("validationTableBody");
const btnDismissModal = getEl("btnDismissModal");
const btnCancelUploadModal = getEl("btnCancelUploadModal");
const btnProceedCleanRows = getEl("btnProceedCleanRows");
const valTotalRows = getEl("valTotalRows");
const valValidRows = getEl("valValidRows");
const valFlaggedRows = getEl("valFlaggedRows");
const guardrailCard = getEl("guardrailCard");
const guardrailIcon = getEl("guardrailIcon");
const guardrailMsg = getEl("guardrailMsg");
const btnConfigureGuardrails = getEl("btnConfigureGuardrails");
const guardrailModal = getEl("guardrailModal");
const btnCloseGuardrailModal = getEl("btnCloseGuardrailModal");
const btnSaveGuardrails = getEl("btnSaveGuardrails");
const btnResetGuardrails = getEl("btnResetGuardrails");
const guardrailMaxAPct = getEl("guardrailMaxAPct");
const guardrailMaxEPct = getEl("guardrailMaxEPct");
const guardrailMinMidPct = getEl("guardrailMinMidPct");
const btnUndo = getEl("btnUndo");
const btnRedo = getEl("btnRedo");
const btnSaveScenario = getEl("btnSaveScenario");
const scenarioModal = getEl("scenarioModal");
const scenarioNameInput = getEl("scenarioNameInput");
const btnConfirmSaveScenario = getEl("btnConfirmSaveScenario");
const btnCancelScenarioModal = getEl("btnCancelScenarioModal");
const btnCloseScenarioModal = getEl("btnCloseScenarioModal");
const scenarioTableBody = getEl("scenarioTableBody");
const changelogDetails = getEl("changelogDetails");
const changelogCount = getEl("changelogCount");
const changelogTableBody = getEl("changelogTableBody");
const weightedCard = getEl("weightedCard");
const weightedColumnsContainer = getEl("weightedColumnsContainer");
const weightSumBadge = getEl("weightSumBadge");
const btnResetWeights = getEl("btnResetWeights");
const btnApplyWeightedMarks = getEl("btnApplyWeightedMarks");
const btnToggleHistTable = getEl("btnToggleHistTable");
const histAccessibleTableContainer = getEl("histAccessibleTableContainer");
const histAccessibleTableBody = getEl("histAccessibleTableBody");
const toggleHistTableText = getEl("toggleHistTableText");

// Pagination Controls
const btnPageFirst = document.getElementById("btnPageFirst");
const btnPagePrev = document.getElementById("btnPagePrev");
const btnPageNext = document.getElementById("btnPageNext");
const btnPageLast = document.getElementById("btnPageLast");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const paginationInfo = document.getElementById("paginationInfo");
const currentPageDisplay = document.getElementById("currentPageDisplay");

/* --------------------------------------------------------------------------
   UTILITY HELPERS
   -------------------------------------------------------------------------- */
export function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function showToast(message, icon = "ℹ️", duration = 3200) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `<span>${icon}</span><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "slideOut 0.25s ease forwards";
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

export function handleSheetJSLoadError() {
  if (cdnErrorBanner) cdnErrorBanner.style.display = "block";
  if (btnUploadFile) {
    btnUploadFile.disabled = true;
    btnUploadFile.title = "Excel processing unavailable (SheetJS CDN offline)";
  }
  if (btnExportXLSX) {
    btnExportXLSX.disabled = true;
    btnExportXLSX.title = "Excel export unavailable (SheetJS CDN offline)";
  }
}
window.handleSheetJSLoadError = handleSheetJSLoadError;

/* --------------------------------------------------------------------------
   AUTOSAVE ENGINE
   -------------------------------------------------------------------------- */
const saveAutosaveSession = debounce(() => {
  const allowStudents = chkPersistStudentData ? chkPersistStudentData.checked : false;
  const state = {
    course: activeCourse,
    instructor: instructorNameInput ? instructorNameInput.value : "",
    cutoffs: currentCutoffs,
    guardrails: guardrailRules,
    scenarios: savedScenarios,
    rawData: allowStudents ? rawData : []
  };
  saveAutosave(AUTOSAVE_STORAGE_KEY, state, allowStudents);
}, 600);

export function checkAutosaveOnLoad() {
  const saved = loadAutosave(AUTOSAVE_STORAGE_KEY);
  if (!saved || !saved.timestamp) return;

  const diffHours = (Date.now() - saved.timestamp) / (1000 * 60 * 60);
  if (diffHours > 72) {
    clearAutosave(AUTOSAVE_STORAGE_KEY);
    return;
  }

  if (restoreBanner) {
    const subtitle = document.getElementById("restoreSubtitle");
    if (subtitle) {
      const dateStr = new Date(saved.timestamp).toLocaleString();
      const courseDesc = saved.course ? ` for course '${escapeHTML(saved.course)}'` : "";
      subtitle.innerHTML = `A saved configuration from <strong>${dateStr}</strong>${courseDesc} is available.`;
    }
    restoreBanner.style.display = "flex";
  }
}

/* --------------------------------------------------------------------------
   UNDO / REDO STATE MANAGEMENT
   -------------------------------------------------------------------------- */
function pushUndoState() {
  if (isApplyingHistory) return;
  undoStack.push({ ...currentCutoffs });
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
  updateHistoryButtons();
}

function undoCutoffChange() {
  if (!undoStack.length) return;
  redoStack.push({ ...currentCutoffs });
  isApplyingHistory = true;
  currentCutoffs = undoStack.pop();
  syncCutoffsToInputs();
  updateDerivedMaxes();
  updateAll();
  isApplyingHistory = false;
  updateHistoryButtons();
  showToast("Cutoff change undone", "↩️");
}

function redoCutoffChange() {
  if (!redoStack.length) return;
  undoStack.push({ ...currentCutoffs });
  isApplyingHistory = true;
  currentCutoffs = redoStack.pop();
  syncCutoffsToInputs();
  updateDerivedMaxes();
  updateAll();
  isApplyingHistory = false;
  updateHistoryButtons();
  showToast("Cutoff change restored", "↪️");
}

function updateHistoryButtons() {
  if (btnUndo) btnUndo.disabled = undoStack.length === 0;
  if (btnRedo) btnRedo.disabled = redoStack.length === 0;
}

function syncCutoffsToInputs() {
  GRADES.forEach(g => {
    const input = document.getElementById(`${g}min`);
    if (input) input.value = currentCutoffs[g];
  });
}

function recordCutoffChange(grade, oldVal, newVal) {
  const delta = newVal - oldVal;
  const deltaSign = delta > 0 ? `+${delta.toFixed(1)}` : `${delta.toFixed(1)}`;
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    grade,
    oldVal: oldVal.toFixed(1),
    newVal: newVal.toFixed(1),
    delta: deltaSign
  };
  cutoffChangeLog.unshift(entry);
  if (cutoffChangeLog.length > 50) cutoffChangeLog.pop();
  renderChangelogTable();
}

function renderChangelogTable() {
  if (!changelogTableBody) return;
  if (changelogCount) changelogCount.innerText = cutoffChangeLog.length;
  if (!cutoffChangeLog.length) {
    changelogTableBody.innerHTML = `<tr><td colspan="5" class="changelog-empty">No cutoff adjustments recorded in this session.</td></tr>`;
    return;
  }
  changelogTableBody.innerHTML = cutoffChangeLog.map(c => `
    <tr>
      <td>${escapeHTML(c.timestamp)}</td>
      <td><strong>${escapeHTML(c.grade)}</strong></td>
      <td>${escapeHTML(c.oldVal)}</td>
      <td>${escapeHTML(c.newVal)}</td>
      <td style="color:${c.delta.startsWith('+') ? 'var(--bits-purple)' : 'var(--bits-crimson)'}; font-weight:700;">${escapeHTML(c.delta)}</td>
    </tr>
  `).join("");
}

/* --------------------------------------------------------------------------
   SCENARIOS ENGINE
   -------------------------------------------------------------------------- */
function renderScenarioTable() {
  if (!scenarioTableBody) return;

  const students = rawData.filter(d => d.Course === activeCourse);
  const total = students.length;

  // Update Headers
  for (let sIdx = 0; sIdx < 3; sIdx++) {
    const th = document.getElementById(`thScen${sIdx}`);
    if (!th) continue;
    const scen = savedScenarios[sIdx];
    if (scen) {
      th.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>${escapeHTML(scen.name)}</span>
          <button type="button" class="btn-delete-scenario" data-scen="${sIdx}" title="Delete scenario" style="background:none; border:none; color:var(--bits-crimson); cursor:pointer; font-size:11px;">✕</button>
        </div>
      `;
    } else {
      th.innerHTML = `<span style="color:var(--text-muted); font-weight:400;">Scenario ${sIdx + 1} (Empty)</span>`;
    }
  }

  // Row per grade
  let html = GRADES.map(g => {
    const activeCutoff = currentCutoffs[g];
    const activeCount = total ? students.filter(s => assignGrade(Number(s["Total Marks"]), currentCutoffs) === g).length : 0;
    const activePct = total ? ((activeCount / total) * 100).toFixed(0) : "0";

    let cells = `<td><strong>${g}</strong></td><td>${activeCutoff} <span style="font-size:11px; color:var(--text-muted);">(${activeCount} • ${activePct}%)</span></td>`;

    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const scen = savedScenarios[sIdx];
      if (scen) {
        const sCutoff = scen.cutoffs[g];
        const sCount = total ? students.filter(s => assignGrade(Number(s["Total Marks"]), scen.cutoffs) === g).length : 0;
        const sPct = total ? ((sCount / total) * 100).toFixed(0) : "0";
        cells += `<td>${sCutoff} <span style="font-size:11px; color:var(--text-muted);">(${sCount} • ${sPct}%)</span></td>`;
      } else {
        cells += `<td style="color:var(--text-muted);">-</td>`;
      }
    }
    return `<tr>${cells}</tr>`;
  }).join("");

  // Grade Shift summary row
  if (savedScenarios.length > 0) {
    let shiftCells = `<td><strong>Grade Shift %</strong></td><td>Baseline</td>`;
    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const scen = savedScenarios[sIdx];
      if (scen && total > 0) {
        let shiftedCount = 0;
        students.forEach(s => {
          const mark = Number(s["Total Marks"]);
          if (assignGrade(mark, currentCutoffs) !== assignGrade(mark, scen.cutoffs)) {
            shiftedCount++;
          }
        });
        const shiftPct = ((shiftedCount / total) * 100).toFixed(1);
        shiftCells += `
          <td>
            <span class="scenario-shift-pill">${shiftPct}% shifted</span>
            <button type="button" class="btn-apply-scenario" data-scen="${sIdx}" style="margin-left:6px; padding:2px 7px; font-size:10px; background:var(--bits-purple); color:#fff; border:none; border-radius:4px; cursor:pointer;">Apply</button>
          </td>
        `;
      } else {
        shiftCells += `<td style="color:var(--text-muted);">-</td>`;
      }
    }
    html += `<tr style="background:var(--bg-page); font-weight:700;">${shiftCells}</tr>`;
  }

  scenarioTableBody.innerHTML = html;

  // Bind scenario action buttons
  document.querySelectorAll(".btn-delete-scenario").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const sIdx = parseInt(btn.dataset.scen, 10);
      savedScenarios.splice(sIdx, 1);
      renderScenarioTable();
      saveAutosaveSession();
      showToast("Scenario deleted", "🗑️");
    };
  });

  document.querySelectorAll(".btn-apply-scenario").forEach(btn => {
    btn.onclick = () => {
      const sIdx = parseInt(btn.dataset.scen, 10);
      const scen = savedScenarios[sIdx];
      if (!scen) return;
      pushUndoState();
      currentCutoffs = { ...scen.cutoffs };
      syncCutoffsToInputs();
      updateDerivedMaxes();
      updateAll();
      renderScenarioTable();
      showToast(`Applied scenario '${scen.name}'`, "✅");
    };
  });
}

/* --------------------------------------------------------------------------
   WEIGHTED ASSESSMENT COMPONENTS
   -------------------------------------------------------------------------- */
function renderWeightedComponentsUI(components) {
  if (!weightedColumnsContainer) return;
  weightedColumnsContainer.innerHTML = "";
  if (!components.length) {
    if (weightedCard) weightedCard.style.display = "none";
    return;
  }

  if (weightedCard) weightedCard.style.display = "block";
  const equalWeight = Math.floor(100 / components.length);
  const remainder = 100 - (equalWeight * components.length);

  components.forEach((c, i) => {
    if (componentWeights[c] === undefined) {
      componentWeights[c] = equalWeight + (i === 0 ? remainder : 0);
    }

    const item = document.createElement("div");
    item.className = "weighted-col-item";
    item.innerHTML = `
      <div class="weighted-col-title">
        <span>${escapeHTML(c)}</span>
        <span id="label_val_${escapeHTML(c)}" style="color:var(--bits-purple);">${componentWeights[c]}%</span>
      </div>
      <input type="number" id="weight_${escapeHTML(c)}" value="${componentWeights[c]}" min="0" max="100" step="5" class="weighted-col-input" aria-label="Weight percentage for ${escapeHTML(c)}">
    `;

    const input = item.querySelector(`#weight_${escapeHTML(c)}`);
    input.oninput = () => {
      const val = parseFloat(input.value) || 0;
      componentWeights[c] = val;
      const label = document.getElementById(`label_val_${escapeHTML(c)}`);
      if (label) label.innerText = `${val}%`;
      updateWeightTotalBadge();
    };

    weightedColumnsContainer.appendChild(item);
  });

  updateWeightTotalBadge();
}

function updateWeightTotalBadge() {
  if (!weightSumBadge) return;
  const total = Object.values(componentWeights).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  weightSumBadge.innerText = `Total Weight: ${total}%`;
  if (total === 100) {
    weightSumBadge.style.background = "var(--bits-purple-light)";
    weightSumBadge.style.color = "var(--bits-purple)";
    if (btnApplyWeightedMarks) btnApplyWeightedMarks.disabled = false;
  } else {
    weightSumBadge.style.background = "var(--bits-crimson-light)";
    weightSumBadge.style.color = "var(--bits-crimson)";
    if (btnApplyWeightedMarks) btnApplyWeightedMarks.disabled = true;
  }
}

/* --------------------------------------------------------------------------
   FILE INGESTION & DATASET APPLICATION
   -------------------------------------------------------------------------- */
function stageFileForUpload(file) {
  if (!file) return;
  const validExts = [".xlsx", ".xls"];
  const lowerName = file.name.toLowerCase();
  const isValid = validExts.some(ext => lowerName.endsWith(ext));

  if (!isValid) {
    showToast("Unsupported file type. Please upload an Excel (.xlsx or .xls) file.", "⚠️", 4000);
    return;
  }

  stagedFile = file;
  if (chipFileName) chipFileName.innerText = file.name;
  if (chipFileSize) chipFileSize.innerText = `(${(file.size / 1024).toFixed(1)} KB)`;
  if (selectedFileChip) selectedFileChip.style.display = "flex";
  if (dropzoneText) dropzoneText.innerText = "Excel file ready to process";
  if (btnUploadFile) {
    btnUploadFile.disabled = false;
    btnUploadFile.classList.add("pulse");
  }
}

function processSpreadsheetUpload(file) {
  if (!file) return;
  fileStatusBanner.style.display = "flex";
  fileStatusText.innerText = "Analyzing file structure and headers...";

  const reader = new FileReader();

  reader.onerror = () => {
    fileStatusBanner.style.display = "none";
    showToast("Error reading file from disk. Please check file permissions and try again.", "❌", 5000);
  };

  reader.onload = (e) => {
    try {
      if (typeof XLSX === "undefined") {
        handleSheetJSLoadError();
        showToast("Spreadsheet engine is offline (SheetJS library not loaded).", "❌", 5000);
        fileStatusBanner.style.display = "none";
        return;
      }

      const parseRes = parseSpreadsheet(e.target.result, XLSX);
      if (!parseRes.success) {
        fileStatusBanner.style.display = "none";
        showToast(parseRes.error, "⚠️", 5000);
        return;
      }

      const validation = validateSpreadsheetData(parseRes.rows);
      if (!validation.valid) {
        fileStatusBanner.style.display = "none";
        showValidationModal(validation);
        return;
      }

      applyCleanDataset(validation.cleanRows, `Successfully loaded ${validation.cleanRows.length} valid student records from '${file.name}'`);
    } catch (err) {
      fileStatusBanner.style.display = "none";
      showToast("Unexpected error processing spreadsheet: " + err.message, "❌", 5000);
    }
  };

  reader.readAsArrayBuffer(file);
}

function showValidationModal(result) {
  if (valTotalRows) valTotalRows.innerText = result.summary.total;
  if (valValidRows) valValidRows.innerText = result.summary.validCount;
  if (valFlaggedRows) valFlaggedRows.innerText = result.summary.errorCount;

  if (validationTableBody) {
    validationTableBody.innerHTML = result.errors.slice(0, 100).map(err => `
      <tr>
        <td><strong>#${err.row}</strong></td>
        <td><code>${escapeHTML(err.id)}</code></td>
        <td style="color:var(--bits-crimson); font-weight:600;">${escapeHTML(err.message)}</td>
      </tr>
    `).join("") + (result.errors.length > 100 ? `<tr><td colspan="3" style="text-align:center; color:var(--text-muted); font-style:italic;">... and ${result.errors.length - 100} additional error rows omitted for brevity</td></tr>` : "");
  }

  if (btnProceedCleanRows) {
    btnProceedCleanRows.disabled = result.cleanRows.length === 0;
    btnProceedCleanRows.onclick = () => {
      validationModal.style.display = "none";
      applyCleanDataset(result.cleanRows, `Loaded ${result.cleanRows.length} clean student records (${result.summary.errorCount} flagged rows excluded)`);
    };
  }

  if (validationModal) validationModal.style.display = "flex";
}

export function applyCleanDataset(cleanRows, successMsg) {
  rawData = cleanRows;
  if (btnUploadFile) {
    btnUploadFile.disabled = true;
    btnUploadFile.classList.remove("pulse");
  }
  populateCourses();

  // Multi-assessment component detection
  detectedComponentColumns = detectWeightedComponents(cleanRows);
  if (detectedComponentColumns.length >= 2) {
    componentWeights = {};
    renderWeightedComponentsUI(detectedComponentColumns);
  } else {
    if (weightedCard) weightedCard.style.display = "none";
  }

  if (fileStatusBanner) {
    fileStatusBanner.style.display = "flex";
    fileStatusText.innerText = successMsg;
  }
  showToast(successMsg, "✅", 4500);
  saveAutosaveSession();
}
window.applyCleanDataset = applyCleanDataset;

/* --------------------------------------------------------------------------
   COURSE POPULATION & STATE SYNCHRONIZATION
   -------------------------------------------------------------------------- */
function populateCourses() {
  const courses = [...new Set(rawData.map(d => d.Course).filter(Boolean))].sort();
  courseSelect.innerHTML = '<option value="">Select a course to begin</option>';

  courses.forEach(c => {
    const count = rawData.filter(d => d.Course === c).length;
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c} (${count} students enrolled)`;
    courseSelect.appendChild(opt);
  });

  if (courses.length > 0) {
    courseSelect.disabled = false;
    courseCountTag.textContent = `${courses.length} Course${courses.length === 1 ? "" : "s"} Available`;
    courseSelect.value = courses[0];
    activeCourse = courses[0];
    startGradingTimer();
    updateAll();
  } else {
    courseSelect.disabled = true;
    courseCountTag.textContent = "No courses found";
    activeCourse = "";
  }
}

/* --------------------------------------------------------------------------
   GRADE CARDS & DERIVED UPPER BOUNDS
   -------------------------------------------------------------------------- */
function buildGradeCards() {
  if (!gradeGrid) return;
  gradeGrid.innerHTML = "";

  GRADES.forEach((g, idx) => {
    const card = document.createElement("div");
    card.className = "grade-card";
    card.id = `card_${g}`;

    const derivedMaxText = idx === 0 ? "100.0" : `< ${currentCutoffs[GRADES[idx - 1]]}`;

    card.innerHTML = `
      <div class="grade-badge-header">
        <span class="grade-letter">${g}</span>
        <span class="grade-count-chip" id="chip_${g}">0</span>
      </div>
      <div class="range-pair">
        <div class="range-field">
          <span>Min:</span>
          <input type="number" class="range-select" id="${g}min"
            value="${currentCutoffs[g]}"
            min="0" max="100" step="0.5"
            aria-label="Minimum cutoff score for Grade ${g}">
        </div>
        <div class="range-field">
          <span>Max:</span>
          <input type="text" class="range-select" id="${g}max"
            value="${derivedMaxText}"
            readonly disabled title="Derived automatically: < Cutoff of grade above"
            aria-label="Derived maximum score bound for Grade ${g}">
        </div>
      </div>
    `;

    const minInput = card.querySelector(`#${g}min`);
    if (g === "E") {
      minInput.setAttribute("readonly", "true");
      minInput.setAttribute("disabled", "true");
      minInput.title = "Grade E baseline cutoff is fixed at 0.0";
    }

    minInput.onfocus = () => {
      minInput.dataset.preVal = minInput.value;
    };

    minInput.onkeydown = (e) => {
      if (g === "E") return;
      let step = e.shiftKey ? 5.0 : 0.5;
      if (e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault();
        step = e.key === "PageUp" ? 5.0 : step;
        pushUndoState();
        const cur = parseFloat(minInput.value) || 0;
        const nextVal = Math.min(100, Math.round((cur + step) * 10) / 10);
        minInput.value = nextVal;
        minInput.dispatchEvent(new Event("input"));
        minInput.dispatchEvent(new Event("change"));
      } else if (e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault();
        step = e.key === "PageDown" ? 5.0 : step;
        pushUndoState();
        const cur = parseFloat(minInput.value) || 0;
        const nextVal = Math.max(0, Math.round((cur - step) * 10) / 10);
        minInput.value = nextVal;
        minInput.dispatchEvent(new Event("input"));
        minInput.dispatchEvent(new Event("change"));
      }
    };

    minInput.oninput = () => {
      const val = parseFloat(minInput.value);
      if (isNaN(val)) return;
      currentCutoffs[g] = val;
      card.classList.add("lift");
      setTimeout(() => card.classList.remove("lift"), 260);
      updateDerivedMaxes();
      updateAll();
      saveAutosaveSession();
    };

    minInput.onchange = () => {
      const oldVal = parseFloat(minInput.dataset.preVal);
      const newVal = parseFloat(minInput.value);
      if (!isNaN(oldVal) && !isNaN(newVal) && oldVal !== newVal) {
        recordCutoffChange(g, oldVal, newVal);
      }
    };

    gradeGrid.appendChild(card);
  });
}

function updateDerivedMaxes() {
  GRADES.forEach((g, idx) => {
    const maxEl = document.getElementById(`${g}max`);
    if (!maxEl) return;
    if (idx === 0) {
      maxEl.value = "100.0";
    } else {
      const upperMin = currentCutoffs[GRADES[idx - 1]];
      maxEl.value = `< ${upperMin}`;
    }
    maxEl.title = `Derived automatically | Interval: ${formatGradeRange(g, currentCutoffs)}`;
  });
}

function validateRanges() {
  let isStrictlyDescending = true;
  for (let i = 0; i < GRADES.length - 1; i++) {
    const higherGrade = GRADES[i];
    const lowerGrade = GRADES[i + 1];
    if (currentCutoffs[higherGrade] <= currentCutoffs[lowerGrade]) {
      isStrictlyDescending = false;
      break;
    }
  }

  if (!isStrictlyDescending) {
    if (rangeAlert) rangeAlert.style.display = "flex";
    if (rangeAlertText) rangeAlertText.innerText = "Cutoffs must be strictly descending: c(A) > c(A-) > c(B) > c(B-) > c(C) > c(C-) > c(D) > c(E).";
    if (btnExportCSV) btnExportCSV.disabled = true;
    if (btnExportXLSX) btnExportXLSX.disabled = true;
    return false;
  }

  if (rangeAlert) rangeAlert.style.display = "none";
  const hasStudents = rawData.some(d => d.Course === activeCourse);
  if (btnExportCSV) btnExportCSV.disabled = !hasStudents;
  if (btnExportXLSX) btnExportXLSX.disabled = !hasStudents || typeof XLSX === "undefined";
  return true;
}

/* --------------------------------------------------------------------------
   PRESETS ENGINE
   -------------------------------------------------------------------------- */
function applyPreset(preset) {
  const students = rawData.filter(d => d.Course === activeCourse);
  const marks = students.map(d => Number(d["Total Marks"])).filter(m => !isNaN(m));

  pushUndoState();

  if (preset === "default") {
    currentCutoffs = { ...DEFAULT_CUTOFFS };
    showToast("BITS Standard Absolute criteria applied.", "📘");
  } else if (preset === "gaussian") {
    const res = calculateGaussianCutoffs(marks, DEFAULT_CUTOFFS);
    currentCutoffs = res.cutoffs;
    if (res.warning) showToast(res.warning, "⚠️", 4000);
    else showToast("Gaussian normal bell curve presets applied.", "🔔");
  } else if (preset === "percentile") {
    const res = calculatePercentileCutoffs(marks, DEFAULT_CUTOFFS);
    currentCutoffs = res.cutoffs;
    if (res.warning) showToast(res.warning, "⚠️", 4000);
    else showToast("Top-decile percentile relative criteria applied.", "📈");
  }

  syncCutoffsToInputs();
  updateDerivedMaxes();
  updateAll();
  saveAutosaveSession();
}

function resetGradeRanges() {
  if (!confirm("Are you sure you want to reset all cutoff thresholds back to BITS default standards?")) return;
  pushUndoState();
  currentCutoffs = { ...DEFAULT_CUTOFFS };
  syncCutoffsToInputs();
  updateDerivedMaxes();
  updateAll();
  saveAutosaveSession();
  showToast("Cutoffs reset to BITS Defaults (A: 80, A-: 70, etc.)", "↺");
}

/* --------------------------------------------------------------------------
   CORE COORDINATION: updateAll()
   -------------------------------------------------------------------------- */
export function updateAll() {
  validateRanges();
  computeKPIs();
  updateGradeCounts();

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const students = rawData.filter(d => d.Course === activeCourse);
  const marks = students.map(d => Number(d["Total Marks"])).filter(m => !isNaN(m));

  // Render Histogram Canvas
  currentBinData = drawHistogram(histCanvas, {
    marks,
    cutoffs: currentCutoffs,
    isDark,
    draggingGrade
  });

  // Render Accessible Table Fallback
  if (histAccessibleTableBody) {
    const accessibleBins = generateAccessibleBins(marks, currentCutoffs);
    histAccessibleTableBody.innerHTML = accessibleBins.map(b => `
      <tr>
        <td><strong>${b.range}</strong></td>
        <td>${b.count} student${b.count === 1 ? "" : "s"}</td>
        <td>${b.pct}%</td>
        <td>${b.overlapping.map(g => `<span class="badge-grade grade-${g}" style="font-size:10px; margin-right:4px;">${g}</span>`).join("")}</td>
      </tr>
    `).join("");
  }

  // Check Guardrails
  const gRes = checkGuardrails(marks, currentCutoffs, guardrailRules);
  if (guardrailCard) {
    guardrailCard.className = `guardrail-card ${gRes.severity}`;
    if (guardrailIcon) guardrailIcon.innerText = gRes.severity === "ok" ? "✅" : (gRes.severity === "danger" ? "🚨" : "⚠️");
    if (guardrailMsg) guardrailMsg.innerText = gRes.message;
  }

  renderStudentRoster();
  renderScenarioTable();
}

function computeKPIs() {
  const students = rawData.filter(d => d.Course === activeCourse);
  const marks = students.map(d => Number(d["Total Marks"])).filter(m => !isNaN(m));
  const stats = computeStats(marks);

  const kpiMin = document.getElementById("kpiMin");
  const kpiMax = document.getElementById("kpiMax");
  const kpiAvg = document.getElementById("kpiAvg");
  const kpiMed = document.getElementById("kpiMed");

  if (kpiMin) kpiMin.innerText = stats.min;
  if (kpiMax) kpiMax.innerText = stats.max;
  if (kpiAvg) kpiAvg.innerText = stats.mean;
  if (kpiMed) kpiMed.innerText = stats.median;
  if (studentCountBadge) studentCountBadge.innerText = `${stats.count} Enrolled`;
}

function updateGradeCounts() {
  const students = rawData.filter(d => d.Course === activeCourse);
  const counts = {};
  GRADES.forEach(g => counts[g] = 0);

  students.forEach(d => {
    const mark = Number(d["Total Marks"]);
    const assigned = assignGrade(mark, currentCutoffs);
    if (counts[assigned] !== undefined) counts[assigned]++;
  });

  GRADES.forEach(g => {
    const chip = document.getElementById(`chip_${g}`);
    if (chip) chip.innerText = counts[g];
  });

  if (gradePillsContainer) {
    gradePillsContainer.innerHTML = GRADES.map(g => {
      const activeClass = activeGradeFilter === g ? "active" : "";
      return `<div class="grade-pill ${activeClass}" data-grade="${g}"><b>${g}</b>: ${counts[g]}</div>`;
    }).join("");

    gradePillsContainer.querySelectorAll(".grade-pill").forEach(pill => {
      pill.onclick = () => {
        const target = pill.dataset.grade;
        if (activeGradeFilter === target) {
          activeGradeFilter = null;
        } else {
          activeGradeFilter = target;
        }
        currentPage = 1;
        updateGradeCounts();
        renderStudentRoster();
      };
    });
  }
}

/* --------------------------------------------------------------------------
   STUDENT ROSTER & PAGINATION
   -------------------------------------------------------------------------- */
export function renderStudentRoster() {
  const students = rawData.filter(d => d.Course === activeCourse);
  if (!students.length) {
    if (rosterBody) rosterBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No records available. Please load marks sheet.</td></tr>`;
    if (paginationInfo) paginationInfo.innerText = "Showing 0 – 0 of 0 students";
    if (currentPageDisplay) currentPageDisplay.innerText = "Page 1 of 1";
    return;
  }

  const query = studentSearch ? studentSearch.value.trim().toLowerCase() : "";
  let borderlineCount = 0;

  let rosterData = students.map((s, originalIdx) => {
    const mark = Number(s["Total Marks"]);
    const assigned = assignGrade(mark, currentCutoffs);
    let isBorderline = false;
    let proximityMsg = "Standard";

    const gradeIdx = GRADES.indexOf(assigned);
    if (gradeIdx > 0) {
      const higherGrade = GRADES[gradeIdx - 1];
      const higherCutoff = currentCutoffs[higherGrade];
      const diff = higherCutoff - mark;
      if (diff > 0 && diff <= 2.0) {
        isBorderline = true;
        borderlineCount++;
        const diffDisplay = Number.isInteger(diff) ? diff : diff.toFixed(1);
        proximityMsg = `⚡ -${diffDisplay} from ${higherGrade}`;
      }
    }

    return {
      index: originalIdx + 1,
      id: s["BITS ID"],
      marks: mark,
      grade: assigned,
      isBorderline,
      proximityMsg
    };
  });

  if (borderlineCountText) {
    borderlineCountText.innerText = `${borderlineCount} Borderline Cases (within 2 marks)`;
  }

  let filtered = rosterData.filter(item => {
    if (activeGradeFilter && item.grade !== activeGradeFilter) return false;
    if (onlyBorderlines && !item.isBorderline) return false;
    if (query && !item.id.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    let vA = a[sortCol];
    let vB = b[sortCol];
    if (typeof vA === "string") vA = vA.toLowerCase();
    if (typeof vB === "string") vB = vB.toLowerCase();
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });

  const totalRecords = filtered.length;
  if (!totalRecords) {
    if (rosterBody) rosterBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-muted);">No students matching the current filter.</td></tr>`;
    if (paginationInfo) paginationInfo.innerText = "Showing 0 – 0 of 0 students";
    if (currentPageDisplay) currentPageDisplay.innerText = "Page 1 of 1";
    return;
  }

  const effectivePageSize = pageSize === "all" ? totalRecords : parseInt(pageSize, 10);
  const totalPages = Math.max(1, Math.ceil(totalRecords / effectivePageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * effectivePageSize;
  const endIdx = Math.min(startIdx + effectivePageSize, totalRecords);
  const pageSlice = filtered.slice(startIdx, endIdx);

  if (paginationInfo) {
    paginationInfo.innerText = `Showing ${startIdx + 1} – ${endIdx} of ${totalRecords} students`;
  }
  if (currentPageDisplay) {
    currentPageDisplay.innerText = `Page ${currentPage} of ${totalPages}`;
  }
  if (btnPageFirst) btnPageFirst.disabled = currentPage <= 1;
  if (btnPagePrev) btnPagePrev.disabled = currentPage <= 1;
  if (btnPageNext) btnPageNext.disabled = currentPage >= totalPages;
  if (btnPageLast) btnPageLast.disabled = currentPage >= totalPages;

  if (rosterBody) {
    rosterBody.innerHTML = pageSlice.map(item => `
      <tr>
        <td>${escapeHTML(item.index)}</td>
        <td><strong>${escapeHTML(item.id)}</strong></td>
        <td><span style="font-family:'JetBrains Mono', monospace; font-weight:700;">${Number.isInteger(item.marks) ? item.marks : item.marks.toFixed(2)}</span></td>
        <td><span class="badge-grade grade-${escapeHTML(item.grade)}">${escapeHTML(item.grade)}</span></td>
        <td>
          ${item.isBorderline 
            ? `<span class="borderline-flag">${escapeHTML(item.proximityMsg)}</span>` 
            : `<span style="color:var(--text-muted); font-size:12px;">Standard</span>`}
        </td>
      </tr>
    `).join("");
  }
}

/* --------------------------------------------------------------------------
   SENATE AUDIT REPORT PRINT VIEW PREPARATION
   -------------------------------------------------------------------------- */
export function prepareSenatePrintReport() {
  const students = rawData.filter(d => d.Course === activeCourse);
  if (!students.length) return false;

  const courseEl = document.getElementById("printCourseName");
  if (courseEl) courseEl.innerText = activeCourse;
  const instEl = document.getElementById("printInstructorName");
  if (instEl) instEl.innerText = instructorNameInput.value || "Not Specified";
  const totEl = document.getElementById("printTotalStudents");
  if (totEl) totEl.innerText = `${students.length} Students`;
  const timeEl = document.getElementById("printReportTimestamp");
  if (timeEl) timeEl.innerText = `Generated: ${new Date().toLocaleString()}`;
  const sigInst = document.getElementById("sigInstructorName");
  if (sigInst) sigInst.innerText = `Name: ${instructorNameInput.value || "Instructor-in-Charge"}`;

  // Section 1: Cutoffs & Distribution
  const printCutoffBody = document.getElementById("printCutoffTableBody");
  if (printCutoffBody) {
    printCutoffBody.innerHTML = GRADES.map((g, idx) => {
      const minCutoff = currentCutoffs[g];
      const count = students.filter(s => assignGrade(Number(s["Total Marks"]), currentCutoffs) === g).length;
      const pct = ((count / students.length) * 100).toFixed(1);
      return `
        <tr>
          <td><strong style="color:#2B296D; font-size:10.5pt;">${g}</strong></td>
          <td>${formatGradeRange(g, currentCutoffs)}</td>
          <td>${GRADE_POINTS[g] ?? "-"}</td>
          <td><strong>${count}</strong></td>
          <td>${pct}%</td>
          <td><span style="font-size:8.5pt; color:#475569;">${GRADE_DESCRIPTIONS[g] || "Standard"}</span></td>
        </tr>
      `;
    }).join("");
  }

  // Section 2: Cohort Statistics
  const printStatsBody = document.getElementById("printStatsTableBody");
  if (printStatsBody) {
    const marks = students.map(s => Number(s["Total Marks"])).filter(m => !isNaN(m));
    const stats = computeStats(marks);
    printStatsBody.innerHTML = `
      <tr>
        <td><strong>${students.length}</strong></td>
        <td>${stats.min}</td>
        <td>${stats.max}</td>
        <td><strong>${stats.mean}</strong></td>
        <td><strong>${stats.median}</strong></td>
        <td>${stats.std}</td>
      </tr>
    `;
  }

  // Section 3: High-Res Histogram Snapshot
  const printChartImg = document.getElementById("printChartImg");
  if (printChartImg && histCanvas) {
    try {
      printChartImg.src = histCanvas.toDataURL("image/png");
    } catch (e) {
      console.warn("Could not capture canvas snapshot:", e);
    }
  }

  // Section 4: Borderline Cases
  const printBorderlineBody = document.getElementById("printBorderlineTableBody");
  if (printBorderlineBody) {
    const borderlines = [];
    students.forEach((s) => {
      const mark = Number(s["Total Marks"]);
      const assigned = assignGrade(mark, currentCutoffs);
      const gradeIdx = GRADES.indexOf(assigned);
      if (gradeIdx > 0) {
        const higherGrade = GRADES[gradeIdx - 1];
        const diff = currentCutoffs[higherGrade] - mark;
        if (diff > 0 && diff <= 2.0) {
          borderlines.push({
            id: s["BITS ID"],
            mark,
            assigned,
            higherGrade,
            diff: diff.toFixed(1)
          });
        }
      }
    });

    if (borderlines.length) {
      printBorderlineBody.innerHTML = borderlines.slice(0, 25).map((b, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHTML(b.id)}</strong></td>
          <td>${Number.isInteger(b.mark) ? b.mark : b.mark.toFixed(2)}</td>
          <td><span class="badge-grade grade-${escapeHTML(b.assigned)}">${escapeHTML(b.assigned)}</span></td>
          <td>-${b.diff} marks from ${escapeHTML(b.higherGrade)}</td>
        </tr>
      `).join("") + (borderlines.length > 25 ? `<tr><td colspan="5" style="text-align:center; font-style:italic; font-size:9pt; color:#475569;">... and ${borderlines.length - 25} additional borderline students reviewed by instructor</td></tr>` : "");
    } else {
      printBorderlineBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748B; padding:8px;">No student scores within 2.0 marks of higher thresholds.</td></tr>`;
    }
  }

  // Section 5: Audit Change Log
  const printLogBody = document.getElementById("printChangeLogTableBody");
  if (printLogBody) {
    if (cutoffChangeLog && cutoffChangeLog.length > 0) {
      printLogBody.innerHTML = cutoffChangeLog.map(c => `
        <tr>
          <td>${escapeHTML(c.timestamp)}</td>
          <td><strong>${escapeHTML(c.grade)}</strong></td>
          <td>${escapeHTML(c.oldVal)}</td>
          <td>${escapeHTML(c.newVal)}</td>
          <td>${escapeHTML(c.delta)}</td>
        </tr>
      `).join("");
    } else {
      printLogBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748B; padding:8px;">Standard BITS Pilani baseline thresholds active — No manual adjustments applied.</td></tr>`;
    }
  }

  return true;
}

/* --------------------------------------------------------------------------
   TIMER & SESSION MANAGEMENT
   -------------------------------------------------------------------------- */
function updateTimer() {
  if (!gradingStartTime) return;
  const elapsed = Date.now() - gradingStartTime;
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (timerClock) {
    timerClock.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  if (timerArc) {
    const fraction = (totalSeconds % 60) / 60;
    timerArc.style.strokeDashoffset = 176 - (176 * fraction);
  }
}

function startGradingTimer() {
  if (gradingTimerInterval) clearInterval(gradingTimerInterval);
  gradingStartTime = Date.now();
  updateTimer();
  gradingTimerInterval = setInterval(updateTimer, 1000);
  if (timerStatusNotice) timerStatusNotice.innerText = `Active Session: ${escapeHTML(activeCourse)}`;
}

function resetEntireSession() {
  if (!confirm("Are you sure you want to reset the entire grading session? All uploaded marks and settings will be cleared.")) return;
  if (gradingTimerInterval) clearInterval(gradingTimerInterval);
  gradingStartTime = null;
  rawData = [];
  activeCourse = "";
  stagedFile = null;
  undoStack = [];
  redoStack = [];
  cutoffChangeLog = [];
  savedScenarios = [];
  currentCutoffs = { ...DEFAULT_CUTOFFS };
  clearAutosave(AUTOSAVE_STORAGE_KEY);

  if (selectedFileChip) selectedFileChip.style.display = "none";
  if (dropzoneText) dropzoneText.innerText = "Drop Excel file here or click to browse";
  if (courseSelect) {
    courseSelect.innerHTML = '<option value="">Select or upload a course to begin</option>';
    courseSelect.disabled = true;
  }
  if (courseCountTag) courseCountTag.innerText = "No file loaded";
  if (btnUploadFile) btnUploadFile.disabled = true;
  if (fileStatusBanner) fileStatusBanner.style.display = "none";
  if (timerClock) timerClock.innerText = "00:00";
  if (timerStatusNotice) timerStatusNotice.innerText = "Session idle — Select course to begin";
  if (weightedCard) weightedCard.style.display = "none";
  if (changelogTableBody) changelogTableBody.innerHTML = `<tr><td colspan="5" class="changelog-empty">No cutoff adjustments recorded in this session.</td></tr>`;
  if (scenarioTableBody) scenarioTableBody.innerHTML = "";

  syncCutoffsToInputs();
  updateDerivedMaxes();
  updateAll();
  updateHistoryButtons();
  showToast("Session reset to initial clean state.", "↺");
}

/* --------------------------------------------------------------------------
   EVENT LISTENERS INITIALIZATION
   -------------------------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  buildGradeCards();
  checkAutosaveOnLoad();

  // File Dropzone & Manual Selection
  if (marksFileInput) {
    marksFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) stageFileForUpload(file);
    };
  }

  if (dropZone) {
    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    };
    dropZone.ondragleave = () => {
      dropZone.classList.remove("dragover");
    };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) stageFileForUpload(file);
    };
  }

  if (btnClearFile) {
    btnClearFile.onclick = () => {
      stagedFile = null;
      if (marksFileInput) marksFileInput.value = "";
      if (selectedFileChip) selectedFileChip.style.display = "none";
      if (dropzoneText) dropzoneText.innerText = "Drop Excel file here or click to browse";
      if (btnUploadFile) {
        btnUploadFile.disabled = true;
        btnUploadFile.classList.remove("pulse");
      }
    };
  }

  if (btnUploadFile) {
    btnUploadFile.onclick = () => {
      if (stagedFile) processSpreadsheetUpload(stagedFile);
    };
  }

  // Demo Dataset Ingestion
  if (btnLoadDemo) {
    btnLoadDemo.onclick = () => {
      const demoStudents = [];
      const courses = ["CS F211 Data Structures", "CS F111 Computer Programming", "MATH F111 Mathematics I"];
      courses.forEach((cName, cIdx) => {
        for (let i = 1; i <= 60; i++) {
          const id = `2024A${cIdx + 1}PS${String(i).padStart(4, '0')}P`;
          let mark;
          if (i <= 6) mark = 85 + Math.round(Math.random() * 12 * 10) / 10;
          else if (i <= 18) mark = 72 + Math.round(Math.random() * 11 * 10) / 10;
          else if (i <= 38) mark = 55 + Math.round(Math.random() * 16 * 10) / 10;
          else if (i <= 54) mark = 38 + Math.round(Math.random() * 14 * 10) / 10;
          else mark = 22 + Math.round(Math.random() * 12 * 10) / 10;

          demoStudents.push({
            "BITS ID": id,
            "Course": cName,
            "Total Marks": mark,
            "Quiz": Math.round((mark * 0.2) * 10) / 10,
            "Midsem": Math.round((mark * 0.3) * 10) / 10,
            "Compre": Math.round((mark * 0.5) * 10) / 10
          });
        }
      });

      applyCleanDataset(demoStudents, "Loaded BITS Pilani Demo Data: 180 records across 3 courses.");
    };
  }

  // Course Selector
  if (courseSelect) {
    courseSelect.onchange = () => {
      activeCourse = courseSelect.value;
      currentPage = 1;
      activeGradeFilter = null;
      onlyBorderlines = false;
      if (btnFilterBorderline) {
        btnFilterBorderline.classList.remove("active");
        btnFilterBorderline.innerText = "Only Borderline";
      }
      startGradingTimer();
      updateAll();
      saveAutosaveSession();
    };
  }

  // Presets
  document.querySelectorAll(".btn-preset").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".btn-preset").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyPreset(btn.dataset.preset);
    };
  });

  if (btnResetRanges) btnResetRanges.onclick = resetGradeRanges;
  if (btnResetRangesBottom) btnResetRangesBottom.onclick = resetGradeRanges;

  // Undo / Redo
  if (btnUndo) btnUndo.onclick = undoCutoffChange;
  if (btnRedo) btnRedo.onclick = redoCutoffChange;

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      if (e.shiftKey) {
        e.preventDefault();
        redoCutoffChange();
      } else {
        e.preventDefault();
        undoCutoffChange();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
      e.preventDefault();
      redoCutoffChange();
    }
  });

  // Canvas Mouse & Touch Dragging
  if (histCanvas) {
    histCanvas.addEventListener("mousedown", (e) => {
      const g = getCutoffAtCanvasPos(histCanvas, currentCutoffs, e.clientX, e.clientY);
      if (g) {
        pushUndoState();
        draggingGrade = g;
        dragInitialCutoff = currentCutoffs[g];
        histCanvas.style.cursor = "ew-resize";
        if (chartTooltip) chartTooltip.style.opacity = "0";
        e.preventDefault();
      }
    });

    histCanvas.addEventListener("touchstart", (e) => {
      if (!e.touches.length) return;
      const touch = e.touches[0];
      const g = getCutoffAtCanvasPos(histCanvas, currentCutoffs, touch.clientX, touch.clientY);
      if (g) {
        pushUndoState();
        draggingGrade = g;
        dragInitialCutoff = currentCutoffs[g];
        e.preventDefault();
      }
    }, { passive: false });

    histCanvas.addEventListener("mousemove", (e) => {
      if (draggingGrade) return;
      const g = getCutoffAtCanvasPos(histCanvas, currentCutoffs, e.clientX, e.clientY);
      histCanvas.style.cursor = g ? "ew-resize" : "default";

      // Tooltip handling
      const rect = histCanvas.getBoundingClientRect();
      const scaleX = histCanvas.width / rect.width;
      const scaleY = histCanvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const hoveredBin = currentBinData.find(b =>
        mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= histCanvas.height - 30
      );

      if (hoveredBin && chartTooltip) {
        chartTooltip.style.opacity = "1";
        chartTooltip.style.left = `${e.clientX - rect.left + 12}px`;
        chartTooltip.style.top = `${e.clientY - rect.top - 28}px`;
        chartTooltip.innerText = `${hoveredBin.range}: ${hoveredBin.count} students`;
      } else if (chartTooltip) {
        chartTooltip.style.opacity = "0";
      }
    });

    histCanvas.addEventListener("mouseleave", () => {
      if (chartTooltip) chartTooltip.style.opacity = "0";
    });

    // Canvas Keyboard Navigation
    histCanvas.addEventListener("keydown", (e) => {
      const adjustableGrades = GRADES.slice(0, -1);
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        pushUndoState();
        const g = adjustableGrades[focusedCanvasMarkerIdx];
        const oldVal = currentCutoffs[g];
        const newVal = Math.max(0, Math.round((oldVal - 0.5) * 10) / 10);
        if (newVal !== oldVal) {
          currentCutoffs[g] = newVal;
          const inputEl = document.getElementById(`${g}min`);
          if (inputEl) inputEl.value = newVal;
          updateDerivedMaxes();
          updateAll();
          recordCutoffChange(g, oldVal, newVal);
          showToast(`Adjusted Grade ${g} cutoff to ${newVal}`, "⌨️", 1800);
        }
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        pushUndoState();
        const g = adjustableGrades[focusedCanvasMarkerIdx];
        const oldVal = currentCutoffs[g];
        const newVal = Math.min(100, Math.round((oldVal + 0.5) * 10) / 10);
        if (newVal !== oldVal) {
          currentCutoffs[g] = newVal;
          const inputEl = document.getElementById(`${g}min`);
          if (inputEl) inputEl.value = newVal;
          updateDerivedMaxes();
          updateAll();
          recordCutoffChange(g, oldVal, newVal);
          showToast(`Adjusted Grade ${g} cutoff to ${newVal}`, "⌨️", 1800);
        }
      } else if (e.key === "]" || e.key === "PageDown") {
        focusedCanvasMarkerIdx = (focusedCanvasMarkerIdx + 1) % adjustableGrades.length;
        showToast(`Selected Grade ${adjustableGrades[focusedCanvasMarkerIdx]} cutoff marker`, "🎯", 1500);
      } else if (e.key === "[" || e.key === "PageUp") {
        focusedCanvasMarkerIdx = (focusedCanvasMarkerIdx - 1 + adjustableGrades.length) % adjustableGrades.length;
        showToast(`Selected Grade ${adjustableGrades[focusedCanvasMarkerIdx]} cutoff marker`, "🎯", 1500);
      }
    });
  }

  window.addEventListener("mousemove", (e) => {
    if (draggingGrade && histCanvas) {
      const rect = histCanvas.getBoundingClientRect();
      const scaleX = histCanvas.width / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mark = Math.max(0, Math.min(100, (mouseX - 32) / 380 * 100));
      const snapped = Math.round(mark * 2) / 2; // 0.5 resolution snap

      currentCutoffs[draggingGrade] = snapped;
      const input = document.getElementById(`${draggingGrade}min`);
      if (input) input.value = snapped;
      updateDerivedMaxes();
      updateAll();
    }
  });

  window.addEventListener("mouseup", () => {
    if (draggingGrade) {
      if (dragInitialCutoff !== null && currentCutoffs[draggingGrade] !== dragInitialCutoff) {
        recordCutoffChange(draggingGrade, dragInitialCutoff, currentCutoffs[draggingGrade]);
        saveAutosaveSession();
      }
      draggingGrade = null;
      if (histCanvas) histCanvas.style.cursor = "default";
    }
  });

  window.addEventListener("touchmove", (e) => {
    if (draggingGrade && histCanvas && e.touches.length) {
      const touch = e.touches[0];
      const rect = histCanvas.getBoundingClientRect();
      const scaleX = histCanvas.width / rect.width;
      const mouseX = (touch.clientX - rect.left) * scaleX;
      const mark = Math.max(0, Math.min(100, (mouseX - 32) / 380 * 100));
      const snapped = Math.round(mark * 2) / 2;

      currentCutoffs[draggingGrade] = snapped;
      const input = document.getElementById(`${draggingGrade}min`);
      if (input) input.value = snapped;
      updateDerivedMaxes();
      updateAll();
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("touchend", () => {
    if (draggingGrade) {
      if (dragInitialCutoff !== null && currentCutoffs[draggingGrade] !== dragInitialCutoff) {
        recordCutoffChange(draggingGrade, dragInitialCutoff, currentCutoffs[draggingGrade]);
        saveAutosaveSession();
      }
      draggingGrade = null;
    }
  });

  // Accessible Histogram Table Toggle
  if (btnToggleHistTable) {
    btnToggleHistTable.onclick = () => {
      if (!histAccessibleTableContainer) return;
      const isHidden = histAccessibleTableContainer.style.display === "none";
      histAccessibleTableContainer.style.display = isHidden ? "block" : "none";
      btnToggleHistTable.setAttribute("aria-expanded", isHidden ? "true" : "false");
      if (toggleHistTableText) {
        toggleHistTableText.innerText = isHidden ? "Hide Accessible Data Table" : "View Histogram as Accessible Data Table";
      }
    };
  }

  // Guardrail Modal Controls
  if (btnConfigureGuardrails) {
    btnConfigureGuardrails.onclick = () => {
      if (guardrailMaxAPct) guardrailMaxAPct.value = guardrailRules.maxA;
      if (guardrailMaxEPct) guardrailMaxEPct.value = guardrailRules.maxE;
      if (guardrailMinMidPct) guardrailMinMidPct.value = guardrailRules.minMid;
      if (guardrailModal) guardrailModal.style.display = "flex";
    };
  }

  if (btnCloseGuardrailModal) {
    btnCloseGuardrailModal.onclick = () => {
      if (guardrailModal) guardrailModal.style.display = "none";
    };
  }

  if (btnResetGuardrails) {
    btnResetGuardrails.onclick = () => {
      guardrailRules = { maxA: 15, maxE: 20, minMid: 35 };
      if (guardrailMaxAPct) guardrailMaxAPct.value = 15;
      if (guardrailMaxEPct) guardrailMaxEPct.value = 20;
      if (guardrailMinMidPct) guardrailMinMidPct.value = 35;
      updateAll();
      saveAutosaveSession();
      showToast("Guardrail rules reset to default thresholds", "↺");
    };
  }

  if (btnSaveGuardrails) {
    btnSaveGuardrails.onclick = () => {
      const a = parseFloat(guardrailMaxAPct ? guardrailMaxAPct.value : 15) || 15;
      const eVal = parseFloat(guardrailMaxEPct ? guardrailMaxEPct.value : 20) || 20;
      const mid = parseFloat(guardrailMinMidPct ? guardrailMinMidPct.value : 35) || 35;
      guardrailRules = { maxA: a, maxE: eVal, minMid: mid };
      if (guardrailModal) guardrailModal.style.display = "none";
      updateAll();
      saveAutosaveSession();
      showToast("Updated configurable distribution guardrails", "⚙️");
    };
  }

  // Scenarios Modal Controls
  if (btnSaveScenario) {
    btnSaveScenario.onclick = () => {
      if (savedScenarios.length >= 3) {
        showToast("Maximum of 3 scenarios reached. Delete an existing scenario to save a new one.", "⚠️");
        return;
      }
      if (scenarioNameInput) {
        scenarioNameInput.value = `Scenario ${savedScenarios.length + 1}`;
      }
      if (scenarioModal) {
        scenarioModal.style.display = "flex";
        if (scenarioNameInput) {
          setTimeout(() => {
            scenarioNameInput.focus();
            scenarioNameInput.select();
          }, 50);
        }
      }
    };
  }

  if (btnCloseScenarioModal) {
    btnCloseScenarioModal.onclick = () => {
      if (scenarioModal) scenarioModal.style.display = "none";
    };
  }

  if (btnCancelScenarioModal) {
    btnCancelScenarioModal.onclick = () => {
      if (scenarioModal) scenarioModal.style.display = "none";
    };
  }

  if (btnConfirmSaveScenario) {
    btnConfirmSaveScenario.onclick = () => {
      const rawName = scenarioNameInput ? scenarioNameInput.value.trim() : "";
      const name = rawName || `Scenario ${savedScenarios.length + 1}`;
      savedScenarios.push({
        name: name,
        cutoffs: { ...currentCutoffs }
      });
      if (scenarioModal) scenarioModal.style.display = "none";
      renderScenarioTable();
      saveAutosaveSession();
      showToast(`Saved scenario '${name}'`, "💾");
    };
  }

  // Weighted Component Marks Actions
  if (btnResetWeights) {
    btnResetWeights.onclick = () => {
      componentWeights = {};
      renderWeightedComponentsUI(detectedComponentColumns);
      showToast("Reset to equal component weights.", "⚖️");
    };
  }

  if (btnApplyWeightedMarks) {
    btnApplyWeightedMarks.onclick = () => {
      if (!rawData.length || !detectedComponentColumns.length) return;
      rawData.forEach(student => {
        student["Total Marks"] = computeWeightedTotal(student, componentWeights);
      });
      updateAll();
      showToast("Total Marks recomputed from weighted components.", "⚡");
    };
  }

  // Roster Pagination & Search
  if (btnPageFirst) btnPageFirst.onclick = () => { currentPage = 1; renderStudentRoster(); };
  if (btnPagePrev) btnPagePrev.onclick = () => { if (currentPage > 1) { currentPage--; renderStudentRoster(); } };
  if (btnPageNext) btnPageNext.onclick = () => { currentPage++; renderStudentRoster(); };
  if (btnPageLast) btnPageLast.onclick = () => { currentPage = 999999; renderStudentRoster(); };
  if (pageSizeSelect) {
    pageSizeSelect.onchange = () => {
      pageSize = pageSizeSelect.value === "all" ? "all" : parseInt(pageSizeSelect.value, 10);
      currentPage = 1;
      renderStudentRoster();
    };
  }

  document.querySelectorAll(".roster-table th[data-sort]").forEach(th => {
    const doSort = () => {
      const col = th.dataset.sort;
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = true;
      }
      document.querySelectorAll(".roster-table th[data-sort]").forEach(h => {
        h.setAttribute("aria-sort", h === th ? (sortAsc ? "ascending" : "descending") : "none");
      });
      currentPage = 1;
      renderStudentRoster();
    };
    th.onclick = doSort;
    th.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        doSort();
      }
    };
  });

  if (studentSearch) {
    studentSearch.oninput = debounce(() => {
      currentPage = 1;
      renderStudentRoster();
    }, 250);
  }

  if (btnFilterBorderline) {
    btnFilterBorderline.onclick = () => {
      onlyBorderlines = !onlyBorderlines;
      btnFilterBorderline.classList.toggle("active", onlyBorderlines);
      btnFilterBorderline.innerText = onlyBorderlines ? "Showing Borderlines" : "Only Borderline";
      currentPage = 1;
      renderStudentRoster();
    };
  }

  // Export Buttons
  if (btnExportCSV) {
    btnExportCSV.onclick = () => {
      finalizeCounter++;
      const elapsed = Date.now() - (gradingStartTime || Date.now());
      const minT = Math.floor(elapsed / 60000);
      const secT = Math.floor((elapsed % 60000) / 1000);

      const students = rawData.filter(d => d.Course === activeCourse);
      const csv = buildCSV({
        instructor: instructorNameInput.value,
        course: activeCourse,
        students,
        cutoffs: currentCutoffs,
        changeLog: cutoffChangeLog
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const safeName = activeCourse.replace(/[^a-zA-Z0-9_-]/g, "_");
      a.download = `BITS_Grades_${safeName}.csv`;
      a.click();

      showToast(`Grading finalized in ${minT}m ${secT}s (Attempt #${finalizeCounter})`, "📥", 4000);
    };
  }

  if (btnExportXLSX) {
    btnExportXLSX.onclick = () => {
      if (typeof XLSX === "undefined") {
        handleSheetJSLoadError();
        showToast("SheetJS library is offline. Cannot export Excel workbook.", "❌", 5000);
        return;
      }
      try {
        const students = rawData.filter(d => d.Course === activeCourse);
        const wb = buildXLSXWorkbook({
          instructor: instructorNameInput.value,
          course: activeCourse,
          students,
          cutoffs: currentCutoffs,
          changeLog: cutoffChangeLog,
          XLSXLib: XLSX
        });
        const safeName = activeCourse.replace(/[^a-zA-Z0-9_-]/g, "_");
        XLSX.writeFile(wb, `BITS_Grading_Package_${safeName}.xlsx`);
        showToast("Excel workbook exported with Criteria, Roster & Change Log tabs", "📊");
      } catch (err) {
        showToast("Failed to generate Excel workbook: " + err.message, "❌", 5000);
      }
    };
  }

  // Print Report
  window.onbeforeprint = () => {
    prepareSenatePrintReport();
  };

  if (btnReport) {
    btnReport.onclick = () => {
      if (!activeCourse) {
        showToast("Please select a course before generating the report.", "⚠️");
        return;
      }
      prepareSenatePrintReport();
      window.print();
    };
  }

  // Session Reset
  if (btnResetSession) btnResetSession.onclick = resetEntireSession;

  // Theme Toggle
  if (themeToggle) {
    themeToggle.onclick = () => {
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const nextTheme = isDark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", nextTheme);
      themeToggle.innerText = isDark ? "🌙 Theme" : "☀️ Theme";
      updateAll();
    };
  }

  // Autosave Restore Prompt
  if (btnRestoreSession) {
    btnRestoreSession.onclick = () => {
      const saved = loadAutosave(AUTOSAVE_STORAGE_KEY);
      if (!saved) return;
      if (saved.instructor && instructorNameInput) instructorNameInput.value = saved.instructor;
      if (saved.cutoffs) currentCutoffs = { ...saved.cutoffs };
      if (saved.guardrails) guardrailRules = { ...saved.guardrails };
      if (saved.scenarios) savedScenarios = saved.scenarios;
      if (saved.rawData && saved.rawData.length > 0) {
        applyCleanDataset(saved.rawData, "Restored student records and configuration from previous session.");
      } else {
        syncCutoffsToInputs();
        updateDerivedMaxes();
        updateAll();
        showToast("Restored grading thresholds and session preferences.", "💾");
      }
      if (restoreBanner) restoreBanner.style.display = "none";
    };
  }

  if (btnDismissRestore) {
    btnDismissRestore.onclick = () => {
      if (restoreBanner) restoreBanner.style.display = "none";
      clearAutosave(AUTOSAVE_STORAGE_KEY);
    };
  }

  // Validation Modal Dismissal
  if (btnDismissModal) {
    btnDismissModal.onclick = () => {
      if (validationModal) validationModal.style.display = "none";
      if (btnClearFile) {
        btnClearFile.click();
      } else {
        stagedFile = null;
        if (marksFileInput) marksFileInput.value = "";
        if (selectedFileChip) selectedFileChip.style.display = "none";
      }
    };
  }

  if (btnCancelUploadModal) {
    btnCancelUploadModal.onclick = () => {
      if (validationModal) validationModal.style.display = "none";
      if (btnClearFile) {
        btnClearFile.click();
      } else {
        stagedFile = null;
        if (marksFileInput) marksFileInput.value = "";
        if (selectedFileChip) selectedFileChip.style.display = "none";
        if (dropzoneText) dropzoneText.innerText = "Drop Excel file here or click to browse";
        if (btnUploadFile) {
          btnUploadFile.disabled = true;
          btnUploadFile.classList.remove("pulse");
        }
      }
      showToast("File ingestion cancelled. Staged file reset.", "ℹ️");
    };
  }
});
