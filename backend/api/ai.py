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
