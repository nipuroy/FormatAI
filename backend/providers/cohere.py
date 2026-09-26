"""Cohere AI Provider implementation.

Specialized enterprise models for document analysis, summarization, and Command reasoning.
"""

from typing import Any, Dict, List, Optional
from backend.core.config import get_settings
from backend.providers.base import BaseAIProvider, ModelInfo, ProviderResult, ProviderValidationResult
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.providers.http_client import execute_with_retry
from backend.utils.logger import get_logger

logger = get_logger("cohere_provider")

DEFAULT_COHERE_BASE_URL = "https://api.cohere.com/v2"
DEFAULT_COHERE_MODEL = "command-r-plus-08-2024"

CURATED_COHERE_MODELS: List[ModelInfo] = [
    ModelInfo(
        id="command-r-plus-08-2024",
        name="Command R+ (08-2024)",
        description="State-of-the-art enterprise model optimized for complex research synthesis, RAG, and reasoning",
        tier="Pro",
        context_length=128000,
        is_default=True,
    ),
    ModelInfo(
        id="command-r-08-2024",
        name="Command R (08-2024)",
        description="High-efficiency balanced model for document formatting and semantic rewriting",
        tier="Balanced",
        context_length=128000,
    ),
    ModelInfo(
        id="command-light",
        name="Command Light",
        description="Fast, low-latency model for quick proofreading and spell/grammar checks",
        tier="Fast",
        context_length=4096,
    ),
]


class CohereProvider(BaseAIProvider):
    """Cohere v2 API provider."""

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
        settings = get_settings()
        resolved_key = api_key if api_key is not None else settings.COHERE_API_KEY
        resolved_base_url = (base_url or DEFAULT_COHERE_BASE_URL).rstrip("/")
        resolved_model = default_model or DEFAULT_COHERE_MODEL

        super().__init__(
            api_key=resolved_key,
            default_model=resolved_model,
            base_url=resolved_base_url,
            timeout_seconds=timeout_seconds,
            enabled=enabled,
            max_retries=max_retries,
            **kwargs,
        )

    def get_provider_name(self) -> str:
        return "cohere"

    def get_display_name(self) -> str:
        return "Cohere"

    def is_configured(self) -> bool:
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model and requested_model.strip():
            clean = requested_model.strip()
            if any(foreign in clean.lower() for foreign in ["gemini", "claude", "gpt-", "llama", "mistral"]):
                logger.warning(
                    f"Model '{clean}' is incompatible with Cohere. Falling back to default '{self.default_model or DEFAULT_COHERE_MODEL}'."
                )
                return self.default_model or DEFAULT_COHERE_MODEL
            return clean
        return self.default_model or DEFAULT_COHERE_MODEL

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured():
            raise ProviderConfigurationError(
                message="Cohere API key is missing. Please set COHERE_API_KEY.",
                provider=self.get_provider_name(),
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def list_models(self) -> List[ModelInfo]:
        if not self.is_configured():
            return CURATED_COHERE_MODELS

        try:
            # Cohere models endpoint is available under v1/models
            url = "https://api.cohere.com/v1/models"
            resp = await execute_with_retry(
                provider_name=self.get_provider_name(),
                method="GET",
                url=url,
                headers=self._get_headers(),
                timeout=10.0,
                max_retries=1,
            )
            data = resp.json()
            models: List[ModelInfo] = []
            for item in data.get("models", []):
                name = item.get("name")
                if name and "command" in name:
                    models.append(
                        ModelInfo(
                            id=name,
                            name=name,
                            context_length=item.get("context_length"),
                            is_default=(name == DEFAULT_COHERE_MODEL),
                        )
                    )
            if models:
                return models
        except Exception as exc:
            logger.warning(f"Cohere model discovery fallback: {str(exc)}")

        return CURATED_COHERE_MODELS

    async def validate_configuration(self) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="Cohere API key is missing or empty.",
            )

        try:
            url = "https://api.cohere.com/v1/models"
            resp = await execute_with_retry(
                provider_name=self.get_provider_name(),
                method="GET",
                url=url,
                headers=self._get_headers(),
                timeout=10.0,
                max_retries=0,
            )
            data = resp.json()
            count = len(data.get("models", []))
            return ProviderValidationResult(
                valid=True,
                provider=self.get_provider_name(),
                message="Successfully verified connection to Cohere API.",
                model_count=count,
            )
        except Exception as exc:
            norm = self.normalize_error(exc)
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message=norm.message,
                details={"error_type": norm.error_type},
            )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> ProviderResult:
        self.check_active_or_raise()

        if not prompt or not prompt.strip():
            raise ProviderError(
                message="Prompt must not be empty.",
                provider=self.get_provider_name(),
                error_type="validation_error",
                status_code=400,
            )

        target_model = self.resolve_model(model)
        effective_timeout = timeout or self.timeout_seconds
        headers = self._get_headers()
        url = f"{self.base_url}/chat"

        payload = {
            "model": target_model,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            "temperature": temperature if temperature is not None else 0.3,
        }

        resp = await execute_with_retry(
            provider_name=self.get_provider_name(),
            method="POST",
            url=url,
            headers=headers,
            json_data=payload,
            timeout=effective_timeout,
            max_retries=self.max_retries,
        )

        data = resp.json()
        message = data.get("message", {})
        content_items = message.get("content", [])
        text_content = ""
        for item in content_items:
            if isinstance(item, dict) and "text" in item:
                text_content += item["text"]
            elif isinstance(item, str):
                text_content += item

        if not text_content and "text" in data:
            text_content = data["text"]

        finish_reason = data.get("finish_reason")

        return ProviderResult(
            provider=self.get_provider_name(),
            model=target_model,
            content=text_content,
            finish_reason=finish_reason,
            metadata={"id": data.get("id"), "usage": data.get("usage", {})},
        )

    def normalize_error(self, error: Exception) -> ProviderError:
        if isinstance(error, ProviderError):
            return error
        return ProviderAPIError(
            message=f"Cohere error: {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
