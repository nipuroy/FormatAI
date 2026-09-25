"""FormatAI FastAPI Application Entry Point.

Clean, modular architecture orchestrating routes, services, providers,
models, utilities, and configuration.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from backend.api.router import api_router
from backend.core.config import get_settings
from backend.models.health import RootResponse
from backend.services.health_service import HealthService

settings = get_settings()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware using safe settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)


def get_health_service() -> HealthService:
    """Dependency injector for HealthService."""
    return HealthService()


@app.get("/", response_model=RootResponse, summary="Root endpoint")
def read_root(service: HealthService = Depends(get_health_service)) -> RootResponse:
    """Root endpoint confirming Python FastAPI backend operational status."""
    return service.get_root_info()


# Mount modular API router under /api
app.include_router(api_router, prefix=settings.API_PREFIX)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
