import builtins
import json
from pathlib import Path
import sqlite3
import subprocess
import sys

from fastapi.testclient import TestClient
import httpx
import pytest
import yaml

from ai.anomaly_detection import analyze
from ai.risk_assessment import assess
from backend.main import create_app
from backend.models import CheckInInput, RiskLevel
from backend.service import SCENARIOS, simulate
from backend.settings import Settings
from companion.companion import Companion


@pytest.fixture
def app(tmp_path):
    return create_app(Settings(db_path=tmp_path / "astronaut_health.db"))


@pytest.fixture
def client(app):
    with TestClient(app) as client:
        yield client


def normal(**changes):
    return SCENARIOS["normal"].model_copy(update=changes)


def payload(**changes):
    return normal(**changes).model_dump()


def test_seeded_dashboard_and_units(client):
    for astronaut_id in (1, 2):
        response = client.get(f"/astronauts/{astronaut_id}/dashboard")
        assert response.status_code == 200
        data = response.json()
        assert data["astronaut"]["id"] == astronaut_id
        assert data["astronaut"]["synthetic"] is True
        assert len(data["recent_history"]) == 7
        assert len(data["mission_logs"]) == 7
        assert data["personal_baseline"]["observation_count"] == 7
        assert data["personal_baseline"]["metrics"]["radiation_exposure"]["unit"] == "microsieverts/24h"
        assert data["latest_risk_assessment"]["level"] == "Normal"
        assert all(row["source"] == "synthetic_baseline" for row in data["recent_history"])


