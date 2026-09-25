"""Main API router combining domain route modules."""

from fastapi import APIRouter
from backend.api.health import router as health_router
from backend.api.ai import router as ai_router
from backend.api.document import router as document_router

api_router = APIRouter()

# Mount health routes under /api
api_router.include_router(health_router, prefix="")

# Mount AI generation routes under /api/ai
api_router.include_router(ai_router)

# Mount Document processing routes under /api/document
api_router.include_router(document_router)
