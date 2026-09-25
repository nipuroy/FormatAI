"""FormatAI Backend Application.

FastAPI entry point for FormatAI academic document formatting service.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="FormatAI Backend",
    description="Python FastAPI backend for FormatAI academic document formatting application.",
    version="0.1.0",
)

# Enable CORS for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    backend: str


class RootResponse(BaseModel):
    message: str
    service: str
    backend: str
    docs_url: str


@app.get("/", response_model=RootResponse)
def read_root():
    """Root endpoint clearly indicating that the Python FastAPI backend is running."""
    return RootResponse(
        message="FormatAI Python FastAPI Backend is running.",
        service="FormatAI",
        backend="python",
        docs_url="/docs",
    )


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    """Health check endpoint returning backend status."""
    return HealthResponse(
        status="ok",
        service="FormatAI",
        backend="python",
    )


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8001))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
