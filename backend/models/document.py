"""Domain models for academic documents, structural blocks, and pipeline processing."""

from enum import Enum
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field


class DocumentFormat(str, Enum):
    """Supported academic export formats."""

    DOCX = "docx"
    PDF = "pdf"
    LATEX = "latex"
    MARKDOWN = "markdown"


class CitationStyle(str, Enum):
    """Standard academic citation guidelines."""

    APA = "apa"
    IEEE = "ieee"
    MLA = "mla"
    HARVARD = "harvard"
    CHICAGO = "chicago"


class BlockType(str, Enum):
    """Types of structured academic document blocks."""

    TITLE = "title"
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    ORDERED_LIST = "ordered_list"
    UNORDERED_LIST = "unordered_list"
    TABLE = "table"
    BLOCKQUOTE = "blockquote"
    CODE_BLOCK = "code_block"
    MATH_BLOCK = "math_block"
    THEMATIC_BREAK = "thematic_break"
    REFERENCE_ENTRY = "reference_entry"


class DocumentBlock(BaseModel):
    """Single semantic block in the academic document AST."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8], description="Unique block ID")
    block_type: BlockType = Field(..., description="Block semantic classification")
    text: str = Field(default="", description="Text content of the block")
    level: Optional[int] = Field(default=None, description="Heading level (1-6) when block_type is HEADING or TITLE")
    items: Optional[List[str]] = Field(default=None, description="List item entries for ordered or unordered lists")
    headers: Optional[List[str]] = Field(default=None, description="Table column header names")
    rows: Optional[List[List[str]]] = Field(default=None, description="Table row records")
    alignments: Optional[List[str]] = Field(default=None, description="Table column alignments (left, center, right)")
    language: Optional[str] = Field(default=None, description="Programming or markup language for code blocks")
    math_type: Optional[str] = Field(default=None, description="Math block kind: 'inline', 'display', 'equation'")
    caption: Optional[str] = Field(default=None, description="Optional caption for table, figure, or code snippet")
    citations: List[str] = Field(default_factory=list, description="In-text citation tokens found within this block")
    scientific_notations: List[str] = Field(default_factory=list, description="Scientific notation items detected")
    chemical_formulas: List[str] = Field(default_factory=list, description="Chemical formulas detected")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom block-level metadata")


class DocumentStatistics(BaseModel):
    """Metrics and quantitative summary of the academic document."""

    word_count: int = 0
    character_count: int = 0
    heading_count: int = 0
    paragraph_count: int = 0
    table_count: int = 0
    math_block_count: int = 0
    code_block_count: int = 0
    list_count: int = 0
    citation_count: int = 0
    reference_count: int = 0


class AcademicDocument(BaseModel):
    """Internal structured representation of a fully processed academic document."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Document unique identifier")
    title: Optional[str] = Field(default=None, description="Detected or provided document title")
    authors: List[str] = Field(default_factory=list, description="List of recognized authors")
    abstract: Optional[str] = Field(default=None, description="Extracted paper abstract")
    citation_style: CitationStyle = Field(default=CitationStyle.APA, description="Target citation standard")
    export_format: DocumentFormat = Field(default=DocumentFormat.DOCX, description="Target export format")
    blocks: List[DocumentBlock] = Field(default_factory=list, description="Ordered sequence of document blocks")
    citations: List[str] = Field(default_factory=list, description="All unique citations detected in the text")
    references: List[str] = Field(default_factory=list, description="Extracted bibliographic references")
    statistics: DocumentStatistics = Field(default_factory=DocumentStatistics, description="Document metrics")
    pipeline_stages: List[str] = Field(
        default_factory=lambda: [
            "raw_input",
            "content_analysis",
            "content_cleanup",
            "structure_detection",
            "formatting_rules",
            "document_model",
            "export",
        ],
        description="Stages successfully completed by the processing pipeline",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")


class FormattingRequestSkeleton(BaseModel):
    """Request schema for document processing and formatting."""

    raw_text: str = Field(..., min_length=1, description="Raw unformatted text from user or AI engines")
    citation_style: CitationStyle = Field(default=CitationStyle.APA, description="Target citation style")
    export_format: DocumentFormat = Field(default=DocumentFormat.DOCX, description="Target export format")
    title: Optional[str] = Field(default=None, description="Optional explicit document title")
    include_table_of_contents: bool = Field(default=True, description="Whether to generate a table of contents")


class DocumentProcessResponse(BaseModel):
    """API response envelope containing the structured AcademicDocument."""

    success: bool = True
    document: AcademicDocument
    message: str = "Document processed successfully through academic pipeline."


class DocxExportRequest(BaseModel):
    """Payload schema for requesting a professional DOCX export."""

    document: Optional[AcademicDocument] = Field(default=None, description="Pre-structured AcademicDocument AST")
    raw_text: Optional[str] = Field(default=None, description="Raw unformatted text to parse and convert on-the-fly")
    preset: Optional[str] = Field(default="academic", description="Layout preset: academic, research_paper, exam, study_notes, textbook")
    title: Optional[str] = Field(default=None, description="Document title override")
    citation_style: Optional[CitationStyle] = Field(default=CitationStyle.APA, description="Citation style standard")
    include_page_numbers: Optional[bool] = Field(default=True, description="Include dynamic Word page numbers in footer")
    include_header: Optional[bool] = Field(default=True, description="Include running header")

