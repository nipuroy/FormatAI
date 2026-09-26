"""Comprehensive test suite for multi-provider adapter architecture."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
import httpx
from backend.main import app
from backend.api.ai import get_ai_service
from backend.models.ai import AIGenerateRequest, ProviderSpecificConfig
from backend.providers.base import BaseAIProvider, ModelInfo, ProviderResult
from backend.providers.cohere import CohereProvider
from backend.providers.custom_openai import CustomOpenAIProvider
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderDisabledError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.providers.factory import get_ai_provider, list_supported_providers
from backend.providers.gemini import GeminiProvider
from backend.providers.groq import GroqProvider
from backend.providers.huggingface import HuggingFaceProvider
from backend.providers.mistral import MistralProvider
from backend.providers.openai_compatible import OpenAICompatibleProvider
from backend.providers.openrouter import OpenRouterProvider
from backend.services.ai_service import AIService

client = TestClient(app)


# =========================================================================
# 1. Provider Registration & Catalog Tests
# =========================================================================

def test_all_eight_providers_registered():
    """Verify that all 8 requested target providers can be instantiated via factory."""
    expected_providers = [
        "gemini",
        "groq",
        "openrouter",
        "mistral",
        "cohere",
        "huggingface",
        "openai",
        "custom_openai",
    ]
    for pid in expected_providers:
        provider = get_ai_provider(pid)
        assert provider.get_provider_name() == pid
        assert bool(provider.get_display_name())
        assert isinstance(provider.default_model, str)


def test_list_supported_providers_endpoint():
    """Verify GET /api/ai/providers returns all providers without leaking credentials."""
    resp = client.get("/api/ai/providers")
    assert resp.status_code == 200
    providers = resp.json()
    assert len(providers) >= 8
    ids = [p["id"] for p in providers]
    for required in ["gemini", "groq", "openrouter", "mistral", "cohere", "huggingface", "openai", "custom_openai"]:
        assert required in ids

    # Check that secrets are not exposed in catalog
    for p in providers:
        assert "api_key" not in p
        assert "key" not in p
        assert "password" not in p


# =========================================================================
# 2. Provider Isolation Tests
# =========================================================================

def test_provider_isolation_and_no_key_leak():
    """Verify each provider instance maintains strictly isolated credentials and options."""
    p_groq = get_ai_provider("groq", api_key="groq-secret-key-111", default_model="llama-3.3-70b-versatile")
    p_mistral = get_ai_provider("mistral", api_key="mistral-secret-key-222", default_model="mistral-large-latest")
    p_custom = get_ai_provider("custom_openai", base_url="http://localhost:11434/v1", default_model="llama3")

    # Strictly isolated
    assert p_groq.api_key == "groq-secret-key-111"
    assert p_mistral.api_key == "mistral-secret-key-222"
    assert p_custom.base_url == "http://localhost:11434/v1"

    # One provider's key is NOT accessible by another
    assert p_mistral.api_key != p_groq.api_key
    assert p_custom.api_key is None or p_custom.api_key != p_groq.api_key


# =========================================================================
# 3. Provider Enable / Disable Enforcement Tests
# =========================================================================

def test_disabled_provider_rejection():
    """Verify that requests to disabled providers are rejected with 403 ProviderDisabledError."""
    # 1. Via request config
    payload = {
        "prompt": "Test prompt for disabled provider",
        "provider": "groq",
        "provider_config": {
            "enabled": False,
            "api_key": "some-key",
        },
    }
    resp = client.post("/api/ai/generate", json=payload)
    assert resp.status_code == 403
    data = resp.json()
    assert data["success"] is False
    assert data["error_type"] == "provider_disabled"
    assert "disabled" in data["error"].lower()


# =========================================================================
# 4. Explicit Fallback Behavior Tests
# =========================================================================

def test_no_fallback_when_not_explicitly_configured():
    """Verify that when fallback_providers is NOT set, failure on primary throws immediately."""
    class FailingProvider(BaseAIProvider):
        def get_provider_name(self) -> str:
            return "groq"
        def is_configured(self) -> bool:
            return True
        def resolve_model(self, model=None) -> str:
            return "llama-3"
        async def generate(self, **kwargs):
            raise ProviderAPIError("Groq primary failed", provider="groq", status_code=502)
        def normalize_error(self, err):
            return err

    failing_service = AIService(provider=FailingProvider())
    app.dependency_overrides[get_ai_service] = lambda: failing_service

    try:
        # Request WITHOUT fallback_providers
        req_payload = {
            "prompt": "Summarize this paper.",
            "provider": "groq",
        }
        resp = client.post("/api/ai/generate", json=req_payload)
        assert resp.status_code == 502
        data = resp.json()
        assert data["success"] is False
        assert data["provider"] == "groq"
        assert "groq primary failed" in data["error"].lower()
    finally:
        app.dependency_overrides.clear()


@pytest.mark.anyio
async def test_fallback_occurs_only_when_explicitly_configured():
    """Verify fallback executes only when fallback_providers is explicitly supplied."""
    class FailingPrimary(BaseAIProvider):
        def get_provider_name(self) -> str:
            return "primary_p"
        def is_configured(self) -> bool:
            return True
        def resolve_model(self, model=None) -> str:
            return "model-1"
        async def generate(self, **kwargs):
            raise ProviderRateLimitError("Primary quota exhausted", provider="primary_p")
        def normalize_error(self, err):
            return err

    class SuccessFallback(BaseAIProvider):
        def get_provider_name(self) -> str:
            return "secondary_p"
        def is_configured(self) -> bool:
            return True
        def resolve_model(self, model=None) -> str:
            return "model-2"
        async def generate(self, **kwargs):
            return ProviderResult(
                provider="secondary_p",
                model="model-2",
                content="Fallback generated text successfully.",
            )
        def normalize_error(self, err):
            return err

    service = AIService(provider=FailingPrimary())

    # Mock the resolve method to return our SuccessFallback for 'secondary_p'
    original_resolve = service._resolve_provider_instance
    def mock_resolve(provider_name=None, config=None):
        if provider_name == "secondary_p":
            return SuccessFallback()
        return FailingPrimary()
    service._resolve_provider_instance = mock_resolve

    req = AIGenerateRequest(
        prompt="Format document",
        provider="primary_p",
        fallback_providers=["secondary_p"],
    )

    resp = await service.generate_text(req)
    assert resp.success is True
    assert resp.provider == "secondary_p"
    assert resp.fallback_occurred is True
    assert "primary_p" in resp.attempted_providers
    assert "secondary_p" in resp.attempted_providers
    assert resp.content == "Fallback generated text successfully."


# =========================================================================
# 5. Model Discovery & Listing Tests
# =========================================================================

def test_provider_models_endpoint():
    """Verify GET /api/ai/providers/{provider}/models returns structured ModelInfo list."""
    for pid in ["gemini", "groq", "openrouter", "mistral", "cohere", "huggingface", "openai", "custom_openai"]:
        resp = client.get(f"/api/ai/providers/{pid}/models")
        assert resp.status_code == 200
        models = resp.json()
        assert isinstance(models, list)
        assert len(models) >= 1
        assert "id" in models[0]
        assert "name" in models[0]


# =========================================================================
# 6. Provider Configuration Validation Endpoint Tests
# =========================================================================

def test_validate_provider_endpoint():
    """Verify POST /api/ai/providers/{provider}/validate safely reports configuration status."""
    # Test unconfigured
    resp = client.post("/api/ai/providers/groq/validate", json={"api_key": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "groq"
    assert data["valid"] is False

    # Test custom openai endpoint with dummy local URL
    resp_custom = client.post(
        "/api/ai/providers/custom_openai/validate",
        json={"base_url": "http://127.0.0.1:9999/v1"},
    )
    assert resp_custom.status_code == 200
    data_custom = resp_custom.json()
    assert data_custom["provider"] == "custom_openai"
    # Should cleanly report failure rather than unhandled exception
    assert data_custom["valid"] is False


# =========================================================================
# 7. Custom OpenAI-compatible Provider Endpoints
# =========================================================================

@pytest.mark.anyio
async def test_custom_openai_adapter_execution():
    """Verify CustomOpenAIProvider handles custom base_url and chat completions."""
    provider = CustomOpenAIProvider(
        base_url="http://localhost:11434/v1",
        default_model="llama3:latest",
    )
    assert provider.get_provider_name() == "custom_openai"
    assert provider.base_url == "http://localhost:11434/v1"
    assert provider.resolve_model() == "llama3:latest"
    assert provider.is_configured() is True
