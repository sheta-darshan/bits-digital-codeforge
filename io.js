/**
 * BITS Pilani Digital — Advanced Grading Console
 * Module: io.js
 * 
 * Input/Output, file ingestion (SheetJS), CSV & XLSX generation,
 * formula injection sanitization (CWE-1236), DOM escaping, and autosave.
 * Runs in both browser (ES module) and Node.js without build step.
 */

import { assignGrade, GRADES, formatGradeRange } from './grading.js';

/**
 * Encodes dangerous characters to neutralize DOM Cross-Site Scripting (XSS).
 *
 * @param {any} str - Input value
 * @returns {string} Sanitized string safe for innerHTML insertion
 */
export function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Mitigates Formula Injection (CWE-1236) in CSV and spreadsheet exports.
 * If a cell string starts with '=', '+', '-', '@', '\t', or '\r', prefixes with a single quote.
 *
 * @param {any} val - Cell value
 * @returns {any} Sanitized value safe for Excel / LibreOffice ingestion
 */
export function sanitizeFormula(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    return "'" + s;
  }
  return val;
}

/**
 * Parses an Excel or spreadsheet file ArrayBuffer using SheetJS.
 *
 * @param {ArrayBuffer} arrayBuffer - Raw file buffer
 * @param {any} XLSXLib - Reference to window.XLSX or imported library
 * @returns {{ success: boolean, rows?: Array<Record<string, any>>, error?: string }}
 */
export function parseSpreadsheet(arrayBuffer, XLSXLib) {
  if (!XLSXLib) {
    return {
      success: false,
      error: "Spreadsheet engine is offline (SheetJS library not loaded)."
    };
  }

  try {
    const workbook = XLSXLib.read(arrayBuffer, { type: "array" });
    if (!workbook.SheetNames || !workbook.SheetNames.length) {
      return {
        success: false,
        error: "Workbook appears corrupt or contains no readable sheets."
      };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      return {
        success: false,
        error: `Could not load sheet '${firstSheetName}'.`
      };
    }

    const rawRows = XLSXLib.utils.sheet_to_json(worksheet, { defval: "" });
    if (!rawRows || !rawRows.length) {
      return {
        success: false,
        error: `Sheet '${firstSheetName}' is completely empty. Please ensure marks data exists.`
      };
    }

    return {
      success: true,
      rows: rawRows
    };
  } catch (err) {
    let msg = err.message || "Unknown error";
    if (/password|encrypt/i.test(msg)) {
      msg = "File is password-protected or encrypted. Please remove encryption before uploading.";
    } else if (/unsupported/i.test(msg)) {
      msg = "Unrecognized workbook format. Please supply a valid .xlsx or .xls spreadsheet.";
    }
    return {
      success: false,
      error: msg
    };
  }
}

/**
 * Generates an RFC 4180 standard CSV string with formula injection protection
 * and an optional Cutoff Audit Change Log appendix.
 *
 * @param {{ instructor: string, course: string, students: Array<Record<string, any>>, cutoffs: Record<string, number>, changeLog?: Array<any> }} options
 * @returns {string} Formatted CSV text
 */