def test_health_aliases_swagger_and_cors(client):
    assert client.get("/health").json()["offline_mode"] is True
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/healthz").json() == {"status": "ok"}
    docs = client.get("/docs")
    assert docs.status_code == 200
    assert "SwaggerUIBundle" in docs.text
    assert "/openapi.json" in docs.text
    assert client.get("/openapi.json").json()["info"]["title"] == "Api"
    assert client.get("/").status_code == 404  # Does not claim the frontend root.
    response = client.options("/astronauts/1/checkin", headers={
        "Origin": "https://crew.example", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"
    assert "access-control-allow-credentials" not in response.headers


def test_six_required_fields_and_missing_radiation(client):
    data = payload()
    del data["radiation_exposure"]
    response = client.post("/astronauts/1/checkin", json=data)
    assert response.status_code == 201
    body = response.json()
    assert body["observation"]["source"] == "user_checkin"
    radiation = next(row for row in body["risk"]["anomalies"]["signals"] if row["feature"] == "radiation_exposure")
    assert radiation["current"] is None and radiation["status"] == "unavailable"
    assert any("unavailable" in reason for reason in body["reasons"])
    assert body["risk"]["level"] == "Normal"


def test_saved_checkin_is_latest_and_baseline_stays_fixed(client):
    before = client.get("/astronauts/1/dashboard").json()
    other_before = client.get("/astronauts/2/dashboard").json()
    result = client.post("/api/astronauts/1/checkin", json=payload(heart_rate=100)).json()
    after = client.get("/astronauts/1/dashboard").json()
    assert after["personal_baseline"] == before["personal_baseline"]
    assert after["latest_observation"] == result["observation"]
    assert after["latest_risk_assessment"] == result["risk"]
    assert len(after["recent_history"]) == 8
    assert client.get("/astronauts/2/dashboard").json() == other_before


@pytest.mark.parametrize("changes", [
    {"heart_rate": -1}, {"heart_rate": "64"}, {"heart_rate": True},
    {"sleep_hours": 25}, {"stress_level": 0}, {"stress_level": 3.5},
    {"mood": "unknown"}, {"activity_minutes": 1441}, {"isolation_level": 11},
    {"radiation_exposure": -1}, {"private_note": "do-not-echo-this-value"},
])
def test_invalid_inputs_are_clear_and_do_not_echo_values(client, changes):
    response = client.post("/astronauts/1/checkin", json={**payload(), **changes})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"
    assert "do-not-echo-this-value" not in response.text
    assert len(client.get("/astronauts/1/dashboard").json()["recent_history"]) == 7


@pytest.mark.parametrize("field", ["heart_rate", "sleep_hours", "stress_level", "mood", "activity_minutes", "isolation_level"])
def test_every_required_field_is_required(client, field):
    data = payload()
    del data[field]
    assert client.post("/astronauts/1/checkin", json=data).status_code == 422


def test_unknown_crew_and_scenarios(client):
    assert client.get("/astronauts/999/dashboard").json()["error"]["code"] == "astronaut_not_found"
    assert client.post("/astronauts/999/checkin", json=payload()).status_code == 404
    assert client.post("/companion/support", json={"astronaut_id": 999}).status_code == 404
    assert client.get("/simulate/no-such-scenario").json()["error"]["code"] == "scenario_not_found"
    assert client.post("/companion/support", json={}).status_code == 422


def test_scenarios_are_deterministic_isolated_and_share_the_pipeline(client):
    before = client.get("/astronauts/1/dashboard").json()
    for scenario, expected in (
        ("normal", "Normal"), ("fatigue_isolation", "Attention Required"),
        ("critical_stress", "High Priority Alert"),
    ):
        first = client.get(f"/simulate/{scenario}").json()
        assert first == client.get(f"/simulate/{scenario}").json()
        assert first["risk"]["level"] == expected
        assert first["synthetic"] is True and first["persisted"] is False
        assert first["observation"]["source"] == "synthetic_simulation"
        assert len(first["companion"]["action_suggestion"]) > 0
    assert client.get("/astronauts/1/dashboard").json() == before


def test_single_minor_spike_cannot_be_high_priority(client):
    result = client.post("/astronauts/1/checkin", json=payload(heart_rate=75)).json()
    assert result["risk"]["level"] == "Attention Required"
    flagged = [signal for signal in result["risk"]["anomalies"]["signals"] if signal["severity"]]
    assert len(flagged) == 1 and flagged[0]["severity"] == 1


def test_multiple_changes_and_trends_escalate(client):
    data = payload(sleep_hours=5.9, stress_level=6)
    results = [client.post("/astronauts/1/checkin", json=data).json() for _ in range(3)]
    assert results[0]["risk"]["level"] == "Attention Required"
    assert results[2]["risk"]["level"] == "High Priority Alert"
    assert len(results[2]["risk"]["trends"]) >= 2


def test_zero_variance_and_insufficient_baselines():
    baseline = [normal()] * 7
    result = analyze(normal(heart_rate=66), baseline)
    heart = next(signal for signal in result.signals if signal.feature == "heart_rate")
    assert heart.status == "within_pattern"
    assert heart.deviation_score == .2
    sparse = analyze(normal(), baseline[:2])
    assert all(signal.status == "insufficient_baseline" for signal in sparse.signals)
    missing = analyze(normal(), [normal(radiation_exposure=None)] * 7)
    assert missing.signals[-1].status == "insufficient_baseline"
    assert assess(normal(), [], []).level == RiskLevel.ATTENTION


@pytest.mark.parametrize("field,value", [("heart_rate", "NaN"), ("sleep_hours", "Infinity"), ("radiation_exposure", "NaN")])
def test_non_finite_numbers_are_rejected_without_error_serialization_failures(client, field, value):
    data = payload()
    data[field] = "NON_FINITE_PLACEHOLDER"
    raw = json.dumps(data).replace('"NON_FINITE_PLACEHOLDER"', value)
    response = client.post("/astronauts/1/checkin", content=raw, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_input"


def test_radiation_alone_is_not_exposure_limit_or_high_priority():
    result = assess(normal(radiation_exposure=30), [normal()] * 7, [])
    assert result.level == RiskLevel.ATTENTION
    assert "not a validated exposure limit" in result.anomalies.signals[-1].explanation
    assert result.anomalies.signals[-1].severity == 2


def test_optional_model_is_reproducible_and_excludes_missing_radiation():
    pytest.importorskip("sklearn")
    baseline = [normal(heart_rate=64 + index % 3) for index in range(7)]
    current = normal(radiation_exposure=None)
    first = analyze(current, baseline, "isolation_forest")
    assert first == analyze(current, baseline, "isolation_forest")
    assert "radiation_exposure" not in first.isolation_forest.features
    assert first.isolation_forest.status in ("inlier", "outlier")


def test_optional_model_unavailable_still_uses_baseline(monkeypatch):
    original = builtins.__import__
    def blocked(name, *args, **kwargs):
        if name.startswith("sklearn"):
            raise ImportError("simulated missing optional package")
        return original(name, *args, **kwargs)
    monkeypatch.setattr(builtins, "__import__", blocked)
    result = analyze(normal(heart_rate=75), [normal()] * 7, "isolation_forest")
    assert result.isolation_forest.status == "unavailable"
    assert result.signals[0].severity == 1


def test_transaction_rolls_back_if_save_fails(client, app, monkeypatch):
    original = app.state.database.insert
    def broken(*args):
        original(*args)
        raise sqlite3.OperationalError("simulated disk error")
    monkeypatch.setattr(app.state.database, "insert", broken)
    result = client.post("/astronauts/1/checkin", json=payload())
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "storage_unavailable"
    assert len(client.get("/astronauts/1/dashboard").json()["recent_history"]) == 7
    assert len(client.get("/astronauts/1/dashboard").json()["mission_logs"]) == 7


def test_restart_persistence_and_idempotent_seeding_in_separate_processes(tmp_path):
    db = str(tmp_path / "restart.db")
    script = """
from pathlib import Path
from backend.main import create_app
from backend.settings import Settings
from fastapi.testclient import TestClient
import json,sys
app=create_app(Settings(db_path=Path(sys.argv[1])))
with TestClient(app) as c:
    if sys.argv[2]=='write':
        result=c.post('/astronauts/1/checkin',json=dict(heart_rate=75,sleep_hours=7.5,stress_level=3,mood='good',activity_minutes=90,isolation_level=2))
        assert result.status_code==201
    print(json.dumps(c.get('/astronauts/1/dashboard').json()))
"""
    first = subprocess.run([sys.executable, "-c", script, db, "write"], capture_output=True, text=True, check=True)
    second = subprocess.run([sys.executable, "-c", script, db, "read"], capture_output=True, text=True, check=True)
    assert json.loads(first.stdout) == json.loads(second.stdout)
    with sqlite3.connect(db) as conn:
        assert conn.execute("SELECT count(*) FROM baseline_samples").fetchone()[0] == 14
        assert conn.execute("SELECT count(*) FROM astronauts").fetchone()[0] == 2
        assert conn.execute("SELECT count(*) FROM observations").fetchone()[0] == 1
        assert conn.execute("SELECT count(*) FROM mission_logs").fetchone()[0] == 15


def test_companion_uses_latest_state_and_works_without_key(client, monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Offline support must never attempt a network call")
    monkeypatch.setattr(httpx.Client, "stream", forbidden)
    # TestClient uses send(), not Client.stream().
    client.post("/astronauts/1/checkin", json=payload(sleep_hours=4, stress_level=8, mood="very_low", isolation_level=9))
    result = client.post("/companion/support", json={"astronaut_id": 1, "allow_online": True}).json()
    assert result == client.post("/companion/support", json={"astronaut_id": 1, "allow_online": True}).json()
    assert result["mode"] == "offline" and result["fallback_reason"] == "not_configured"
    assert "4 hours" in result["summary"] and "stress 8/10" in result["summary"]
    assert "very low mood" in result["summary"] and "isolation 9/10" in result["summary"]
    assert result["family_message"]["kind"] == "audio"
    assert result["family_message"]["recommendation"].startswith("If ")
    assert result["non_diagnostic"] is True


def online_app(tmp_path, handler, **changes):
    settings = Settings(
        db_path=tmp_path / "online.db", llm_api_key="test-only-not-a-real-key",
        llm_base_url="https://provider.example/v1", llm_model="test-model", **changes,
    )
    return create_app(settings, Companion(settings, httpx.MockTransport(handler)))


def test_online_is_opt_in_and_sends_no_identity_or_history(tmp_path):
    calls = []
    content = simulate("normal").companion.model_dump()
    def provider(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content)}}]})
    with TestClient(online_app(tmp_path, provider)) as client:
        assert client.get("/health").json()["offline_mode"] is False
        assert client.post("/companion/support", json={"astronaut_id": 1}).json()["mode"] == "offline"
        assert not calls
        assert client.post("/companion/support", json={"astronaut_id": 1, "allow_online": True}).json()["mode"] == "online"
    sent = json.loads(calls[0]["messages"][1]["content"])
    assert set(sent) == {"sleep_hours", "mood", "stress_level", "isolation_level"}


