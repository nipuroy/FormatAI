"""Application configuration powered by pydantic-settings.

Safely reads environment variables from .env files or OS environment
without hardcoding sensitive secrets or keys.
"""

from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """FormatAI backend settings configuration."""

    # Project Information
    PROJECT_NAME: str = "FormatAI"
    VERSION: str = "0.1.0"
    DESCRIPTION: str = "AI-powered academic document formatting application."
    API_PREFIX: str = "/api"

    # Server Settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # CORS Configuration
    CORS_ORIGINS: List[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # AI Provider API Keys (Read securely from environment / .env, never hardcoded)
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None

    # Default Provider Settings
    DEFAULT_AI_PROVIDER: str = "gemini"
    DEFAULT_MODEL_NAME: str = "gemini-2.5-flash"

    # Document Export Settings
    DEFAULT_CITATION_STYLE: str = "apa"
    MAX_DOCUMENT_SIZE_MB: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance for dependency injection."""
    return Settings()
