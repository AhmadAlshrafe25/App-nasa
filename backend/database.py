"""SQLite storage, CSV seeding and a synthetic 30-day fallback generator."""
import csv
import json
import os
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("ASTRONAUT_DB_PATH", ROOT / "astronaut_health.db"))
CSV_PATH = ROOT / "data" / "astronaut_health_dataset.csv"
ASTRONAUTS = ["AST-01", "AST-02", "AST-03"]
FIELDS = ["heart_rate_bpm", "systolic_bp", "diastolic_bp", "sleep_hours", "stress_score",
          "mood", "activity_minutes", "radiation_msv", "isolation_level"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS astronaut_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    logged_at TEXT NOT NULL,
    heart_rate_bpm REAL NOT NULL, systolic_bp REAL NOT NULL, diastolic_bp REAL NOT NULL,
    sleep_hours REAL NOT NULL, stress_score REAL NOT NULL, mood TEXT NOT NULL,
    activity_minutes REAL NOT NULL, radiation_msv REAL NOT NULL, isolation_level REAL NOT NULL,
    risk_level TEXT, reasons TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_astronaut ON astronaut_logs (astronaut_id, logged_at, id);
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id INTEGER NOT NULL REFERENCES astronaut_logs(id),
    astronaut_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_EARTH_SYNC',
    queued_at TEXT NOT NULL,
    synced_at TEXT
);
CREATE TABLE IF NOT EXISTS family_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    astronaut_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('video','audio','text')),
    title TEXT NOT NULL,
    message_text TEXT,
    media_url TEXT,
    mood_tag TEXT NOT NULL DEFAULT 'general' CHECK (mood_tag IN ('anxious','lonely','tired','general')),
    is_viewed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_astronaut ON family_messages (astronaut_id, is_viewed, created_at);
