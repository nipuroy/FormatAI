"""Professional PDF Generation Engine for FormatAI.

Generates high-fidelity, publication-grade academic PDF documents directly
from the internal AcademicDocument model using centralized style presets.
Preserves page structure, headings, paragraphs, lists, tables, and mathematical
content while preventing orphan headings, broken page breaks, and blank pages.
"""

from io import BytesIO
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import xml.sax.saxutils as saxutils

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from backend.core.docx_styles import (
    DocxPresetType,
    DocxStyleConfig,
    get_style_preset,
)
from backend.models.document import AcademicDocument, BlockType, DocumentBlock
from backend.services.docx_service import parse_inline_markdown_runs
from backend.services.math_service import MathService
from backend.utils.logger import get_logger
from backend.utils.omml_converter import GREEK_SYMBOLS

logger = get_logger("pdf_service")

# -------------------------------------------------------------------------
# Font Registration
# -------------------------------------------------------------------------

_FONTS_REGISTERED = False
_SERIF_FAMILY = "Times-Roman"
_SERIF_BOLD = "Times-Bold"
_SERIF_ITALIC = "Times-Italic"
_SERIF_BOLD_ITALIC = "Times-BoldItalic"

_SANS_FAMILY = "Helvetica"
_SANS_BOLD = "Helvetica-Bold"
_SANS_ITALIC = "Helvetica-Oblique"
_SANS_BOLD_ITALIC = "Helvetica-BoldOblique"

_MONO_FAMILY = "Courier"
_MONO_BOLD = "Courier-Bold"


def _register_system_fonts() -> None:
    """Register TrueType Unicode fonts with full academic symbol coverage."""
    global _FONTS_REGISTERED, _SERIF_FAMILY, _SERIF_BOLD, _SERIF_ITALIC, _SERIF_BOLD_ITALIC
    global _SANS_FAMILY, _SANS_BOLD, _SANS_ITALIC, _SANS_BOLD_ITALIC, _MONO_FAMILY, _MONO_BOLD

    if _FONTS_REGISTERED:
        return

    # 1. Try FreeSerif (excellent Unicode math & Greek coverage)
    free_serif_path = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
    free_serif_bold_path = "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf"
    free_serif_italic_path = "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf"
    free_serif_bi_path = "/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf"

    if os.path.exists(free_serif_path):
        try:
            pdfmetrics.registerFont(TTFont("FreeSerif", free_serif_path))
            pdfmetrics.registerFont(TTFont("FreeSerifBold", free_serif_bold_path if os.path.exists(free_serif_bold_path) else free_serif_path))
            pdfmetrics.registerFont(TTFont("FreeSerifItalic", free_serif_italic_path if os.path.exists(free_serif_italic_path) else free_serif_path))
            pdfmetrics.registerFont(TTFont("FreeSerifBoldItalic", free_serif_bi_path if os.path.exists(free_serif_bi_path) else free_serif_path))

            pdfmetrics.registerFontFamily(
                "FreeSerif",
                normal="FreeSerif",
                bold="FreeSerifBold",
                italic="FreeSerifItalic",
                boldItalic="FreeSerifBoldItalic",
            )
            _SERIF_FAMILY = "FreeSerif"
            _SERIF_BOLD = "FreeSerifBold"
            _SERIF_ITALIC = "FreeSerifItalic"
            _SERIF_BOLD_ITALIC = "FreeSerifBoldItalic"
        except Exception as e:
            logger.debug(f"FreeSerif font registration fallback: {e}")

    # 2. Try FreeSans
    free_sans_path = "/usr/share/fonts/truetype/freefont/FreeSans.ttf"
    free_sans_bold_path = "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"
    free_sans_italic_path = "/usr/share/fonts/truetype/freefont/FreeSansOblique.ttf"
    free_sans_bi_path = "/usr/share/fonts/truetype/freefont/FreeSansBoldOblique.ttf"

    if os.path.exists(free_sans_path):
        try:
            pdfmetrics.registerFont(TTFont("FreeSans", free_sans_path))
            pdfmetrics.registerFont(TTFont("FreeSansBold", free_sans_bold_path if os.path.exists(free_sans_bold_path) else free_sans_path))
            pdfmetrics.registerFont(TTFont("FreeSansItalic", free_sans_italic_path if os.path.exists(free_sans_italic_path) else free_sans_path))
            pdfmetrics.registerFont(TTFont("FreeSansBoldItalic", free_sans_bi_path if os.path.exists(free_sans_bi_path) else free_sans_path))

            pdfmetrics.registerFontFamily(
                "FreeSans",
                normal="FreeSans",
                bold="FreeSansBold",
                italic="FreeSansItalic",
                boldItalic="FreeSansBoldItalic",
            )
            _SANS_FAMILY = "FreeSans"
            _SANS_BOLD = "FreeSansBold"
            _SANS_ITALIC = "FreeSansItalic"
            _SANS_BOLD_ITALIC = "FreeSansBoldItalic"
        except Exception as e:
            logger.debug(f"FreeSans font registration fallback: {e}")

    # 3. Try FreeMono
    free_mono_path = "/usr/share/fonts/truetype/freefont/FreeMono.ttf"
    free_mono_bold_path = "/usr/share/fonts/truetype/freefont/FreeMonoBold.ttf"
    if os.path.exists(free_mono_path):
        try:
            pdfmetrics.registerFont(TTFont("FreeMono", free_mono_path))
            pdfmetrics.registerFont(TTFont("FreeMonoBold", free_mono_bold_path if os.path.exists(free_mono_bold_path) else free_mono_path))
            _MONO_FAMILY = "FreeMono"
            _MONO_BOLD = "FreeMonoBold"
        except Exception as e:
            logger.debug(f"FreeMono font registration fallback: {e}")

    _FONTS_REGISTERED = True


