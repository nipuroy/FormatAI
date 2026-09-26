"""AI Service orchestrating prompt execution via provider-adapter architecture."""

from typing import Any, Dict, List, Optional
from backend.core.config import get_settings
from backend.models.ai import (
    AIGenerateRequest,
    AIGenerateResponse,
    ProviderDescriptor,
    ProviderSpecificConfig,
    ProviderValidationRequest,
)
from backend.providers.base import BaseAIProvider, ModelInfo, ProviderResult, ProviderValidationResult
from backend.providers.exceptions import (
    ProviderDisabledError,
    ProviderError,
)
from backend.providers.factory import get_ai_provider, list_supported_providers
from backend.utils.logger import get_logger

logger = get_logger("ai_service")


class AIService:
    """Business logic service mediating between API routes and AI providers."""

    def __init__(self, provider: Optional[BaseAIProvider] = None):
        self.settings = get_settings()
        self._default_provider = provider

    def _resolve_provider_instance(
        self,
        provider_name: Optional[str] = None,
        config: Optional[ProviderSpecificConfig] = None,
    ) -> BaseAIProvider:
        """Instantiate an isolated provider adapter with optional client-specific config."""
        if self._default_provider is not None:
            # Use injected provider if no explicit override or if names match
            if not provider_name or provider_name.lower() == self._default_provider.get_provider_name().lower():
                if not config or (not config.api_key and not config.base_url):
                    return self._default_provider

        target_name = (provider_name or self.settings.DEFAULT_AI_PROVIDER).lower()
        cfg = config or ProviderSpecificConfig()

        kwargs: Dict[str, Any] = {}
        if cfg.api_key is not None:
            kwargs["api_key"] = cfg.api_key
        if cfg.base_url is not None:
            kwargs["base_url"] = cfg.base_url
        if cfg.default_model is not None:
            kwargs["default_model"] = cfg.default_model
        if cfg.timeout_seconds is not None:
            kwargs["timeout_seconds"] = cfg.timeout_seconds
        if cfg.max_retries is not None:
            kwargs["max_retries"] = cfg.max_retries
        kwargs["enabled"] = cfg.enabled if cfg.enabled is not None else True

        return get_ai_provider(provider_name=target_name, **kwargs)

    async def generate_text(self, request: AIGenerateRequest) -> AIGenerateResponse:
        """Execute text generation through the selected AI provider.

        Strictly enforces:
        - Provider isolation (no key sharing)
        - Disabled check (will not query disabled providers)
        - Explicit fallback only (does not switch providers unless explicitly configured)
        - Resilience against individual provider failures
        """
        prompt = request.prompt.strip()
        if not prompt:
            raise ProviderError(
                message="Prompt cannot be empty or solely whitespace.",
                provider=request.provider or "unknown",
                error_type="validation_error",
                status_code=400,
            )

        target_provider_name = (request.provider or self.settings.DEFAULT_AI_PROVIDER).lower()
        attempted_providers: List[str] = [target_provider_name]

        # 1. Primary provider execution
        primary_adapter = self._resolve_provider_instance(
            provider_name=target_provider_name,
            config=request.provider_config,
        )

        # Enforce disabled check
        if not primary_adapter.is_enabled():
            raise ProviderDisabledError(
                message=f"Provider '{primary_adapter.get_display_name()}' ({target_provider_name}) is currently disabled.",
                provider=target_provider_name,
            )

        logger.info(
            f"AIService dispatching generation to primary provider='{target_provider_name}', "
            f"model='{request.model or primary_adapter.resolve_model()}'"
        )

        try:
            result = await primary_adapter.generate(
                prompt=prompt,
                model=request.model,
                timeout=request.timeout,
                temperature=request.temperature,
            )
            return AIGenerateResponse(
                success=True,
                provider=result.provider,
                model=result.model,
                content=result.content,
                finish_reason=result.finish_reason,
                fallback_occurred=False,
                attempted_providers=attempted_providers,
                metadata=result.metadata,
            )
        except Exception as primary_error:
            logger.warning(
                f"Primary provider '{target_provider_name}' failed: {str(primary_error)}"
            )

            # Check if fallback is explicitly configured
            if not request.fallback_providers:
                # No fallback configured - fail immediately with primary error
                if isinstance(primary_error, ProviderError):
                    raise primary_error
                raise primary_adapter.normalize_error(primary_error)

            # 2. Explicit Fallback Handling
            logger.info(f"Attempting fallback providers: {request.fallback_providers}")
            last_error: Exception = primary_error

            for fallback_name in request.fallback_providers:
                clean_name = fallback_name.strip().lower()
                if clean_name == target_provider_name or not clean_name:
                    continue

                attempted_providers.append(clean_name)
                try:
                    fallback_adapter = self._resolve_provider_instance(provider_name=clean_name)
                    if not fallback_adapter.is_enabled() or not fallback_adapter.is_configured():
                        logger.info(f"Skipping fallback provider '{clean_name}': disabled or unconfigured.")
                        continue

                    logger.info(f"Executing fallback on provider='{clean_name}'...")
                    fallback_result = await fallback_adapter.generate(
                        prompt=prompt,
                        timeout=request.timeout,
                        temperature=request.temperature,
                    )
                    return AIGenerateResponse(
                        success=True,
                        provider=fallback_result.provider,
                        model=fallback_result.model,
                        content=fallback_result.content,
                        finish_reason=fallback_result.finish_reason,
                        fallback_occurred=True,
                        attempted_providers=attempted_providers,
                        metadata={
                            **fallback_result.metadata,
                            "original_provider": target_provider_name,
                            "fallback_reason": str(primary_error),
                        },
                    )
                except Exception as fb_err:
                    logger.warning(f"Fallback provider '{clean_name}' failed: {str(fb_err)}")
                    last_error = fb_err

            # If all fallbacks failed
            if isinstance(last_error, ProviderError):
                raise last_error
            raise primary_adapter.normalize_error(last_error)

    def get_supported_providers(self) -> List[ProviderDescriptor]:
        """Return catalog of all supported providers and their readiness status."""
        catalog = list_supported_providers()
        return [ProviderDescriptor(**item) for item in catalog]

    async def list_models_for_provider(
        self,
        provider_name: str,
        config: Optional[ProviderSpecificConfig] = None,
    ) -> List[ModelInfo]:
        """Discover or retrieve supported models for a given provider."""
        adapter = self._resolve_provider_instance(provider_name=provider_name, config=config)
        return await adapter.list_models()

    async def validate_provider(
        self,
        provider_name: str,
        request: Optional[ProviderValidationRequest] = None,
    ) -> ProviderValidationResult:
        """Validate connectivity and credentials for a provider safely."""
        config = ProviderSpecificConfig(
            api_key=request.api_key if request else None,
            base_url=request.base_url if request else None,
            default_model=request.model if request else None,
        )
        adapter = self._resolve_provider_instance(provider_name=provider_name, config=config)
        return await adapter.validate_configuration()
