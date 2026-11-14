"""Personal baseline, z-score deviation, Isolation Forest and 3-log trend engine.

Everything runs locally. Deviations are statistical comparisons against the
astronaut's own recent history, not validated medical or exposure limits.
"""
import numpy as np

BASELINE_METRICS = ["heart_rate_bpm", "sleep_hours", "stress_score", "radiation_msv"]
FOREST_FEATURES = BASELINE_METRICS + ["systolic_bp", "diastolic_bp", "activity_minutes", "isolation_level"]
# Minimum std used for z-scores so a very steady history does not inflate tiny changes.
STD_FLOOR = {"heart_rate_bpm": 2.0, "sleep_hours": 0.3, "stress_score": 0.5, "radiation_msv": 0.03}
BASELINE_WINDOW = 14
MIN_BASELINE = 7


def compute_baseline(history: list[dict]) -> dict:
    """Mean/std over the last 7-14 logs (all available if fewer than 7)."""
    window = history[-BASELINE_WINDOW:]
    metrics = {}
    if window:
        for m in BASELINE_METRICS:
            vals = np.array([r[m] for r in window], dtype=float)
            metrics[m] = {"mean": round(float(vals.mean()), 3), "std": round(float(vals.std()), 3)}
    else:
        metrics = {m: {"mean": 0.0, "std": 0.0} for m in BASELINE_METRICS}
    return {"log_count": len(window), "sufficient_history": len(window) >= MIN_BASELINE, "metrics": metrics}


def baseline_comparison(current: dict, baseline: dict) -> dict:
    out = {}
    for m in BASELINE_METRICS:
        cur = float(current[m])
        if not baseline["sufficient_history"]:
            out[m] = {"current": cur, "baseline_mean": baseline["metrics"][m]["mean"] if baseline["log_count"] else None,
                      "baseline_std": baseline["metrics"][m]["std"] if baseline["log_count"] else None,
                      "z_score": None, "deviation_pct": None, "status": "insufficient_history"}
            continue
        mean, std = baseline["metrics"][m]["mean"], baseline["metrics"][m]["std"]
        z = (cur - mean) / max(std, STD_FLOOR[m])
        status = ("markedly_elevated" if z >= 3 else "elevated" if z >= 2 else
                  "markedly_reduced" if z <= -3 else "reduced" if z <= -2 else "within_range")
        out[m] = {"current": cur, "baseline_mean": mean, "baseline_std": std, "z_score": round(float(z), 2),
                  "deviation_pct": round((cur - mean) / mean * 100, 1) if mean else None, "status": status}
    return out


def isolation_forest_score(current: dict, history: list[dict]) -> dict:
    """Fit on the astronaut's own history (last 60 logs); score the current reading."""
    if len(history) < 10:
        return {"available": False, "anomaly_score": None, "is_outlier": False,
                "note": "Isolation Forest needs at least 10 earlier logs; z-score rules used instead."}
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:  # keeps the service running if scikit-learn is missing
        return {"available": False, "anomaly_score": None, "is_outlier": False,
                "note": "scikit-learn is not installed; z-score rules used instead."}
    train = np.array([[r[f] for f in FOREST_FEATURES] for r in history[-60:]], dtype=float)
    mu, sd = train.mean(axis=0), train.std(axis=0)
    sd[sd == 0] = 1.0
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42).fit((train - mu) / sd)
    x = (np.array([[current[f] for f in FOREST_FEATURES]], dtype=float) - mu) / sd
    raw = -float(model.score_samples(x)[0])  # ~0.4 typical ... >0.6 unusual
    return {"available": True, "anomaly_score": round(raw, 3), "is_outlier": bool(model.predict(x)[0] == -1),
            "note": "Unusual relative to this astronaut's own recent logs; not a clinical finding."}


# metric -> (direction, minimum total change over 3 logs, message)
TRENDS = {
    "sleep_hours": ("down", 0.5, "Sleep has dropped across the last 3 logs (Isolation & Confinement / NASA HRP sleep and circadian risk)."),
    "heart_rate_bpm": ("up", 3.0, "Resting heart rate has risen across the last 3 logs (Cardiovascular / Microgravity)."),
    "stress_score": ("up", 1.0, "Stress has risen across the last 3 logs (Isolation & Confinement / NASA HRP behavioral health)."),
    "radiation_msv": ("up", 0.05, "Radiation readings have risen across the last 3 logs (Space Radiation / CSA); this is a trend, not an exposure-limit judgement."),
}


def detect_trends(current: dict, history: list[dict]) -> list[str]:
    """3 consecutive logs (the two latest earlier ones + current) moving the same way."""
    if len(history) < 2:
        return []
    seq = history[-2:] + [current]
    alerts = []
    for m, (direction, min_change, msg) in TRENDS.items():
        v = [float(r[m]) for r in seq]
        steps = (v[1] > v[0] and v[2] > v[1]) if direction == "up" else (v[1] < v[0] and v[2] < v[1])
        if steps and abs(v[2] - v[0]) >= min_change:
            alerts.append(msg)
    return alerts


def analyze(current: dict, history: list[dict]) -> dict:
    """`history` = earlier logs for this astronaut, oldest first, excluding `current`."""
    baseline = compute_baseline(history)
    return {"baseline": baseline, "baseline_comparison": baseline_comparison(current, baseline),
            "trend_alerts": detect_trends(current, history),
            "isolation_forest": isolation_forest_score(current, history)}
