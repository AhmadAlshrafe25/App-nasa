"""Run with `uv run --frozen python -m backend.main` from the workspace root."""
from contextlib import asynccontextmanager
import logging
import os
import sqlite3

from fastapi import APIRouter, FastAPI, HTTPException, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.database import AstronautNotFound, Database
from backend.models import (
    CheckInInput, CheckInResult, Dashboard, ErrorResponse, HealthResponse,
    HealthStatus, SimulationResult, SupportInput, SupportResponse,
)
from backend.service import HealthService, SCENARIOS, simulate
from backend.settings import Settings
from companion.companion import Companion

log = logging.getLogger("spacehealth")


def create_app(settings: Settings | None = None, companion: Companion | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    database = Database(settings.db_path)
    service = HealthService(database, settings.anomaly_method)
    companion = companion or Companion(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        database.initialize()
        yield

    app = FastAPI(
        title="Api", version="1.0.0", lifespan=lifespan,
        description="SpaceHealth synthetic-data demo. Local SQLite; offline-first, non-diagnostic support. No authentication: use only demonstration data. Statistical radiation changes are not validated exposure limits.",
        servers=[{"url": "/api", "description": "Shared preview API prefix; root aliases are also available"}],
        responses={
            404: {"model": ErrorResponse, "description": "Unknown astronaut or scenario"},
            422: {"model": ErrorResponse, "description": "Invalid input"},
            503: {"model": ErrorResponse, "description": "Local storage unavailable"},
        },
    )
    app.state.database, app.state.service = database, service
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"], allow_credentials=False)

    @app.exception_handler(AstronautNotFound)
    async def unknown_astronaut(request, exc):
        return JSONResponse(status_code=404, content={"error": {"code": "astronaut_not_found", "message": "Astronaut not found. Synthetic crew IDs are 1 and 2.", "details": []}})

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request, exc):
        details = [{"field": ".".join(map(str, error["loc"])), "message": error["msg"], "type": error["type"]} for error in exc.errors()]
        return JSONResponse(status_code=422, content={"error": {"code": "invalid_input", "message": "Check the required fields, units, and allowed values.", "details": details}})

    @app.exception_handler(sqlite3.Error)
    async def storage_unavailable(request, exc):
        log.error("Local SQLite operation failed (%s)", type(exc).__name__)
        return JSONResponse(status_code=503, content={"error": {"code": "storage_unavailable", "message": "Local storage is unavailable. The operation was not accepted; check the database path and disk access.", "details": []}})

    @app.exception_handler(StarletteHTTPException)
    async def api_error(request, exc):
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "not_found" if exc.status_code == 404 else "http_error", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": {**detail, "details": []}})

    router = APIRouter()

    @router.get("/healthz", response_model=HealthStatus, operation_id="healthCheck", tags=["health"])
    def healthz():
        return HealthStatus(status="ok")

    @router.get("/health", response_model=HealthResponse, operation_id="getHealth", tags=["health"])
    def health():
        with database.connection() as conn:
            conn.execute("SELECT 1").fetchone()
        return HealthResponse(status="ok", offline_mode=settings.offline_mode)

    @router.get("/astronauts/{astronaut_id}/dashboard", response_model=Dashboard, operation_id="getAstronautDashboard", tags=["health"])
    def dashboard(astronaut_id: int = Path(ge=1)):
        return service.dashboard(astronaut_id)

    @router.post("/astronauts/{astronaut_id}/checkin", response_model=CheckInResult, status_code=201, operation_id="submitAstronautCheckin", tags=["health"])
    def checkin(data: CheckInInput, astronaut_id: int = Path(ge=1)):
        return service.checkin(astronaut_id, data)

    @router.post("/companion/support", response_model=SupportResponse, operation_id="getCompanionSupport", tags=["companion"])
    def support(data: SupportInput):
        latest = service.dashboard(data.astronaut_id).latest_observation
        return companion.support(latest, data.allow_online)

    @router.get("/simulate/{scenario}", response_model=SimulationResult, operation_id="simulateScenario", tags=["demo"])
    def simulation(scenario: str):
        if scenario not in SCENARIOS:
            raise HTTPException(404, detail={"code": "scenario_not_found", "message": "Choose normal, fatigue_isolation, or critical_stress."})
        return simulate(scenario, settings.anomaly_method)

    app.include_router(router)
    app.include_router(router, prefix="/api", include_in_schema=False)

    @app.get("/api", include_in_schema=False)
    def api_info():
        return {"service": "SpaceHealth Python API", "docs": "/docs", "health": "/health", "demo_only": True}

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