@pytest.mark.parametrize("failure, expected", [
    ("network", "provider_unavailable"), ("http", "provider_unavailable"),
    ("malformed", "invalid_response"), ("unsafe", "invalid_response"), ("oversize", "invalid_response"),
])
def test_optional_provider_failures_fall_back_safely(tmp_path, failure, expected):
    def provider(request):
        if failure == "network":
            raise httpx.ConnectError("simulated unavailable network", request=request)
        if failure == "http":
            return httpx.Response(503)
        if failure == "oversize":
            return httpx.Response(200, content=b"x" * 20_000)
        content = {"summary": "You have depression.", "action_suggestion": "Ask for medication.", "family_message": {"kind": "message", "recommendation": "Draft a message.", "reason": "Connection."}}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(content) if failure == "unsafe" else "{}"}}]})
    with TestClient(online_app(tmp_path, provider)) as client:
        response = client.post("/companion/support", json={"astronaut_id": 1, "allow_online": True})
        assert response.status_code == 200
        result = response.json()
        assert result["mode"] == "offline" and result["fallback_reason"] == expected
        assert "depression" not in result["summary"]


def test_forced_offline_never_contacts_configured_provider(tmp_path):
    def forbidden(request):
        raise AssertionError("No network allowed")
    with TestClient(online_app(tmp_path, forbidden, force_offline=True)) as client:
        assert client.get("/health").json()["offline_mode"] is True
        result = client.post("/companion/support", json={"astronaut_id": 1, "allow_online": True}).json()
        assert result["mode"] == "offline" and result["fallback_reason"] == "forced_offline"


def test_shared_openapi_matches_runtime_contract(client):
    spec = yaml.safe_load(Path("lib/api-spec/openapi.yaml").read_text())
    assert spec == client.get("/openapi.json").json()
    assert spec["info"]["title"] == "Api" and spec["servers"][0]["url"] == "/api"
    assert spec["paths"]["/healthz"]["get"]["operationId"] == "healthCheck"
    assert "HealthStatus" in spec["components"]["schemas"]
