"""Resilient async HTTP client for AI providers with timeouts and retries."""

import asyncio
import ipaddress
from typing import Any, Dict, Optional
from urllib.parse import urlparse
import httpx
from backend.providers.exceptions import (
    ProviderAPIError,
    ProviderAuthenticationError,
    ProviderError,
    ProviderNetworkError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)
from backend.utils.logger import get_logger

logger = get_logger("provider_http")

# Blocked hostnames for Cloud Instance Metadata Service (IMDS) protection
BLOCKED_HOSTNAMES = {
    "metadata.google.internal",
    "metadata.google",
    "169.254.169.254",
    "169.254.169.253",
}


def validate_safe_provider_url(url: str, provider_name: str) -> None:
    """Validate URL to protect against SSRF and cloud metadata exfiltration."""
    try:
        parsed = urlparse(url)
    except Exception as exc:
        raise ProviderAPIError(
            message=f"Invalid URL for provider {provider_name}: {exc}",
            provider=provider_name,
        )

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise ProviderAPIError(
            message=f"Disallowed protocol scheme '{scheme}' for provider {provider_name}. Only HTTP and HTTPS are permitted.",
            provider=provider_name,
        )

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        raise ProviderAPIError(
            message=f"URL missing hostname for provider {provider_name}.",
            provider=provider_name,
        )

    # Check blocked metadata hostnames
    if hostname in BLOCKED_HOSTNAMES or hostname.endswith(".internal"):
        raise ProviderAPIError(
            message=f"Access to metadata service or internal host '{hostname}' is strictly forbidden (SSRF protection).",
            provider=provider_name,
        )

    # Check if hostname is an IP address
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_link_local:
            raise ProviderAPIError(
                message=f"Access to link-local IP '{hostname}' is forbidden (SSRF protection).",
                provider=provider_name,
            )
        if ip.is_multicast:
            raise ProviderAPIError(
                message=f"Access to multicast IP '{hostname}' is forbidden.",
                provider=provider_name,
            )
        if ip.is_reserved:
            raise ProviderAPIError(
                message=f"Access to reserved IP '{hostname}' is forbidden.",
                provider=provider_name,
            )
    except ValueError:
        # Hostname is a standard domain name
        pass


async def execute_with_retry(
    provider_name: str,
    method: str,
    url: str,
    headers: Dict[str, str],
    json_data: Optional[Dict[str, Any]] = None,
    timeout: float = 30.0,
    max_retries: int = 2,
) -> httpx.Response:
    """Execute an HTTP request with exponential backoff for transient failures."""
    # Enforce SSRF protection before any network socket is opened
    validate_safe_provider_url(url, provider_name)

    attempt = 0
    backoff = 1.0

    while True:
        attempt += 1
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=json_data,
                )

            # Check status codes
            if response.status_code == 200:
                return response

            if response.status_code in (401, 403):
                # Never retry authentication failures
                error_msg = _extract_error_message(response)
                raise ProviderAuthenticationError(
                    message=f"Authentication failed for {provider_name}: {error_msg}",
                    provider=provider_name,
                    details={"status_code": response.status_code},
                )

            if response.status_code == 429:
                if attempt <= max_retries:
                    logger.warning(
                        f"Rate limit hit for {provider_name} (attempt {attempt}/{max_retries + 1}). Retrying in {backoff}s..."
                    )
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                raise ProviderRateLimitError(
                    message=f"Rate limit exceeded for {provider_name}. Please check your quota or try again later.",
                    provider=provider_name,
                    details={"status_code": 429},
                )

            if response.status_code in (500, 502, 503, 504):
                if attempt <= max_retries:
                    logger.warning(
                        f"Server error {response.status_code} for {provider_name} (attempt {attempt}). Retrying in {backoff}s..."
                    )
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue
                error_msg = _extract_error_message(response)
                raise ProviderAPIError(
                    message=f"Provider {provider_name} error ({response.status_code}): {error_msg}",
                    provider=provider_name,
                    status_code=response.status_code,
                )

            # Other 4xx client errors
            error_msg = _extract_error_message(response)
            raise ProviderAPIError(
                message=f"Request to {provider_name} failed ({response.status_code}): {error_msg}",
                provider=provider_name,
                status_code=response.status_code,
            )

        except (httpx.TimeoutException, asyncio.TimeoutError) as exc:
            if attempt <= max_retries:
                logger.warning(f"Timeout on {provider_name} request (attempt {attempt}). Retrying in {backoff}s...")
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            raise ProviderTimeoutError(
                message=f"Request to {provider_name} timed out after {timeout} seconds.",
                provider=provider_name,
                details={"timeout": timeout},
            )
        except (httpx.ConnectError, httpx.NetworkError) as exc:
            is_local = "localhost" in url or "127.0.0.1" in url or "0.0.0.0" in url
            # Do not retry connection refused or local addresses where no server is listening
            if isinstance(exc, httpx.ConnectError) or is_local:
                if is_local:
                    raise ProviderNetworkError(
                        message=(
                            f"Unable to connect to local endpoint at {url}. "
                            "When running in a cloud environment, FormatAI cannot reach your local machine's 'localhost' directly. "
                            "Please provide a publicly reachable tunnel URL (e.g. ngrok, Cloudflare Tunnel) or select a cloud provider."
                        ),
                        provider=provider_name,
                        details={"url": url, "error": str(exc)},
                    )
                raise ProviderNetworkError(
                    message=f"Connection refused to {provider_name} at {url}. Verify the server is running and reachable.",
                    provider=provider_name,
                    details={"url": url, "error": str(exc)},
                )

            if attempt <= max_retries:
                logger.warning(f"Network error on {provider_name} (attempt {attempt}): {str(exc)}. Retrying...")
                await asyncio.sleep(backoff)
                backoff *= 2
                continue
            raise ProviderNetworkError(
                message=f"Failed to connect to {provider_name} endpoint at {url}. Network connection failed.",
                provider=provider_name,
                details={"url": url},
            )
        except ProviderError:
            raise
        except Exception as exc:
            raise ProviderAPIError(
                message=f"Unexpected error communicating with {provider_name}: {str(exc)}",
                provider=provider_name,
            )


def _extract_error_message(response: httpx.Response) -> str:
    """Extract human-readable error from JSON or text response body."""
    try:
        data = response.json()
        if isinstance(data, dict):
            # Standard formats: {"error": {"message": ...}} or {"error": "..."} or {"message": "..."}
            if "error" in data:
                err = data["error"]
                if isinstance(err, dict) and "message" in err:
                    return str(err["message"])
                return str(err)
            if "message" in data:
                return str(data["message"])
            if "detail" in data:
                return str(data["detail"])
    except Exception:
        pass
    text = response.text
    return text[:200] if text else f"HTTP {response.status_code}"
