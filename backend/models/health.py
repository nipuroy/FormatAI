"""Pydantic models for health check and root endpoints."""

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response payload verifying backend status."""

    status: str = Field(default="ok", description="Current operational status")
    service: str = Field(default="FormatAI", description="Name of the service")
    backend: str = Field(default="python", description="Backend language/runtime")


class RootResponse(BaseModel):
    """Root endpoint response payload."""

    message: str = Field(..., description="Status welcome message")
    service: str = Field(default="FormatAI", description="Name of the service")
    backend: str = Field(default="python", description="Backend language/runtime")
    docs_url: str = Field(default="/docs", description="Interactive API documentation URL")
