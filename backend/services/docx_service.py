"""Professional DOCX Generation Engine for FormatAI.

Generates genuine, fully editable Microsoft Word (.docx) documents from
the internal AcademicDocument AST model using centralized style presets.
Supports python-docx with full OpenXML typography, margins, headers,
dynamic page numbers, tables, lists, and inline styles (bold, italic, underline).
"""

from io import BytesIO
import re
from typing import Any, Dict, List, Optional, Tuple
import zipfile
import xml.sax.saxutils as saxutils

from backend.core.docx_styles import (
    DocxPresetType,
    DocxStyleConfig,
    get_style_preset,
)
from backend.models.document import AcademicDocument, BlockType, DocumentBlock
from backend.services.math_service import MathService
from backend.utils.logger import get_logger

logger = get_logger("docx_service")

# Check if python-docx is installed in runtime
try:
    import docx
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_LINE_SPACING
    from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
    from docx.oxml import OxmlElement, parse_xml
    from docx.oxml.ns import nsdecls, qn
    HAS_PYTHON_DOCX = True
except ImportError:
    HAS_PYTHON_DOCX = False


def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    """Convert 6-character hex color string to RGB tuple."""
    hex_str = hex_str.lstrip("#")
    if len(hex_str) != 6:
        return (0, 0, 0)
    return (int(hex_str[0:2], 16), int(hex_str[2:4], 16), int(hex_str[4:6], 16))


def parse_inline_markdown_runs(text: str) -> List[Dict[str, Any]]:
    """Parse inline markdown tags (**bold**, *italic*, __underline__, `code`) into formatted runs.

    Returns a list of dicts: [{"text": str, "bold": bool, "italic": bool, "underline": bool, "code": bool}]
    """
    if not text:
        return []

    # Combined regex pattern for inline markers:
    # 1. ***bold italic***
    # 2. **bold**
    # 3. __underline__
    # 4. *italic* or _italic_
    # 5. `code`
    token_pattern = re.compile(
        r"(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)|`([^`\n]+)`)"
    )

    runs: List[Dict[str, Any]] = []
    last_idx = 0

    for match in token_pattern.finditer(text):
        start, end = match.span()

        # Add any plain text preceding this match
        if start > last_idx:
            runs.append({
                "text": text[last_idx:start],
                "bold": False,
                "italic": False,
                "underline": False,
                "code": False,
            })

        matched_text = match.group(0)

        # ***bold italic***
        if match.group(2):
            runs.append({
                "text": match.group(2),
                "bold": True,
                "italic": True,
                "underline": False,
                "code": False,
            })
        # **bold**
        elif match.group(3):
            runs.append({
                "text": match.group(3),
                "bold": True,
                "italic": False,
                "underline": False,
                "code": False,
            })
        # __underline__
        elif match.group(4):
            runs.append({
                "text": match.group(4),
                "bold": False,
                "italic": False,
                "underline": True,
                "code": False,
            })
        # *italic*
        elif match.group(5):
            runs.append({
                "text": match.group(5),
                "bold": False,
                "italic": True,
                "underline": False,
                "code": False,
            })
        # _italic_
        elif match.group(6):
            runs.append({
                "text": match.group(6),
                "bold": False,
                "italic": True,
                "underline": False,
                "code": False,
            })
        # `code`
        elif match.group(7):
            runs.append({
                "text": match.group(7),
                "bold": False,
                "italic": False,
                "underline": False,
                "code": True,
            })

        last_idx = end

    # Remaining trailing text
    if last_idx < len(text):
        runs.append({
            "text": text[last_idx:],
            "bold": False,
            "italic": False,
            "underline": False,
            "code": False,
        })

    return runs


