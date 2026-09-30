/**
 * BITS Pilani Digital — Advanced Grading Console
 * Module: charts.js
 * 
 * HTML5 Canvas histogram rendering, normal distribution bell curve,
 * interactive draggable cutoff markers, and accessible table data mapping.
 * Runs in both browser (ES module) and Node.js without build step.
 */

import { GRADES } from './grading.js';

/**
 * Draws the score distribution histogram and bell curve on the provided canvas.
 *
 * @param {HTMLCanvasElement} canvas - Target HTML5 canvas
 * @param {{ marks: number[], cutoffs: Record<string, number>, isDark?: boolean, draggingGrade?: string|null }} options
 * @returns {Array<{ x: number, y: number, w: number, h: number, range: string, count: number }>} Bin coordinates for tooltips
 */
export function drawHistogram(canvas, { marks, cutoffs, isDark = false, draggingGrade = null }) {
  if (!canvas) return [];
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const validMarks = marks.filter(m => typeof m === "number" && !isNaN(m));
  if (!validMarks.length) return [];

  const bins = Array(10).fill(0);
  validMarks.forEach(m => bins[Math.min(9, Math.floor(m / 10))]++);
  const maxBin = Math.max(...bins, 1);

  const barColor = isDark ? "#8A00FF" : "#2B296D";
  const textColor = isDark ? "#8F9EB7" : "#5B6B84";

  const chartBottom = height - 30;
  const chartHeight = 175;
  const binData = [];

  // Render Frequency Bars
  bins.forEach((count, i) => {
    const barH = (count / maxBin) * chartHeight;
    const x = 32 + i * 38;
    const y = chartBottom - barH;
    const barW = 28;

    binData.push({ x, y, w: barW, h: barH, range: `${i * 10}–${i * 10 + 9.9}`, count });

    ctx.fillStyle = barColor;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    } else {
      ctx.rect(x, y, barW, barH);
    }
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.fillText(`${i * 10}`, x + 5, height - 12);
  });

  // Render Normal Distribution Bell Curve (if N >= 2 and std > 0)
  if (validMarks.length >= 2) {
    const mean = validMarks.reduce((a, b) => a + b, 0) / validMarks.length;
    const std = Math.sqrt(validMarks.reduce((a, b) => a + (b - mean) ** 2, 0) / validMarks.length);
    if (std > 0) {
      ctx.strokeStyle = "#EA1F27";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x <= 100; x++) {
        const yVal = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / std) ** 2);
        const px = 32 + (x / 100) * 380;
        const py = chartBottom - yVal * 3200;
        if (x === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  // Render Vertical Cutoff Markers with Interactive Pill Handles
  const adjustableGrades = GRADES.slice(0, -1); // Exclude E
  adjustableGrades.forEach(g => {
    const cutoff = cutoffs[g];
    if (cutoff === undefined || cutoff === null) return;
    const px = 32 + (cutoff / 100) * 380;

    // Dashed threshold guide line
    ctx.strokeStyle = draggingGrade === g ? "#8A00FF" : "#E8972B";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = draggingGrade === g ? 2.2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(px, 18);
    ctx.lineTo(px, chartBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Interactive Pill Handle at Top
    ctx.fillStyle = draggingGrade === g ? "#8A00FF" : "#E8972B";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(px - 10, 2, 20, 15, [4, 4, 4, 4]);
    } else {
      ctx.rect(px - 10, 2, 20, 15);
    }
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 9px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(g, px, 13);
    ctx.textAlign = "left";
  });

  return binData;
}

/**
 * Identifies which grade cutoff handle is located at a canvas mouse/touch coordinate.
 *
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {Record<string, number>} cutoffs - Active grade cutoffs
 * @param {number} clientX - Client coordinate X
 * @param {number} clientY - Client coordinate Y
 * @returns {string|null} Grade letter or null
 */
export function getCutoffAtCanvasPos(canvas, cutoffs, clientX, clientY) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (clientX - rect.left) * scaleX;
  const mouseY = (clientY - rect.top) * scaleY;

  const adjustableGrades = GRADES.slice(0, -1);
  for (const g of adjustableGrades) {
    const cutoff = cutoffs[g];
    if (cutoff === undefined) continue;
    const px = 32 + (cutoff / 100) * 380;
    // Handle pill area at top (Y: 0..24) or full vertical line region (Y: 0..220)
    if (Math.abs(mouseX - px) <= 12 && mouseY >= 0 && mouseY <= 220) {
      return g;
    }
  }
  return null;
}

/**
 * Generates structured bin rows for the accessible histogram table fallback.
 *
 * @param {number[]} marks - Array of student total marks
 * @param {Record<string, number>} cutoffs - Active cutoffs
 * @returns {Array<{ range: string, count: number, pct: string, overlapping: string[] }>}
 */
export function generateAccessibleBins(marks, cutoffs) {
  const valid = marks.filter(m => typeof m === "number" && !isNaN(m));
  const bins = Array(10).fill(0);
  valid.forEach(m => bins[Math.min(9, Math.floor(m / 10))]++);

  return bins.map((count, i) => {
    const binMin = i * 10;
    const binMax = i === 9 ? 100 : i * 10 + 9.9;
    const pct = valid.length ? ((count / valid.length) * 100).toFixed(1) : "0.0";
    const overlapping = GRADES.filter(g => {
      const cMin = cutoffs[g];
      const gIdx = GRADES.indexOf(g);
      const cMax = gIdx === 0 ? 100.0 : cutoffs[GRADES[gIdx - 1]];
      return !(cMax <= binMin || cMin > binMax);
    });
    return {
      range: `${binMin} – ${binMax === 100 ? "100" : binMax.toFixed(1)}`,
      count,
      pct,
      overlapping
    };
  });
}
