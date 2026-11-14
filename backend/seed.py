"""Fixed fictional sample values, with explicit provenance."""
from datetime import datetime, timedelta

from backend.models import CheckInInput

ASTRONAUTS = [
    {"id": 1, "name": "Mara Velez", "mission": "SpaceHealth demo crew"},
    {"id": 2, "name": "Elias Noor", "mission": "SpaceHealth demo crew"},
]


def baseline_samples(astronaut_id: int, anchor: datetime) -> list[tuple[datetime, CheckInInput]]:
    rows = []
    for day, offset in enumerate((-1, 1, 0, 2, -2, 1, -1)):
        rows.append((anchor - timedelta(days=6 - day), CheckInInput(
            heart_rate=64 + (astronaut_id - 1) * 4 + offset,
            sleep_hours=7.5 + offset * .1,
            stress_level=3 + int(offset > 0), mood="good",
            activity_minutes=90 + offset * 4, isolation_level=2,
            radiation_exposure=12 + offset * .1,
        )))
    return rows
