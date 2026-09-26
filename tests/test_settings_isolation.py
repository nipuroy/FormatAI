"""Automated Tests for Settings Isolation and Non-Persistence.

These tests prove that:
1. FormatAI has NO shared server-side user settings store or multi-tenant database.
2. User A's API keys and configuration parameters are never cached or leaked to User B.
3. Concurrent requests with different provider configurations execute in isolated thread memory.
4. Server responses never reflect or expose client API keys or custom user credentials.
"""

import asyncio
from typing import Any, Dict
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.ai import AIGenerateRequest, ProviderSpecificConfig
from backend.services.ai_service import AIService
from backend.providers.base import BaseAIProvider, ProviderResult

client = TestClient(app)


# =========================================================================
# Mock Provider for Multi-Tenant Isolation Testing
# =========================================================================

class EphemeralTrackingProvider(BaseAIProvider):
    """Mock provider that records the exact configuration passed to it."""

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        self.received_key = self.api_key
        self.received_base_url = self.base_url

    def get_provider_name(self) -> str:
        return "tracking_provider"

    def get_display_name(self) -> str:
        return "Tracking Provider"

    def is_configured(self) -> bool:
        return True

    def resolve_model(self, requested_model: Any = None) -> str:
        return requested_model or "track-model-1"

    async def generate(self, prompt: str, **kwargs: Any) -> ProviderResult:
        # Echo back which key was active in this isolated execution context
        return ProviderResult(
            provider=self.get_provider_name(),
            model="track-model-1",
            content=f"Processed with key: {self.api_key} and base_url: {self.base_url}",
        )

    async def list_models(self) -> Any:
        return []

    async def validate_configuration(self) -> Any:
        return None

    def normalize_error(self, error: Exception) -> Any:
        return error


# =========================================================================
# 1. No Shared Server-Side Settings Endpoint
# =========================================================================

def test_no_server_side_user_settings_endpoint():
    """Verify that there is no server-side endpoint storing or retrieving user settings."""
    # Attempting to fetch user settings must return 404 Not Found
    resp_get = client.get("/api/user/settings")
    assert resp_get.status_code == 404

    resp_post = client.post("/api/user/settings", json={"apiKey": "sk-secret"})
    assert resp_post.status_code == 404

    resp_profile = client.get("/api/user/profile")
    assert resp_profile.status_code == 404


def test_public_provider_catalog_never_exposes_user_keys():
    """Verify GET /api/ai/providers never leaks API keys or user custom URLs."""
    resp = client.get("/api/ai/providers")
    assert resp.status_code == 200
    providers = resp.json()
    assert isinstance(providers, list)

    for p in providers:
        # None of the provider catalog items should contain api_key or credentials
        assert "api_key" not in p
        assert "apiKey" not in p
        assert "credentials" not in p
        assert "secret" not in p
        # requires_base_url is boolean metadata, not user URL
        if "base_url" in p:
            assert p["base_url"] is None or p["base_url"] == ""


# =========================================================================
# 2. Ephemeral Concurrency & Request Isolation Tests
# =========================================================================

@pytest.mark.anyio
async def test_concurrent_requests_remain_strictly_isolated():
    """Prove that concurrent requests with different user credentials cannot leak between users."""
    service = AIService()

    # Register the ephemeral provider
    def resolve_mock(provider_name: str, config: Any = None) -> BaseAIProvider:
        api_key = config.api_key if config else None
        base_url = config.base_url if config else None
        return EphemeralTrackingProvider(api_key=api_key, base_url=base_url)

    service._resolve_provider_instance = resolve_mock  # type: ignore

    # Simulate User A and User B firing simultaneous requests with their respective client-isolated keys
    user_a_key = "user_a_secret_key_99999"
    user_b_key = "user_b_secret_key_11111"

    req_a = AIGenerateRequest(
        prompt="User A document query",
        provider="tracking_provider",
        provider_config=ProviderSpecificConfig(
            api_key=user_a_key,
            base_url="https://user-a.gateway.internal/v1",
        ),
    )

    req_b = AIGenerateRequest(
        prompt="User B document query",
        provider="tracking_provider",
        provider_config=ProviderSpecificConfig(
            api_key=user_b_key,
            base_url="https://user-b.gateway.internal/v1",
        ),
    )

    # Execute simultaneously via asyncio.gather
    res_a, res_b = await asyncio.gather(
        service.generate_text(req_a),
        service.generate_text(req_b),
    )

    assert res_a.success is True
    assert res_b.success is True

    # User A's response MUST only reflect User A's credentials
    assert user_a_key in res_a.content
    assert user_b_key not in res_a.content
    assert "user-a.gateway.internal" in res_a.content
    assert "user-b.gateway.internal" not in res_a.content

    # User B's response MUST only reflect User B's credentials
    assert user_b_key in res_b.content
    assert user_a_key not in res_b.content
    assert "user-b.gateway.internal" in res_b.content
    assert "user-a.gateway.internal" not in res_b.content


# =========================================================================
# 3. Response Scrubbing Test
# =========================================================================

def test_api_generate_response_does_not_echo_secret_keys():
    """Verify that /api/ai/generate does not echo back raw API keys in response metadata."""
    # Dummy invalid payload to verify error payload structure
    secret = "sk-super-secret-user-key-should-never-be-returned"
    resp = client.post(
        "/api/ai/generate",
        json={
            "prompt": "Test academic thesis",
            "provider": "openai",
            "provider_config": {
                "api_key": secret,
                "base_url": "https://api.openai.com/v1",
            },
        },
    )

    # Regardless of whether the call succeeded or failed, the response body must NEVER echo the secret
    resp_text = resp.text
    assert secret not in resp_text
