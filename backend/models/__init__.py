"""Pydantic request and response schemas for FormatAI."""

from .health import HealthResponse, RootResponse
from .document import (
    BlockType,
    CitationStyle,
    DocumentBlock,
    DocumentFormat,
    DocumentStatistics,
    AcademicDocument,
    FormattingRequestSkeleton,
    DocumentProcessResponse,
    DocxExportRequest,
    PdfExportRequest,
)
from .ai import AIGenerateRequest, AIGenerateResponse, AIErrorResponse

__all__ = [
    "HealthResponse",
    "RootResponse",
    "CitationStyle",
    "DocumentFormat",
    "BlockType",
    "DocumentBlock",
    "DocumentStatistics",
    "AcademicDocument",
    "FormattingRequestSkeleton",
    "DocumentProcessResponse",
    "DocxExportRequest",
    "PdfExportRequest",
    "AIGenerateRequest",
    "AIGenerateResponse",
    "AIErrorResponse",
]
