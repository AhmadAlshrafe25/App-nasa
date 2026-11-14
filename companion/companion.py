"""Deterministic support first; external generation requires configuration AND consent."""
import json
import re
import time

import httpx
from pydantic import ValidationError

from backend.models import CheckInInput, FamilyRecommendation, Observation, SupportContent, SupportResponse
from backend.settings import Settings


def offline_support(state: CheckInInput) -> SupportContent:
    demanding = state.stress_level >= 7 or state.sleep_hours < 6 or state.isolation_level >= 7 or state.mood in ("low", "very_low")
    summary = (
        f"You reported {state.sleep_hours:g} hours of sleep, {state.mood.replace('_', ' ')} mood, "
        f"stress {state.stress_level}/10 and isolation {state.isolation_level}/10. "
        + ("That sounds demanding; you deserve support from your crew." if demanding else "Thank you for checking in; keeping a routine can help you stay connected.")
    )
    if state.stress_level >= 7:
        action = "Take one quiet minute of comfortable, unforced breathing, then ask a crewmate for a brief check-in."
    elif state.sleep_hours < 6:
        action = "Ask your crew lead about a short rest opportunity that fits the mission schedule."
    elif state.mood in ("low", "very_low") or state.isolation_level >= 7:
        action = "Arrange a five-minute conversation with a trusted crewmate during the next suitable break."
    else:
        action = "Take a brief relaxation break within your mission plan and notice three things around you."
    if state.isolation_level >= 7:
        family = FamilyRecommendation(
            kind="audio",
            recommendation="If a familiar voice message is already stored onboard, listen to it during your next break; otherwise draft a request for the next communication window.",
            reason="You reported feeling very isolated; a familiar voice may offer a sense of connection despite communication delays.",
        )
    else:
        family = FamilyRecommendation(
            kind="message",
            recommendation="Draft one short update for a family member or trusted person for the next communication window.",
            reason="A low-pressure message can maintain connection" + (" when mood is low." if state.mood in ("low", "very_low") else " while respecting mission and communication schedules."),
        )
    return SupportContent(summary=summary, action_suggestion=action, family_message=family)


class InvalidProviderResponse(Exception):
    pass


class Companion:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None):
        self.settings = settings
        self.transport = transport

    def _online(self, state: CheckInInput, fallback: SupportContent) -> SupportContent:
        # Deliberately omit identity, health history, notes, radiation, and API keys
        # from the request body. The key is used only in the Authorization header.
        prompt = {
            "sleep_hours": state.sleep_hours, "mood": state.mood,
            "stress_level": state.stress_level, "isolation_level": state.isolation_level,
        }
        payload = {
            "model": self.settings.llm_model, "temperature": 0,
            "max_tokens": 400, "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": (
                    "Provide empathetic, non-diagnostic astronaut well-being support. "
                    "Return JSON with summary, action_suggestion (one brief relaxation or practical action), "
                    "and family_message {kind: audio or message, recommendation, reason}. "
                    "Do not diagnose, prescribe medication, claim medical safety, discuss radiation, or invent accessible recordings. "
                    "Any recording recommendation must be conditional on it already being available onboard."
                )},
                {"role": "user", "content": json.dumps(prompt)},
            ],
        }
        started = time.monotonic()
        data = bytearray()
        with httpx.Client(timeout=httpx.Timeout(3, connect=2), transport=self.transport, follow_redirects=False) as client:
            with client.stream(
                "POST", f"{self.settings.llm_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.settings.llm_api_key}"}, json=payload,
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data) > 16_384 or time.monotonic() - started > 5:
                        raise InvalidProviderResponse()
        try:
            envelope = json.loads(data)
            content = SupportContent.model_validate_json(envelope["choices"][0]["message"]["content"])
        except (ValueError, ValidationError, KeyError, IndexError, TypeError) as exc:
            raise InvalidProviderResponse() from exc
        text = f"{content.summary} {content.action_suggestion}"
        if re.search(r"diagnos|prescrib|medicat|clinically|you have (?:a |an )?(?:disorder|depression|anxiety)|radiation|\bsafe\b", text, re.I):
            raise InvalidProviderResponse()
        # Family resources are unknown: retain the conditional offline selection
        # rather than trusting a provider's claims about real recordings.
        content.family_message = fallback.family_message
        return content

    def support(self, observation: Observation, allow_online: bool = False) -> SupportResponse:
        fallback = offline_support(observation.checkin)
        content, mode, reason = fallback, "offline", "not_requested"
        if allow_online:
            if self.settings.force_offline:
                reason = "forced_offline"
            elif self.settings.offline_mode:
                reason = "not_configured"
            else:
                try:
                    content, mode, reason = self._online(observation.checkin, fallback), "online", None
                except InvalidProviderResponse:
                    reason = "invalid_response"
                except (httpx.HTTPError, OSError):
                    reason = "provider_unavailable"
        return SupportResponse(
            **content.model_dump(), astronaut_id=observation.astronaut_id,
            based_on_observation_id=observation.id, mode=mode, fallback_reason=reason,
        )
