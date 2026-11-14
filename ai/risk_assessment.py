"""Transparent demonstration prioritization. Multiple signals are required for high priority."""
from ai.anomaly_detection import analyze, baseline_profile
from backend.models import CheckInInput, RiskAssessment, RiskLevel


def assess(current: CheckInInput, baseline: list[CheckInInput], history: list[CheckInInput], method: str = "baseline") -> RiskAssessment:
    anomalies = analyze(current, baseline, method)
    evidence = {signal.feature: signal.severity for signal in anomalies.signals if signal.severity}
    reasons = [signal.explanation for signal in anomalies.signals if signal.severity]
    # These subjective signals are prioritization hints, not diagnoses.
    for name, condition, reason in (
        ("sleep_hours", current.sleep_hours < 6, f"Reported sleep was {current.sleep_hours:g} hours; consider a rest check."),
        ("stress_level", current.stress_level >= 7, f"Reported stress is {current.stress_level}/10."),
        ("isolation_level", current.isolation_level >= 7, f"Reported isolation is {current.isolation_level}/10."),
        ("mood", current.mood in ("low", "very_low"), "The reported mood suggests a supportive check-in may help."),
    ):
        if condition and name not in evidence:
            evidence[name] = 1
            reasons.append(reason)
    # history excludes the current input; compare three successive observations.
    recent = [*history[-2:], current]
    profile = baseline_profile(baseline)
    trends = []
    if len(recent) == 3:
        for feature, label, offset, lower in (
            ("sleep_hours", "Sleep stayed below its usual pattern for three check-ins.", 1, True),
            ("stress_level", "Stress stayed above its usual pattern for three check-ins.", 2, False),
            ("heart_rate", "Heart rate stayed above its usual pattern for three check-ins.", 10, False),
            ("radiation_exposure", "Radiation dose stayed above its earlier pattern for three check-ins; this is not an exposure-limit assessment.", None, False),
        ):
            stats = profile.metrics[feature]
            values = [getattr(row, feature) for row in recent]
            if stats.sample_count < 5 or any(value is None for value in values):
                continue
            boundary = stats.mean + (-offset if lower else offset) if offset is not None else stats.mean + max(stats.mean * .25, 1)
            if all(value < boundary if lower else value > boundary for value in values):
                trends.append(label)
    outlier = anomalies.isolation_forest.status == "outlier"
    incomplete_baseline = any(signal.status == "insufficient_baseline" for signal in anomalies.signals)
    score = sum(evidence.values()) + len(trends) + int(outlier) + int(incomplete_baseline)
    major_count = sum(severity == 2 for severity in evidence.values())
    high = (
        (major_count >= 2 and len(evidence) >= 3)
        or (len(trends) >= 2 and len(evidence) >= 2)
        or (score >= 8 and major_count >= 1 and len(evidence) >= 3)
    )
    level = RiskLevel.HIGH if high else RiskLevel.ATTENTION if score else RiskLevel.NORMAL
    if not reasons:
        reasons.append("No unusual changes were flagged against the synthetic personal baseline. This is not medical clearance.")
    if outlier:
        reasons.append("The optional model found an unusual combination; this alone cannot create a high-priority alert.")
    reasons.extend(trends)
    for signal in anomalies.signals:
        if signal.status in ("unavailable", "insufficient_baseline"):
            reasons.append(signal.explanation)
    if high:
        reasons.append("Multiple changes or sustained trends merit a prompt check with mission medical staff; this is not a diagnosis.")
    return RiskAssessment(level=level, score=score, reasons=reasons, trends=trends, anomalies=anomalies)
