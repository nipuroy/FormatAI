"""Mistral AI Provider implementation.

Advanced European frontier reasoning and code generation models.
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

logger = get_logger("mistral_provider")

DEFAULT_MISTRAL_BASE_URL = "https://api.mistral.ai/v1"
DEFAULT_MISTRAL_MODEL = "mistral-large-latest"

CURATED_MISTRAL_MODELS: List[ModelInfo] = [
    ModelInfo(
        id="mistral-large-latest",
        name="Mistral Large",
        description="Flagship model for high-reasoning academic synthesis, multilingual nuances, and precision",
        tier="Pro",
        context_length=128000,
        is_default=True,
    ),
    ModelInfo(
        id="mistral-small-latest",
        name="Mistral Small",
        description="Fast and cost-efficient for document proofreading and structural cleanup",
        tier="Fast",
        context_length=32000,
    ),
    ModelInfo(
        id="codestral-latest",
        name="Codestral",
        description="Specialized for mathematical formulations, LaTeX scripts, and computational workflows",
        tier="Code",
        context_length=32000,
    ),
    ModelInfo(
        id="open-mistral-nemo",
        name="Mistral NeMo",
        description="Leading open-weights multilingual model built with NVIDIA",
        tier="Balanced",
        context_length=128000,
    ),
]


class MistralProvider(BaseAIProvider):
    """Mistral AI provider implementation."""

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
        resolved_key = api_key if api_key is not None else settings.MISTRAL_API_KEY
        resolved_base_url = (base_url or DEFAULT_MISTRAL_BASE_URL).rstrip("/")
        resolved_model = default_model or DEFAULT_MISTRAL_MODEL

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
        return "mistral"

    def get_display_name(self) -> str:
        return "Mistral AI"

    def is_configured(self) -> bool:
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model and requested_model.strip():
            clean = requested_model.strip()
            if any(foreign in clean.lower() for foreign in ["gemini", "claude", "gpt-", "command", "llama", "o1-", "o3-"]):
                logger.warning(
                    f"Model '{clean}' is incompatible with Mistral. Falling back to default '{self.default_model or DEFAULT_MISTRAL_MODEL}'."
                )
                return self.default_model or DEFAULT_MISTRAL_MODEL
            return clean
        return self.default_model or DEFAULT_MISTRAL_MODEL

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured():
            raise ProviderConfigurationError(
                message="Mistral API key is not configured. Please set MISTRAL_API_KEY.",
                provider=self.get_provider_name(),
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def list_models(self) -> List[ModelInfo]:
        if not self.is_configured():
            return CURATED_MISTRAL_MODELS

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
                            description=item.get("description"),
                            is_default=(m_id == DEFAULT_MISTRAL_MODEL),
                        )
                    )
            if models:
                return models
        except Exception as exc:
            logger.warning(f"Mistral live model discovery fallback: {str(exc)}")

        return CURATED_MISTRAL_MODELS

    async def validate_configuration(self) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="Mistral API key is missing or empty.",
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
                message="Successfully verified connection to Mistral API.",
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

        payload = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": "You are a professional academic editor and LaTeX formatter."},
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
                message="Mistral returned empty choices.",
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
            message=f"Mistral API error: {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
