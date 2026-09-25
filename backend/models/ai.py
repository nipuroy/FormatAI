"""Pydantic request and response schemas for AI generation endpoints."""

from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class AIGenerateRequest(BaseModel):
    """Payload for text generation requests."""

    prompt: str = Field(..., min_length=1, description="Prompt text to submit to the AI provider")
    model: Optional[str] = Field(default=None, description="Optional target model override")


class AIGenerateResponse(BaseModel):
    """Predictable response payload for successful generation."""

    success: bool = Field(default=True, description="Indicates if generation succeeded")
    provider: str = Field(..., description="Provider that generated the text (e.g. 'gemini')")
    model: str = Field(..., description="Model identifier used for generation")
    content: str = Field(..., description="Generated text content")
    finish_reason: Optional[str] = Field(default=None, description="Completion finish reason")


class AIErrorResponse(BaseModel):
    """Structured error payload for failed generation attempts."""

    success: bool = Field(default=False, description="Always false for error responses")
    error: str = Field(..., description="Human-readable error explanation")
    error_type: str = Field(default="provider_error", description="Error category classification")
    provider: str = Field(default="gemini", description="AI provider where error originated")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional error context")
