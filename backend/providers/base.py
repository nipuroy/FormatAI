"""Abstract base class defining the standard interface for AI providers."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ProviderResult(BaseModel):
    """Normalized output returned by any AI provider implementation."""

    provider: str = Field(..., description="Provider identifier (e.g. 'gemini')")
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
        timeout_seconds: float = 30.0,
    ):
        self.api_key = api_key
        self.default_model = default_model
        self.timeout_seconds = timeout_seconds

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the unique identifier for the provider (e.g. 'gemini')."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Verify whether required credentials/keys are present without logging them."""
        pass

    @abstractmethod
    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        """Determine and validate the model identifier to be used."""
        pass

    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> ProviderResult:
        """Submit a prompt to the AI provider, extract response content, and handle errors.

        Args:
            prompt: Input text prompt.
            model: Optional model name to override the default model.
            timeout: Optional per-request timeout in seconds.

        Returns:
            ProviderResult containing normalized text content, provider name, and model.

        Raises:
            ProviderError or subclasses upon configuration, network, timeout, or API failure.
        """
        pass

    @abstractmethod
    def normalize_error(self, error: Exception) -> Exception:
        """Normalize provider-specific exceptions into standard ProviderError hierarchy."""
        pass