def _resolve_font_names(preset_font: str) -> Tuple[str, str, str, str]:
    """Resolve font family, bold, italic, and bold-italic names based on preset."""
    _register_system_fonts()
    norm = preset_font.lower()
    if any(k in norm for k in ("arial", "calibri", "sans")):
        return (_SANS_FAMILY, _SANS_BOLD, _SANS_ITALIC, _SANS_BOLD_ITALIC)
    return (_SERIF_FAMILY, _SERIF_BOLD, _SERIF_ITALIC, _SERIF_BOLD_ITALIC)


# -------------------------------------------------------------------------
# Dynamic Two-Pass Numbered Canvas (Header & Footer)
# -------------------------------------------------------------------------

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas for dynamic total page count, running headers, and footers."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[Dict[str, Any]] = []
        self.header_text: str = ""
        self.include_header: bool = True
        self.include_footer: bool = True
        self.include_page_numbers: bool = True
        self.page_number_alignment: str = "right"
        self.margin_left: float = 72.0
        self.margin_right: float = 72.0
        self.margin_top: float = 72.0
        self.margin_bottom: float = 72.0
        self.font_name: str = "Helvetica"

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_page_decorations(total_pages)
            super().showPage()
        super().save()

    def _draw_page_decorations(self, total_pages: int) -> None:
        """Draw running header and running footer with exact page count."""
        page_width, page_height = self._pagesize
        header_font = _SANS_FAMILY if _FONTS_REGISTERED else "Helvetica"
        self.saveState()

        # 1. Running Header
        if self.include_header and self.header_text:
            header_y = page_height - (self.margin_top * 0.55)
            self.setFont(header_font, 8.5)
            self.setFillColor(colors.HexColor("#777777"))
            self.drawRightString(page_width - self.margin_right, header_y, self.header_text)

            # Subtle header divider line
            self.setStrokeColor(colors.HexColor("#D8D8D8"))
            self.setLineWidth(0.5)
            line_y = page_height - (self.margin_top * 0.75)
            self.line(self.margin_left, line_y, page_width - self.margin_right, line_y)

        # 2. Running Footer with Page Numbers
        if self.include_footer and self.include_page_numbers:
            footer_y = self.margin_bottom * 0.55
            self.setFont(header_font, 8.5)
            self.setFillColor(colors.HexColor("#777777"))

            page_str = f"Page {self._pageNumber} of {total_pages}"

            if self.page_number_alignment == "center":
                self.drawCentredString(page_width / 2.0, footer_y, page_str)
            elif self.page_number_alignment == "left":
                self.drawString(self.margin_left, footer_y, page_str)
            else:
                self.drawRightString(page_width - self.margin_right, footer_y, page_str)

            # Subtle footer divider line
            self.setStrokeColor(colors.HexColor("#E2E2E2"))
            self.setLineWidth(0.5)
            line_y = self.margin_bottom * 0.75
            self.line(self.margin_left, line_y, page_width - self.margin_right, line_y)

        self.restoreState()


