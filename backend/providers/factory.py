"""Provider factory to instantiate external AI engine instances."""

from typing import Dict, Optional, Type
from backend.core.config import get_settings
from backend.providers.base import BaseAIProvider
from backend.providers.gemini import GeminiProvider

_PROVIDERS: Dict[str, Type[BaseAIProvider]] = {
    "gemini": GeminiProvider,
}


def get_ai_provider(provider_name: Optional[str] = None) -> BaseAIProvider:
    """Instantiate and return the requested AI provider based on configuration."""
    settings = get_settings()
    target_name = (provider_name or settings.DEFAULT_AI_PROVIDER).lower()

    provider_cls = _PROVIDERS.get(target_name)
    if not provider_cls:
        raise ValueError(
            f"Unsupported AI provider: '{target_name}'. Supported providers: {list(_PROVIDERS.keys())}"
        )

    return provider_cls()
