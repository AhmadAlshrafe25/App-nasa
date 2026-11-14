import httpx

from backend import database as db
from companion import companion
from backend.tests.conftest import reading


def test_checkin_queues_then_sync_clears(client):
    assert client.get("/mission/sync-status").json()["pending_count"] == 0
    r = client.post("/astronauts/AST-01/checkin", json=reading())
    assert r.status_code == 200
    assert r.json()["sync_status"] == "PENDING_EARTH_SYNC"
    status = client.get("/mission/sync-status").json()
    assert status["pending_count"] == 1
    assert status["pending_items"][0]["log_id"] == r.json()["log_id"]

    synced = client.post("/mission/sync").json()
    assert synced["synced_count"] == 1
    assert client.get("/mission/sync-status").json()["pending_count"] == 0
    assert client.post("/mission/sync").json()["synced_count"] == 0


def test_checkin_persists_log_and_validates(client):
    client.post("/astronauts/AST-02/checkin", json=reading(stress_score=7))
    with db.connect() as conn:
        last = db.recent_logs(conn, "AST-02", 1)[0]
    assert last["stress_score"] == 7 and last["risk_level"]
    assert client.post("/astronauts/AST-02/checkin", json=reading(stress_score=11)).status_code == 422


def test_unknown_astronaut_404(client):
    assert client.post("/astronauts/NOPE/checkin", json=reading()).status_code == 404
    assert client.get("/astronauts/NOPE/dashboard").status_code == 404


def test_dashboard_shape(client):
    d = client.get("/astronauts/AST-01/dashboard").json()
    assert d["risk_level"] in ("Normal", "Attention Required", "High Priority Alert")
    assert len(d["last_logs"]) == 14


def test_dashboard_includes_isolation_forest(client):
    forest = client.get("/astronauts/AST-01/dashboard").json()["isolation_forest"]
    assert set(forest) == {"available", "anomaly_score", "is_outlier", "note"}
    assert forest["available"] is True
    assert 0 <= forest["anomaly_score"] <= 1
    assert isinstance(forest["is_outlier"], bool)
    assert forest["note"]
    assert client.get("/api/astronauts/AST-01/dashboard").json()["isolation_forest"] == forest


def test_api_prefix_alias(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_single_spike_checkin_not_high_priority(client):
    r = client.post("/astronauts/AST-01/checkin", json=reading(stress_score=8))
    assert r.json()["assessment"]["risk_level"] != "High Priority Alert"


def test_companion_offline_without_key(client):
    r = client.post("/companion/support", json={"astronaut_id": "AST-01"}).json()
    assert r["source"] == "offline_fallback"
    assert "not a diagnosis" in r["summary"]


def test_companion_falls_back_when_llm_fails(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_BASE_URL", "https://llm.invalid/v1")

    def boom(*a, **k):
        raise httpx.ConnectError("down")
    monkeypatch.setattr(companion.httpx, "post", boom)
    r = client.post("/companion/support", json={"astronaut_id": "AST-01"}).json()
    assert r["source"] == "offline_fallback"


def test_companion_allow_online_false_skips_llm(client, monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setattr(companion.httpx, "post", lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    r = client.post("/companion/support", json={"astronaut_id": "AST-01", "allow_online": False}).json()
    assert r["source"] == "offline_fallback"


def test_companion_rejects_unsafe_base_url(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "k")
    monkeypatch.setenv("LLM_BASE_URL", "http://evil.example.com/v1")
    out = companion.support(7, "calm", 3, 3)
    assert out["source"] == "offline_fallback"


def test_offline_support_deterministic_and_stress_driven():
    a = companion.offline_support(7, "calm", 8, 3)
    assert a == companion.offline_support(7, "calm", 8, 3)
    assert "Box breathing" in a["relaxation_action"]
