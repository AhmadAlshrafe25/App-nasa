from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CheckInInput(Contract):
    """Bounds reject malformed data; they are NOT medical safety limits."""

    heart_rate: float = Field(ge=30, le=220, strict=True, description="Beats per minute.")
    sleep_hours: float = Field(ge=0, le=24, strict=True, description="Sleep in the past 24 hours.")
    stress_level: int = Field(ge=1, le=10, strict=True, description="Self-reported: 1 low, 10 very high.")
    mood: Literal["very_low", "low", "neutral", "good", "excellent"]
    activity_minutes: float = Field(ge=0, le=1440, strict=True, description="Activity in the past 24 hours.")
    isolation_level: int = Field(ge=0, le=10, strict=True, description="Self-reported: 0 none, 10 very isolated.")
    radiation_exposure: float | None = Field(
        default=None, ge=0, le=1_000_000, strict=True,
        description="Optional dose in microsieverts over the past 24 hours, NOT a rate. Missing means unknown.",
    )

    @field_validator("mood", mode="before")
    @classmethod
    def normalize_mood(cls, value):
        return value.strip().lower().replace(" ", "_") if isinstance(value, str) else value


class RiskLevel(StrEnum):
    NORMAL = "Normal"
    ATTENTION = "Attention Required"
    HIGH = "High Priority Alert"


class BaselineMetric(Contract):
    mean: float | None
    standard_deviation: float | None
    minimum: float | None
    maximum: float | None
    sample_count: int
    unit: str


class BaselineProfile(Contract):
    source: Literal["synthetic_baseline"] = "synthetic_baseline"
    observation_count: int
    metrics: dict[str, BaselineMetric]


class AnomalySignal(Contract):
    feature: str
    current: float | None
    baseline_mean: float | None
    deviation_score: float | None
    severity: Literal[0, 1, 2]
    status: Literal["within_pattern", "minor_deviation", "major_deviation", "unavailable", "insufficient_baseline"]
    explanation: str


class IsolationResult(Contract):
    requested: bool
    status: Literal["not_requested", "inlier", "outlier", "unavailable"]
    score: float | None = None
    features: list[str] = Field(default_factory=list)
    explanation: str


class AnomalyResult(Contract):
    method: Literal["baseline", "isolation_forest"]
    signals: list[AnomalySignal]
    isolation_forest: IsolationResult


class RiskAssessment(Contract):
    level: RiskLevel
    score: int
    reasons: list[str]
    trends: list[str]
    anomalies: AnomalyResult
    disclaimer: str = "Demo prioritization, not a diagnosis, safety clearance, or validated radiation exposure limit."


class Astronaut(Contract):
    id: int
    name: str
    mission: str
    synthetic: bool = True


class Observation(Contract):
    id: str
    astronaut_id: int
    recorded_at: datetime
    source: Literal["synthetic_baseline", "user_checkin", "synthetic_simulation"]
    checkin: CheckInInput


class MissionLog(Contract):
    recorded_at: datetime
    message: str
    synthetic: bool


class Dashboard(Contract):
    astronaut: Astronaut
    personal_baseline: BaselineProfile
    recent_history: list[Observation]
    history_window_days: Literal[7] = 7
    latest_observation: Observation
    latest_risk_assessment: RiskAssessment
    mission_logs: list[MissionLog]
    explanation: str
    demo_only: bool = True


class CheckInResult(Contract):
    observation: Observation
    risk: RiskAssessment
    reasons: list[str]


class SupportInput(Contract):
    astronaut_id: int = Field(ge=1, strict=True)
    allow_online: bool = Field(default=False, strict=True, description="Explicitly allow sending latest sleep, mood, stress and isolation to the configured provider. Never sends identity or history.")


class FamilyRecommendation(Contract):
    kind: Literal["audio", "message"]
    recommendation: str = Field(min_length=1, max_length=500)
    reason: str = Field(min_length=1, max_length=500)


class SupportContent(Contract):
    summary: str = Field(min_length=1, max_length=800)
    action_suggestion: str = Field(min_length=1, max_length=500)
    family_message: FamilyRecommendation


class SupportResponse(SupportContent):
    astronaut_id: int
    based_on_observation_id: str
    mode: Literal["offline", "online"]
    fallback_reason: Literal["not_requested", "not_configured", "forced_offline", "provider_unavailable", "invalid_response"] | None
    non_diagnostic: bool = True
    disclaimer: str = "Well-being support only, not medical advice. Contact mission medical staff if you feel unwell or unsafe."


class HealthStatus(Contract):
    status: str


class HealthResponse(HealthStatus):
    offline_mode: bool
    offline_mode_definition: str = "True when online support is disabled or not fully configured; this does not probe internet connectivity. Requests default to offline support."
    storage: Literal["sqlite_local"] = "sqlite_local"
    demo_only: bool = True


class SimulationResult(Contract):
    scenario: Literal["normal", "fatigue_isolation", "critical_stress"]
    synthetic: bool = True
    persisted: bool = False
    observation: Observation
    risk: RiskAssessment
    companion: SupportContent


class ErrorDetail(Contract):
    code: str
    message: str
    details: list[dict[str, str]] = Field(default_factory=list)


class ErrorResponse(Contract):
    error: ErrorDetail
