from datetime import datetime, timedelta, timezone

from ai.anomaly_detection import baseline_profile
from ai.risk_assessment import assess
from backend.database import Database, utc_now
from backend.models import CheckInInput, CheckInResult, Dashboard, Observation, SimulationResult
from backend.seed import baseline_samples
from companion.companion import offline_support

SCENARIOS = {
    "normal": CheckInInput(heart_rate=65, sleep_hours=7.5, stress_level=3, mood="good", activity_minutes=90, isolation_level=2, radiation_exposure=12),
    "fatigue_isolation": CheckInInput(heart_rate=68, sleep_hours=5.8, stress_level=6, mood="low", activity_minutes=60, isolation_level=7),
    "critical_stress": CheckInInput(heart_rate=96, sleep_hours=3.2, stress_level=10, mood="very_low", activity_minutes=10, isolation_level=9),
}


class HealthService:
    def __init__(self, database: Database, method: str = "baseline"):
        self.database, self.method = database, method

    def dashboard(self, astronaut_id: int) -> Dashboard:
        with self.database.connection() as conn:
            astronaut, baseline, observations, latest, saved, logs = self.database.context(conn, astronaut_id)
        cutoff = utc_now() - timedelta(days=7)
        recent = [row for row in observations if row.recorded_at >= cutoff]
        risk = saved or assess(latest.checkin, baseline, [row.checkin for row in recent if row.id != latest.id], self.method)
        return Dashboard(
            astronaut=astronaut, personal_baseline=baseline_profile(baseline), recent_history=recent,
            latest_observation=latest, latest_risk_assessment=risk, mission_logs=logs,
            explanation="The baseline is a fixed set of seven synthetic observations, separate from later check-ins. History covers the latest seven days; latest assessment is the saved result for the latest submitted check-in. Statistical changes are not a diagnosis or radiation safety limit.",
        )

    def checkin(self, astronaut_id: int, checkin: CheckInInput) -> CheckInResult:
        with self.database.connection(write=True) as conn:
            _, baseline, observations, _, _, _ = self.database.context(conn, astronaut_id)
            cutoff = utc_now() - timedelta(days=7)
            history = [row.checkin for row in observations if row.recorded_at >= cutoff]
            assessment = assess(checkin, baseline, history, self.method)
            observation = self.database.insert(conn, astronaut_id, checkin, assessment)
        return CheckInResult(observation=observation, risk=assessment, reasons=assessment.reasons)


def simulate(scenario: str, method: str = "baseline") -> SimulationResult:
    # Fixed data and timestamps; no DB reads or writes, no online generation.
    current = SCENARIOS[scenario]
    anchor = datetime(2026, 1, 7, 12, tzinfo=timezone.utc)
    baseline = [sample for _, sample in baseline_samples(1, anchor)]
    history = baseline if scenario != "critical_stress" else [*baseline, current, current]
    observation = Observation(
        id=f"simulation-{scenario}", astronaut_id=1, recorded_at=anchor + timedelta(days=1),
        source="synthetic_simulation", checkin=current,
    )
    return SimulationResult(
        scenario=scenario, observation=observation,
        risk=assess(current, baseline, history, method), companion=offline_support(current),
    )
