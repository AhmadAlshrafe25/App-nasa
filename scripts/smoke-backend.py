"""Read-only real HTTP verification; no browsers, data writes, or network LLM."""
import json
import sys
from urllib.request import urlopen

base = sys.argv[1].rstrip("/") if len(sys.argv) == 2 else "http://localhost:8000"


def get(path):
    with urlopen(base + path, timeout=15) as response:
        assert response.status == 200, (path, response.status)
        return response.read().decode()


assert json.loads(get("/health"))["status"] == "ok"
assert json.loads(get("/api/healthz")) == {"status": "ok"}
for astronaut_id in (1, 2):
    dashboard = json.loads(get(f"/astronauts/{astronaut_id}/dashboard"))
    assert dashboard["personal_baseline"]["observation_count"] == 7
for scenario, level in (
    ("normal", "Normal"), ("fatigue_isolation", "Attention Required"),
    ("critical_stress", "High Priority Alert"),
):
    result = json.loads(get(f"/simulate/{scenario}"))
    assert result["risk"]["level"] == level
    assert result["synthetic"] and not result["persisted"]
assert "SwaggerUIBundle" in get("/docs")
contract = json.loads(get("/openapi.json"))
assert contract["info"]["title"] == "Api"
assert "/companion/support" in contract["paths"]
print("PASS: health, compatibility route, two dashboards, three scenarios, Swagger, and OpenAPI")
