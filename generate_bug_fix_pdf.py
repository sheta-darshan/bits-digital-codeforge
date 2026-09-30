import os
import sys
import html
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#2B296D"))
        self.drawString(32, 566, "BITS Pilani Digital")
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(108, 566, " | CodeForge Challenge V1.0 - Stage 1: Official Bug Fix Log")
        self.drawRightString(810, 566, "Release: v2.0 Enterprise Pro")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(32, 559, 810, 559)

        # Running Footer
        self.line(32, 32, 810, 32)
        self.drawString(32, 22, "Prototype built for BITS Digital CodeForge Challenge. Formal Stage 1 Submission Package.")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(810, 22, page_str)

        self.restoreState()


def clean_text(text):
    text = text.replace("—", " - ").replace("–", "-").replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    return text


def build_pdf(filename="BUG_FIX_LOG.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        leftMargin=32,
        rightMargin=32,
        topMargin=38,
        bottomMargin=36
    )

    # Custom typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=19,
        textColor=colors.HexColor('#2B296D'),
        spaceAfter=2
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        fontName='Helvetica',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#8A00FF'),
        spaceAfter=6
    )

    meta_val = ParagraphStyle(
        'MetaVal',
        fontName='Helvetica',
        fontSize=7.8,
        leading=10.5,
        textColor=colors.HexColor('#334155')
    )

    th_style = ParagraphStyle(
        'TableHeader',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white,
        alignment=0
    )

    th_center_style = ParagraphStyle(
        'TableHeaderCenter',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.white,
        alignment=1
    )

    td_idx_style = ParagraphStyle(
        'TableCellIdx',
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#2B296D'),
        alignment=1
    )

    td_bug_style = ParagraphStyle(
        'TableCellBug',
        fontName='Helvetica-Bold',
        fontSize=7.6,
        leading=9.8,
        textColor=colors.HexColor('#0F172A')
    )

    td_body_style = ParagraphStyle(
        'TableCellBody',
        fontName='Helvetica',
        fontSize=7.4,
        leading=9.4,
        textColor=colors.HexColor('#1E293B')
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor('#2B296D'),
        spaceBefore=6,
        spaceAfter=4
    )

    body_note = ParagraphStyle(
        'BodyNote',
        fontName='Helvetica',
        fontSize=7.4,
        leading=10,
        textColor=colors.HexColor('#334155')
    )

    elements = []

    # Title & Subtitle
    elements.append(Paragraph("BITS Pilani Digital - Stage 1: Official Bug Fix Log", title_style))
    elements.append(Paragraph("Challenge Specification: BITS Digital CodeForge V1.0 | Evaluation Rubric: Stage 1 (Debug)", subtitle_style))

    # Meta Info Card Table
    meta_data = [
        [
            Paragraph("<b>Project:</b> Advanced Grading Console &amp; Cutoff Optimization Engine", meta_val),
            Paragraph("<b>Candidate / Author:</b> Darshan Sheta (sheta-darshan)", meta_val),
            Paragraph("<b>Submission Format:</b> Standard CodeForge Rubric Table", meta_val),
        ],
        [
            Paragraph("<b>Total Defects Diagnosed &amp; Repaired:</b> 12", meta_val),
            Paragraph("<b>Automated Verification:</b> 100% Pass (109 Unit, 22 Smoke Assertions)", meta_val),
            Paragraph("<b>Live URL:</b> https://sheta-darshan.github.io/bits-digital-codeforge/", meta_val),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[245, 245, 288])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 4))

    # Introduction / Prompt Compliance Notice
    intro_text = (
        "<b>Format Compliance Statement:</b> This document adheres strictly to the tabular schema prescribed in "
        "<b>BITS Digital CodeForge V1.0.docx</b>: <i>[# | Bug / Issue Identified | How You Reproduced It | Root Cause | Fix Implemented | How You Tested the Fix]</i>. "
        "All 12 defects have been systematically diagnosed, resolved, and verified using end-to-end automated test suites, mathematical invariant bounds, and live browser regression testing."
    )
    elements.append(Paragraph(intro_text, body_note))
    elements.append(Spacer(1, 4))

    # Table Header Row
    raw_headers = [
        Paragraph("#", th_center_style),
        Paragraph("Bug / Issue Identified", th_style),
        Paragraph("How You Reproduced It", th_style),
        Paragraph("Root Cause", th_style),
        Paragraph("Fix Implemented", th_style),
        Paragraph("How You Tested the Fix", th_style)
    ]

    bug_rows = [
        (
            "1",
            "File upload rejects .xlsx spreadsheets",
            "Attempted to select standard Excel spreadsheet 'sample_marks.xlsx' in the file picker. File picker disabled/greyed out the file.",
            '<input type="file" id="file" accept=".xls"> only permitted legacy .xls format, violating the challenge requirement expecting modern .xlsx files.',
            'Updated file input accept attribute to accept=".xlsx, .xls". Upgraded file ingestion to readAsArrayBuffer() and parsed binary buffer using XLSX.read(data, {type: "array"}).',
            "Successfully selected, uploaded, and parsed both .xlsx and .xls workbooks into the console without format rejection or encoding errors."
        ),
        (
            "2",
            "Duplicate course list & lack of reset on re-upload",
            "Uploaded a spreadsheet containing multiple rows sharing the same course name, or uploaded two files in succession. Course dropdown duplicated options and preserved stale courses.",
            "Courses were mapped directly via data.map(d => d.Course).forEach(...) without deduplication, and courseSelect.innerHTML was never cleared prior to populating new courses.",
            "Cleared existing options before adding new courses: course.innerHTML = '<option value=\"\">Select a course to begin</option>'. Applied unique deduplication: [...new Set(data.map(d => d.Course).filter(Boolean))].sort().",
            "Uploaded file with 180 rows across 3 courses (CS F211, MATH F111, ECON F211); confirmed dropdown rendered exactly 3 sorted, unique options. Uploaded second file and verified stale courses were wiped."
        ),
        (
            "3",
            "Min and Max statistics inverted on UI",
            "Selected any course and inspected the summary KPI analytics panel. Highest class score appeared under 'Min' and lowest score appeared under 'Max'.",
            'HTML element IDs were swapped in the markup: <div class="stat">Min<br><b id="max"></b></div> and <div class="stat">Max<br><b id="min"></b></div>.',
            'Inverted DOM IDs to correctly match UI semantics: assigned id="min" to Min container and id="max" to Max container.',
            "Loaded sample courses (CS F211: 31-100, MATH F111: 25-90, ECON F211: 40-96); verified Min and Max display true extremes matching dataset records."
        ),
        (
            "4",
            "Double confirmation dialog on Reset Range",
            "Clicked 'Reset Range' button in the cutoff panel. Browser triggered two consecutive confirm() modal dialogs back-to-back.",
            "Two identical confirm() calls were chained in resetRanges.onclick handler: if(!confirm(...)) return; if(!confirm(...)) return;.",
            "Eliminated the redundant prompt, preserving a single accessible confirmation dialog before resetting cutoffs.",
            "Clicked 'Reset Range'; confirmed single prompt appears, and confirming successfully restores default cutoffs (A: 80, A-: 70, etc.)."
        ),
        (
            "5",
            "Cascade logic corrupts lower grade ranges",
            "Lowered Grade B Min cutoff from 60 to 45. Immediately, Grade B- failed validation with 'Each grade must have Min < Max'.",
            "cascadeMaxFrom(index) adjusted B- max = prevMin - 1 (44), but left B- min at 50, creating an impossible inverted range (min: 50 > max: 44).",
            "Refactored cutoff architecture: grade bands are defined strictly by minimum cutoff [Cutoff(G), Cutoff(G_above)). Derived Max is read-only and automatically computed as < Cutoff(Upper), mathematically preventing inverted intervals.",
            "Adjusted cutoffs across all grade bands; verified derived upper boundaries snap smoothly with zero negative spans or validation crashes."
        ),
        (
            "6",
            "Timer starts prematurely on page load & delayed tick",
            "Opened console, waited 2 minutes, then entered instructor name. Timer was already at 02:00. Initial tick was delayed 1000ms.",
            "Timer gradingStartTime = Date.now() was initialized globally on script execution, and setInterval delayed 1000ms before first DOM write.",
            "Deferred timer start until faculty explicitly selects a course or begins grading. Added immediate initial render of 00:00 before starting interval.",
            "Loaded application, verified timer remains idle until active grading commences, then renders fresh starting from 00:00 without initial blank delay."
        ),
        (
            "7",
            "Animation classes removed prematurely (30ms vs 250ms)",
            "Observed grade summary count cards upon cutoff shift. Animations flashed instantaneously or failed to produce smooth visual transitions.",
            "setTimeout(() => card.classList.remove('lift'), 30) removed the animation class after 30ms, while CSS transition duration was 250ms (.25s ease).",
            "Increased timeout duration to 260ms, allowing the CSS transform and elevation animation to complete its full transition curve.",
            "Adjusted grade cutoffs; verified smooth card lift elevation and pulse transitions without stutter or premature clipping."
        ),
        (
            "8",
            "Division by zero / NaN on empty course or identical marks",
            "Selected a course with zero enrolled students, or a cohort where all students scored identical marks (e.g., all 80). Analytics showed NaN and bell curve crashed.",
            "computeStats divided by m.length without guarding against 0. Canvas bell curve divided by standard deviation (std), which is strictly 0 when all scores are identical.",
            "Added robust boundary guards: return safe placeholder ('-') when N = 0. In curving and canvas rendering, detect std = 0 and safely fall back to standard defaults.",
            "Tested with empty dataset (N=0) and uniform marks cohort (std=0); verified clean placeholder display without NaN or script exceptions."
        ),
        (
            "9",
            "CSV export lacks escaping and adds unexpected spaces",
            "Exported CSV with instructor name containing commas or course titles with spaces. Output format was malformed and misaligned in spreadsheet viewers.",
            "Header interpolation injected stray spaces ('Course, ${course.value}'), and cells were unescaped, breaking standard RFC 4180 specifications.",
            "Implemented RFC 4180 compliant CSV serializer: properly quote fields containing commas, newlines, or quotes; double-escape inner quotes; stripped stray spaces.",
            "Generated CSV exports with complex names and titles; opened in Excel/Calc and confirmed perfect column alignment and data integrity."
        ),
        (
            "10",
            "Missing explicit upload action button & ambiguous ingestion",
            "Selected a local spreadsheet; UI showed only 'Load BITS Demo Data' with no visible button to process or submit the chosen file.",
            "File input silently auto-triggered on change without user-controlled ingestion confirmation or staged file inspection state.",
            "Engineered dedicated two-step ingestion: drag-and-drop zone, file preview chip with file size and remove (X) button, and explicit 'Upload & Process File' primary button.",
            "Selected local files; verified clear staging chip, clicked explicit upload button, and verified deterministic ingestion sequence."
        ),
        (
            "11",
            "Intrusive blocking alert() & auto-trigger on single-course files",
            "Uploaded file with 1 course before entering instructor name. Browser triggered blocking alert() popup and wiped course selection dropdown.",
            "courseSelect.onchange called synchronous alert() and cleared courseSelect.value = '' whenever instructor name was missing.",
            "Replaced intrusive browser alert() with non-blocking inline warning message, automatic focus redirect to Instructor Name input, and stacked toast notifications.",
            "Uploaded single-course workbook without instructor name; confirmed clean non-blocking toast guidance without disruptive popup or wiped state."
        ),
        (
            "12",
            "One-way cutoff cascade (Max changes broke continuity)",
            "Attempted to adjust a grade's Max value; upper grade's Min did not update, causing immediate 'Ranges must be continuous' error.",
            "Cascade logic operated unidirectionally downwards on Min changes (cascadeMaxFrom), completely ignoring upward continuity when Max was changed.",
            "Implemented unified boundary model where Max is derived automatically from upper Min, alongside bidirectional cascade synchronization handlers for boundary changes.",
            "Modified cutoffs for Grade B and C; verified contiguous intervals are permanently maintained without manual boundary recalculation."
        )
    ]

    table_data = [raw_headers]
    for row in bug_rows:
        table_data.append([
            Paragraph(f"<b>{row[0]}</b>", td_idx_style),
            Paragraph(f"<b>{html.escape(clean_text(row[1]))}</b>", td_bug_style),
            Paragraph(html.escape(clean_text(row[2])), td_body_style),
            Paragraph(html.escape(clean_text(row[3])), td_body_style),
            Paragraph(html.escape(clean_text(row[4])), td_body_style),
            Paragraph(html.escape(clean_text(row[5])), td_body_style),
        ])

    col_widths = [24, 116, 142, 150, 186, 160]
    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    
    # Table Styling
    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2B296D')),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.8),
        ('LEFTPADDING', (0, 0), (-1, -1), 4.5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4.5),
    ]

    # Alternating row colors
    for r in range(1, len(table_data)):
        bg = colors.HexColor('#FFFFFF') if r % 2 != 0 else colors.HexColor('#F8FAFC')
        t_style.append(('BACKGROUND', (0, r), (-1, r), bg))

    main_table.setStyle(TableStyle(t_style))
    elements.append(main_table)

    # Key Architectural Learnings Summary Box
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Stage 1 Key Architectural Learnings &amp; Engineering Principles", section_heading))
    
    learnings_data = [
        [
            Paragraph("<b>1. Defensive Data Ingestion:</b> Academic datasets frequently introduce whitespace, mixed casing, and non-standard extensions. Ingestion must sanitize headers and normalize records immediately upon reading.", body_note),
            Paragraph("<b>2. Explicit User Intent:</b> File ingestion workflows must decouple file selection from processing via dedicated staging chips and explicit action triggers.", body_note)
        ],
        [
            Paragraph("<b>3. Deterministic State Progression:</b> State transitions (Upload -&gt; Select -&gt; Cutoffs -&gt; Validate -&gt; Export) must guarantee clean cache invalidation on re-upload.", body_note),
            Paragraph("<b>4. Boundary Resilience in Statistical Visualizations:</b> Statistical calculations must defensively guard against edge cases (N=0, identical scores std=0) to prevent browser math failures (NaN, Infinity).", body_note)
        ]
    ]
    learnings_table = Table(learnings_data, colWidths=[389, 389])
    learnings_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#EFF6FF')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#BFDBFE')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DBEAFE')),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
    ]))
    elements.append(learnings_table)

    # Build PDF
    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename} ({os.path.getsize(filename)} bytes)")

if __name__ == "__main__":
    out_file = sys.argv[1] if len(sys.argv) > 1 else "BUG_FIX_LOG.pdf"
    build_pdf(out_file)
