"""AI Service orchestrating prompt execution via provider abstraction."""

from typing import Optional
from backend.core.config import get_settings
from backend.models.ai import AIGenerateRequest, AIGenerateResponse
from backend.providers.base import BaseAIProvider
from backend.providers.factory import get_ai_provider
from backend.providers.exceptions import ProviderError
from backend.utils.logger import get_logger

logger = get_logger("ai_service")


class AIService:
    """Business logic service mediating between API routes and AI providers."""

    def __init__(self, provider: Optional[BaseAIProvider] = None):
        self.settings = get_settings()
        self.provider = provider or get_ai_provider()

    async def generate_text(self, request: AIGenerateRequest) -> AIGenerateResponse:
        """Execute text generation through the configured AI provider.

        Communicates purely with BaseAIProvider abstraction, insulating the service
        from provider-specific SDK internals.
        """
        prompt = request.prompt.strip()
        if not prompt:
            raise ProviderError(
                message="Prompt cannot be empty or solely whitespace.",
                provider=self.provider.get_provider_name(),
                error_type="validation_error",
                status_code=400,
            )

        logger.info(
            f"AIService dispatching generation to provider='{self.provider.get_provider_name()}', "
            f"model='{request.model or self.provider.resolve_model()}'"
        )

        # Call provider through abstract interface
        result = await self.provider.generate_text(
            prompt=prompt,
            model=request.model,
        )

        return AIGenerateResponse(
            success=True,
            provider=result.provider,
            model=result.model,
            content=result.content,
            finish_reason=result.finish_reason,
        )
