"""Provider factory to instantiate external AI engine instances."""

from typing import Any, Dict, List, Optional, Type
from backend.core.config import get_settings
from backend.providers.base import BaseAIProvider
from backend.providers.cohere import CohereProvider
from backend.providers.custom_openai import CustomOpenAIProvider
from backend.providers.gemini import GeminiProvider
from backend.providers.groq import GroqProvider
from backend.providers.huggingface import HuggingFaceProvider
from backend.providers.mistral import MistralProvider
from backend.providers.openai_compatible import OpenAICompatibleProvider
from backend.providers.openrouter import OpenRouterProvider

_PROVIDERS: Dict[str, Type[BaseAIProvider]] = {
    "gemini": GeminiProvider,
    "groq": GroqProvider,
    "openrouter": OpenRouterProvider,
    "mistral": MistralProvider,
    "cohere": CohereProvider,
    "huggingface": HuggingFaceProvider,
    "openai": OpenAICompatibleProvider,
    "custom_openai": CustomOpenAIProvider,
}

# Provider descriptions for UI presentation
_PROVIDER_DESCRIPTIONS: Dict[str, str] = {
    "gemini": "Google frontier multimodal models with large context windows and native reasoning.",
    "groq": "Ultra-fast inference on custom LPUs powered by Meta Llama 3 and open models.",
    "openrouter": "Unified router providing access to Claude, Llama, DeepSeek, and hundreds of models.",
    "mistral": "Leading European frontier models including Mistral Large and specialized Codestral.",
    "cohere": "Command R+ enterprise models optimized for document intelligence and synthesis.",
    "huggingface": "Serverless open source models via the Hugging Face Inference API.",
    "openai": "Standard OpenAI GPT-4o, GPT-4o-mini, and reasoning models via official endpoints.",
    "custom_openai": "Connect any local or private OpenAI-compatible endpoint (Ollama, LM Studio, vLLM).",
}


def get_ai_provider(
    provider_name: Optional[str] = None,
    api_key: Optional[str] = None,
    default_model: Optional[str] = None,
    base_url: Optional[str] = None,
    timeout_seconds: Optional[float] = None,
    enabled: bool = True,
    **kwargs: Any,
) -> BaseAIProvider:
    """Instantiate and return the requested AI provider based on configuration.

    Strictly isolates configuration: keys and options passed here are only provided
    to the instantiated adapter and never stored or shared with other providers.
    """
    settings = get_settings()
    target_name = (provider_name or settings.DEFAULT_AI_PROVIDER).lower()

    # Normalize aliases
    if target_name in ("google", "google_gemini"):
        target_name = "gemini"
    elif target_name in ("hf", "hugging_face"):
        target_name = "huggingface"
    elif target_name in ("custom", "local", "ollama"):
        target_name = "custom_openai"

    provider_cls = _PROVIDERS.get(target_name)
    if not provider_cls:
        raise ValueError(
            f"Unsupported AI provider: '{target_name}'. Supported providers: {list(_PROVIDERS.keys())}"
        )

    init_kwargs: Dict[str, Any] = {
        "enabled": enabled,
    }
    if api_key is not None:
        init_kwargs["api_key"] = api_key
    if default_model is not None:
        init_kwargs["default_model"] = default_model
    if base_url is not None:
        init_kwargs["base_url"] = base_url
    if timeout_seconds is not None:
        init_kwargs["timeout_seconds"] = timeout_seconds

    init_kwargs.update(kwargs)
    return provider_cls(**init_kwargs)


def list_supported_providers() -> List[Dict[str, Any]]:
    """Return overview of all supported AI providers without exposing sensitive keys."""
    catalog: List[Dict[str, Any]] = []
    for pid, cls in _PROVIDERS.items():
        try:
            instance = cls()
            catalog.append(
                {
                    "id": pid,
                    "name": instance.get_display_name(),
                    "description": _PROVIDER_DESCRIPTIONS.get(pid, ""),
                    "is_configured": instance.is_configured(),
                    "is_enabled": instance.is_enabled(),
                    "default_model": instance.default_model,
                    "supports_discovery": pid in ("gemini", "groq", "openrouter", "mistral", "cohere", "openai", "custom_openai"),
                    "requires_base_url": pid == "custom_openai",
                }
            )
        except Exception:
            catalog.append(
                {
                    "id": pid,
                    "name": pid.title(),
                    "description": _PROVIDER_DESCRIPTIONS.get(pid, ""),
                    "is_configured": False,
                    "is_enabled": True,
                    "default_model": None,
                    "supports_discovery": False,
                    "requires_base_url": pid == "custom_openai",
                }
            )
    return catalog