# -------------------------------------------------------------------------
# Mathematical and Inline Markup Transformers
# -------------------------------------------------------------------------

def latex_to_pdf_markup(latex_str: str) -> str:
    """Transform LaTeX math into clean, readable XML markup for ReportLab Paragraphs."""
    if not latex_str:
        return ""

    s = latex_str.strip()

    # 1. Strip delimiters
    if s.startswith("$$") and s.endswith("$$") and len(s) >= 4:
        s = s[2:-2].strip()
    elif s.startswith("$") and s.endswith("$") and len(s) >= 2:
        s = s[1:-1].strip()
    elif s.startswith(r"\(") and s.endswith(r"\)"):
        s = s[2:-2].strip()
    elif s.startswith(r"\[") and s.endswith(r"\]"):
        s = s[2:-2].strip()

    # 2. Handle matrix environments
    if r"\begin{matrix}" in s:
        inner = re.search(r"\\begin\{matrix\}([\s\S]+?)\\end\{matrix\}", s)
        if inner:
            rows = [r.strip() for r in inner.group(1).split(r"\\")]
            formatted_rows = ["  ".join(c.strip() for c in r.split("&")) for r in rows if r.strip()]
            s = s.replace(inner.group(0), "[ " + " | ".join(formatted_rows) + " ]")

    # 3. Greek symbols mapping
    def _replace_greek(match: re.Match[str]) -> str:
        tok = match.group(1)
        return GREEK_SYMBOLS.get(tok, match.group(0))

    s = re.sub(r"\\([A-Za-z]+)", _replace_greek, s)

    # 4. Standard academic operators
    s = s.replace(r"\sum", "∑").replace(r"\int", "∫").replace(r"\prod", "∏")
    s = s.replace(r"\times", "×").replace(r"\cdot", "·").replace(r"\pm", "±")
    s = s.replace(r"\leq", "≤").replace(r"\geq", "≥").replace(r"\neq", "≠")
    s = s.replace(r"\approx", "≈").replace(r"\infty", "∞").replace(r"\partial", "∂")
    s = s.replace(r"\to", "→").replace(r"\rightarrow", "→")

    # 5. Radicals
    s = re.sub(r"\\sqrt\[(\d+)\]\{([^{}]+)\}", r"<super>\1</super>√(\2)", s)
    s = re.sub(r"\\sqrt\{([^{}]+)\}", r"√(\1)", s)

    # 6. Fractions: \frac{a}{b} -> (a / b)
    s = re.sub(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", r"(\1 / \2)", s)

    # 7. Limits
    s = re.sub(r"\\lim_\{([^{}]+)\}", r"lim<sub>\1</sub>", s)

    # 8. Subscripts & Superscripts
    s = re.sub(r"_\{([^{}]+)\}", r"<sub>\1</sub>", s)
    s = re.sub(r"\^\{([^{}]+)\}", r"<super>\1</super>", s)
    s = re.sub(r"_([A-Za-z0-9])", r"<sub>\1</sub>", s)
    s = re.sub(r"\^([A-Za-z0-9])", r"<super>\1</super>", s)

    # 9. Clean up spacing and text wrappers
    s = re.sub(r"\\quad\b", "   ", s)
    s = re.sub(r"\\mathrm\{([^{}]+)\}", r"\1", s)
    s = re.sub(r"\\mathbf\{([^{}]+)\}", r"<b>\1</b>", s)
    s = re.sub(r"\\[A-Za-z]+\b", "", s)

    return s.strip()


def build_paragraph_markup(text: str, math_service: MathService) -> str:
    """Convert mixed academic text (prose, inline markdown, inline math) to ReportLab XML."""
    if not text:
        return ""

    segments = math_service.segment_text_and_math(text)
    markup_pieces: List[str] = []

    for seg in segments:
        if seg["type"] == "math":
            clean_math = latex_to_pdf_markup(seg.get("raw", ""))
            # Italicize math expression variables while keeping operators distinct
            markup_pieces.append(f"<font color='#0D47A1'><i>{clean_math}</i></font>")
        else:
            prose = seg.get("content", "")
            runs = parse_inline_markdown_runs(prose)
            for r in runs:
                escaped = saxutils.escape(r["text"])
                if r["bold"]:
                    escaped = f"<b>{escaped}</b>"
                if r["italic"]:
                    escaped = f"<i>{escaped}</i>"
                if r["underline"]:
                    escaped = f"<u>{escaped}</u>"
                if r["code"]:
                    escaped = f"<font face='{_MONO_FAMILY}' color='#A93226'>{escaped}</font>"
                markup_pieces.append(escaped)

    return "".join(markup_pieces)


# -------------------------------------------------------------------------
# PDF Service Class
# -------------------------------------------------------------------------

class PdfService:
    """Orchestrates PDF document compilation from the FormatAI AcademicDocument model."""

    def __init__(
        self,
        default_preset: DocxPresetType = DocxPresetType.ACADEMIC,
        math_service: Optional[MathService] = None,
    ):
        self.default_preset = default_preset
        self.math_service = math_service or MathService()
        _register_system_fonts()

    def generate_pdf(
        self,
        document: AcademicDocument,
        preset: Optional[str | DocxPresetType] = None,
        title_override: Optional[str] = None,
        include_page_numbers: Optional[bool] = None,
        include_header: Optional[bool] = None,
    ) -> bytes:
        """Compile an AcademicDocument into a genuine, publication-grade PDF file."""
        style_config = get_style_preset(preset or self.default_preset)

        # Apply runtime overrides if provided
        if include_page_numbers is not None:
            style_config.include_page_numbers = include_page_numbers
        if include_header is not None:
            style_config.include_header = include_header

        effective_title = title_override or document.title or "Academic Document"

        logger.info(
            f"Generating PDF for '{effective_title}' with preset '{style_config.preset_name}' "
            f"({len(document.blocks)} blocks)"
        )

        buffer = BytesIO()

        # Margins converted to ReportLab points (1 inch = 72 points)
        margin_top_pt = style_config.margins.top * 72.0
        margin_bottom_pt = style_config.margins.bottom * 72.0
        margin_left_pt = style_config.margins.left * 72.0
        margin_right_pt = style_config.margins.right * 72.0

        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            leftMargin=margin_left_pt,
            rightMargin=margin_right_pt,
            topMargin=margin_top_pt,
            bottomMargin=margin_bottom_pt,
        )

        # Configure custom NumberedCanvas class attributes
        class DocumentCanvas(NumberedCanvas):
            pass

        DocumentCanvas.header_text = style_config.default_header_text or effective_title
        DocumentCanvas.include_header = style_config.include_header
        DocumentCanvas.include_footer = style_config.include_footer
        DocumentCanvas.include_page_numbers = style_config.include_page_numbers
        DocumentCanvas.page_number_alignment = style_config.page_number_alignment
        DocumentCanvas.margin_left = margin_left_pt
        DocumentCanvas.margin_right = margin_right_pt
        DocumentCanvas.margin_top = margin_top_pt
        DocumentCanvas.margin_bottom = margin_bottom_pt

        # Build paragraph styles directly from style_config
        styles = self._build_reportlab_styles(style_config)

        # Calculate printable content width for table sizing
        printable_width = letter[0] - (margin_left_pt + margin_right_pt)

        # Assemble Platypus story
        story = self._build_story(document, style_config, styles, printable_width)

        # Build PDF document
        doc.build(story, canvasmaker=DocumentCanvas)

        buffer.seek(0)
        return buffer.getvalue()

    def _build_reportlab_styles(self, style: DocxStyleConfig) -> Dict[str, ParagraphStyle]:
        """Construct matching ReportLab ParagraphStyles based on centralized DocxStyleConfig."""
        font_family, font_bold, font_italic, _ = _resolve_font_names(style.font_name)

        body_align = TA_JUSTIFY if style.body_alignment == "justify" else TA_LEFT
        title_align = TA_CENTER if style.title_alignment == "center" else TA_LEFT

        return {
            "title": ParagraphStyle(
                name="PDF_Title",
                fontName=font_bold,
                fontSize=style.title_size_pt,
                leading=style.title_size_pt * 1.25,
                textColor=colors.HexColor("#" + style.heading1_color_hex),
                alignment=title_align,
                spaceBefore=14,
                spaceAfter=14,
                keepWithNext=True,
            ),
            "h1": ParagraphStyle(
                name="PDF_Heading1",
                fontName=font_bold,
                fontSize=style.heading1_size_pt,
                leading=style.heading1_size_pt * 1.25,
                textColor=colors.HexColor("#" + style.heading1_color_hex),
                spaceBefore=style.heading1_space_before_pt,
                spaceAfter=style.heading1_space_after_pt,
                keepWithNext=True,
            ),
            "h2": ParagraphStyle(
                name="PDF_Heading2",
                fontName=font_bold,
                fontSize=style.heading2_size_pt,
                leading=style.heading2_size_pt * 1.25,
                textColor=colors.HexColor("#" + style.heading2_color_hex),
                spaceBefore=style.heading2_space_before_pt,
                spaceAfter=style.heading2_space_after_pt,
                keepWithNext=True,
            ),
            "h3": ParagraphStyle(
                name="PDF_Heading3",
                fontName=font_bold,
                fontSize=style.heading3_size_pt,
                leading=style.heading3_size_pt * 1.25,
                textColor=colors.HexColor("#" + style.heading3_color_hex),
                spaceBefore=style.heading3_space_before_pt,
                spaceAfter=style.heading3_space_after_pt,
                keepWithNext=True,
            ),
            "body": ParagraphStyle(
                name="PDF_Body",
                fontName=font_family,
                fontSize=style.body_size_pt,
                leading=style.body_size_pt * style.line_spacing + 2,
                textColor=colors.HexColor("#" + style.body_color_hex),
                alignment=body_align,
                firstLineIndent=style.first_line_indent_inches * 72.0,
                spaceBefore=style.paragraph_space_before_pt,
                spaceAfter=style.paragraph_space_after_pt,
            ),
            "list": ParagraphStyle(
                name="PDF_List",
                fontName=font_family,
                fontSize=style.body_size_pt,
                leading=style.body_size_pt * style.line_spacing + 2,
                textColor=colors.HexColor("#" + style.body_color_hex),
                leftIndent=24,
                firstLineIndent=-14,
                spaceBefore=1,
                spaceAfter=3,
            ),
            "quote": ParagraphStyle(
                name="PDF_Quote",
                fontName=font_italic,
                fontSize=style.body_size_pt,
                leading=style.body_size_pt * 1.25,
                textColor=colors.HexColor("#4A4A4A"),
                leftIndent=36,
                rightIndent=36,
                spaceBefore=6,
                spaceAfter=6,
            ),
            "math_display": ParagraphStyle(
                name="PDF_MathDisplay",
                fontName=font_family,
                fontSize=style.body_size_pt + 1.5,
                leading=(style.body_size_pt + 1.5) * 1.35,
                textColor=colors.HexColor("#1A365D"),
                alignment=TA_CENTER,
                spaceBefore=8,
                spaceAfter=8,
            ),
            "table_header": ParagraphStyle(
                name="PDF_TableHeader",
                fontName=font_bold,
                fontSize=style.table_cell_size_pt,
                leading=style.table_cell_size_pt * 1.2,
                alignment=TA_CENTER,
                textColor=colors.HexColor("#1A1A1A"),
            ),
            "table_cell": ParagraphStyle(
                name="PDF_TableCell",
                fontName=font_family,
                fontSize=style.table_cell_size_pt,
                leading=style.table_cell_size_pt * 1.2,
                alignment=TA_LEFT,
                textColor=colors.HexColor("#2C2C2C"),
            ),
            "code": ParagraphStyle(
                name="PDF_Code",
                fontName=_MONO_FAMILY,
                fontSize=9.0,
                leading=12.0,
                textColor=colors.HexColor("#222222"),
                leftIndent=18,
                rightIndent=18,
                spaceBefore=4,
                spaceAfter=4,
            ),
        }

    def _build_story(
        self,
        document: AcademicDocument,
        style: DocxStyleConfig,
        styles: Dict[str, ParagraphStyle],
        printable_width: float,
    ) -> List[Any]:
        """Convert AcademicDocument blocks into Platypus flowable elements."""
        story: List[Any] = []
        blocks = document.blocks

        for idx, block in enumerate(blocks):
            b_type = block.block_type

            # 1. Document Title
            if b_type == BlockType.TITLE:
                markup = saxutils.escape(block.text)
                story.append(Paragraph(f"<b>{markup}</b>", styles["title"]))
                continue

            # 2. Section Headings (H1, H2, H3)
            if b_type == BlockType.HEADING:
                level = block.level or 1
                heading_style = styles.get(f"h{min(level, 3)}", styles["h1"])
                markup = saxutils.escape(block.text)
                story.append(Paragraph(f"<b>{markup}</b>", heading_style))
                continue

            # 3. Standard Paragraphs
            if b_type == BlockType.PARAGRAPH:
                if not block.text.strip():
                    continue
                markup = build_paragraph_markup(block.text, self.math_service)
                story.append(Paragraph(markup, styles["body"]))
                continue

            # 4. Ordered Lists
            if b_type == BlockType.ORDERED_LIST:
                items = block.items or []
                for item_idx, item in enumerate(items, 1):
                    item_markup = build_paragraph_markup(item, self.math_service)
                    formatted_item = f"<b>{item_idx}.</b>&nbsp;&nbsp;{item_markup}"
                    story.append(Paragraph(formatted_item, styles["list"]))
                story.append(Spacer(1, 4))
                continue

            # 5. Unordered Lists
            if b_type == BlockType.UNORDERED_LIST:
                items = block.items or []
                for item in items:
                    item_markup = build_paragraph_markup(item, self.math_service)
                    formatted_item = f"<b>&bull;</b>&nbsp;&nbsp;{item_markup}"
                    story.append(Paragraph(formatted_item, styles["list"]))
                story.append(Spacer(1, 4))
                continue

            # 6. Tables
            if b_type == BlockType.TABLE:
                table_flowable = self._render_table(block, style, styles, printable_width)
                if table_flowable:
                    story.append(table_flowable)
                    story.append(Spacer(1, 6))
                continue

            # 7. Blockquotes
            if b_type == BlockType.BLOCKQUOTE:
                if not block.text.strip():
                    continue
                markup = build_paragraph_markup(block.text, self.math_service)
                story.append(Paragraph(f"“{markup}”", styles["quote"]))
                continue

            # 8. Code Blocks
            if b_type == BlockType.CODE_BLOCK:
                lines = block.text.split("\n")
                escaped_lines = [saxutils.escape(l) for l in lines]
                pre = Preformatted(
                    "\n".join(escaped_lines),
                    styles["code"],
                )
                story.append(pre)
                story.append(Spacer(1, 4))
                continue

            # 9. Math Display Blocks
            if b_type == BlockType.MATH_BLOCK:
                clean_math = latex_to_pdf_markup(block.text)
                story.append(Paragraph(clean_math, styles["math_display"]))
                continue

            # 10. Thematic Break / Page Break
            if b_type == BlockType.THEMATIC_BREAK:
                # Only insert page break if not at the very end of document
                if idx < len(blocks) - 1:
                    story.append(PageBreak())
                continue

        # Prevent empty story causing generation error
        if not story:
            story.append(Paragraph("Empty Academic Document", styles["body"]))

        # Remove trailing PageBreaks or Spacers to prevent unnecessary blank pages
        while story and isinstance(story[-1], (PageBreak, Spacer)):
            story.pop()

        return story

    def _render_table(
        self,
        block: DocumentBlock,
        style: DocxStyleConfig,
        styles: Dict[str, ParagraphStyle],
        printable_width: float,
    ) -> Optional[Table]:
        """Format and construct a cleanly wrapped, multi-page capable ReportLab Table."""
        headers = block.headers or []
        rows = block.rows or []

        if not headers and not rows:
            return None

        total_cols = max(len(headers), max((len(r) for r in rows), default=0))
        if total_cols == 0:
            return None

        col_width = printable_width / float(total_cols)
        col_widths = [col_width] * total_cols

        table_data: List[List[Any]] = []

        # Headers
        if headers:
            header_row = []
            for h in headers:
                escaped_h = saxutils.escape(h)
                header_row.append(Paragraph(f"<b>{escaped_h}</b>", styles["table_header"]))
            table_data.append(header_row)

        # Rows
        alignments = block.alignments or []
        for row in rows:
            cell_row = []
            for c_idx in range(total_cols):
                val = row[c_idx] if c_idx < len(row) else ""
                markup = build_paragraph_markup(val, self.math_service)

                # Column alignment
                align = TA_LEFT
                if c_idx < len(alignments):
                    if alignments[c_idx] == "center":
                        align = TA_CENTER
                    elif alignments[c_idx] == "right":
                        align = TA_RIGHT

                c_style = ParagraphStyle(
                    name=f"TableCell_{c_idx}_{align}",
                    parent=styles["table_cell"],
                    alignment=align,
                )
                cell_row.append(Paragraph(markup, c_style))
            table_data.append(cell_row)

        # Table styling
        tbl_style = [
            ("BACKGROUND", (0, 0), (-1, 0 if headers else -1), colors.HexColor("#" + style.table_header_bg_hex)),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("LINEABOVE", (0, 0), (-1, 0), 1.0, colors.HexColor("#" + style.table_border_color_hex)),
            ("LINEBELOW", (0, -1), (-1, -1), 1.25, colors.HexColor("#" + style.table_border_color_hex)),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#" + style.table_border_color_hex)),
        ]

        if headers:
            tbl_style.append(("LINEBELOW", (0, 0), (-1, 0), 1.0, colors.HexColor("#" + style.table_border_color_hex)))

        return Table(
            table_data,
            colWidths=col_widths,
            style=TableStyle(tbl_style),
            repeatRows=1 if headers else 0,
        )
