"""AI generation API routes supporting multi-provider adapter architecture."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Path, Query, status
from fastapi.responses import JSONResponse
from backend.models.ai import (
    AIGenerateRequest,
    AIGenerateResponse,
    AIErrorResponse,
    ProviderDescriptor,
    ProviderValidationRequest,
)
from backend.providers.base import ModelInfo, ProviderValidationResult
from backend.providers.exceptions import ProviderError
from backend.services.ai_service import AIService
from backend.utils.logger import get_logger

router = APIRouter(prefix="/ai", tags=["AI Multi-Provider Engine"])
logger = get_logger("ai_route")


def get_ai_service() -> AIService:
    """Dependency injector for AIService."""
    return AIService()


@router.post(
    "/generate",
    response_model=AIGenerateResponse,
    responses={
        400: {"model": AIErrorResponse, "description": "Validation error or invalid request"},
        401: {"model": AIErrorResponse, "description": "Authentication failure with AI provider"},
        403: {"model": AIErrorResponse, "description": "Provider is disabled by user"},
        429: {"model": AIErrorResponse, "description": "Provider rate limit or quota exceeded"},
        502: {"model": AIErrorResponse, "description": "AI provider service or generation error"},
        503: {"model": AIErrorResponse, "description": "AI provider not configured or missing credentials"},
        504: {"model": AIErrorResponse, "description": "AI provider request timed out"},
    },
    summary="Generate text via selected AI provider with optional fallback",
)
async def generate_text(
    request: AIGenerateRequest,
    service: AIService = Depends(get_ai_service),
):
    """Submits a prompt to the selected AI provider (Gemini, Groq, OpenRouter, Mistral, Cohere, HuggingFace, OpenAI, Custom)

    with error normalization, timeouts, retries, and optional explicit fallback.
    """
    try:
        return await service.generate_text(request)
    except ProviderError as exc:
        logger.warning(f"Provider error [{exc.error_type} in {exc.provider}]: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content=AIErrorResponse(
                success=False,
                error=exc.message,
                error_type=exc.error_type,
                provider=exc.provider,
                details=exc.details,
            ).model_dump(),
        )
    except Exception as exc:
        logger.error(f"Unexpected error in generate_text: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=AIErrorResponse(
                success=False,
                error="An unexpected internal server error occurred.",
                error_type="internal_server_error",
                provider=request.provider or "unknown",
            ).model_dump(),
        )


@router.get(
    "/providers",
    response_model=List[ProviderDescriptor],
    summary="List all supported AI providers and their status",
)
def get_supported_providers(
    service: AIService = Depends(get_ai_service),
):
    """Returns overview of all 8 supported AI providers and their readiness status."""
    return service.get_supported_providers()


@router.get(
    "/providers/{provider_name}/models",
    response_model=List[ModelInfo],
    summary="Discover or list models for a specific AI provider",
)
async def get_provider_models(
    provider_name: str = Path(..., description="Provider identifier (e.g. 'gemini', 'groq', 'openrouter')"),
    service: AIService = Depends(get_ai_service),
):
    """Fetches discovered or curated models for the specified provider."""
    try:
        return await service.list_models_for_provider(provider_name)
    except Exception as exc:
        logger.warning(f"Failed to fetch models for {provider_name}: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": f"Failed to retrieve models for provider '{provider_name}': {str(exc)}"},
        )


@router.post(
    "/providers/{provider_name}/validate",
    response_model=ProviderValidationResult,
    summary="Validate provider configuration and connectivity safely",
)
async def validate_provider(
    provider_name: str = Path(..., description="Provider identifier to validate"),
    request: Optional[ProviderValidationRequest] = None,
    service: AIService = Depends(get_ai_service),
):
    """Safely tests credentials and connectivity for a provider without running full generation."""
    try:
        return await service.validate_provider(provider_name, request)
    except Exception as exc:
        return ProviderValidationResult(
            valid=False,
            provider=provider_name,
            message=f"Validation failed: {str(exc)}",
            details={"error": str(exc)},
        )


@router.get(
    "/models",
    summary="Legacy endpoint: Get available Gemini models and status",
)
def get_available_models(
    service: AIService = Depends(get_ai_service),
):
    """Returns supported Gemini models for backward compatibility."""
    return {
        "provider": "gemini",
        "default_model": "gemini-2.5-flash",
        "is_configured": True,
        "models": [
            {
                "id": "gemini-2.5-flash",
                "name": "Gemini 2.5 Flash",
                "description": "Recommended for high-speed academic formatting, LaTeX extraction, and synthesis",
                "tier": "Fast",
            },
            {
                "id": "gemini-2.5-pro",
                "name": "Gemini 2.5 Pro",
                "description": "Advanced reasoning for dense mathematical derivations and rigorous citations",
                "tier": "Pro",
            },
            {
                "id": "gemini-1.5-flash",
                "name": "Gemini 1.5 Flash",
                "description": "Standard high-throughput model",
                "tier": "Standard",
            },
            {
                "id": "gemini-3.1-pro-preview",
                "name": "Gemini 3.1 Pro Preview",
                "description": "Frontier reasoning for complex STEM and research analysis",
                "tier": "Frontier",
            },
        ],
    }
