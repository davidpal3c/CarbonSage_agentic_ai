from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from api.emissions import emissions_router
from api.evidence import evidence_router
from api.reports import reports_router
from api.routes import chat_router
from api.scenarios import scenarios_router
from api.shipments import shipments_router
from api.workspaces import workspace_router
from config import settings

app = FastAPI(
    title="CarbonSage API",
    description="Evidence-grounded Scope 3 intelligence and deterministic decision tools.",
    version="0.2.0-dev",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if settings.environment == "production":
        response.headers.setdefault(
            "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
        )
    return response


app.include_router(chat_router, prefix="/chat", tags=["chat"])
app.include_router(workspace_router)
app.include_router(emissions_router)
app.include_router(shipments_router)
app.include_router(evidence_router)
app.include_router(scenarios_router)
app.include_router(reports_router)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "environment": settings.environment,
        "assistant_enabled": settings.assistant_enabled,
        "semantic_search_enabled": bool(settings.embedding_provider),
    }
