"""Custom OpenAI-compatible AI Provider implementation.

Supports custom endpoints such as Ollama, LocalAI, vLLM, LM Studio,
Text Generation WebUI, or private enterprise LLM gateways.
"""

from typing import Any, Dict, List, Optional
from backend.core.config import get_settings
from backend.providers.base import BaseAIProvider, ModelInfo, ProviderResult, ProviderValidationResult
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderError,
    ProviderNetworkError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.providers.http_client import execute_with_retry
from backend.utils.logger import get_logger

logger = get_logger("custom_openai_provider")

DEFAULT_CUSTOM_BASE_URL = "http://localhost:11434/v1"
DEFAULT_CUSTOM_MODEL = "llama3"


class CustomOpenAIProvider(BaseAIProvider):
    """Custom OpenAI-compatible provider adapter."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 45.0,
        enabled: bool = True,
        max_retries: int = 2,
        **kwargs: Any,
    ):
        settings = get_settings()
        resolved_key = api_key if api_key is not None else settings.CUSTOM_OPENAI_API_KEY
        resolved_base_url = (base_url or settings.CUSTOM_OPENAI_BASE_URL or DEFAULT_CUSTOM_BASE_URL).rstrip("/")
        resolved_model = default_model or DEFAULT_CUSTOM_MODEL

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
        return "custom_openai"

    def get_display_name(self) -> str:
        return "Custom OpenAI Endpoint"

    def is_configured(self) -> bool:
        """Custom endpoint is considered configured if base_url is specified."""
        return bool(self.base_url and str(self.base_url).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model and requested_model.strip():
            return requested_model.strip()
        return self.default_model or DEFAULT_CUSTOM_MODEL

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "FormatAI/1.0",
        }
        if self.api_key and self.api_key.strip():
            headers["Authorization"] = f"Bearer {self.api_key.strip()}"
        return headers

    async def list_models(self) -> List[ModelInfo]:
        """Dynamically discover models hosted on custom endpoint."""
        if not self.is_configured():
            return [
                ModelInfo(
                    id=self.default_model or DEFAULT_CUSTOM_MODEL,
                    name=self.default_model or DEFAULT_CUSTOM_MODEL,
                    description="Default custom endpoint model",
                    is_default=True,
                )
            ]

        try:
            url = f"{self.base_url}/models"
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
            for item in data.get("data", []):
                m_id = item.get("id")
                if m_id:
                    models.append(
                        ModelInfo(
                            id=m_id,
                            name=m_id,
                            description=f"Available on {self.base_url}",
                            is_default=(m_id == self.default_model),
                        )
                    )
            if models:
                return models
        except Exception as exc:
            logger.warning(f"Custom OpenAI model discovery: {str(exc)}")

        # Fallback to configured default
        return [
            ModelInfo(
                id=self.default_model or DEFAULT_CUSTOM_MODEL,
                name=self.default_model or DEFAULT_CUSTOM_MODEL,
                description=f"Configured model on {self.base_url}",
                is_default=True,
            )
        ]

    async def validate_configuration(self) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="Base URL is not specified for custom OpenAI endpoint.",
            )

        try:
            url = f"{self.base_url}/models"
            resp = await execute_with_retry(
                provider_name=self.get_provider_name(),
                method="GET",
                url=url,
                headers=self._get_headers(),
                timeout=10.0,
                max_retries=0,
            )
            data = resp.json()
            models_list = data.get("data", [])
            count = len(models_list)
            return ProviderValidationResult(
                valid=True,
                provider=self.get_provider_name(),
                message=f"Successfully reached custom endpoint at {self.base_url}.",
                model_count=count,
                details={"base_url": self.base_url},
            )
        except Exception as exc:
            norm = self.normalize_error(exc)
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message=norm.message,
                details={"error_type": norm.error_type, "base_url": self.base_url},
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
        url = f"{self.base_url}/chat/completions"

        payload = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": "You are an expert academic paper formatter."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature if temperature is not None else 0.2,
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
        choices = data.get("choices", [])
        if not choices:
            raise ProviderAPIError(
                message="Custom endpoint returned empty completion choices.",
                provider=self.get_provider_name(),
            )

        first_choice = choices[0]
        content = first_choice.get("message", {}).get("content", "")
        finish_reason = first_choice.get("finish_reason")

        return ProviderResult(
            provider=self.get_provider_name(),
            model=target_model,
            content=content,
            finish_reason=finish_reason,
            metadata={"base_url": self.base_url},
        )

    def normalize_error(self, error: Exception) -> ProviderError:
        if isinstance(error, ProviderError):
            return error
        return ProviderAPIError(
            message=f"Custom endpoint error ({self.base_url}): {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
