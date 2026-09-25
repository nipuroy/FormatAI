"""Business logic service for system diagnostics and health checks."""

from backend.core.config import get_settings
from backend.models.health import HealthResponse, RootResponse
from backend.utils.logger import get_logger

logger = get_logger("health_service")


class HealthService:
    """Service handling operational health and system runtime status."""

    def __init__(self):
        self.settings = get_settings()

    def get_health_status(self) -> HealthResponse:
        """Evaluate and return backend health status."""
        logger.debug("Executing health check verification.")
        return HealthResponse(
            status="ok",
            service=self.settings.PROJECT_NAME,
            backend="python",
        )

    def get_root_info(self) -> RootResponse:
        """Provide informative root payload confirming FastAPI service is active."""
        return RootResponse(
            message=f"{self.settings.PROJECT_NAME} Python FastAPI Backend is running.",
            service=self.settings.PROJECT_NAME,
            backend="python",
            docs_url="/docs",
        )
