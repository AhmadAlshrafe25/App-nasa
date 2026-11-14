import os
import tempfile

# Point storage at a throwaway DB before the app modules are imported.
_TMP = tempfile.mkdtemp(prefix="astronaut-test-")
os.environ["ASTRONAUT_DB_PATH"] = os.path.join(_TMP, "test.db")
os.environ.pop("LLM_API_KEY", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend import database as db  # noqa: E402


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Fresh, seeded temp database per test; never touches the real DB file."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    from backend.main import app
    with TestClient(app) as c:
        yield c


def reading(**over):
    base = dict(heart_rate_bpm=63, systolic_bp=118, diastolic_bp=76, sleep_hours=7.4, stress_score=3,
                mood="calm", activity_minutes=110, radiation_msv=0.55, isolation_level=3)
    base.update(over)
    return base


def steady_history(n=14, **over):
    return [reading(**over) for _ in range(n)]
