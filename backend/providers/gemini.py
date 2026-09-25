"""Google Gemini AI Provider implementation.

Supports model selection, prompt execution, response extraction,
timeout enforcement, and provider-specific error normalization.
"""

import asyncio
from typing import Any, Dict, Optional
from backend.core.config import get_settings
from backend.providers.base import BaseAIProvider, ProviderResult
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.utils.logger import get_logger

logger = get_logger("gemini_provider")

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_TIMEOUT_SECONDS = 30.0


class GeminiProvider(BaseAIProvider):
    """Google Gemini provider conforming to BaseAIProvider contract."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        client: Optional[Any] = None,
    ):
        settings = get_settings()
        resolved_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        resolved_model = default_model or settings.DEFAULT_MODEL_NAME or DEFAULT_GEMINI_MODEL

        super().__init__(
            api_key=resolved_key,
            default_model=resolved_model,
            timeout_seconds=timeout_seconds,
        )
        self._client = client

    def get_provider_name(self) -> str:
        return "gemini"

    def is_configured(self) -> bool:
        """Verify whether an API key is configured without exposing it."""
        return bool(self.api_key and str(self.api_key).strip())

    def resolve_model(self, requested_model: Optional[str] = None) -> str:
        """Resolve requested model or fall back to configured default."""
        if requested_model and requested_model.strip():
            return requested_model.strip()
        return self.default_model or DEFAULT_GEMINI_MODEL

    def _get_client(self) -> Any:
        """Instantiate or return the Google GenAI SDK client."""
        if self._client is not None:
            return self._client

        if not self.is_configured():
            raise ProviderConfigurationError(
                message="Gemini API key is missing. Please set GEMINI_API_KEY in your environment or .env file.",
                provider=self.get_provider_name(),
            )

        try:
            # Official Google GenAI SDK
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
            return self._client
        except ImportError:
            # Fallback check for google-generativeai legacy package
            try:
                import google.generativeai as legacy_genai
                legacy_genai.configure(api_key=self.api_key)
                self._client = legacy_genai
                return self._client
            except ImportError:
                raise ProviderConfigurationError(
                    message="Google GenAI SDK is not installed. Install google-genai package.",
                    provider=self.get_provider_name(),
                )

    async def generate_text(
        self,
        prompt: str,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> ProviderResult:
        """Generate text using Google Gemini API."""
        if not prompt or not prompt.strip():
            raise ProviderError(
                message="Prompt must not be empty.",
                provider=self.get_provider_name(),
                error_type="validation_error",
                status_code=400,
            )

        target_model = self.resolve_model(model)
        request_timeout = timeout if timeout is not None else self.timeout_seconds

        logger.info(f"Submitting prompt to Gemini provider (model='{target_model}')")

        try:
            client = self._get_client()

            # Execute generation inside asyncio timeout
            result = await asyncio.wait_for(
                self._execute_generation(client, target_model, prompt),
                timeout=request_timeout,
            )
            return result

        except asyncio.TimeoutError:
            logger.warning(f"Gemini generation timed out after {request_timeout} seconds.")
            raise ProviderTimeoutError(
                message=f"Gemini API request timed out after {request_timeout} seconds.",
                provider=self.get_provider_name(),
            )
        except ProviderError:
            # Re-raise already normalized provider errors
            raise
        except Exception as exc:
            normalized = self.normalize_error(exc)
            logger.error(f"Gemini provider error: {str(normalized)}")
            raise normalized

    async def _execute_generation(self, client: Any, model: str, prompt: str) -> ProviderResult:
        """Internal synchronous/asynchronous execution bridge."""
        loop = asyncio.get_running_loop()

        def _call_api() -> ProviderResult:
            # Case 1: Custom mock or duck-typed client supporting generate_content
            if hasattr(client, "models") and hasattr(client.models, "generate_content"):
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                )
                text = getattr(resp, "text", "") or ""
                finish_reason = None
                if hasattr(resp, "candidates") and resp.candidates:
                    first_candidate = resp.candidates[0]
                    finish_reason = getattr(first_candidate, "finish_reason", None)
                    if finish_reason:
                        finish_reason = str(finish_reason)

                return ProviderResult(
                    provider=self.get_provider_name(),
                    model=model,
                    content=text,
                    finish_reason=finish_reason,
                )

            # Case 2: Legacy google.generativeai or GenerativeModel
            if hasattr(client, "GenerativeModel"):
                gen_model = client.GenerativeModel(model)
                resp = gen_model.generate_content(prompt)
                return ProviderResult(
                    provider=self.get_provider_name(),
                    model=model,
                    content=getattr(resp, "text", "") or "",
                )

            # Case 3: Callable client or mock function
            if callable(client):
                output = client(model=model, prompt=prompt)
                if isinstance(output, ProviderResult):
                    return output
                return ProviderResult(
                    provider=self.get_provider_name(),
                    model=model,
                    content=str(output),
                )

            raise ProviderAPIError(
                message="Client does not support generate_content operation.",
                provider=self.get_provider_name(),
            )

        return await loop.run_in_executor(None, _call_api)

    def normalize_error(self, error: Exception) -> Exception:
        """Normalize Gemini-specific SDK errors into standard ProviderError hierarchy."""
        err_msg = str(error)
        err_type_name = type(error).__name__.lower()

        # Check for authentication / API key failures
        if any(keyword in err_msg.lower() for keyword in ["api_key", "unauthenticated", "invalid api key", "401"]):
            return ProviderAuthenticationError(
                message="Invalid or unauthorized Gemini API key.",
                provider=self.get_provider_name(),
            )

        # Check for rate limiting / quota errors
        if any(keyword in err_msg.lower() for keyword in ["quota", "resource_exhausted", "rate limit", "429"]):
            return ProviderRateLimitError(
                message="Gemini API rate limit or quota exceeded.",
                provider=self.get_provider_name(),
            )

        # Check for network / timeout issues
        if "timeout" in err_type_name or "timeout" in err_msg.lower():
            return ProviderTimeoutError(
                message=f"Gemini request timed out: {err_msg}",
                provider=self.get_provider_name(),
            )

        # General API or server errors
        return ProviderAPIError(
            message=f"Gemini API failure: {err_msg}",
            provider=self.get_provider_name(),
            status_code=502,
        )
