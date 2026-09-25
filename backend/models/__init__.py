"""Pydantic request and response schemas for FormatAI."""

from .health import HealthResponse, RootResponse
from .document import CitationStyle, DocumentFormat, FormattingRequestSkeleton
from .ai import AIGenerateRequest, AIGenerateResponse, AIErrorResponse

__all__ = [
    "HealthResponse",
    "RootResponse",
    "CitationStyle",
    "DocumentFormat",
    "FormattingRequestSkeleton",
    "AIGenerateRequest",
    "AIGenerateResponse",
    "AIErrorResponse",
]
