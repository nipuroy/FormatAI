"""OpenRouter AI Provider implementation.

Unified API gateway accessing models from Anthropic, Meta, DeepSeek, Google, and more.
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

logger = get_logger("openrouter_provider")

DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct"

CURATED_OPENROUTER_MODELS: List[ModelInfo] = [
    ModelInfo(
        id="meta-llama/llama-3.3-70b-instruct",
        name="Llama 3.3 70B Instruct",
        description="High-performance open weights model with broad academic reasoning",
        tier="Balanced",
        context_length=131072,
        is_default=True,
    ),
    ModelInfo(
        id="anthropic/claude-3.5-sonnet",
        name="Claude 3.5 Sonnet",
        description="Top-tier nuances in prose style, academic formatting, and structured logic",
        tier="Pro",
        context_length=200000,
    ),
    ModelInfo(
        id="google/gemini-2.5-flash",
        name="Gemini 2.5 Flash (via OpenRouter)",
        description="High throughput low-cost model for rapid document processing",
        tier="Fast",
        context_length=1000000,
    ),
    ModelInfo(
        id="deepseek/deepseek-chat",
        name="DeepSeek V3",
        description="Powerful cost-efficient reasoning and mathematical extraction",
        tier="Fast",
        context_length=64000,
    ),
]


class OpenRouterProvider(BaseAIProvider):
    """OpenRouter universal API provider."""

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
        resolved_key = api_key if api_key is not None else settings.OPENROUTER_API_KEY
        resolved_base_url = (base_url or DEFAULT_OPENROUTER_BASE_URL).rstrip("/")
        resolved_model = default_model or DEFAULT_OPENROUTER_MODEL

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
        return "openrouter"

    def get_display_name(self) -> str:
        return "OpenRouter"

    def is_configured(self) -> bool:
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model and requested_model.strip():
            return requested_model.strip()
        return self.default_model or DEFAULT_OPENROUTER_MODEL

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured():
            raise ProviderConfigurationError(
                message="OpenRouter API key is missing. Set OPENROUTER_API_KEY.",
                provider=self.get_provider_name(),
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://formatai.app",
            "X-Title": "FormatAI Academic Formatter",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> List[ModelInfo]:
        if not self.is_configured():
            return CURATED_OPENROUTER_MODELS

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
            for item in data.get("data", [])[:50]:  # Limit top 50 to avoid massive payload
                m_id = item.get("id")
                if m_id:
                    models.append(
                        ModelInfo(
                            id=m_id,
                            name=item.get("name") or m_id,
                            description=item.get("description", "")[:120] if item.get("description") else None,
                            context_length=item.get("context_length"),
                            is_default=(m_id == DEFAULT_OPENROUTER_MODEL),
                        )
                    )
            if models:
                return models
        except Exception as exc:
            logger.warning(f"OpenRouter model discovery fallback: {str(exc)}")

        return CURATED_OPENROUTER_MODELS

    async def validate_configuration(self) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="OpenRouter API key is missing or empty.",
            )

        try:
            url = f"{self.base_url}/auth/key"
            resp = await execute_with_retry(
                provider_name=self.get_provider_name(),
                method="GET",
                url=url,
                headers=self._get_headers(),
                timeout=10.0,
                max_retries=0,
            )
            data = resp.json()
            label = data.get("data", {}).get("label") or "Active"
            return ProviderValidationResult(
                valid=True,
                provider=self.get_provider_name(),
                message=f"Successfully authenticated with OpenRouter ({label}).",
            )
        except Exception:
            # Fallback to checking /models endpoint if /auth/key is not supported on this account
            try:
                await execute_with_retry(
                    provider_name=self.get_provider_name(),
                    method="GET",
                    url=f"{self.base_url}/models",
                    headers=self._get_headers(),
                    timeout=10.0,
                    max_retries=0,
                )
                return ProviderValidationResult(
                    valid=True,
                    provider=self.get_provider_name(),
                    message="Successfully authenticated with OpenRouter.",
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

        payload = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": "You are an expert scientific writing and LaTeX assistant."},
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
                message="OpenRouter returned empty choices.",
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
            message=f"OpenRouter error: {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
