"""Pydantic v2 request/response schemas."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

RiskLevel = Literal["Normal", "Attention Required", "High Priority Alert"]


class CheckInRequest(BaseModel):
    heart_rate_bpm: float = Field(ge=20, le=250)
    systolic_bp: float = Field(ge=50, le=260)
    diastolic_bp: float = Field(ge=30, le=160)
    sleep_hours: float = Field(ge=0, le=24)
    stress_score: float = Field(ge=0, le=10)
    mood: str = Field(min_length=1, max_length=40, examples=["calm"])
    activity_minutes: float = Field(ge=0, le=1440)
    radiation_msv: float = Field(ge=0, le=100, description="Daily dose reading in mSv")
    isolation_level: float = Field(ge=0, le=10)


class LogEntry(CheckInRequest):
    id: int
    astronaut_id: str
    logged_at: str
    risk_level: Optional[str] = None


class MetricStat(BaseModel):
    mean: float
    std: float


class Baseline(BaseModel):
    log_count: int
    sufficient_history: bool
    metrics: dict[str, MetricStat]


class MetricComparison(BaseModel):
    current: float
    baseline_mean: Optional[float]
    baseline_std: Optional[float]
    z_score: Optional[float]
    deviation_pct: Optional[float]
    status: Literal["within_range", "elevated", "markedly_elevated", "reduced", "markedly_reduced", "insufficient_history"]


class IsolationForestResult(BaseModel):
    available: bool
    anomaly_score: Optional[float] = Field(None, description="0-1, higher = more unusual versus own history")
    is_outlier: bool = False
    note: str


class Assessment(BaseModel):
    risk_level: RiskLevel
    risk_score: int
    reasons: list[str]
    recommended_actions: list[str] = Field(min_length=1, max_length=3)
    next_checkin_hours: Literal[24, 6, 2]
    routine_prompt: str
    baseline_comparison: dict[str, MetricComparison]
    trend_alerts: list[str]
    isolation_forest: IsolationForestResult
    disclaimer: str


class Dashboard(BaseModel):
    astronaut_id: str
    baseline: Baseline
    last_logs: list[LogEntry]
    baseline_comparison: dict[str, MetricComparison]
    trend_alerts: list[str]
    isolation_forest: IsolationForestResult
    risk_level: RiskLevel
    reasons: list[str]
    recommended_actions: list[str]
    next_checkin_hours: int
    routine_prompt: str


class HealthStatus(BaseModel):
    status: str


class CheckInResponse(BaseModel):
    log_id: int
    astronaut_id: str
    sync_status: str
    sync_note: str
    assessment: Assessment


class SupportRequest(BaseModel):
    astronaut_id: str = Field(examples=["AST-01"])
    allow_online: bool = Field(True, description="Set false to forbid sending state to the LLM even if LLM_API_KEY is set")


MediaType = Literal["video", "audio", "text"]
MoodTag = Literal["anxious", "lonely", "tired", "general"]


class FamilyMessageIn(BaseModel):
    astronaut_id: str = Field(min_length=1, max_length=40, examples=["AST-01"])
    sender_name: str = Field(min_length=1, max_length=80)
    relationship: str = Field(min_length=1, max_length=60)
    media_type: MediaType
    title: str = Field(min_length=1, max_length=120)
    message_text: Optional[str] = Field(None, max_length=4000)
    media_url: Optional[str] = Field(None, max_length=1000, description="Required for audio/video")
    mood_tag: MoodTag = "general"


class FamilyMessage(FamilyMessageIn):
    id: int
    is_viewed: bool
    created_at: str


class RecommendedFamilyMedia(BaseModel):
    message: Optional[FamilyMessage] = None
    selection_reason: str


class SupportResponse(BaseModel):
    astronaut_id: str
    summary: str
    relaxation_action: str
    family_message_suggestion: str
    selection_reason: str
    source: Literal["offline_fallback", "llm"]
    recommended_family_media: Optional[RecommendedFamilyMedia] = None


class SyncItem(BaseModel):
    id: int
    log_id: int
    astronaut_id: str
    status: str
    queued_at: str
    synced_at: Optional[str] = None
    payload: dict[str, Any]


class SyncStatus(BaseModel):
    pending_count: int
    mars_delay_minutes: int
    pending_items: list[SyncItem]


class SyncResult(BaseModel):
    synced_count: int
    synced_at: str
    mars_delay_minutes: int
    note: str


class SimulationResponse(BaseModel):
    scenario: str
    description: str
    astronaut_id: str
    input: CheckInRequest
    assessment: Assessment
    companion: SupportResponse
    saved: bool = False
