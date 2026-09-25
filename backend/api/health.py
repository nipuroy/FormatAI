"""Health check route endpoints."""

from fastapi import APIRouter, Depends
from backend.models.health import HealthResponse, RootResponse
from backend.services.health_service import HealthService

router = APIRouter(tags=["Health & Status"])


def get_health_service() -> HealthService:
    """Dependency injector providing HealthService instance."""
    return HealthService()


@router.get("/health", response_model=HealthResponse, summary="Backend health check")
def health_check(service: HealthService = Depends(get_health_service)) -> HealthResponse:
    """Verifies that the Python FastAPI backend is functioning properly."""
    return service.get_health_status()


@router.get("/root-info", response_model=RootResponse, summary="Backend root metadata")
def root_info(service: HealthService = Depends(get_health_service)) -> RootResponse:
    """Returns general backend metadata and docs link."""
    return service.get_root_info()
