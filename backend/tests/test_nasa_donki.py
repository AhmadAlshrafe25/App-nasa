from datetime import datetime, timezone

import httpx
import pytest

from backend import nasa_donki


NOW = datetime(2026, 11, 15, 14, 0, tzinfo=timezone.utc)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


def setup_function():
    nasa_donki.clear_cache()


def teardown_function():
    nasa_donki.clear_cache()


def test_normalizes_real_donki_events_and_uses_best_analysis():
    raw = [
        {
            "activityID": "newest-cme",
            "startTime": "2026-11-15T12:40Z",
            "sourceLocation": "N10E20",
            "activeRegionNum": 14200,
            "link": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/1/-1",
            "cmeAnalyses": [
                {"isMostAccurate": False, "speed": 500},
                {"isMostAccurate": True, "speed": 721.4},
            ],
        },
        {
            "activityID": "outside-window",
            "startTime": "2026-11-01T12:40Z",
            "cmeAnalyses": [],
        },
    ]

    events = nasa_donki._normalize_cmes(
        raw,
        datetime(2026, 11, 9, tzinfo=timezone.utc),
        NOW,
    )

    assert events == [{
        "activityId": "newest-cme",
        "startTime": "2026-11-15T12:40:00Z",
        "sourceLocation": "N10E20",
        "activeRegion": 14200,
        "analysisSpeedKmPerSecond": 721.4,
        "eventUrl": "https://ccmc.gsfc.nasa.gov/DONKI/view/CME/1/-1",
    }]


def test_cme_endpoint_uses_api_key_and_caches_the_real_response(monkeypatch):
    calls = []
    monkeypatch.setenv("NASA_API_KEY", "test-nasa-key")
    monkeypatch.setattr(
        nasa_donki.httpx,
        "get",
        lambda url, **kwargs: (
            calls.append((url, kwargs)) or FakeResponse([{
                "activityID": "cme-1",
                "startTime": "2026-11-14T12:00Z",
                "cmeAnalyses": [{"isMostAccurate": True, "speed": 410}],
            }])
        ),
    )

    first = nasa_donki.get_recent_cmes(NOW)
    second = nasa_donki.get_recent_cmes(NOW)

    assert first["source"] == "NASA DONKI"
    assert first["cached"] is False
    assert first["events"][0]["activityId"] == "cme-1"
    assert second["cached"] is True
    assert len(calls) == 1
    assert calls[0][1]["params"]["api_key"] == "test-nasa-key"
    assert "api_key" not in first


def test_no_events_is_a_real_empty_result_not_a_synthetic_fallback(monkeypatch):
    monkeypatch.setattr(nasa_donki.httpx, "get", lambda *args, **kwargs: FakeResponse([]))

    result = nasa_donki.get_recent_cmes(NOW)

    assert result["events"] == []
    assert result["source"] == "NASA DONKI"


def test_bad_upstream_response_fails_explicitly(monkeypatch):
    monkeypatch.setattr(
        nasa_donki.httpx,
        "get",
        lambda *args, **kwargs: (_ for _ in ()).throw(httpx.ConnectError("offline")),
    )
    with pytest.raises(nasa_donki.NASADataUnavailable):
        nasa_donki.get_recent_cmes(NOW)


def test_api_alias_returns_nasa_source_and_does_not_fallback(client, monkeypatch):
    from backend import main

    monkeypatch.setattr(main, "get_recent_cmes", lambda: {
        "source": "NASA DONKI",
        "sourceUrl": nasa_donki.NASA_SOURCE_URL,
        "events": [],
    })
    response = client.get("/api/space-weather/nasa-cmes")
    assert response.status_code == 200
    assert response.json()["source"] == "NASA DONKI"

    monkeypatch.setattr(
        main,
        "get_recent_cmes",
        lambda: (_ for _ in ()).throw(nasa_donki.NASADataUnavailable()),
    )
    unavailable = client.get("/api/space-weather/nasa-cmes")
    assert unavailable.status_code == 502
    assert "NASA" in unavailable.json()["detail"]
