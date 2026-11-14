"""Compare five signals with a fixed personal baseline; no clinical thresholds."""
from dataclasses import dataclass
from statistics import mean, pstdev

from backend.models import (
    AnomalyResult, AnomalySignal, BaselineMetric, BaselineProfile,
    CheckInInput, IsolationResult,
)


@dataclass(frozen=True)
class Feature:
    label: str
    unit: str
    noise_floor: float
    adverse: str


# Floors prevent almost-constant seed observations from amplifying tiny changes.
# These are demo sensitivity settings, NOT mission or medical exposure limits.
FEATURES = {
    "heart_rate": Feature("Heart rate", "beats/min", 5, "both"),
    "sleep_hours": Feature("Sleep", "hours/24h", .75, "low"),
    "stress_level": Feature("Stress", "self-report 1–10", 1, "high"),
    "activity_minutes": Feature("Activity", "minutes/24h", 20, "low"),
    "radiation_exposure": Feature("Radiation dose", "microsieverts/24h", 1, "high"),
}


def baseline_profile(samples: list[CheckInInput]) -> BaselineProfile:
    metrics = {}
    for name, feature in FEATURES.items():
        values = [getattr(row, name) for row in samples if getattr(row, name) is not None]
        metrics[name] = BaselineMetric(
            mean=round(mean(values), 6) if values else None,
            standard_deviation=round(pstdev(values), 6) if values else None,
            minimum=min(values) if values else None, maximum=max(values) if values else None,
            sample_count=len(values), unit=feature.unit,
        )
    return BaselineProfile(observation_count=len(samples), metrics=metrics)


def isolation_result(samples: list[CheckInInput], current: CheckInInput, requested: bool) -> IsolationResult:
    if not requested:
        return IsolationResult(requested=False, status="not_requested", explanation="Personal-baseline comparisons only.")
    names = [name for name in FEATURES if getattr(current, name) is not None and all(getattr(s, name) is not None for s in samples)]
    if len(samples) < 7 or not names:
        return IsolationResult(requested=True, status="unavailable", explanation="At least seven complete baseline rows are needed.")
    try:
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        return IsolationResult(requested=True, status="unavailable", explanation="Optional model package is not installed; personal-baseline comparisons remain available.")
    matrix = [[getattr(row, name) for name in names] for row in samples]
    scaler = StandardScaler().fit(matrix)
    model = IsolationForest(n_estimators=128, contamination=.1, random_state=42, n_jobs=1).fit(scaler.transform(matrix))
    vector = scaler.transform([[getattr(current, name) for name in names]])
    return IsolationResult(
        requested=True, status="outlier" if model.predict(vector)[0] == -1 else "inlier",
        score=round(float(model.decision_function(vector)[0]), 6), features=names,
        explanation="Exploratory Isolation Forest fitted only to the synthetic baseline, with a fixed random seed. A small baseline is not clinical validation; missing radiation is excluded, never filled with zero.",
    )


def analyze(current: CheckInInput, samples: list[CheckInInput], method: str = "baseline") -> AnomalyResult:
    if method not in ("baseline", "isolation_forest"):
        raise ValueError("Unsupported anomaly method")
    profile = baseline_profile(samples)
    signals = []
    for name, feature in FEATURES.items():
        value, stats = getattr(current, name), profile.metrics[name]
        score, severity = None, 0
        if value is None:
            status, explanation = "unavailable", f"{feature.label} is unavailable; missing is not zero."
        elif stats.sample_count < 5:
            status, explanation = "insufficient_baseline", f"Not enough earlier {feature.label.lower()} readings to compare."
        else:
            score = (value - stats.mean) / max(stats.standard_deviation, feature.noise_floor)
            adverse = feature.adverse == "both" or (score < 0 if feature.adverse == "low" else score > 0)
            severity = (2 if abs(score) >= 3 else 1 if abs(score) >= 2 else 0) if adverse else 0
            status = ("within_pattern", "minor_deviation", "major_deviation")[severity]
            direction = "lower" if score < 0 else "higher"
            explanation = (
                f"{feature.label} is {value:g} {feature.unit}, {direction} than the earlier average of {stats.mean:g}; an unusual change."
                if severity else f"{feature.label} shows no flagged change from its earlier pattern."
            )
            if name == "radiation_exposure":
                explanation += " This statistical comparison is not a validated exposure limit or safety assessment."
        signals.append(AnomalySignal(
            feature=name, current=value, baseline_mean=stats.mean, deviation_score=round(score, 4) if score is not None else None,
            severity=severity, status=status, explanation=explanation,
        ))
    return AnomalyResult(method=method, signals=signals, isolation_forest=isolation_result(samples, current, method == "isolation_forest"))
