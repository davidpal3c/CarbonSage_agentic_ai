import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_csv(value: str | None, *, default: tuple[str, ...]) -> tuple[str, ...]:
    if not value:
        return default
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _demo_session_secret() -> str:
    configured = os.getenv("DEMO_SESSION_SECRET")
    if configured:
        return configured
    if os.getenv("APP_ENV", "development") == "production":
        return ""
    return "development-only-nzeroesg-demo-session-secret"


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("APP_ENV", "development")
    assistant_enabled: bool = _as_bool(os.getenv("ASSISTANT_ENABLED"))
    demo_session_secret: str = _demo_session_secret()
    demo_workspace_ttl_hours: int = int(os.getenv("DEMO_WORKSPACE_TTL_HOURS", "24"))
    database_url: str | None = os.getenv("DATABASE_URL") or None
    session_cookie_secure: bool = os.getenv("APP_ENV", "development") == "production"
    session_cookie_samesite: str = "none" if session_cookie_secure else "lax"
    llm_provider: str = os.getenv("LLM_PROVIDER", "").strip().lower()
    openai_api_key: str | None = os.getenv("OPENAI_API_KEY")
    openai_model: str | None = os.getenv("OPENAI_MODEL")
    openrouter_api_key: str | None = os.getenv("OPENROUTER_API_KEY")
    openrouter_model: str | None = os.getenv("OPENROUTER_MODEL")
    embedding_provider: str = os.getenv("EMBEDDING_PROVIDER", "").strip().lower()
    embedding_model: str | None = os.getenv("EMBEDDING_MODEL") or None
    embedding_dimensions: int = int(os.getenv("EMBEDDING_DIMENSIONS", "1536"))
    carbon_interface_api_key: str | None = os.getenv("CARBON_INTERFACE_API_KEY")
    cors_origins: tuple[str, ...] = _as_csv(
        os.getenv("CORS_ORIGINS"),
        default=("http://localhost:3000", "http://127.0.0.1:3000"),
    )


settings = Settings()


def database_url_for_runtime() -> str | None:
    """Require durable storage whenever the API is running in production."""

    if settings.environment == "production" and not settings.database_url:
        raise RuntimeError("DATABASE_URL is required when APP_ENV=production.")
    return settings.database_url
