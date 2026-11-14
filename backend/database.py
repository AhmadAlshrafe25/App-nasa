"""Local SQLite storage; fixed baseline rows never absorb later check-ins."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3

from backend.models import Astronaut, CheckInInput, MissionLog, Observation, RiskAssessment
from backend.seed import ASTRONAUTS, baseline_samples


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AstronautNotFound(Exception):
    pass


class Database:
    def __init__(self, path: str | Path):
        self.path = Path(path)

    @contextmanager
    def connection(self, write=False):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 10000")
        try:
            if write:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as conn:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS astronauts (
                    id INTEGER PRIMARY KEY, name TEXT NOT NULL, mission TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS baseline_samples (
                    id INTEGER PRIMARY KEY, astronaut_id INTEGER NOT NULL REFERENCES astronauts(id),
                    day_index INTEGER NOT NULL, recorded_at TEXT NOT NULL, checkin_json TEXT NOT NULL,
                    UNIQUE(astronaut_id, day_index)
                );
                CREATE TABLE IF NOT EXISTS observations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, astronaut_id INTEGER NOT NULL REFERENCES astronauts(id),
                    recorded_at TEXT NOT NULL, checkin_json TEXT NOT NULL, assessment_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS observations_crew_time ON observations(astronaut_id, recorded_at);
                CREATE TABLE IF NOT EXISTS mission_logs (
                    id INTEGER PRIMARY KEY, astronaut_id INTEGER NOT NULL REFERENCES astronauts(id),
                    recorded_at TEXT NOT NULL, message TEXT NOT NULL, synthetic INTEGER NOT NULL,
                    seed_key TEXT UNIQUE
                );
            """)
        # One transaction makes concurrent/repeated initialization safe and idempotent.
        with self.connection(write=True) as conn:
            anchor = utc_now() - timedelta(hours=1)
            for astronaut in ASTRONAUTS:
                conn.execute("INSERT OR IGNORE INTO astronauts VALUES (:id, :name, :mission)", astronaut)
                for day, (timestamp, sample) in enumerate(baseline_samples(astronaut["id"], anchor)):
                    conn.execute(
                        "INSERT OR IGNORE INTO baseline_samples(astronaut_id, day_index, recorded_at, checkin_json) VALUES (?,?,?,?)",
                        (astronaut["id"], day, timestamp.isoformat(), sample.model_dump_json()),
                    )
                    conn.execute(
                        "INSERT OR IGNORE INTO mission_logs(astronaut_id, recorded_at, message, synthetic, seed_key) VALUES (?,?,?,?,?)",
                        (astronaut["id"], timestamp.isoformat(), f"Synthetic mission day {day + 1}: routine exercise and crew contact.", 1, f"{astronaut['id']}:{day}"),
                    )

    def context(self, conn, astronaut_id: int):
        astronaut = conn.execute("SELECT * FROM astronauts WHERE id=?", (astronaut_id,)).fetchone()
        if astronaut is None:
            raise AstronautNotFound()
        baseline = conn.execute("SELECT * FROM baseline_samples WHERE astronaut_id=? ORDER BY day_index", (astronaut_id,)).fetchall()
        baseline_observations = [
            Observation(id=f"baseline-{row['id']}", astronaut_id=astronaut_id,
                        recorded_at=row["recorded_at"], source="synthetic_baseline",
                        checkin=CheckInInput.model_validate_json(row["checkin_json"]))
            for row in baseline
        ]
        # Include last two observations regardless of age for "successive check-ins"
        # trend rules; the dashboard separately limits displayed history to 7 days.
        users = conn.execute(
            "SELECT * FROM observations WHERE astronaut_id=? ORDER BY recorded_at DESC, id DESC", (astronaut_id,)
        ).fetchall()
        user_observations = [
            Observation(id=f"checkin-{row['id']}", astronaut_id=astronaut_id,
                        recorded_at=row["recorded_at"], source="user_checkin",
                        checkin=CheckInInput.model_validate_json(row["checkin_json"]))
            for row in reversed(users)
        ]
        observations = sorted([*baseline_observations, *user_observations], key=lambda row: row.recorded_at)
        latest = observations[-1]
        saved_risk = RiskAssessment.model_validate_json(users[0]["assessment_json"]) if users and latest.source == "user_checkin" else None
        logs = conn.execute(
            "SELECT recorded_at,message,synthetic FROM mission_logs WHERE astronaut_id=? AND recorded_at>=? ORDER BY recorded_at",
            (astronaut_id, (utc_now() - timedelta(days=7)).isoformat()),
        ).fetchall()
        return (
            Astronaut(**dict(astronaut)), [row.checkin for row in baseline_observations],
            observations, latest, saved_risk,
            [MissionLog(recorded_at=row["recorded_at"], message=row["message"], synthetic=bool(row["synthetic"])) for row in logs],
        )

    def insert(self, conn, astronaut_id: int, checkin: CheckInInput, assessment: RiskAssessment) -> Observation:
        timestamp = utc_now()
        row = conn.execute(
            "INSERT INTO observations(astronaut_id,recorded_at,checkin_json,assessment_json) VALUES (?,?,?,?)",
            (astronaut_id, timestamp.isoformat(), checkin.model_dump_json(), assessment.model_dump_json()),
        )
        conn.execute(
            "INSERT INTO mission_logs(astronaut_id,recorded_at,message,synthetic) VALUES (?,?,?,?)",
            (astronaut_id, timestamp.isoformat(), "Check-in recorded; " + assessment.level.value + ".", 0),
        )
        return Observation(id=f"checkin-{row.lastrowid}", astronaut_id=astronaut_id, recorded_at=timestamp, source="user_checkin", checkin=checkin)
