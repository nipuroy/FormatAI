"""Standard OpenAI-compatible AI Provider implementation.

Supports OpenAI endpoints (GPT-4o, GPT-4o-mini, o3-mini) and compliant gateways.
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

logger = get_logger("openai_provider")

DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

CURATED_OPENAI_MODELS: List[ModelInfo] = [
    ModelInfo(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        description="Fast, cost-efficient model with excellent academic structure and markdown parsing",
        tier="Fast",
        context_length=128000,
        is_default=True,
    ),
    ModelInfo(
        id="gpt-4o",
        name="GPT-4o",
        description="Flagship multimodal model with deep analytical reasoning and formatting precision",
        tier="Pro",
        context_length=128000,
    ),
    ModelInfo(
        id="o3-mini",
        name="o3 Mini",
        description="Specialized high-reasoning model for complex math, STEM, and logic tasks",
        tier="Reasoning",
        context_length=200000,
    ),
    ModelInfo(
        id="gpt-4-turbo",
        name="GPT-4 Turbo",
        description="High-capacity standard frontier model",
        tier="Standard",
        context_length=128000,
    ),
]


class OpenAICompatibleProvider(BaseAIProvider):
    """OpenAI API provider conforming to standard /v1 endpoints."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 30.0,
        enabled: bool = True,
        max_retries: int = 2,
        organization: Optional[str] = None,
        **kwargs: Any,
    ):
        settings = get_settings()
        resolved_key = api_key if api_key is not None else settings.OPENAI_API_KEY
        resolved_base_url = (base_url or settings.OPENAI_BASE_URL or DEFAULT_OPENAI_BASE_URL).rstrip("/")
        resolved_model = default_model or DEFAULT_OPENAI_MODEL

        super().__init__(
            api_key=resolved_key,
            default_model=resolved_model,
            base_url=resolved_base_url,
            timeout_seconds=timeout_seconds,
            enabled=enabled,
            max_retries=max_retries,
            **kwargs,
        )
        self.organization = organization

    def get_provider_name(self) -> str:
        return "openai"

    def get_display_name(self) -> str:
        return "OpenAI"

    def is_configured(self) -> bool:
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model and requested_model.strip():
            return requested_model.strip()
        return self.default_model or DEFAULT_OPENAI_MODEL

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured():
            raise ProviderConfigurationError(
                message="OpenAI API key is missing. Please set OPENAI_API_KEY.",
                provider=self.get_provider_name(),
            )
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.organization:
            headers["OpenAI-Organization"] = self.organization
        return headers

    async def list_models(self) -> List[ModelInfo]:
        if not self.is_configured():
            return CURATED_OPENAI_MODELS

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
                if m_id and any(prefix in m_id for prefix in ("gpt", "o1", "o3", "chatgpt")):
                    models.append(
                        ModelInfo(
                            id=m_id,
                            name=m_id,
                            description=f"OpenAI Model ({item.get('owned_by', 'openai')})",
                            is_default=(m_id == DEFAULT_OPENAI_MODEL),
                        )
                    )
            if models:
                # Sort so gpt-4o, gpt-4o-mini appear near top
                return sorted(models, key=lambda m: (not m.is_default, m.id))
        except Exception as exc:
            logger.warning(f"OpenAI live model discovery fallback: {str(exc)}")

        return CURATED_OPENAI_MODELS

    async def validate_configuration(self) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="OpenAI API key is missing or empty.",
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
            count = len(data.get("data", []))
            return ProviderValidationResult(
                valid=True,
                provider=self.get_provider_name(),
                message="Successfully verified connection to OpenAI API.",
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
        url = f"{self.base_url}/chat/completions"

        payload: Dict[str, Any] = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": "You are a scientific academic editing assistant."},
                {"role": "user", "content": prompt},
            ],
        }
        # o1 / o3 models don't support custom temperature parameter
        if not target_model.startswith("o1") and not target_model.startswith("o3"):
            payload["temperature"] = temperature if temperature is not None else 0.2

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
                message="OpenAI returned empty completion choices.",
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
            metadata={"usage": data.get("usage", {})},
        )

    def normalize_error(self, error: Exception) -> ProviderError:
        if isinstance(error, ProviderError):
            return error
        return ProviderAPIError(
            message=f"OpenAI error: {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
