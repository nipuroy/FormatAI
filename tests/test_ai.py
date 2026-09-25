"""Tests for FormatAI AI provider and generation endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.api.ai import get_ai_service
from backend.models.ai import AIGenerateResponse
from backend.providers.base import BaseAIProvider, ProviderResult
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderConfigurationError,
    ProviderTimeoutError,
)
from backend.providers.gemini import GeminiProvider
from backend.services.ai_service import AIService

client = TestClient(app)


class MockAIProvider(BaseAIProvider):
    """Mock AI Provider for deterministic testing without external API calls."""

    def __init__(self, api_key: str = "mock-key-12345", default_model: str = "gemini-2.5-flash"):
        super().__init__(api_key=api_key, default_model=default_model)
        self.generate_mock = AsyncMock()

    def get_provider_name(self) -> str:
        return "gemini"

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def resolve_model(self, requested_model: str | None = None) -> str:
        return requested_model or self.default_model

    async def generate_text(self, prompt: str, model: str | None = None, timeout: float | None = None) -> ProviderResult:
        if self.generate_mock:
            return await self.generate_mock(prompt=prompt, model=model, timeout=timeout)
        return ProviderResult(
            provider=self.get_provider_name(),
            model=self.resolve_model(model),
            content="Mocked response text.",
        )

    def normalize_error(self, error: Exception) -> Exception:
        return error


# =========================================================================
# 1. Request Validation Tests
# =========================================================================

def test_generate_missing_payload():
    """Verify 422 Unprocessable Entity when request body is omitted."""
    response = client.post("/api/ai/generate", json={})
    assert response.status_code == 422


def test_generate_empty_prompt():
    """Verify 422 Unprocessable Entity when prompt is an empty string."""
    response = client.post("/api/ai/generate", json={"prompt": ""})
    assert response.status_code == 422


# =========================================================================
# 2. Missing API Key Test
# =========================================================================

def test_generate_missing_api_key():
    """Verify structured 503 error response when GEMINI_API_KEY is missing."""
    unconfigured_provider = GeminiProvider(api_key="")
    mock_service = AIService(provider=unconfigured_provider)

    app.dependency_overrides[get_ai_service] = lambda: mock_service
    try:
        response = client.post("/api/ai/generate", json={"prompt": "Format this research abstract."})
        assert response.status_code == 503
        data = response.json()
        assert data["success"] is False
        assert data["provider"] == "gemini"
        assert data["error_type"] == "configuration_error"
        assert "missing" in data["error"].lower() or "gemini api key" in data["error"].lower()
    finally:
        app.dependency_overrides.clear()


# =========================================================================
# 3. Provider Error Tests
# =========================================================================

def test_generate_provider_api_error():
    """Verify structured 502 error response when the AI provider encounters an API error."""
    mock_provider = MockAIProvider()
    mock_provider.generate_mock.side_effect = ProviderAPIError(
        message="Gemini model generation failed: high traffic load",
        provider="gemini",
        status_code=502,
    )
    mock_service = AIService(provider=mock_provider)

    app.dependency_overrides[get_ai_service] = lambda: mock_service
    try:
        response = client.post("/api/ai/generate", json={"prompt": "Format this document."})
        assert response.status_code == 502
        data = response.json()
        assert data["success"] is False
        assert data["provider"] == "gemini"
        assert data["error_type"] == "api_error"
        assert "high traffic load" in data["error"]
    finally:
        app.dependency_overrides.clear()


def test_generate_provider_timeout_error():
    """Verify structured 504 error response when generation times out."""
    mock_provider = MockAIProvider()
    mock_provider.generate_mock.side_effect = ProviderTimeoutError(
        message="Gemini API request timed out after 30 seconds.",
        provider="gemini",
    )
    mock_service = AIService(provider=mock_provider)

    app.dependency_overrides[get_ai_service] = lambda: mock_service
    try:
        response = client.post("/api/ai/generate", json={"prompt": "Format large manuscript."})
        assert response.status_code == 504
        data = response.json()
        assert data["success"] is False
        assert data["error_type"] == "timeout_error"
        assert "timed out" in data["error"].lower()
    finally:
        app.dependency_overrides.clear()


# =========================================================================
# 4. Successful Response Using Mocked Provider
# =========================================================================

def test_generate_success_mocked():
    """Verify successful generation with predictable response structure."""
    mock_provider = MockAIProvider()
    mock_provider.generate_mock.return_value = ProviderResult(
        provider="gemini",
        model="gemini-2.5-flash",
        content="# Introduction\n\nThis is a professionally structured academic section.",
        finish_reason="STOP",
    )
    mock_service = AIService(provider=mock_provider)

    app.dependency_overrides[get_ai_service] = lambda: mock_service
    try:
        payload = {
            "prompt": "Convert unformatted bullet points into academic prose.",
            "model": "gemini-2.5-flash",
        }
        response = client.post("/api/ai/generate", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["provider"] == "gemini"
        assert data["model"] == "gemini-2.5-flash"
        assert "Introduction" in data["content"]
        assert data.get("finish_reason") == "STOP"
    finally:
        app.dependency_overrides.clear()


# =========================================================================
# 5. Security & Key Leak Prevention
# =========================================================================

def test_security_never_leak_api_key():
    """Verify that neither success nor error responses expose the secret API key."""
    secret_key = "SUPER_SECRET_GEMINI_KEY_ABC123"
    mock_provider = MockAIProvider(api_key=secret_key)
    mock_provider.generate_mock.return_value = ProviderResult(
        provider="gemini",
        model="gemini-2.5-flash",
        content="Academic output.",
    )
    mock_service = AIService(provider=mock_provider)

    app.dependency_overrides[get_ai_service] = lambda: mock_service
    try:
        # Success check
        res = client.post("/api/ai/generate", json={"prompt": "Test prompt"})
        raw_text = res.text
        assert secret_key not in raw_text

        # Error check
        mock_provider.generate_mock.side_effect = ProviderAPIError(
            message="Internal provider failure",
            provider="gemini",
        )
        err_res = client.post("/api/ai/generate", json={"prompt": "Test prompt"})
        assert secret_key not in err_res.text
    finally:
        app.dependency_overrides.clear()


# =========================================================================
# 6. Unit Test for GeminiProvider with Injected Client
# =========================================================================

def test_gemini_provider_unit_with_mock_client():
    """Verify GeminiProvider extraction logic using a duck-typed SDK client mock."""
    import asyncio
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Generated text from mock Google GenAI client."
    mock_candidate = MagicMock()
    mock_candidate.finish_reason = "STOP"
    mock_response.candidates = [mock_candidate]

    mock_client.models.generate_content.return_value = mock_response

    provider = GeminiProvider(
        api_key="valid-test-key",
        default_model="gemini-2.5-flash",
        client=mock_client,
    )

    result = asyncio.run(provider.generate_text(prompt="Sample abstract"))
    assert result.provider == "gemini"
    assert result.model == "gemini-2.5-flash"
    assert result.content == "Generated text from mock Google GenAI client."
    assert result.finish_reason == "STOP"