class DocxService:
    """Consumes AcademicDocument model and generates a professional, genuine Microsoft Word .docx file."""

    def __init__(self, default_preset: DocxPresetType = DocxPresetType.ACADEMIC, math_service: Optional[MathService] = None):
        self.default_preset = default_preset
        self.math_service = math_service or MathService()

    def generate_docx(
        self,
        document: AcademicDocument,
        preset: Optional[str | DocxPresetType] = None,
        title_override: Optional[str] = None,
        include_page_numbers: Optional[bool] = None,
        include_header: Optional[bool] = None,
    ) -> bytes:
        """Generate a genuine Microsoft Word .docx file from an AcademicDocument.

        Returns raw binary bytes of the .docx file package.
        """
        style_config = get_style_preset(preset or self.default_preset)

        # Overrides if specified
        if include_page_numbers is not None:
            style_config.include_page_numbers = include_page_numbers
        if include_header is not None:
            style_config.include_header = include_header

        effective_title = title_override or document.title or "Academic Document"

        logger.info(
            f"Generating DOCX for '{effective_title}' with preset '{style_config.preset_name}' "
            f"({len(document.blocks)} blocks, python-docx={HAS_PYTHON_DOCX})"
        )

        if HAS_PYTHON_DOCX:
            try:
                return self._generate_with_python_docx(document, style_config, effective_title)
            except Exception as e:
                logger.warning(f"python-docx encountered an issue ({e}), using OpenXML engine fallback.")
                return self._generate_with_openxml_engine(document, style_config, effective_title)
        else:
            return self._generate_with_openxml_engine(document, style_config, effective_title)

    # =========================================================================
    # Engine A: python-docx Implementation
    # =========================================================================

    def _generate_with_python_docx(
        self,
        document: AcademicDocument,
        style: DocxStyleConfig,
        effective_title: str,
    ) -> bytes:
        """Build DOCX document using the python-docx library."""
        doc = Document()

        # 1. Page Margins & Section Setup
        section = doc.sections[0]
        section.top_margin = Inches(style.margins.top)
        section.bottom_margin = Inches(style.margins.bottom)
        section.left_margin = Inches(style.margins.left)
        section.right_margin = Inches(style.margins.right)

        # 2. Running Header
        if style.include_header:
            header = section.header
            header.is_linked_to_previous = False
            hp = header.paragraphs[0]
            hp.text = style.default_header_text or effective_title
            hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            if hp.runs:
                hrun = hp.runs[0]
                hrun.font.name = style.font_name
                hrun.font.size = Pt(style.header_footer_size_pt)
                hrun.font.color.rgb = RGBColor(128, 128, 128)

        # 3. Running Footer with Dynamic Word Page Number Field
        if style.include_footer:
            footer = section.footer
            footer.is_linked_to_previous = False
            fp = footer.paragraphs[0]
            fp.alignment = (
                WD_ALIGN_PARAGRAPH.RIGHT if style.page_number_alignment == "right"
                else (WD_ALIGN_PARAGRAPH.CENTER if style.page_number_alignment == "center" else WD_ALIGN_PARAGRAPH.LEFT)
            )
            if style.include_page_numbers:
                frun = fp.add_run()
                frun.font.name = style.font_name
                frun.font.size = Pt(style.header_footer_size_pt)
                frun.font.color.rgb = RGBColor(128, 128, 128)
                self._add_dynamic_page_number_field(frun)

        # 4. Process Blocks
        for block in document.blocks:
            self._render_block_python_docx(doc, block, style)

        buffer = BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    def _render_block_python_docx(
        self,
        doc: Any,
        block: DocumentBlock,
        style: DocxStyleConfig,
    ) -> None:
        """Render individual DocumentBlock into python-docx document elements."""
        b_type = block.block_type

        # --- Title ---
        if b_type == BlockType.TITLE:
            p = doc.add_paragraph()
            p.alignment = (
                WD_ALIGN_PARAGRAPH.CENTER if style.title_alignment == "center"
                else WD_ALIGN_PARAGRAPH.LEFT
            )
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(12)
            run = p.add_run(block.text)
            run.font.name = style.font_name
            run.font.size = Pt(style.title_size_pt)
            run.bold = True
            run.font.color.rgb = RGBColor(*hex_to_rgb(style.heading1_color_hex))
            return

        # --- Headings ---
        if b_type == BlockType.HEADING:
            level = block.level or 1
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.keep_with_next = True

            run = p.add_run(block.text)
            run.font.name = style.font_name
            run.bold = True

            if level == 1:
                p.paragraph_format.space_before = Pt(style.heading1_space_before_pt)
                p.paragraph_format.space_after = Pt(style.heading1_space_after_pt)
                run.font.size = Pt(style.heading1_size_pt)
                run.font.color.rgb = RGBColor(*hex_to_rgb(style.heading1_color_hex))
            elif level == 2:
                p.paragraph_format.space_before = Pt(style.heading2_space_before_pt)
                p.paragraph_format.space_after = Pt(style.heading2_space_after_pt)
                run.font.size = Pt(style.heading2_size_pt)
                run.font.color.rgb = RGBColor(*hex_to_rgb(style.heading2_color_hex))
            else:
                p.paragraph_format.space_before = Pt(style.heading3_space_before_pt)
                p.paragraph_format.space_after = Pt(style.heading3_space_after_pt)
                run.font.size = Pt(style.heading3_size_pt)
                run.font.color.rgb = RGBColor(*hex_to_rgb(style.heading3_color_hex))
            return

        # --- Paragraphs ---
        if b_type == BlockType.PARAGRAPH:
            p = doc.add_paragraph()
            p.alignment = (
                WD_ALIGN_PARAGRAPH.JUSTIFY if style.body_alignment == "justify"
                else WD_ALIGN_PARAGRAPH.LEFT
            )
            p.paragraph_format.space_before = Pt(style.paragraph_space_before_pt)
            p.paragraph_format.space_after = Pt(style.paragraph_space_after_pt)
            p.paragraph_format.line_spacing = style.line_spacing

            if style.first_line_indent_inches > 0:
                p.paragraph_format.first_line_indent = Inches(style.first_line_indent_inches)

            self._apply_inline_runs_python_docx(p, block.text, style)
            return

        # --- Ordered Lists ---
        if b_type == BlockType.ORDERED_LIST:
            items = block.items or []
            for idx, item in enumerate(items, start=1):
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Inches(0.4)
                p.paragraph_format.first_line_indent = Inches(-0.25)
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.line_spacing = style.line_spacing

                num_run = p.add_run(f"{idx}.\t")
                num_run.bold = True
                num_run.font.name = style.font_name
                num_run.font.size = Pt(style.body_size_pt)

                self._apply_inline_runs_python_docx(p, item, style)
            return

        # --- Unordered Lists ---
        if b_type == BlockType.UNORDERED_LIST:
            items = block.items or []
            for item in items:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Inches(0.4)
                p.paragraph_format.first_line_indent = Inches(-0.25)
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.line_spacing = style.line_spacing

                bullet_run = p.add_run("•\t")
                bullet_run.bold = True
                bullet_run.font.name = style.font_name
                bullet_run.font.size = Pt(style.body_size_pt)

                self._apply_inline_runs_python_docx(p, item, style)
            return

        # --- Tables ---
        if b_type == BlockType.TABLE:
            headers = block.headers or []
            rows = block.rows or []
            if not headers and not rows:
                return

            total_cols = max(len(headers), max((len(r) for r in rows), default=0))
            if total_cols == 0:
                return

            total_rows = len(rows) + (1 if headers else 0)
            table = doc.add_table(rows=total_rows, cols=total_cols)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER

            cur_row = 0
            if headers:
                hdr_cells = table.rows[0].cells
                for col_idx, h_text in enumerate(headers):
                    cell = hdr_cells[col_idx]
                    cp = cell.paragraphs[0]
                    cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    crun = cp.add_run(h_text)
                    crun.bold = True
                    crun.font.name = style.font_name
                    crun.font.size = Pt(style.table_cell_size_pt)
                    self._set_cell_background(cell, style.table_header_bg_hex)
                cur_row += 1

            for row_data in rows:
                row_cells = table.rows[cur_row].cells
                for col_idx in range(total_cols):
                    cell_text = row_data[col_idx] if col_idx < len(row_data) else ""
                    cell = row_cells[col_idx]
                    cp = cell.paragraphs[0]
                    cp.alignment = (
                        WD_ALIGN_PARAGRAPH.LEFT if not block.alignments or col_idx >= len(block.alignments)
                        else (
                            WD_ALIGN_PARAGRAPH.CENTER if block.alignments[col_idx] == "center"
                            else (WD_ALIGN_PARAGRAPH.RIGHT if block.alignments[col_idx] == "right" else WD_ALIGN_PARAGRAPH.LEFT)
                        )
                    )
                    crun = cp.add_run(cell_text)
                    crun.font.name = style.font_name
                    crun.font.size = Pt(style.table_cell_size_pt)
                cur_row += 1

            # Space after table
            spacer = doc.add_paragraph()
            spacer.paragraph_format.space_before = Pt(0)
            spacer.paragraph_format.space_after = Pt(6)
            return

        # --- Blockquotes ---
        if b_type == BlockType.BLOCKQUOTE:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.5)
            p.paragraph_format.right_indent = Inches(0.5)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.15

            run = p.add_run(block.text)
            run.font.name = style.font_name
            run.font.size = Pt(style.body_size_pt)
            run.italic = True
            run.font.color.rgb = RGBColor(80, 80, 80)
            return

        # --- Code Blocks ---
        if b_type == BlockType.CODE_BLOCK:
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)

            run = p.add_run(block.text)
            run.font.name = style.code_font_name
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(40, 40, 40)
            return

        # --- Math Blocks ---
        if b_type == BlockType.MATH_BLOCK:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(8)

            clean_math = block.text.strip().strip("$")
            omml_xml = self.math_service.latex_to_omml(clean_math, display=True)
            if omml_xml:
                try:
                    omml_element = parse_xml(omml_xml)
                    p._p.append(omml_element)
                    return
                except Exception as e:
                    logger.debug(f"Failed to append OMML to paragraph: {e}")

            # Fallback readable math
            readable = self.math_service._latex_to_readable_math_string(clean_math)
            run = p.add_run(readable)
            run.font.name = "Cambria Math"
            run.font.size = Pt(style.body_size_pt + 1.0)
            run.italic = True
            return

        # --- Thematic Break ---
        if b_type == BlockType.THEMATIC_BREAK:
            doc.add_page_break()
            return

    def _apply_inline_runs_python_docx(
        self,
        paragraph: Any,
        text: str,
        style: DocxStyleConfig,
    ) -> None:
        """Add runs with inline styles and native OMML math to paragraph."""
        segments = self.math_service.segment_text_and_math(text)

        for seg in segments:
            if seg["type"] == "math":
                omml_xml = seg.get("omml")
                appended = False
                if omml_xml:
                    try:
                        omml_element = parse_xml(omml_xml)
                        paragraph._p.append(omml_element)
                        appended = True
                    except Exception as e:
                        logger.debug(f"Failed to append inline OMML: {e}")

                if not appended:
                    clean_text = self.math_service._latex_to_readable_math_string(seg.get("clean_latex", ""))
                    run = paragraph.add_run(clean_text)
                    run.font.name = "Cambria Math"
                    run.font.size = Pt(style.body_size_pt)
                    run.italic = True
            else:
                prose = seg["content"]
                parsed_runs = parse_inline_markdown_runs(prose)
                for r_info in parsed_runs:
                    run = paragraph.add_run(r_info["text"])
                    run.bold = r_info["bold"]
                    run.italic = r_info["italic"]
                    run.underline = r_info["underline"]

                    if r_info["code"]:
                        run.font.name = style.code_font_name
                        run.font.size = Pt(style.body_size_pt * 0.9)
                        run.font.color.rgb = RGBColor(180, 40, 40)
                    else:
                        run.font.name = style.font_name
                        run.font.size = Pt(style.body_size_pt)
                        run.font.color.rgb = RGBColor(*hex_to_rgb(style.body_color_hex))

    def _set_cell_background(self, cell: Any, hex_color: str) -> None:
        """Set XML background shading for a table cell."""
        try:
            tcPr = cell._tc.get_or_add_tcPr()
            shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
            tcPr.append(shd)
        except Exception:
            pass

    def _add_dynamic_page_number_field(self, run: Any) -> None:
        """Insert standard dynamic Word PAGE field code in footer."""
        try:
            fldChar1 = parse_xml(r'<w:fldChar %s w:fldCharType="begin"/>' % nsdecls("w"))
            instrText = parse_xml(r'<w:instrText %s xml:space="preserve"> PAGE </w:instrText>' % nsdecls("w"))
            fldChar2 = parse_xml(r'<w:fldChar %s w:fldCharType="separate"/>' % nsdecls("w"))
            fldChar3 = parse_xml(r'<w:fldChar %s w:fldCharType="end"/>' % nsdecls("w"))
            run._r.append(fldChar1)
            run._r.append(instrText)
            run._r.append(fldChar2)
            run._r.append(fldChar3)
        except Exception:
            run.text = "1"

    # =========================================================================
    # Engine B: Direct OpenXML ECMA-376 Generation Engine
    # =========================================================================

    def _generate_with_openxml_engine(
        self,
        document: AcademicDocument,
        style: DocxStyleConfig,
        effective_title: str,
    ) -> bytes:
        """Generate a 100% compliant, fully editable OpenXML .docx archive without external packages."""
        body_xml_fragments: List[str] = []

        # Convert margins to dxa (1 inch = 1440 dxa)
        top_dxa = int(style.margins.top * 1440)
        bottom_dxa = int(style.margins.bottom * 1440)
        left_dxa = int(style.margins.left * 1440)
        right_dxa = int(style.margins.right * 1440)

        # Process each block
        for block in document.blocks:
            body_xml_fragments.append(self._block_to_openxml(block, style))

        # Build Section Properties
        sect_pr = (
            f'<w:sectPr>'
            f'  <w:headerReference w:type="default" r:id="rId6"/>'
            f'  <w:footerReference w:type="default" r:id="rId7"/>'
            f'  <w:pgSz w:w="12240" w:h="15840"/>'  # Standard Letter 8.5 x 11 in
            f'  <w:pgMar w:top="{top_dxa}" w:right="{right_dxa}" w:bottom="{bottom_dxa}" w:left="{left_dxa}" '
            f'           w:header="720" w:footer="720" w:gutter="0"/>'
            f'</w:sectPr>'
        )

        body_content = "\n".join(body_xml_fragments) + "\n" + sect_pr

        # Document XML
        document_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
            '            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n'
            f'<w:body>\n{body_content}\n</w:body>\n'
            '</w:document>'
        )

        # Header XML
        header_text = saxutils.escape(style.default_header_text or effective_title)
        header_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
            '  <w:p>\n'
            '    <w:pPr><w:jc w:val="right"/></w:pPr>\n'
            '    <w:r>\n'
            f'      <w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:sz w:val="19"/><w:color w:val="808080"/></w:rPr>\n'
            f'      <w:t>{header_text}</w:t>\n'
            '    </w:r>\n'
            '  </w:p>\n'
            '</w:hdr>'
        )

        # Footer XML with dynamic Word PAGE field
        footer_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
            '  <w:p>\n'
            f'    <w:pPr><w:jc w:val="{style.page_number_alignment}"/></w:pPr>\n'
            '    <w:r>\n'
            f'      <w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:sz w:val="19"/><w:color w:val="808080"/></w:rPr>\n'
            '      <w:fldSimple w:instr="PAGE"/>\n'
            '    </w:r>\n'
            '  </w:p>\n'
            '</w:ftr>'
        )

        # [Content_Types].xml
        content_types_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
            '  <Default Extension="xml" ContentType="application/xml"/>\n'
            '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n'
            '  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>\n'
            '  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>\n'
            '  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>\n'
            '  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>\n'
            '  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>\n'
            '</Types>'
        )

        # _rels/.rels
        root_rels_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n'
            '  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>\n'
            '  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>\n'
            '</Relationships>'
        )

        # word/_rels/document.xml.rels
        doc_rels_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n'
            '  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>\n'
            '  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>\n'
            '</Relationships>'
        )

        # word/styles.xml
        styles_xml = self._build_styles_xml(style)

        # docProps/core.xml
        core_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
            '                   xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
            f'  <dc:title>{saxutils.escape(effective_title)}</dc:title>\n'
            '  <dc:creator>FormatAI Academic Engine</dc:creator>\n'
            '</cp:coreProperties>'
        )

        # docProps/app.xml
        app_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">\n'
            '  <Application>FormatAI</Application>\n'
            '  <DocSecurity>0</DocSecurity>\n'
            '</Properties>'
        )

        # Assemble into valid ZIP archive
        zip_buffer = BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", content_types_xml)
            zf.writestr("_rels/.rels", root_rels_xml)
            zf.writestr("word/_rels/document.xml.rels", doc_rels_xml)
            zf.writestr("word/document.xml", document_xml)
            zf.writestr("word/styles.xml", styles_xml)
            zf.writestr("word/header1.xml", header_xml)
            zf.writestr("word/footer1.xml", footer_xml)
            zf.writestr("docProps/core.xml", core_xml)
            zf.writestr("docProps/app.xml", app_xml)

        zip_buffer.seek(0)
        return zip_buffer.getvalue()

    def _block_to_openxml(self, block: DocumentBlock, style: DocxStyleConfig) -> str:
        """Convert a DocumentBlock into WordProcessingML XML string."""
        b_type = block.block_type

        # Title
        if b_type == BlockType.TITLE:
            sz_hp = int(style.title_size_pt * 2)
            color = style.heading1_color_hex
            runs_xml = f'<w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:b/><w:sz w:val="{sz_hp}"/><w:color w:val="{color}"/></w:rPr><w:t>{saxutils.escape(block.text)}</w:t></w:r>'
            return f'<w:p><w:pPr><w:jc w:val="{style.title_alignment}"/><w:spacing w:before="240" w:after="240"/></w:pPr>{runs_xml}</w:p>'

        # Heading 1, 2, 3
        if b_type == BlockType.HEADING:
            level = block.level or 1
            if level == 1:
                sz_hp = int(style.heading1_size_pt * 2)
                before = int(style.heading1_space_before_pt * 20)
                after = int(style.heading1_space_after_pt * 20)
                color = style.heading1_color_hex
            elif level == 2:
                sz_hp = int(style.heading2_size_pt * 2)
                before = int(style.heading2_space_before_pt * 20)
                after = int(style.heading2_space_after_pt * 20)
                color = style.heading2_color_hex
            else:
                sz_hp = int(style.heading3_size_pt * 2)
                before = int(style.heading3_space_before_pt * 20)
                after = int(style.heading3_space_after_pt * 20)
                color = style.heading3_color_hex

            runs_xml = f'<w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:b/><w:sz w:val="{sz_hp}"/><w:color w:val="{color}"/></w:rPr><w:t>{saxutils.escape(block.text)}</w:t></w:r>'
            return f'<w:p><w:pPr><w:keepNext/><w:spacing w:before="{before}" w:after="{after}"/></w:pPr>{runs_xml}</w:p>'

        # Paragraph
        if b_type == BlockType.PARAGRAPH:
            align_val = "both" if style.body_alignment == "justify" else "left"
            line_val = int(style.line_spacing * 240)
            after_val = int(style.paragraph_space_after_pt * 20)
            indent_xml = f'<w:ind w:firstLine="{int(style.first_line_indent_inches * 1440)}"/>' if style.first_line_indent_inches > 0 else ""

            runs_xml = self._inline_runs_to_openxml(block.text, style)
            return f'<w:p><w:pPr><w:jc w:val="{align_val}"/><w:spacing w:before="0" w:after="{after_val}" w:line="{line_val}" w:lineRule="auto"/>{indent_xml}</w:pPr>{runs_xml}</w:p>'

        # Ordered List
        if b_type == BlockType.ORDERED_LIST:
            items = block.items or []
            paragraphs = []
            for idx, item in enumerate(items, 1):
                num_run = f'<w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:b/><w:sz w:val="{int(style.body_size_pt * 2)}"/></w:rPr><w:t xml:space="preserve">{idx}.  </w:t></w:r>'
                item_runs = self._inline_runs_to_openxml(item, style)
                paragraphs.append(
                    f'<w:p><w:pPr><w:ind w:left="576" w:hanging="288"/><w:spacing w:before="0" w:after="60"/></w:pPr>{num_run}{item_runs}</w:p>'
                )
            return "\n".join(paragraphs)

        # Unordered List
        if b_type == BlockType.UNORDERED_LIST:
            items = block.items or []
            paragraphs = []
            for item in items:
                bullet_run = f'<w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:b/><w:sz w:val="{int(style.body_size_pt * 2)}"/></w:rPr><w:t xml:space="preserve">&#8226;  </w:t></w:r>'
                item_runs = self._inline_runs_to_openxml(item, style)
                paragraphs.append(
                    f'<w:p><w:pPr><w:ind w:left="576" w:hanging="288"/><w:spacing w:before="0" w:after="60"/></w:pPr>{bullet_run}{item_runs}</w:p>'
                )
            return "\n".join(paragraphs)

        # Table
        if b_type == BlockType.TABLE:
            headers = block.headers or []
            rows = block.rows or []
            if not headers and not rows:
                return ""

            col_count = max(len(headers), max((len(r) for r in rows), default=0))
            if col_count == 0:
                return ""

            tbl_rows_xml = []

            # Headers
            if headers:
                cells_xml = []
                for h in headers:
                    cells_xml.append(
                        f'<w:tc>'
                        f'  <w:tcPr><w:shd w:fill="{style.table_header_bg_hex}"/></w:tcPr>'
                        f'  <w:p><w:pPr><w:jc w:val="center"/></w:pPr>'
                        f'    <w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:b/><w:sz w:val="{int(style.table_cell_size_pt * 2)}"/></w:rPr>'
                        f'      <w:t>{saxutils.escape(h)}</w:t>'
                        f'    </w:r>'
                        f'  </w:p>'
                        f'</w:tc>'
                    )
                tbl_rows_xml.append(f'<w:tr><w:trPr><w:tblHeader/></w:trPr>{"".join(cells_xml)}</w:tr>')

            # Rows
            for row in rows:
                cells_xml = []
                for idx in range(col_count):
                    val = row[idx] if idx < len(row) else ""
                    cells_xml.append(
                        f'<w:tc>'
                        f'  <w:p><w:pPr><w:spacing w:after="40"/></w:pPr>'
                        f'    <w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:sz w:val="{int(style.table_cell_size_pt * 2)}"/></w:rPr>'
                        f'      <w:t>{saxutils.escape(val)}</w:t>'
                        f'    </w:r>'
                        f'  </w:p>'
                        f'</w:tc>'
                    )
                tbl_rows_xml.append(f'<w:tr>{"".join(cells_xml)}</w:tr>')

            tbl_xml = (
                f'<w:tbl>'
                f'  <w:tblPr>'
                f'    <w:jc w:val="center"/>'
                f'    <w:tblBorders>'
                f'      <w:top w:val="single" w:sz="6" w:space="0" w:color="{style.table_border_color_hex}"/>'
                f'      <w:bottom w:val="8" w:sz="8" w:space="0" w:color="{style.table_border_color_hex}"/>'
                f'      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="{style.table_border_color_hex}"/>'
                f'      <w:insideV w:val="none"/>'
                f'      <w:left w:val="none"/>'
                f'      <w:right w:val="none"/>'
                f'    </w:tblBorders>'
                f'  </w:tblPr>'
                f'  {"".join(tbl_rows_xml)}'
                f'</w:tbl>'
            )
            return tbl_xml

        # Blockquote
        if b_type == BlockType.BLOCKQUOTE:
            runs_xml = f'<w:r><w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:i/><w:sz w:val="{int(style.body_size_pt * 2)}"/><w:color w:val="555555"/></w:rPr><w:t>{saxutils.escape(block.text)}</w:t></w:r>'
            return f'<w:p><w:pPr><w:ind w:left="720" w:right="720"/><w:spacing w:before="120" w:after="120"/></w:pPr>{runs_xml}</w:p>'

        # Code Block
        if b_type == BlockType.CODE_BLOCK:
            lines = block.text.split("\n")
            p_list = []
            for l in lines:
                p_list.append(
                    f'<w:p><w:pPr><w:ind w:left="432"/><w:spacing w:before="0" w:after="20"/></w:pPr>'
                    f'<w:r><w:rPr><w:rFonts w:ascii="{style.code_font_name}" w:hAnsi="{style.code_font_name}"/><w:sz w:val="19"/><w:color w:val="333333"/></w:rPr>'
                    f'<w:t xml:space="preserve">{saxutils.escape(l)}</w:t></w:r></w:p>'
                )
            return "\n".join(p_list)

        # Math Block
        if b_type == BlockType.MATH_BLOCK:
            clean = block.text.strip().strip("$")
            omml_xml = self.math_service.latex_to_omml(clean, display=True)
            if omml_xml:
                return (
                    f'<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="160" w:after="160"/></w:pPr>'
                    f'{omml_xml}'
                    f'</w:p>'
                )

            clean_readable = self.math_service._latex_to_readable_math_string(clean)
            return (
                f'<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="140" w:after="140"/></w:pPr>'
                f'<w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/><w:sz w:val="{int(style.body_size_pt * 2)}"/></w:rPr>'
                f'<w:t>{saxutils.escape(clean_readable)}</w:t></w:r></w:p>'
            )

        # Thematic Break
        if b_type == BlockType.THEMATIC_BREAK:
            return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'

        return ""

    def _inline_runs_to_openxml(self, text: str, style: DocxStyleConfig) -> str:
        """Convert inline markdown and embedded math into WordprocessingML and OMML tags."""
        segments = self.math_service.segment_text_and_math(text)
        xml_fragments: List[str] = []

        for seg in segments:
            if seg["type"] == "math":
                omml_xml = seg.get("omml")
                if omml_xml:
                    xml_fragments.append(omml_xml)
                else:
                    readable = self.math_service._latex_to_readable_math_string(seg.get("clean_latex", ""))
                    xml_fragments.append(
                        f'<w:r><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math"/><w:i/><w:sz w:val="{int(style.body_size_pt * 2)}"/></w:rPr>'
                        f'<w:t>{saxutils.escape(readable)}</w:t></w:r>'
                    )
            else:
                prose = seg["content"]
                parsed_runs = parse_inline_markdown_runs(prose)
                for r in parsed_runs:
                    t = saxutils.escape(r["text"])
                    bold_xml = "<w:b/>" if r["bold"] else ""
                    italic_xml = "<w:i/>" if r["italic"] else ""
                    underline_xml = '<w:u w:val="single"/>' if r["underline"] else ""

                    if r["code"]:
                        font_xml = f'<w:rFonts w:ascii="{style.code_font_name}" w:hAnsi="{style.code_font_name}"/>'
                        sz_xml = f'<w:sz w:val="{int(style.body_size_pt * 1.8)}"/>'
                        color_xml = '<w:color w:val="A93226"/>'
                    else:
                        font_xml = f'<w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/>'
                        sz_xml = f'<w:sz w:val="{int(style.body_size_pt * 2)}"/>'
                        color_xml = f'<w:color w:val="{style.body_color_hex}"/>'

                    rpr = f"<w:rPr>{font_xml}{bold_xml}{italic_xml}{underline_xml}{sz_xml}{color_xml}</w:rPr>"
                    xml_fragments.append(f'<w:r>{rpr}<w:t xml:space="preserve">{t}</w:t></w:r>')

        return "".join(xml_fragments)

    def _build_styles_xml(self, style: DocxStyleConfig) -> str:
        """Generate word/styles.xml matching document presets."""
        sz_hp = int(style.body_size_pt * 2)
        return (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n'
            '  <w:docDefaults>\n'
            '    <w:rPrDefault>\n'
            f'      <w:rPr><w:rFonts w:ascii="{style.font_name}" w:hAnsi="{style.font_name}"/><w:sz w:val="{sz_hp}"/></w:rPr>\n'
            '    </w:rPrDefault>\n'
            '  </w:docDefaults>\n'
            '</w:styles>'
        )