"""

# Fictional sample content; media URLs are placeholders, not real recordings.
FAMILY_SEED = [
    ("Mom", "Mother", "video", "You're doing amazing, sweetheart",
     "Hi love! The whole street asks about you. Look out the window tonight; we're all looking up at the same sky.",
     "https://example.invalid/demo/mom-encouragement.mp4", "lonely"),
    ("Jake", "Close friend", "audio", "Voice note: the worst joke of the year",
     "A silly voice note about the time we got lost on the way to the lake. Laugh, then rest.",
     "https://example.invalid/demo/jake-funny-note.mp3", "tired"),
    ("Dad & Lena", "Father and sister", "audio", "Breathe with us: 2-minute grounding",
     "Slow breathing together: in for 4, hold for 4, out for 6. Feel your feet, name three things you can see.",
     "https://example.invalid/demo/family-grounding.mp3", "anxious"),
    ("Mom", "Mother", "text", "Halfway there!",
     "You've passed the halfway mark of the mission. We made a countdown chain at home and just removed another link.",
     None, "general"),
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def generate_synthetic(days: int = 30) -> list[dict]:
    """Deterministic, plausible daily logs. Fictional data, not medical records."""
    rng = random.Random(2026)
    profiles = {  # hr, sys, dia, sleep, stress, activity, radiation, isolation
        "AST-01": (62, 118, 76, 7.4, 3.0, 110, 0.55, 3.0),
        "AST-02": (68, 122, 79, 7.0, 3.5, 95, 0.60, 3.5),
        "AST-03": (59, 115, 74, 7.7, 2.5, 120, 0.50, 2.5),
    }
    start = datetime.now(timezone.utc).replace(hour=8, minute=0, second=0, microsecond=0) - timedelta(days=days)
    rows = []
    for aid, (hr, sy, di, sl, st, ac, rad, iso) in profiles.items():
        for d in range(days):
            drift = d / days  # isolation slowly builds over the mission
            stress = max(0, min(10, rng.gauss(st + drift, 0.7)))
            sleep = max(3.5, rng.gauss(sl - 0.4 * drift, 0.4))
            rows.append({
                "astronaut_id": aid, "logged_at": (start + timedelta(days=d + 1)).isoformat(timespec="seconds"),
                "heart_rate_bpm": round(rng.gauss(hr + stress * 0.5, 2.0), 1),
                "systolic_bp": round(rng.gauss(sy, 3)), "diastolic_bp": round(rng.gauss(di, 2)),
                "sleep_hours": round(sleep, 1), "stress_score": round(stress, 1),
                "mood": "calm" if stress < 3.5 else "neutral" if stress < 5 else "tense",
                "activity_minutes": round(max(20, rng.gauss(ac, 12))),
                "radiation_msv": round(max(0.1, rng.gauss(rad, 0.05)), 3),
                "isolation_level": round(max(0, min(10, rng.gauss(iso + 2 * drift, 0.6))), 1),
            })
    return rows


def _read_csv() -> list[dict]:
    rows = []
    with CSV_PATH.open(newline="") as fh:
        for i, rec in enumerate(csv.DictReader(fh), start=2):
            try:
                row = {f: (rec[f].strip() if f == "mood" else float(rec[f])) for f in FIELDS}
                row["astronaut_id"] = rec["astronaut_id"].strip()
                row["logged_at"] = (rec.get("logged_at") or rec.get("timestamp") or rec.get("date") or now_iso()).strip()
            except (KeyError, ValueError, AttributeError) as exc:
                raise ValueError(f"{CSV_PATH.name} line {i}: invalid or missing column ({exc})") from exc
            rows.append(row)
    return rows


def init_db() -> str:
    """Create tables and seed when empty. Returns the seed source."""
    with connect() as conn:
        conn.executescript(SCHEMA)
        if not conn.execute("SELECT COUNT(*) FROM family_messages").fetchone()[0]:
            base = datetime.now(timezone.utc) - timedelta(days=4)
            for i, (name, rel, mt, title, text, url, tag) in enumerate(FAMILY_SEED):
                conn.execute(
                    "INSERT INTO family_messages (astronaut_id, sender_name, relationship, media_type, title, message_text,"
                    " media_url, mood_tag, is_viewed, created_at) VALUES (?,?,?,?,?,?,?,?,0,?)",
                    ("AST-01", name, rel, mt, title, text, url, tag,
                     (base + timedelta(days=i)).isoformat(timespec="seconds")))
        if conn.execute("SELECT COUNT(*) FROM astronaut_logs").fetchone()[0]:
            return "existing"
        source, rows = ("csv", _read_csv()) if CSV_PATH.exists() else ("synthetic", generate_synthetic())
        for row in rows:
            insert_log(conn, row["astronaut_id"], row, row["logged_at"])
        return source


def insert_log(conn, astronaut_id: str, data: dict, logged_at: str | None = None,
               risk_level: str | None = None, reasons: list[str] | None = None) -> int:
    cur = conn.execute(
        f"INSERT INTO astronaut_logs (astronaut_id, logged_at, {', '.join(FIELDS)}, risk_level, reasons) "
        f"VALUES (?, ?, {', '.join('?' * len(FIELDS))}, ?, ?)",
        [astronaut_id, logged_at or now_iso(), *[data[f] for f in FIELDS], risk_level,
         json.dumps(reasons) if reasons is not None else None],
    )
    return cur.lastrowid


def recent_logs(conn, astronaut_id: str, limit: int) -> list[dict]:
    """Newest `limit` logs, returned oldest-first."""
    rows = conn.execute(
        "SELECT * FROM astronaut_logs WHERE astronaut_id=? ORDER BY logged_at DESC, id DESC LIMIT ?",
        (astronaut_id, limit)).fetchall()
    return [dict(r) for r in reversed(rows)]


def astronaut_exists(conn, astronaut_id: str) -> bool:
    return conn.execute("SELECT 1 FROM astronaut_logs WHERE astronaut_id=? LIMIT 1", (astronaut_id,)).fetchone() is not None


def insert_family_message(conn, d: dict) -> dict:
    cur = conn.execute(
        "INSERT INTO family_messages (astronaut_id, sender_name, relationship, media_type, title, message_text,"
        " media_url, mood_tag, is_viewed, created_at) VALUES (?,?,?,?,?,?,?,?,0,?)",
        (d["astronaut_id"], d["sender_name"], d["relationship"], d["media_type"], d["title"], d.get("message_text"),
         d.get("media_url"), d["mood_tag"], now_iso()))
    return family_message(conn, cur.lastrowid)


def family_message(conn, message_id: int) -> dict | None:
    r = conn.execute("SELECT * FROM family_messages WHERE id=?", (message_id,)).fetchone()
    return _fam(r) if r else None


def family_messages(conn, astronaut_id: str, mood_tag: str | None = None, unviewed_only: bool = False) -> list[dict]:
    q, args = "SELECT * FROM family_messages WHERE astronaut_id=?", [astronaut_id]
    if mood_tag:
        q += " AND mood_tag=?"; args.append(mood_tag)
    if unviewed_only:
        q += " AND is_viewed=0"
    return [_fam(r) for r in conn.execute(q + " ORDER BY created_at DESC, id DESC", args).fetchall()]


def mark_family_viewed(conn, message_id: int) -> dict | None:
    conn.execute("UPDATE family_messages SET is_viewed=1 WHERE id=?", (message_id,))
    return family_message(conn, message_id)


def _fam(r) -> dict:
    d = dict(r)
    d["is_viewed"] = bool(d["is_viewed"])
    return d
