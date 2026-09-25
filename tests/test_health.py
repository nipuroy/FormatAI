"""Tests for FormatAI FastAPI health and root endpoints."""

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify root endpoint returns Python FastAPI information."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "FormatAI"
    assert data["backend"] == "python"
    assert "running" in data["message"].lower()


def test_health_endpoint():
    """Verify /api/health endpoint returns expected status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "ok",
        "service": "FormatAI",
        "backend": "python",
    }