export function buildCSV({ instructor, course, students, cutoffs, changeLog = [] }) {
  const escapeCSV = (val) => {
    const sanitized = sanitizeFormula(val);
    const s = String(sanitized ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  let csv = `Instructor,${escapeCSV(instructor)}\nCourse,${escapeCSV(course)}\nTimestamp,${escapeCSV(new Date().toLocaleString())}\n\nBITS ID,Total Marks,Grade,Status\n`;

  students.forEach(d => {
    const mark = Number(d["Total Marks"]);
    const assigned = assignGrade(mark, cutoffs);
    csv += `${escapeCSV(d["BITS ID"])},${mark},${escapeCSV(assigned)},Finalized\n`;
  });

  if (changeLog && changeLog.length > 0) {
    csv += `\n--- CUTOFF AUDIT CHANGE LOG ---\nTimestamp,Grade,Previous Cutoff,New Cutoff,Adjustment\n`;
    changeLog.forEach(c => {
      csv += `${escapeCSV(c.timestamp)},${escapeCSV(c.grade)},${escapeCSV(c.oldVal)},${escapeCSV(c.newVal)},${escapeCSV(c.delta)}\n`;
    });
  }

  return csv;
}

/**
 * Builds a multi-sheet Excel workbook object using SheetJS.
 * Contains: "Grading Criteria", "Student Roster", and "Audit Change Log".
 *
 * @param {{ instructor: string, course: string, students: Array<Record<string, any>>, cutoffs: Record<string, number>, changeLog?: Array<any>, XLSXLib: any }} options
 * @returns {any} SheetJS Workbook instance
 */
export function buildXLSXWorkbook({ instructor, course, students, cutoffs, changeLog = [], XLSXLib }) {
  if (!XLSXLib) {
    throw new Error("SheetJS library is required to build Excel workbooks.");
  }

  const wb = XLSXLib.utils.book_new();

  // Sheet 1: Grading Criteria
  const summaryRows = [
    { "Metric": "Course", "Value": sanitizeFormula(course) },
    { "Metric": "Instructor", "Value": sanitizeFormula(instructor) },
    { "Metric": "Date", "Value": new Date().toLocaleDateString() },
    { "Metric": "Total Students", "Value": students.length }
  ];
  GRADES.forEach(g => {
    summaryRows.push({
      "Metric": `Grade ${g} Range`,
      "Value": formatGradeRange(g, cutoffs)
    });
  });
  const wsSummary = XLSXLib.utils.json_to_sheet(summaryRows);
  XLSXLib.utils.book_append_sheet(wb, wsSummary, "Grading Criteria");

  // Sheet 2: Student Roster
  const rosterRows = students.map(d => {
    const mark = Number(d["Total Marks"]);
    return {
      "BITS ID": sanitizeFormula(d["BITS ID"]),
      "Total Marks": mark,
      "Final Grade": sanitizeFormula(assignGrade(mark, cutoffs))
    };
  });
  const wsRoster = XLSXLib.utils.json_to_sheet(rosterRows);
  XLSXLib.utils.book_append_sheet(wb, wsRoster, "Student Roster");

  // Sheet 3: Audit Change Log (if modifications exist)
  if (changeLog && changeLog.length > 0) {
    const logRows = changeLog.map(c => ({
      "Timestamp": sanitizeFormula(c.timestamp),
      "Grade": sanitizeFormula(c.grade),
      "Previous Cutoff": c.oldVal,
      "New Cutoff": c.newVal,
      "Net Delta": sanitizeFormula(c.delta)
    }));
    const wsLog = XLSXLib.utils.json_to_sheet(logRows);
    XLSXLib.utils.book_append_sheet(wb, wsLog, "Audit Change Log");
  }

  return wb;
}

/**
 * Saves active session state to localStorage with student privacy protection.
 *
 * @param {string} key - Storage key
 * @param {Record<string, any>} data - State snapshot
 * @param {boolean} persistStudents - If true, saves student marks; if false, strips them
 */
export function saveAutosave(key, data, persistStudents = false) {
  try {
    const clone = { ...data, timestamp: Date.now() };
    if (!persistStudents) {
      delete clone.rawData;
    }
    localStorage.setItem(key, JSON.stringify(clone));
    return true;
  } catch (e) {
    console.warn("Autosave storage failed:", e);
    return false;
  }
}

/**
 * Loads autosaved session from localStorage.
 *
 * @param {string} key - Storage key
 * @returns {Record<string, any>|null} Parsed state or null
 */
export function loadAutosave(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to load autosaved session:", e);
    return null;
  }
}

/**
 * Clears autosaved session from localStorage.
 *
 * @param {string} key - Storage key
 */
export function clearAutosave(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    // ignore
  }
}
