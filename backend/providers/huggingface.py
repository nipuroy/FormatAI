"""Hugging Face AI Provider implementation.

Access serverless open source models via Hugging Face Inference API.
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

logger = get_logger("hf_provider")

DEFAULT_HF_BASE_URL = "https://router.huggingface.co/hf-inference/v1"
DEFAULT_HF_MODEL = "meta-llama/Meta-Llama-3-8B-Instruct"

CURATED_HF_MODELS: List[ModelInfo] = [
    ModelInfo(
        id="meta-llama/Meta-Llama-3-8B-Instruct",
        name="Llama 3 8B Instruct",
        description="Popular open weights instruction model for versatile academic formatting",
        tier="Balanced",
        context_length=8192,
        is_default=True,
    ),
    ModelInfo(
        id="mistralai/Mistral-7B-Instruct-v0.3",
        name="Mistral 7B Instruct v0.3",
        description="High-efficiency lightweight model with strong language and formatting capabilities",
        tier="Fast",
        context_length=32768,
    ),
    ModelInfo(
        id="Qwen/Qwen2.5-72B-Instruct",
        name="Qwen 2.5 72B Instruct",
        description="Top-tier open reasoning, math, and scientific derivation model",
        tier="Pro",
        context_length=32768,
    ),
    ModelInfo(
        id="microsoft/Phi-3.5-mini-instruct",
        name="Phi 3.5 Mini Instruct",
        description="Extremely efficient small language model with outstanding benchmark scores",
        tier="Fast",
        context_length=128000,
    ),
]


class HuggingFaceProvider(BaseAIProvider):
    """Hugging Face Inference API provider."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: float = 35.0,
        enabled: bool = True,
        max_retries: int = 2,
        **kwargs: Any,
    ):
        settings = get_settings()
        resolved_key = api_key if api_key is not None else (settings.HUGGINGFACE_API_KEY or settings.HF_TOKEN)
        resolved_base_url = (base_url or DEFAULT_HF_BASE_URL).rstrip("/")
        resolved_model = default_model or DEFAULT_HF_MODEL

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
        return "huggingface"

    def get_display_name(self) -> str:
        return "Hugging Face"

    def is_configured(self) -> bool:
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        if requested_model and requested_model.strip():
            clean = requested_model.strip()
            if any(foreign in clean.lower() for foreign in ["gemini", "claude", "gpt-", "command"]):
                logger.warning(
                    f"Model '{clean}' is incompatible with Hugging Face. Falling back to default '{self.default_model or DEFAULT_HF_MODEL}'."
                )
                return self.default_model or DEFAULT_HF_MODEL
            return clean
        return self.default_model or DEFAULT_HF_MODEL

    def _get_headers(self) -> Dict[str, str]:
        if not self.is_configured():
            raise ProviderConfigurationError(
                message="Hugging Face User Access Token is missing. Please set HUGGINGFACE_API_KEY or HF_TOKEN.",
                provider=self.get_provider_name(),
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> List[ModelInfo]:
        return CURATED_HF_MODELS

    async def validate_configuration(self) -> ProviderValidationResult:
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="Hugging Face API token is missing or empty.",
            )

        try:
            # Query whoami endpoint on Hugging Face
            url = "https://huggingface.co/api/whoami-v2"
            resp = await execute_with_retry(
                provider_name=self.get_provider_name(),
                method="GET",
                url=url,
                headers=self._get_headers(),
                timeout=10.0,
                max_retries=0,
            )
            data = resp.json()
            user_name = data.get("name") or "User"
            return ProviderValidationResult(
                valid=True,
                provider=self.get_provider_name(),
                message=f"Successfully authenticated as Hugging Face user '{user_name}'.",
                model_count=len(CURATED_HF_MODELS),
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

        # Hugging Face serverless router endpoint supports OpenAI chat completions format
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": target_model,
            "messages": [
                {"role": "system", "content": "You are an expert academic text editor and proofreader."},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature if temperature is not None else 0.2,
            "max_tokens": 2048,
        }

        try:
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
            if choices:
                first = choices[0]
                content = first.get("message", {}).get("content", "")
                return ProviderResult(
                    provider=self.get_provider_name(),
                    model=target_model,
                    content=content,
                    finish_reason=first.get("finish_reason"),
                )
        except Exception as primary_exc:
            # Fallback to direct model inference endpoint if router format had an issue
            fallback_url = f"https://api-inference.huggingface.co/models/{target_model}"
            try:
                resp = await execute_with_retry(
                    provider_name=self.get_provider_name(),
                    method="POST",
                    url=fallback_url,
                    headers=headers,
                    json_data={"inputs": prompt, "parameters": {"max_new_tokens": 1500, "temperature": 0.2}},
                    timeout=effective_timeout,
                    max_retries=1,
                )
                data = resp.json()
                if isinstance(data, list) and data and "generated_text" in data[0]:
                    return ProviderResult(
                        provider=self.get_provider_name(),
                        model=target_model,
                        content=data[0]["generated_text"],
                    )
            except Exception:
                pass
            raise self.normalize_error(primary_exc)

        raise ProviderAPIError(
            message="Hugging Face returned unrecognized response format.",
            provider=self.get_provider_name(),
        )

    def normalize_error(self, error: Exception) -> ProviderError:
        if isinstance(error, ProviderError):
            return error
        return ProviderAPIError(
            message=f"Hugging Face error: {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
