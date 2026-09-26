"""Google Gemini AI Provider implementation.

Supports model selection, prompt execution, response extraction,
timeout enforcement, model discovery, validation, and provider-specific error normalization.
"""

import asyncio
from typing import Any, Dict, List, Optional
from backend.core.config import get_settings
from backend.providers.base import BaseAIProvider, ModelInfo, ProviderResult, ProviderValidationResult
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderDisabledError,
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.utils.logger import get_logger

logger = get_logger("gemini_provider")

DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
DEFAULT_TIMEOUT_SECONDS = 30.0

CURATED_GEMINI_MODELS: List[ModelInfo] = [
    ModelInfo(
        id="gemini-3.8-flash",
        name="Gemini 3.8 Flash",
        description="Recommended default model for rapid academic structuring and text formatting",
        tier="Fast",
        context_length=1048576,
        is_default=True,
    ),
    ModelInfo(
        id="gemini-3.1-pro-preview",
        name="Gemini 3.1 Pro Preview",
        description="Advanced reasoning for dense mathematical derivations and rigorous citations",
        tier="Pro",
        context_length=2097152,
    ),
    ModelInfo(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        description="High-speed academic formatting, LaTeX extraction, and synthesis",
        tier="Fast",
        context_length=1048576,
    ),
]


class GeminiProvider(BaseAIProvider):
    """Google Gemini provider conforming to BaseAIProvider contract."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        enabled: bool = True,
        client: Optional[Any] = None,
        **kwargs: Any,
    ):
        settings = get_settings()
        resolved_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        resolved_model = default_model or settings.DEFAULT_MODEL_NAME or DEFAULT_GEMINI_MODEL

        super().__init__(
            api_key=resolved_key,
            default_model=resolved_model,
            timeout_seconds=timeout_seconds,
            enabled=enabled,
            **kwargs,
        )
        self._client = client

    def get_provider_name(self) -> str:
        return "gemini"

    def get_display_name(self) -> str:
        return "Google Gemini"

    def is_configured(self) -> bool:
        """Verify whether an API key is configured without exposing it."""
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        """Resolve requested model or fall back to configured default."""
        if requested_model and requested_model.strip():
            clean = requested_model.strip()
            # Guard against foreign model identifiers being passed to Gemini
            if any(
                foreign in clean.lower()
                for foreign in [
                    "llama",
                    "mistral",
                    "codestral",
                    "gpt",
                    "o1",
                    "o3",
                    "claude",
                    "command",
                    "deepseek",
                    "qwen",
                    "phi",
                ]
            ):
                logger.warning(
                    f"Model '{clean}' is incompatible with Google Gemini. Resolving to default '{self.default_model or DEFAULT_GEMINI_MODEL}'."
                )
                return self.default_model or DEFAULT_GEMINI_MODEL
            return clean
        return self.default_model or DEFAULT_GEMINI_MODEL

    def _get_client(self) -> Any:
        """Instantiate or return the Google GenAI SDK client."""
        if self._client is not None:
            return self._client

        if not self.is_configured():
            raise ProviderConfigurationError(
                message="Gemini API key is missing. Please configure GEMINI_API_KEY.",
                provider=self.get_provider_name(),
            )

        try:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
            return self._client
        except ImportError:
            try:
                import google.generativeai as legacy_genai
                legacy_genai.configure(api_key=self.api_key)
                self._client = legacy_genai
                return self._client
            except ImportError:
                raise ProviderConfigurationError(
                    message="Google GenAI SDK is not installed.",
                    provider=self.get_provider_name(),
                )

    async def list_models(self) -> List[ModelInfo]:
        """Discover models via Gemini SDK or return curated academic list."""
        if not self.is_configured():
            return CURATED_GEMINI_MODELS

        try:
            client = self._get_client()
            if hasattr(client, "models") and hasattr(client.models, "list"):
                discovered: List[ModelInfo] = []
                # Run synchronous SDK model listing in thread
                models_iter = await asyncio.to_thread(client.models.list)
                for m in models_iter:
                    m_id = getattr(m, "name", None) or getattr(m, "id", "")
                    # strip 'models/' prefix if present
                    clean_id = m_id.replace("models/", "")
                    if "gemini" in clean_id:
                        discovered.append(
                            ModelInfo(
                                id=clean_id,
                                name=getattr(m, "display_name", None) or clean_id,
                                description=getattr(m, "description", None),
                                is_default=(clean_id == DEFAULT_GEMINI_MODEL),
                            )
                        )
                if discovered:
                    return discovered
        except Exception as exc:
            logger.warning(f"Gemini live model discovery fallback to curated: {str(exc)}")

        return CURATED_GEMINI_MODELS

    async def validate_configuration(self) -> ProviderValidationResult:
        """Test API key and reachability safely without generating full output."""
        if not self.is_configured():
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message="API key is missing or empty.",
            )

        try:
            client = self._get_client()
            # Lightweight verification: list models or ping
            if hasattr(client, "models") and hasattr(client.models, "list"):
                await asyncio.to_thread(lambda: next(iter(client.models.list()), None))
            return ProviderValidationResult(
                valid=True,
                provider=self.get_provider_name(),
                message="Successfully authenticated with Google Gemini API.",
                model_count=len(CURATED_GEMINI_MODELS),
            )
        except Exception as exc:
            normalized = self.normalize_error(exc)
            return ProviderValidationResult(
                valid=False,
                provider=self.get_provider_name(),
                message=normalized.message,
                details={"error_type": normalized.error_type},
            )

    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        temperature: Optional[float] = None,
        **kwargs: Any,
    ) -> ProviderResult:
        """Generate text using Google Gemini API."""
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
        client = self._get_client()

        logger.info(
            f"Calling Gemini API (model='{target_model}', timeout={effective_timeout}s, chars={len(prompt)})"
        )

        try:
            attempts = 0
            max_attempts = self.max_retries + 1
            last_err: Optional[Exception] = None

            while attempts < max_attempts:
                attempts += 1
                try:
                    coro = asyncio.to_thread(
                        self._invoke_client,
                        client,
                        target_model,
                        prompt,
                        temperature,
                    )
                    result = await asyncio.wait_for(coro, timeout=effective_timeout)
                    return result
                except Exception as invoke_err:
                    last_err = invoke_err
                    err_text = str(invoke_err).lower()
                    if ("503" in err_text or "unavailable" in err_text or "high demand" in err_text) and attempts < max_attempts:
                        logger.warning(f"Gemini transient 503 (attempt {attempts}/{max_attempts}). Retrying in 1s...")
                        await asyncio.sleep(1.0)
                        continue
                    raise invoke_err

            if last_err:
                raise last_err

        except asyncio.TimeoutError:
            raise ProviderTimeoutError(
                message=f"Gemini API request timed out after {effective_timeout:.1f} seconds.",
                provider=self.get_provider_name(),
                details={"model": target_model, "timeout": effective_timeout},
            )
        except Exception as exc:
            normalized = self.normalize_error(exc)
            logger.error(f"Gemini error [{normalized.error_type}]: {normalized.message}")
            raise normalized

    def _invoke_client(
        self,
        client: Any,
        model: str,
        prompt: str,
        temperature: Optional[float] = None,
    ) -> ProviderResult:
        """Synchronous wrapper for Google GenAI SDK execution."""
        from google import genai
        from google.genai import types

        config = types.GenerateContentConfig(
            temperature=temperature if temperature is not None else 0.3,
        )

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )

        content = response.text or ""
        finish_reason = None
        if hasattr(response, "candidates") and response.candidates:
            finish_reason = str(getattr(response.candidates[0], "finish_reason", "STOP"))

        return ProviderResult(
            provider=self.get_provider_name(),
            model=model,
            content=content,
            finish_reason=finish_reason,
            metadata={"sdk": "google-genai"},
        )

    def normalize_error(self, error: Exception) -> ProviderError:
        """Classify Gemini exceptions into standard ProviderError hierarchy."""
        if isinstance(error, ProviderError):
            return error

        error_str = str(error).lower()

        if "api_key" in error_str or "unauthorized" in error_str or "401" in error_str:
            return ProviderAuthenticationError(
                message="Invalid or missing Gemini API key. Please check your credentials.",
                provider=self.get_provider_name(),
                details={"original_error": str(error)},
            )
        elif "quota" in error_str or "resource_exhausted" in error_str or "429" in error_str:
            return ProviderRateLimitError(
                message="Gemini API quota or rate limit exceeded. Please wait a moment.",
                provider=self.get_provider_name(),
                details={"original_error": str(error)},
            )
        elif "deadline" in error_str or "timed out" in error_str:
            return ProviderTimeoutError(
                message="Gemini API request exceeded execution deadline.",
                provider=self.get_provider_name(),
                details={"original_error": str(error)},
            )
        elif "disabled" in error_str:
            return ProviderDisabledError(
                message=str(error),
                provider=self.get_provider_name(),
            )

        return ProviderAPIError(
            message=f"Gemini generation failed: {str(error)}",
            provider=self.get_provider_name(),
            details={"original_error": str(error)},
        )
