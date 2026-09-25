"""AI generation API routes."""

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from backend.models.ai import AIGenerateRequest, AIGenerateResponse, AIErrorResponse
from backend.services.ai_service import AIService
from backend.providers.exceptions import ProviderError
from backend.utils.logger import get_logger

router = APIRouter(prefix="/ai", tags=["AI Generation"])
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
        429: {"model": AIErrorResponse, "description": "Provider rate limit or quota exceeded"},
        502: {"model": AIErrorResponse, "description": "AI provider service or generation error"},
        503: {"model": AIErrorResponse, "description": "AI provider not configured or missing credentials"},
        504: {"model": AIErrorResponse, "description": "AI provider request timed out"},
    },
    summary="Generate text via AI provider",
)
async def generate_text(
    request: AIGenerateRequest,
    service: AIService = Depends(get_ai_service),
):
    """Submits a prompt to the configured AI provider (Google Gemini) and returns the generated content."""
    try:
        return await service.generate_text(request)
    except ProviderError as exc:
        logger.warning(f"Provider error [{exc.error_type}]: {exc.message}")
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
                provider="gemini",
            ).model_dump(),
        )


@router.get(
    "/models",
    summary="Get available AI provider models and configuration status",
)
def get_available_models(
    service: AIService = Depends(get_ai_service),
):
    """Returns supported Gemini models and provider readiness."""
    is_configured = service.provider.is_configured() if hasattr(service.provider, "is_configured") else True
    return {
        "provider": "gemini",
        "default_model": "gemini-2.5-flash",
        "is_configured": is_configured,
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
        ],
    }
