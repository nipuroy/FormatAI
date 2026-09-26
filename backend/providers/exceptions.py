"""Standard exception hierarchy for AI providers."""

from typing import Any, Dict, Optional


class ProviderError(Exception):
    """Base exception for all AI provider errors."""

    def __init__(
        self,
        message: str,
        provider: str = "generic",
        error_type: str = "provider_error",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.provider = provider
        self.error_type = error_type
        self.status_code = status_code
        self.details = details or {}


class ProviderConfigurationError(ProviderError):
    """Raised when provider configuration or credentials are missing or invalid."""

    def __init__(self, message: str, provider: str = "generic", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="configuration_error",
            status_code=503,
            details=details,
        )


class ProviderDisabledError(ProviderError):
    """Raised when a request is made to a provider that has been disabled."""

    def __init__(self, message: str, provider: str = "generic", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="provider_disabled",
            status_code=403,
            details=details,
        )


class ProviderAuthenticationError(ProviderError):
    """Raised when authentication with the provider fails."""

    def __init__(self, message: str, provider: str = "generic", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="authentication_error",
            status_code=401,
            details=details,
        )


class ProviderTimeoutError(ProviderError):
    """Raised when an AI provider call times out."""

    def __init__(self, message: str = "AI provider request timed out", provider: str = "generic", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="timeout_error",
            status_code=504,
            details=details,
        )


class ProviderRateLimitError(ProviderError):
    """Raised when an AI provider rate limit or quota is exceeded."""

    def __init__(self, message: str = "AI provider rate limit exceeded", provider: str = "generic", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="rate_limit_error",
            status_code=429,
            details=details,
        )


class ProviderNetworkError(ProviderError):
    """Raised when a network failure occurs connecting to the AI provider."""

    def __init__(self, message: str, provider: str = "generic", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="network_error",
            status_code=503,
            details=details,
        )


class ProviderAPIError(ProviderError):
    """Raised when the provider API returns a server or generation error."""

    def __init__(self, message: str, provider: str = "generic", status_code: int = 502, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            provider=provider,
            error_type="api_error",
            status_code=status_code,
            details=details,
        )
