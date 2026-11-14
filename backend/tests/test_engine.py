from ai.anomaly_detection import analyze, detect_trends
from ai.risk_assessment import assess
from backend.tests.conftest import reading, steady_history


def level(current, history):
    return assess(current, analyze(current, history))["risk_level"]


def test_steady_reading_is_normal():
    assert level(reading(), steady_history()) == "Normal"


def test_single_minor_spike_never_high_priority():
    hist = steady_history()
    for spike in (dict(stress_score=7), dict(sleep_hours=5.5), dict(heart_rate_bpm=101),
                  dict(radiation_msv=0.7), dict(mood="sad"), dict(systolic_bp=145)):
        assert level(reading(**spike), hist) != "High Priority Alert", spike


def test_single_extreme_signal_is_not_high_priority():
    # One independent signal alone, even a major one, must not escalate.
    assert level(reading(radiation_msv=1.5), steady_history()) != "High Priority Alert"


def test_minor_spike_is_flagged_attention():
    assert level(reading(stress_score=7), steady_history()) == "Attention Required"


def test_multiple_major_signals_are_high_priority():
    cur = reading(sleep_hours=4.0, stress_score=9, isolation_level=8, mood="lonely", heart_rate_bpm=112)
    assert level(cur, steady_history()) == "High Priority Alert"


def test_insufficient_history_still_assesses_with_note():
    cur = reading(stress_score=7)
    res = assess(cur, analyze(cur, steady_history(3)))
    assert res["risk_level"] == "Attention Required"
    assert any("Fewer than 7" in r for r in res["reasons"])


def test_trend_detected_on_three_consecutive_moves():
    hist = [reading(sleep_hours=7.4), reading(sleep_hours=7.0)]
    alerts = detect_trends(reading(sleep_hours=6.6), hist)
    assert any("Sleep" in a for a in alerts)


def test_trend_not_detected_when_not_monotonic_or_too_small():
    hist = [reading(sleep_hours=7.4), reading(sleep_hours=6.8)]
    assert detect_trends(reading(sleep_hours=7.0), hist) == []
    hist = [reading(heart_rate_bpm=63), reading(heart_rate_bpm=64)]
    assert detect_trends(reading(heart_rate_bpm=65), hist) == []  # rise < 3 bpm


def test_trend_needs_two_earlier_logs():
    assert detect_trends(reading(), [reading()]) == []
