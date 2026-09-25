"""Centralized typography, spacing, and layout presets for DOCX generation.

Provides configurable presets (Academic, Exam, Study Notes, Research Paper, Textbook)
so formatting values are not scattered across the codebase.
"""

from enum import Enum
from typing import Dict, Optional, Tuple
from pydantic import BaseModel, Field


class DocxPresetType(str, Enum):
    """Available professional layout presets."""

    ACADEMIC = "academic"
    RESEARCH_PAPER = "research_paper"
    EXAM = "exam"
    STUDY_NOTES = "study_notes"
    TEXTBOOK = "textbook"


class MarginsConfig(BaseModel):
    """Page margins in inches."""

    top: float = Field(default=1.0, description="Top margin in inches")
    bottom: float = Field(default=1.0, description="Bottom margin in inches")
    left: float = Field(default=1.0, description="Left margin in inches")
    right: float = Field(default=1.0, description="Right margin in inches")


class DocxStyleConfig(BaseModel):
    """Centralized formatting parameters for generating a DOCX document."""

    preset_name: str = "Academic"
    font_name: str = "Times New Roman"
    code_font_name: str = "Courier New"

    # Font sizes in points
    title_size_pt: float = 18.0
    heading1_size_pt: float = 14.0
    heading2_size_pt: float = 13.0
    heading3_size_pt: float = 12.0
    body_size_pt: float = 12.0
    caption_size_pt: float = 10.0
    table_cell_size_pt: float = 10.5
    header_footer_size_pt: float = 9.5

    # Line & Paragraph Spacing
    line_spacing: float = 1.5  # 1.0, 1.15, 1.5, or 2.0
    paragraph_space_before_pt: float = 0.0
    paragraph_space_after_pt: float = 6.0
    heading1_space_before_pt: float = 12.0
    heading1_space_after_pt: float = 6.0
    heading2_space_before_pt: float = 9.0
    heading2_space_after_pt: float = 4.0
    heading3_space_before_pt: float = 6.0
    heading3_space_after_pt: float = 2.0

    # Alignment: "left", "center", "right", "justify"
    body_alignment: str = "justify"
    title_alignment: str = "center"
    heading_alignment: str = "left"

    # Indentation
    first_line_indent_inches: float = 0.0  # 0.5 for APA standard paragraph indent

    # Margins
    margins: MarginsConfig = Field(default_factory=MarginsConfig)

    # Colors (HEX string without #)
    body_color_hex: str = "000000"
    heading1_color_hex: str = "000000"
    heading2_color_hex: str = "1F4E79"
    heading3_color_hex: str = "333333"
    table_header_bg_hex: str = "EAEAEA"
    table_border_color_hex: str = "CCCCCC"
    quote_border_color_hex: str = "4A90E2"
    code_bg_hex: str = "F5F5F5"

    # Header / Footer
    include_header: bool = True
    default_header_text: Optional[str] = "FormatAI Academic Document"
    include_footer: bool = True
    include_page_numbers: bool = True
    page_number_alignment: str = "right"  # "left", "center", "right"


# =========================================================================
# Preset Definitions
# =========================================================================

