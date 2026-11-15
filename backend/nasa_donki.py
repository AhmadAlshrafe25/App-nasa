"""Cached access to NASA DONKI coronal mass ejection reports."""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timedelta, timezone
import math
import os
import threading
import time
from urllib.parse import urlparse

import httpx

NASA_CME_URL = "https://api.nasa.gov/DONKI/CME"
NASA_SOURCE_URL = "https://api.nasa.gov/DONKI/CME"
CACHE_SECONDS = 30 * 60
REQUEST_TIMEOUT_SECONDS = 8

_cache_lock = threading.Lock()
_cached_payload: dict | None = None
_cache_expires_at = 0.0


class NASADataUnavailable(Exception):
    """The NASA DONKI source could not provide a valid response."""


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _safe_event_link(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {
        "ccmc.gsfc.nasa.gov",
        "kauai.ccmc.gsfc.nasa.gov",
    }:
        return None
    return value


def _normalize_cmes(raw: object, start: datetime, end: datetime) -> list[dict]:
    if not isinstance(raw, list):
        raise ValueError("NASA DONKI returned an unexpected response.")

    events: list[dict] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        started = _parse_time(entry.get("startTime"))
        if started is None or not start <= started <= end:
            continue

        analyses = entry.get("cmeAnalyses")
        analyses = [item for item in analyses if isinstance(item, dict)] if isinstance(analyses, list) else []
        analysis = next((item for item in analyses if item.get("isMostAccurate") is True), None)
        if analysis is None and analyses:
            analysis = analyses[-1]

        speed = None
        if analysis is not None:
            try:
                candidate = float(analysis.get("speed"))
                if math.isfinite(candidate) and candidate >= 0:
                    speed = candidate
            except (TypeError, ValueError):
                pass

        location = entry.get("sourceLocation")
        active_region = entry.get("activeRegionNum")
        activity_id = entry.get("activityID")
        events.append({
            "activityId": activity_id if isinstance(activity_id, str) else None,
            "startTime": started.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "sourceLocation": location.strip() if isinstance(location, str) and location.strip() else None,
            "activeRegion": active_region if isinstance(active_region, (str, int)) else None,
            "analysisSpeedKmPerSecond": speed,
            "eventUrl": _safe_event_link(entry.get("link")),
        })

    events.sort(key=lambda event: event["startTime"], reverse=True)
    return events[:3]


def clear_cache() -> None:
    """Clear the in-process cache; also used to isolate API tests."""
    global _cached_payload, _cache_expires_at
    with _cache_lock:
        _cached_payload = None
        _cache_expires_at = 0.0


def get_recent_cmes(now: datetime | None = None) -> dict:
    """Return real NASA DONKI CME reports from the last seven UTC days.

    The NASA demo key is used for local development if NASA_API_KEY is not set.
    A shared 30-minute cache keeps that public key below its request quota in
    normal use; production deployments should set NASA_API_KEY as a secret.
    """
    global _cached_payload, _cache_expires_at
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    end_date = current.date()
    start_date = end_date - timedelta(days=6)
    start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end = current
    api_key = os.getenv("NASA_API_KEY", "").strip() or "DEMO_KEY"
    cache_key = (start_date.isoformat(), end_date.isoformat(), api_key)

    with _cache_lock:
        if _cached_payload and _cached_payload.get("_cacheKey") == cache_key and time.monotonic() < _cache_expires_at:
            payload = deepcopy(_cached_payload)
            payload.pop("_cacheKey", None)
            payload["cached"] = True
            return payload

        try:
            response = httpx.get(
                NASA_CME_URL,
                params={
                    "startDate": start_date.isoformat(),
                    "endDate": end_date.isoformat(),
                    "api_key": api_key,
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            raw = response.json()
            events = _normalize_cmes(raw, start, end)
        except (httpx.HTTPError, ValueError) as exc:
            raise NASADataUnavailable("NASA DONKI is temporarily unavailable.") from exc

        payload = {
            "source": "NASA DONKI",
            "sourceUrl": NASA_SOURCE_URL,
            "windowStart": start_date.isoformat(),
            "windowEnd": end_date.isoformat(),
            "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "cached": False,
            "events": events,
            "_cacheKey": cache_key,
        }
        _cached_payload = deepcopy(payload)
        _cache_expires_at = time.monotonic() + CACHE_SECONDS
        payload.pop("_cacheKey", None)
        return payload
