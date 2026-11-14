"""FastAPI app. Run: `uv run --frozen python -m backend.main` (serves 0.0.0.0:8000)."""
import json
import os
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ai.anomaly_detection import analyze
from ai.risk_assessment import assess
from backend import database as db
from backend.models import (Assessment, CheckInRequest, FamilyMessage, FamilyMessageIn, CheckInResponse, Dashboard, SimulationResponse,
                            HealthStatus, MoodTag, SupportRequest, SupportResponse, SyncResult, SyncStatus)
from companion import companion

MARS_DELAY_MINUTES = 14

SCENARIOS = {
    "normal": ("Steady day close to the personal baseline.",
               dict(heart_rate_bpm=63, systolic_bp=118, diastolic_bp=76, sleep_hours=7.4, stress_score=3,
                    mood="calm", activity_minutes=110, radiation_msv=0.55, isolation_level=3)),
    "fatigue_isolation": ("Poor sleep, high stress and strong isolation.",
                          dict(heart_rate_bpm=74, systolic_bp=126, diastolic_bp=82, sleep_hours=4.6, stress_score=8,
                               mood="lonely", activity_minutes=40, radiation_msv=0.55, isolation_level=8)),
    "radiation_spike": ("Radiation reading well above baseline with mild physiological strain.",
                        dict(heart_rate_bpm=82, systolic_bp=124, diastolic_bp=80, sleep_hours=5.8, stress_score=7,
                             mood="anxious", activity_minutes=60, radiation_msv=1.6, isolation_level=4)),
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.seed_source = db.init_db()
    yield


app = FastAPI(generate_unique_id_function=lambda route: route.name, title="Astronaut Health Monitoring System & Space Companion", version="1.0.0", lifespan=lifespan,
              description="Offline-first onboard health backend. Detection, risk scoring and companion fallback run locally; "
                          "check-ins queue for Earth sync with a simulated 14-minute Mars delay. Not a medical device.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def _require_astronaut(conn, astronaut_id: str):
    if not db.astronaut_exists(conn, astronaut_id):
        raise HTTPException(404, f"Unknown astronaut '{astronaut_id}'")


def _evaluate(conn, astronaut_id: str, current: dict, history: list[dict]) -> dict:
    analysis = analyze(current, history)
    result = assess(current, analysis)
    return {**result, "baseline_comparison": analysis["baseline_comparison"], "trend_alerts": analysis["trend_alerts"],
            "isolation_forest": analysis["isolation_forest"], "baseline": analysis["baseline"]}


def _public_log(row: dict) -> dict:
    return {k: row[k] for k in ("id", "astronaut_id", "logged_at", "risk_level", *db.FIELDS)}


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "service": "astronaut-health-backend", "offline_capable": True,
            "references": {
                "nasa_hrp": "https://www.nasa.gov/hrp/",
                "nasa_hrp_five_hazards": "https://www.nasa.gov/hrp/hazards/",
                "csa_space_health": "https://www.asc-csa.gc.ca/eng/astronauts/space-health/default.asp",
                "csa_radiation": "https://www.asc-csa.gc.ca/eng/sciences/cans/radiation.asp"}}


@app.get("/astronauts/{astronaut_id}/dashboard", response_model=Dashboard, tags=["astronauts"])
def dashboard(astronaut_id: str):
    with db.connect() as conn:
        _require_astronaut(conn, astronaut_id)
        logs = db.recent_logs(conn, astronaut_id, 15)
    latest, history = logs[-1], logs[:-1]
    res = _evaluate(None, astronaut_id, latest, history)
    return {"astronaut_id": astronaut_id, "baseline": res["baseline"], "last_logs": [_public_log(r) for r in logs[-14:]],
            **{k: res[k] for k in ("baseline_comparison", "trend_alerts", "isolation_forest", "risk_level", "reasons", "recommended_actions",
                                   "next_checkin_hours", "routine_prompt")}}


@app.post("/astronauts/{astronaut_id}/checkin", response_model=CheckInResponse, tags=["astronauts"])
def checkin(astronaut_id: str, body: CheckInRequest):
    data = body.model_dump()
    with db.connect() as conn:
        _require_astronaut(conn, astronaut_id)
        history = db.recent_logs(conn, astronaut_id, 60)
        res = _evaluate(conn, astronaut_id, data, history)
        log_id = db.insert_log(conn, astronaut_id, data, risk_level=res["risk_level"], reasons=res["reasons"])
        payload = {**data, "risk_level": res["risk_level"], "reasons": res["reasons"]}
        conn.execute("INSERT INTO sync_queue (log_id, astronaut_id, payload, status, queued_at) VALUES (?,?,?,?,?)",
                     (log_id, astronaut_id, json.dumps(payload), "PENDING_EARTH_SYNC", db.now_iso()))
    return {"log_id": log_id, "astronaut_id": astronaut_id, "sync_status": "PENDING_EARTH_SYNC",
            "sync_note": f"Processed onboard. Queued for Earth ({MARS_DELAY_MINUTES}-minute one-way delay, simulated).",
            "assessment": res}


@app.post("/companion/support", response_model=SupportResponse, tags=["companion"])
def companion_support(body: SupportRequest):
    with db.connect() as conn:
        _require_astronaut(conn, body.astronaut_id)
        latest = db.recent_logs(conn, body.astronaut_id, 1)[0]
        media = companion.pick_family_media(db.family_messages(conn, body.astronaut_id, unviewed_only=True),
                                            latest["mood"], latest["isolation_level"])
    out = companion.support(latest["sleep_hours"], latest["mood"], latest["stress_score"], latest["isolation_level"],
                            allow_online=body.allow_online)
    return {"astronaut_id": body.astronaut_id, **out, "recommended_family_media": media}


@app.post("/family/messages", response_model=FamilyMessage, status_code=201, tags=["family"])
def post_family_message(body: FamilyMessageIn):
    if body.media_type in ("audio", "video") and not body.media_url:
        raise HTTPException(422, "media_url is required for audio and video messages")
    if body.media_type == "text" and not (body.message_text or "").strip():
        raise HTTPException(422, "message_text is required for text messages")
    with db.connect() as conn:
        _require_astronaut(conn, body.astronaut_id)
        return db.insert_family_message(conn, body.model_dump())


@app.get("/family/messages/{astronaut_id}", response_model=list[FamilyMessage], tags=["family"])
def list_family_messages(astronaut_id: str, mood_tag: Optional[MoodTag] = None):
    with db.connect() as conn:
        _require_astronaut(conn, astronaut_id)
        return db.family_messages(conn, astronaut_id, mood_tag)


@app.patch("/family/messages/{message_id}/viewed", response_model=FamilyMessage, tags=["family"])
def mark_family_message_viewed(message_id: int):
    with db.connect() as conn:
        msg = db.mark_family_viewed(conn, message_id)
    if not msg:
        raise HTTPException(404, f"Unknown message '{message_id}'")
    return msg


def _sync_item(r) -> dict:
    return {"id": r["id"], "log_id": r["log_id"], "astronaut_id": r["astronaut_id"], "status": r["status"],
            "queued_at": r["queued_at"], "synced_at": r["synced_at"], "payload": json.loads(r["payload"])}


@app.get("/mission/sync-status", response_model=SyncStatus, tags=["mission"])
def sync_status():
    with db.connect() as conn:
        rows = conn.execute("SELECT * FROM sync_queue WHERE status='PENDING_EARTH_SYNC' ORDER BY id").fetchall()
    return {"pending_count": len(rows), "mars_delay_minutes": MARS_DELAY_MINUTES, "pending_items": [_sync_item(r) for r in rows]}


@app.post("/mission/sync", response_model=SyncResult, tags=["mission"])
def mission_sync():
    ts = db.now_iso()
    with db.connect() as conn:
        n = conn.execute("UPDATE sync_queue SET status='SYNCED', synced_at=? WHERE status='PENDING_EARTH_SYNC'", (ts,)).rowcount
    return {"synced_count": n, "synced_at": ts, "mars_delay_minutes": MARS_DELAY_MINUTES,
            "note": "Simulated Earth-link window; no real network transfer."}


@app.get("/simulate/{scenario}", response_model=SimulationResponse, tags=["simulate"])
def simulate(scenario: str):
    if scenario not in SCENARIOS:
        raise HTTPException(404, f"Unknown scenario '{scenario}'. Use: {', '.join(SCENARIOS)}")
    desc, data = SCENARIOS[scenario]
    # Fixed local history and offline companion: output never depends on stored check-ins or the network.
    history = [r for r in db.generate_synthetic() if r["astronaut_id"] == "AST-01"]
    res = _evaluate(None, "AST-01", data, history)
    comp = companion.offline_support(data["sleep_hours"], data["mood"], data["stress_score"], data["isolation_level"])
    return {"scenario": scenario, "description": desc, "astronaut_id": "AST-01", "input": data, "assessment": res,
            "companion": {"astronaut_id": "AST-01", **comp}}


@app.get("/healthz", response_model=HealthStatus, operation_id="healthCheck", tags=["system"])
def healthz():
    return {"status": "ok"}


# Preview/proxy prefix: expose every route again under /api (hidden from Swagger).
for _route in [r for r in app.routes if getattr(r, "path", "").startswith(("/health", "/astronauts", "/companion", "/family", "/mission", "/simulate"))]:
    app.add_api_route("/api" + _route.path, _route.endpoint, methods=list(_route.methods), include_in_schema=False)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
