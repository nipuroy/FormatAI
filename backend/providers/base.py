"""Abstract base class defining the standard interface for AI providers."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from backend.providers.exceptions import (
    ProviderDisabledError,
    ProviderError,
)


class ModelInfo(BaseModel):
    """Metadata describing an AI model supported or discovered by a provider."""

    id: str = Field(..., description="Unique model identifier used in API requests")
    name: str = Field(..., description="Human-friendly model title")
    description: Optional[str] = Field(default=None, description="Capabilities or usage recommendation")
    tier: Optional[str] = Field(default=None, description="Performance or pricing tier (e.g. 'Fast', 'Pro', 'Open')")
    context_length: Optional[int] = Field(default=None, description="Context window token limit if available")
    is_default: bool = Field(default=False, description="Whether this is the provider's default model")


class ProviderValidationResult(BaseModel):
    """Result of validating provider configuration and connectivity."""

    valid: bool = Field(..., description="True if provider is correctly configured and reachable")
    provider: str = Field(..., description="Provider identifier")
    message: str = Field(..., description="Descriptive status or error message")
    model_count: Optional[int] = Field(default=None, description="Count of available/discovered models")
    details: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Diagnostic details without exposing secrets")


class ProviderResult(BaseModel):
    """Normalized output returned by any AI provider implementation."""

    provider: str = Field(..., description="Provider identifier (e.g. 'gemini', 'groq')")
    model: str = Field(..., description="Model identifier used for generation")
    content: str = Field(..., description="Generated text content")
    finish_reason: Optional[str] = Field(default=None, description="Completion finish reason")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Auxiliary response metadata")


class BaseAIProvider(ABC):
    """Abstract interface that all external AI model providers must implement."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        enabled: bool = True,
        max_retries: int = 2,
        **kwargs: Any,
    ):
        self.api_key = api_key
        self.default_model = default_model
        self.base_url = base_url
        self.timeout_seconds = timeout_seconds
        self.enabled = enabled
        self.max_retries = max_retries
        self.extra_config = kwargs

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the unique lowercase identifier for the provider (e.g. 'gemini', 'groq')."""
        pass

    def get_display_name(self) -> str:
        """Return human-readable display name for UI presentation."""
        return self.get_provider_name().title()

    @abstractmethod
    def is_configured(self) -> bool:
        """Verify whether required credentials/keys are present without logging them."""
        pass

    def is_enabled(self) -> bool:
        """Return whether provider is currently enabled."""
        return self.enabled

    def set_enabled(self, enabled: bool) -> None:
        """Enable or disable this provider instance."""
        self.enabled = enabled

    @abstractmethod
    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        """Determine and validate the model identifier to be used."""
        pass

    async def list_models(self) -> List[ModelInfo]:
        """Discover or list available models for this provider."""
        return [
            ModelInfo(
                id=self.default_model or "default",
                name=self.default_model or "Default Model",
                is_default=True,
            )
        ]

    async def validate_configuration(self) -> ProviderValidationResult:
        """Test configuration/connectivity without performing full generation or leaking secrets."""
        return ProviderValidationResult(
            valid=self.is_configured(),
            provider=self.get_provider_name(),
            message="Configuration is valid." if self.is_configured() else "Provider is not configured.",
        )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> ProviderResult:
        """Submit prompt to the AI provider. Defaults to calling generate_text for backward compatibility."""
        return await self.generate_text(prompt=prompt, model=model, timeout=timeout)

    async def generate_text(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> ProviderResult:
        """Legacy / compatibility method delegating to generate()."""
        return await self.generate(prompt=prompt, model=model, timeout=timeout)

    @abstractmethod
    def normalize_error(self, error: Exception) -> ProviderError:
        """Normalize provider-specific exceptions into standard ProviderError hierarchy."""
        pass

    def check_active_or_raise(self) -> None:
        """Enforce that disabled providers do not process requests."""
        if not self.is_enabled():
            raise ProviderDisabledError(
                message=f"Provider '{self.get_display_name()}' ({self.get_provider_name()}) is disabled.",
                provider=self.get_provider_name(),
            )