PRESET_CONFIGS: Dict[DocxPresetType, DocxStyleConfig] = {
    # 1. Standard Academic Preset
    DocxPresetType.ACADEMIC: DocxStyleConfig(
        preset_name="Academic",
        font_name="Times New Roman",
        body_size_pt=12.0,
        title_size_pt=18.0,
        heading1_size_pt=14.0,
        heading2_size_pt=13.0,
        heading3_size_pt=12.0,
        line_spacing=1.5,
        paragraph_space_before_pt=0.0,
        paragraph_space_after_pt=6.0,
        body_alignment="justify",
        title_alignment="center",
        margins=MarginsConfig(top=1.0, bottom=1.0, left=1.0, right=1.0),
        heading1_color_hex="000000",
        heading2_color_hex="2E4053",
        table_header_bg_hex="F2F4F4",
    ),

    # 2. Research Paper (APA / IEEE Double Spaced Strict)
    DocxPresetType.RESEARCH_PAPER: DocxStyleConfig(
        preset_name="Research Paper",
        font_name="Times New Roman",
        body_size_pt=12.0,
        title_size_pt=16.0,
        heading1_size_pt=14.0,
        heading2_size_pt=12.5,
        heading3_size_pt=12.0,
        line_spacing=2.0,  # Double spacing standard
        paragraph_space_before_pt=0.0,
        paragraph_space_after_pt=0.0,
        first_line_indent_inches=0.5,  # Standard APA paragraph indent
        body_alignment="justify",
        title_alignment="center",
        margins=MarginsConfig(top=1.0, bottom=1.0, left=1.0, right=1.0),
        heading1_color_hex="000000",
        heading2_color_hex="000000",
        heading3_color_hex="000000",
        table_header_bg_hex="F8F9F9",
    ),

    # 3. Exam Preset (Clean, High Density, Sans-Serif)
    DocxPresetType.EXAM: DocxStyleConfig(
        preset_name="Exam",
        font_name="Arial",
        body_size_pt=11.0,
        title_size_pt=16.0,
        heading1_size_pt=13.0,
        heading2_size_pt=12.0,
        heading3_size_pt=11.0,
        line_spacing=1.15,
        paragraph_space_before_pt=2.0,
        paragraph_space_after_pt=4.0,
        body_alignment="left",
        title_alignment="center",
        margins=MarginsConfig(top=0.75, bottom=0.75, left=0.75, right=0.75),
        heading1_color_hex="1A252F",
        heading2_color_hex="2C3E50",
        table_header_bg_hex="EAECEE",
        default_header_text="Examination Paper",
    ),

    # 4. Study Notes Preset (Modern Calibri with Accent Colors)
    DocxPresetType.STUDY_NOTES: DocxStyleConfig(
        preset_name="Study Notes",
        font_name="Calibri",
        body_size_pt=11.0,
        title_size_pt=18.0,
        heading1_size_pt=15.0,
        heading2_size_pt=13.0,
        heading3_size_pt=11.5,
        line_spacing=1.2,
        paragraph_space_before_pt=0.0,
        paragraph_space_after_pt=6.0,
        body_alignment="left",
        title_alignment="left",
        margins=MarginsConfig(top=0.8, bottom=0.8, left=0.8, right=0.8),
        heading1_color_hex="1B4F72",
        heading2_color_hex="2874A6",
        heading3_color_hex="3498DB",
        table_header_bg_hex="EBF5FB",
        default_header_text="Study Guide & Revision Notes",
    ),

    # 5. Textbook Preset (Georgia Serif with Elegant Layout)
    DocxPresetType.TEXTBOOK: DocxStyleConfig(
        preset_name="Textbook",
        font_name="Georgia",
        body_size_pt=11.5,
        title_size_pt=20.0,
        heading1_size_pt=15.0,
        heading2_size_pt=13.0,
        heading3_size_pt=11.5,
        line_spacing=1.25,
        paragraph_space_before_pt=0.0,
        paragraph_space_after_pt=6.0,
        body_alignment="justify",
        title_alignment="left",
        margins=MarginsConfig(top=1.0, bottom=1.0, left=1.2, right=1.0),
        heading1_color_hex="17202A",
        heading2_color_hex="4A235A",
        table_header_bg_hex="F4ECF7",
        default_header_text="Academic Reference Publication",
    ),
}


def get_style_preset(preset: Optional[str | DocxPresetType] = None) -> DocxStyleConfig:
    """Resolve and return style configuration for the requested preset name."""
    if not preset:
        return PRESET_CONFIGS[DocxPresetType.ACADEMIC]

    if isinstance(preset, DocxPresetType):
        return PRESET_CONFIGS.get(preset, PRESET_CONFIGS[DocxPresetType.ACADEMIC])

    normalized_key = str(preset).lower().replace(" ", "_").replace("-", "_")
    for key, cfg in PRESET_CONFIGS.items():
        if key.value == normalized_key:
            return cfg

    return PRESET_CONFIGS[DocxPresetType.ACADEMIC]
