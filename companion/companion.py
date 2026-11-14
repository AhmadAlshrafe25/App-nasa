"""Non-diagnostic well-being companion: LLM when LLM_API_KEY is set, else offline rules."""
import json
import logging
import os

import httpx
from urllib.parse import urlsplit

log = logging.getLogger("companion")
LLM_TIMEOUT_S = 6.0
NEGATIVE_MOODS = {"sad", "low", "anxious", "irritable", "tense", "depressed", "angry", "lonely", "stressed", "overwhelmed"}
KEYS = ("summary", "relaxation_action", "family_message_suggestion", "selection_reason")


def offline_support(sleep_hours: float, mood: str, stress_score: float, isolation_level: float) -> dict:
    """Deterministic: same inputs always give the same output."""
    low_sleep, high_stress = sleep_hours < 6, stress_score >= 6
    low_mood, isolated = mood.strip().lower() in NEGATIVE_MOODS, isolation_level >= 6
    if high_stress:
        relax = "Box breathing for 4 minutes: inhale 4 s, hold 4 s, exhale 4 s, hold 4 s."
        reason = f"Chosen because stress is {stress_score:g}/10."
    elif low_sleep:
        relax = "A 10-minute wind-down: dim the lights, gentle stretching, and slow breathing before your next sleep period."
        reason = f"Chosen because sleep was {sleep_hours:g} hours."
    elif isolated or low_mood:
        relax = "Spend 10 minutes looking out the window or at Earth photos while doing slow breathing, then message someone you trust."
        reason = "Chosen because isolation or mood needs extra connection."
    else:
        relax = "A 5-minute body scan: relax shoulders, jaw and hands, one breath at a time."
        reason = "Chosen as a light routine because readings look steady."
    parts = []
    if low_sleep:
        parts.append(f"you slept {sleep_hours:g} hours")
    if high_stress:
        parts.append(f"stress feels high ({stress_score:g}/10)")
    if low_mood:
        parts.append(f"your mood is '{mood}'")
    if isolated:
        parts.append(f"isolation feels strong ({isolation_level:g}/10)")
    if parts:
        summary = "It sounds like " + ", ".join(parts) + ". These feelings are common on long missions. Small routines and connection can help; this is general support, not a diagnosis."
    else:
        summary = "Your check-in looks steady. Keep your routines going. This is general support, not a diagnosis."
    if isolated or low_mood:
        family = "Hi, I'm thinking of you today. The mission is going on and I'd love to hear about home: what's something good that happened this week?"
    elif low_sleep or high_stress:
        family = "Hi! It's been a busy stretch up here and I'm a bit tired. A short note about your day would really lift my mood."
    else:
        family = "Hi! All is well on my side. Here's a little update from space; tell me what's new with you."
    return {"summary": summary, "relaxation_action": relax, "family_message_suggestion": family,
            "selection_reason": reason, "source": "offline_fallback"}


def _safe_base(base: str) -> bool:
    u = urlsplit(base)
    return bool(u.hostname) and not (u.username or u.password or u.query or u.fragment) and (
        u.scheme == "https" or (u.scheme == "http" and u.hostname in ("localhost", "127.0.0.1", "::1")))


def _llm_support(state: dict) -> dict | None:
    key = os.environ.get("LLM_API_KEY")
    if not key:
        return None
    base = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    if not _safe_base(base):
        log.warning("LLM_BASE_URL must be HTTPS (loopback HTTP allowed); using offline fallback")
        return None
    prompt = ("You are a supportive, NON-DIAGNOSTIC well-being companion for an astronaut. Never diagnose or give medical "
              "advice. Given this state: " + json.dumps(state) + ". Reply with JSON only, keys: summary, relaxation_action, "
              "family_message_suggestion, selection_reason (each one or two short sentences).")
    try:
        resp = httpx.post(f"{base}/chat/completions", timeout=LLM_TIMEOUT_S,
                          headers={"Authorization": f"Bearer {key}"},
                          json={"model": os.environ.get("LLM_MODEL", "gpt-4o-mini"), "temperature": 0.3,
                                "response_format": {"type": "json_object"},
                                "messages": [{"role": "user", "content": prompt}]})
        resp.raise_for_status()
        data = json.loads(resp.json()["choices"][0]["message"]["content"])
        if all(isinstance(data.get(k), str) and data[k].strip() for k in KEYS):
            return {**{k: data[k].strip() for k in KEYS}, "source": "llm"}
        log.warning("LLM reply missing fields; using offline fallback")
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        log.warning("LLM unavailable (%s); using offline fallback", type(exc).__name__)
    return None


def support(sleep_hours: float, mood: str, stress_score: float, isolation_level: float, allow_online: bool = True) -> dict:
    state = {"sleep_hours": sleep_hours, "mood": mood, "stress_score": stress_score, "isolation_level": isolation_level}
    return (allow_online and _llm_support(state)) or offline_support(**state)


ANXIOUS_MOODS = {"anxious", "tense", "stressed", "overwhelmed", "irritable", "angry"}
LONELY_MOODS = {"lonely", "sad", "low", "depressed"}


def pick_family_media(messages: list[dict], mood: str, isolation_level: float) -> dict:
    """Top unviewed message (newest first) matching mood or isolation; else an unviewed general one."""
    m = mood.strip().lower()
    wanted, why = None, ""
    if m in ANXIOUS_MOODS:
        wanted, why = "anxious", f"your mood is '{mood}'"
    elif m in LONELY_MOODS:
        wanted, why = "lonely", f"your mood is '{mood}'"
    elif m == "tired":
        wanted, why = "tired", "you reported feeling tired"
    elif isolation_level >= 6:
        wanted, why = "lonely", f"isolation feels strong ({isolation_level:g}/10)"
    unviewed = [x for x in messages if not x["is_viewed"]]
    if wanted:
        for x in unviewed:
            if x["mood_tag"] == wanted:
                return {"message": x, "selection_reason": f"Unviewed '{wanted}' message chosen because {why}."}
    for x in unviewed:
        if x["mood_tag"] == "general":
            reason = "no unviewed message matches your current state; showing a general one" if wanted else "readings look steady; showing a general message"
            return {"message": x, "selection_reason": reason.capitalize() + "."}
    return {"message": None, "selection_reason": "No unviewed family or friend messages are waiting."}
