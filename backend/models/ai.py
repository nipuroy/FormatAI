"""Pydantic request and response schemas for AI generation endpoints."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProviderSpecificConfig(BaseModel):
    """Client-provided runtime configuration for an isolated provider."""

    api_key: Optional[str] = Field(default=None, description="Ephemeral API key provided by the client (never saved in shared DB)")
    base_url: Optional[str] = Field(default=None, description="Custom base URL for custom OpenAI or enterprise gateway")
    enabled: Optional[bool] = Field(default=True, description="Whether this provider is currently enabled by user")
    timeout_seconds: Optional[float] = Field(default=None, description="Per-request or per-provider timeout in seconds")
    max_retries: Optional[int] = Field(default=None, description="Max retry attempts on transient network or 429 errors")
    default_model: Optional[str] = Field(default=None, description="Preferred default model")


class AIGenerateRequest(BaseModel):
    """Payload for text generation requests."""

    prompt: str = Field(..., min_length=1, description="Prompt text to submit to the AI provider")
    provider: Optional[str] = Field(default=None, description="Target AI provider (e.g. 'gemini', 'groq', 'openrouter')")
    model: Optional[str] = Field(default=None, description="Optional target model override")
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0, description="Sampling temperature")
    provider_config: Optional[ProviderSpecificConfig] = Field(default=None, description="Optional per-request provider settings")
    fallback_providers: Optional[List[str]] = Field(
        default=None,
        description="Explicit list of fallback provider IDs to try ONLY if primary fails. If omitted, no fallback occurs.",
    )
    timeout: Optional[float] = Field(default=None, description="Custom per-request timeout in seconds")


class AIGenerateResponse(BaseModel):
    """Predictable response payload for successful generation."""

    success: bool = Field(default=True, description="Indicates if generation succeeded")
    provider: str = Field(..., description="Provider that generated the text")
    model: str = Field(..., description="Model identifier used for generation")
    content: str = Field(..., description="Generated text content")
    finish_reason: Optional[str] = Field(default=None, description="Completion finish reason")
    fallback_occurred: bool = Field(default=False, description="True if a fallback provider was utilized")
    attempted_providers: Optional[List[str]] = Field(default_factory=list, description="List of providers attempted in sequence")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Auxiliary response metadata")


class AIErrorResponse(BaseModel):
    """Structured error payload for failed generation attempts."""

    success: bool = Field(default=False, description="Always false for error responses")
    error: str = Field(..., description="Human-readable error explanation")
    error_type: str = Field(default="provider_error", description="Error category classification")
    provider: str = Field(default="gemini", description="AI provider where error originated")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional error context")


class ProviderValidationRequest(BaseModel):
    """Payload to test and validate configuration for a specific provider."""

    api_key: Optional[str] = Field(default=None, description="API key to validate")
    base_url: Optional[str] = Field(default=None, description="Custom base URL to validate")
    model: Optional[str] = Field(default=None, description="Optional model to check")


class ProviderDescriptor(BaseModel):
    """Provider catalog entry describing capabilities and availability."""

    id: str
    name: str
    description: str
    is_configured: bool
    is_enabled: bool
    default_model: Optional[str] = None
    supports_discovery: bool = False
    requires_base_url: bool = False
