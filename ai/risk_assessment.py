"""Explainable risk and countermeasure engine (NASA HRP 5 Hazards, CSA radiation).

Points come from transparent rules. High Priority needs substantial evidence from
at least two independent signals, so one minor spike never escalates.
"""
NEGATIVE_MOODS = {"sad", "low", "anxious", "irritable", "tense", "depressed", "angry", "lonely", "stressed", "overwhelmed"}
DISCLAIMER = ("Decision support only. Statistical deviations are not validated exposure limits "
              "and this is not a diagnosis; follow mission medical procedures.")

PROMPTS = {
    "Normal": "Routine check-in: keep your sleep, exercise and meal schedule, then log again in 24 hours.",
    "Attention Required": "Pause and recheck: take a quiet 5-minute break, rehydrate, and re-log within 6 hours.",
    "High Priority Alert": "Contact the onboard medical officer and flight surgeon now, then re-log within 2 hours.",
}
CADENCE = {"Normal": 24, "Attention Required": 6, "High Priority Alert": 2}


def assess(current: dict, analysis: dict) -> dict:
    comp, trends, forest = analysis["baseline_comparison"], analysis["trend_alerts"], analysis["isolation_forest"]
    signals: dict[str, int] = {}  # signal name -> points (1 minor, 2 major)
    reasons: list[str] = []
    hazards: list[str] = []

    def add(name: str, pts: int, hazard: str, reason: str):
        signals[name] = max(pts, signals.get(name, 0))
        reasons.append(reason)
        hazards.append(hazard)

    rad = comp["radiation_msv"]
    if rad["z_score"] is not None and rad["z_score"] >= 2:
        pts = 2 if rad["z_score"] >= 3 and rad["deviation_pct"] and rad["deviation_pct"] >= 25 else 1
        add("radiation", pts, "radiation", f"Space Radiation (CSA): reading {current['radiation_msv']:.2f} mSv is "
            f"{rad['deviation_pct']:+.0f}% from this astronaut's baseline ({rad['baseline_mean']:.2f}). "
            "This is a statistical deviation, not a validated exposure limit; verify with dosimeter data.")

    hr = comp["heart_rate_bpm"]
    if (hr["z_score"] is not None and hr["z_score"] >= 2.5) or current["heart_rate_bpm"] >= 100:
        add("heart_rate", 2 if current["heart_rate_bpm"] >= 110 else 1, "cardio",
            f"Cardiovascular / Microgravity: heart rate {current['heart_rate_bpm']:.0f} bpm is above this astronaut's usual range.")
    if current["systolic_bp"] >= 140 or current["diastolic_bp"] >= 90:
        add("blood_pressure", 1, "cardio", f"Cardiovascular / Microgravity: blood pressure "
            f"{current['systolic_bp']:.0f}/{current['diastolic_bp']:.0f} is elevated.")

    sl = current["sleep_hours"]
    if sl < 6:
        add("sleep", 2 if sl < 5 else 1, "isolation", f"Isolation & Confinement (NASA HRP): only {sl:.1f} h of sleep reported; "
            "sleep loss affects performance and mood.")
    if current["stress_score"] >= 7:
        add("stress", 2 if current["stress_score"] >= 9 else 1, "isolation",
            f"Isolation & Confinement (NASA HRP): stress score {current['stress_score']:.0f}/10 is high.")
    if current["isolation_level"] >= 6:
        add("isolation", 2 if current["isolation_level"] >= 8 else 1, "isolation",
            f"Isolation & Confinement (NASA HRP): isolation level {current['isolation_level']:.0f}/10 is high.")
    if current["mood"].strip().lower() in NEGATIVE_MOODS:
        add("mood", 1, "isolation", f"Isolation & Confinement (NASA HRP): reported mood is '{current['mood']}'.")

    for t in trends:
        reasons.append(t)
        signals["trend:" + t[:12]] = 1
    if "Radiation" in " ".join(trends):
        hazards.append("radiation")
    if "heart rate" in " ".join(trends):
        hazards.append("cardio")
    if "Sleep" in " ".join(trends) or "Stress" in " ".join(trends):
        hazards.append("isolation")
    if forest["is_outlier"]:
        signals["pattern"] = 1
        reasons.append("Overall combination of readings is unusual compared with this astronaut's own history (Isolation Forest).")

    score = sum(signals.values())
    major = sum(1 for v in signals.values() if v == 2)
    if score >= 5 and len(signals) >= 3 and (major >= 1 or len(trends) >= 2):
        level = "High Priority Alert"
    elif score >= 1:
        level = "Attention Required"
    else:
        level = "Normal"
    if not reasons:
        reasons = ["All readings are within this astronaut's personal baseline. No hazard indicators flagged."]
    if not analysis["baseline"]["sufficient_history"]:
        reasons.append("Fewer than 7 earlier logs: baseline comparison is limited, so fixed rules were used.")

    return {"risk_level": level, "risk_score": score, "reasons": reasons,
            "recommended_actions": _actions(level, hazards), "next_checkin_hours": CADENCE[level],
            "routine_prompt": PROMPTS[level], "disclaimer": DISCLAIMER}


ACTIONS = {
    "radiation": "Move to the best-shielded area (storm shelter / water-wall zone) and check the dosimeter and space-weather status.",
    "cardio": "Rest, hydrate, and repeat the blood pressure and heart rate measurement in 15 minutes; do the planned resistance/aerobic exercise.",
    "isolation": "Take a 10-minute breathing or mindfulness break and schedule a private video or audio call with family or the crew psychologist.",
    "sleep": "Protect a full sleep period tonight: dim lighting, no screens one hour before bed.",
}


def _actions(level: str, hazards: list[str]) -> list[str]:
    if level == "Normal":
        return ["Continue the planned exercise, nutrition and sleep schedule."]
    ordered = list(dict.fromkeys(hazards))
    acts = [ACTIONS[h] for h in ordered[:3]] or [ACTIONS["isolation"]]
    if level == "High Priority Alert":
        acts = acts[:2] + ["Report to the onboard medical officer and flight surgeon now."]
    return acts[:3]
