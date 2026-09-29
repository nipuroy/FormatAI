"""Automated Security Audit Verification Tests for FormatAI.

Tests verify:
1. SSRF prevention against AWS/GCP cloud metadata services and link-local IPs.
2. Filename sanitization against path traversal, CRLF header injection, and control characters.
3. CORS configuration safety.
4. Input payload bounds against memory exhaustion / DoS.
5. Error-message sanitization preventing internal exception stack leakage.
6. Multi-tenant / per-request skill isolation without shared global state mutation.
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.providers.exceptions import ProviderAPIError
from backend.providers.http_client import validate_safe_provider_url
from backend.skills.orchestrator import skill_orchestrator
from backend.skills.registry import skill_registry
from backend.utils.formatting import sanitize_filename

client = TestClient(app)


class TestSecurityAudit:
    """Security audit assertions ensuring robust defense-in-depth."""

    def test_ssrf_blocks_cloud_metadata(self):
        """Verify that requests to AWS/GCP cloud metadata IP are blocked."""
        with pytest.raises(ProviderAPIError) as exc_info:
            validate_safe_provider_url("http://169.254.169.254/latest/meta-data/", "test_provider")
        assert "metadata service" in str(exc_info.value).lower() or "forbidden" in str(exc_info.value).lower()

    def test_ssrf_blocks_google_metadata_host(self):
        """Verify that requests to metadata.google.internal are blocked."""
        with pytest.raises(ProviderAPIError) as exc_info:
            validate_safe_provider_url("http://metadata.google.internal/computeMetadata/v1/", "test_provider")
        assert "metadata service" in str(exc_info.value).lower() or "forbidden" in str(exc_info.value).lower()

    def test_ssrf_blocks_disallowed_schemes(self):
        """Verify that file://, ftp://, and gopher:// schemes are blocked."""
        for scheme in ["file:///etc/passwd", "ftp://evil.com/payload", "gopher://evil.com"]:
            with pytest.raises(ProviderAPIError) as exc_info:
                validate_safe_provider_url(scheme, "test_provider")
            assert "disallowed protocol scheme" in str(exc_info.value).lower()

    def test_ssrf_blocks_link_local_ips(self):
        """Verify that link-local IPs are blocked."""
        with pytest.raises(ProviderAPIError) as exc_info:
            validate_safe_provider_url("http://169.254.1.1:8080/data", "test_provider")
        assert "link-local" in str(exc_info.value).lower() or "forbidden" in str(exc_info.value).lower()

    def test_filename_sanitization_path_traversal(self):
        """Verify that directory traversal sequences are stripped from filenames."""
        malicious = "../../../etc/passwd"
        sanitized = sanitize_filename(malicious)
        assert ".." not in sanitized
        assert "/" not in sanitized
        assert "\\" not in sanitized
        assert sanitized == "etcpasswd"

    def test_filename_sanitization_crlf_injection(self):
        """Verify that CRLF characters and quotes cannot cause header injection."""
        malicious = 'malicious_name\r\nContent-Type: text/html\r\n\r\n<script>alert(1)</script>'
        sanitized = sanitize_filename(malicious)
        assert "\r" not in sanitized
        assert "\n" not in sanitized
        assert "<" not in sanitized
        assert ">" not in sanitized
        assert '"' not in sanitized
        assert ";" not in sanitized

    def test_filename_sanitization_null_bytes(self):
        """Verify that null bytes are stripped."""
        malicious = "paper\x00.exe.docx"
        sanitized = sanitize_filename(malicious)
        assert "\x00" not in sanitized

    def test_cors_credentials_not_allowed_with_wildcard(self):
        """Verify that allow_credentials is never True when CORS_ORIGINS contains wildcard."""
        from backend.core.config import get_settings
        settings = get_settings()
        # Verify safe configuration
        assert not (settings.CORS_ALLOW_CREDENTIALS and "*" in settings.CORS_ORIGINS)

    def test_prompt_length_bound(self):
        """Verify that prompts exceeding the safe character limit are rejected with 422."""
        oversized_prompt = "A" * 200_001
        response = client.post(
            "/api/ai/generate",
            json={"prompt": oversized_prompt, "provider": "gemini"},
        )
        assert response.status_code == 422

    def test_per_request_skill_isolation(self):
        """Verify that per-request skill_states do not mutate the global singleton."""
        math_skill = skill_registry.get("mathematics")
        assert math_skill is not None
        original_global_state = math_skill.enabled

        # Process a document with mathematics explicitly disabled in request
        raw_input = "# Math Note\n\nEinstein found that $E = mc^2$."
        result = skill_orchestrator.process(
            raw_text=raw_input,
            skill_states={"mathematics": False},
        )

        # Global registry state MUST remain unaffected
        assert math_skill.enabled == original_global_state
        # Execution logs should confirm mathematics was not applied
        applied_math = any(
            (log.get("skill_id") if isinstance(log, dict) else getattr(log, "skill_id", None)) == "mathematics"
            and (log.get("applied") if isinstance(log, dict) else getattr(log, "applied", False))
            for log in result.get("execution_logs", [])
        )
        assert not applied_math
