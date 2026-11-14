# SpaceHealth Python backend

Backend-only NASA Space Apps demonstration. Python **3.11 or 3.12**, FastAPI,
local SQLite, explainable statistical comparisons, and offline well-being support.
No login, frontend integration, live sensors, clinical diagnosis, or family-message
transmission is included.

## Install and run

The Replit Python 3.12 module provides Python and `uv`; `uv.lock` pins the complete
dependency graph. From the repository root:

```sh
uv sync --frozen
uv run --frozen python -m backend.main
# equivalent workspace entry point:
pnpm --filter @workspace/api-server run dev
```

Default: `0.0.0.0:8000` (`PORT` may override the port for hosting).
The existing API artifact now runs Python, not the unused Express scaffold.
The cancelled Rust task must not be merged into this replacement.

Endpoints are available at their requested root paths and under `/api`. Swagger:
**`/docs`**, OpenAPI: **`/openapi.json`**. The shared router directs only the API
paths to Python; the existing wrist frontend still owns `/` and `/companion`.
In particular, only `/companion/support`, not the frontend's `/companion` page,
is routed to Python.

```sh
curl http://localhost:8000/health
curl http://localhost:8000/astronauts/1/dashboard
curl -X POST http://localhost:8000/astronauts/1/checkin \
  -H 'Content-Type: application/json' \
  -d '{"heart_rate":65,"sleep_hours":7.5,"stress_level":3,"mood":"good","activity_minutes":90,"isolation_level":2}'
curl -X POST http://localhost:8000/companion/support \
  -H 'Content-Type: application/json' -d '{"astronaut_id":1}'
curl http://localhost:8000/simulate/critical_stress
```

For shared preview checks, use the same paths on the project's development domain,
not browser-visible localhost URLs. `/api/healthz` preserves the old
`{"status":"ok"}` contract.

## Contracts and units

Two fictional crew members are seeded: **1 — Mara Velez**, **2 — Elias Noor**.
These are demo identities, not real personnel.

`POST /astronauts/{astronaut_id}/checkin` requires these **six** fields:

| Field | Meaning and accepted input |
| --- | --- |
| `heart_rate` | Number, 30–220 beats per minute |
| `sleep_hours` | Number, 0–24 hours of sleep in the past 24 hours |
| `stress_level` | Integer, 1–10 self-report; 1 low, 10 very high |
| `mood` | `very_low`, `low`, `neutral`, `good`, or `excellent`; case/space normalized |
| `activity_minutes` | Number, 0–1440 activity minutes in the past 24 hours |
| `isolation_level` | Integer, 0–10 self-report; 0 none, 10 very isolated |

Optional `radiation_exposure`: non-negative number up to 1,000,000,
**microsieverts accumulated over the past 24 hours**, **not** microsieverts/hour.
Its observation window must match the baseline's 24-hour window. Omit it or send
`null` when unavailable; never substitute zero. This API is not yet connected
to the frontend's separate sample dose-rate demo.

Bounds are input-quality guards, **not medical safety limits**. Numeric strings,
booleans in numeric fields, NaN, infinities, extra fields, and omitted required
fields are rejected. Successful check-ins return HTTP **201** with the saved
observation, assessment, and reasons. IDs/timestamps are server-owned.
All timestamps use timezone-aware UTC ISO 8601. Errors use:

```json
{"error":{"code":"invalid_input","message":"...","details":[{"field":"body.sleep_hours","message":"...","type":"..."}]}}
```

Unknown astronauts/scenarios return 404, invalid inputs 422, local SQLite errors
503. Error responses do not echo submitted values or provider credentials.

## SQLite and baseline lifecycle

`astronaut_health.db` is created in the repository root at application startup;
override its location with `SPACEHEALTH_DB_PATH`. WAL and foreign keys are enabled.
Check-ins and assessment snapshots are committed in the **same transaction**;
save failures roll back both the observation and its mission log.

Initial startup inserts seven fixed synthetic baseline observations and seven
synthetic mission logs per astronaut. Baseline rows are in their own table and
never absorb submitted observations. Uniqueness constraints and a transaction
make seeding repeatable without duplication. Restarting does not redate, replace,
or reseed existing baseline observations. Baseline comparisons use the fixed
baseline even after those samples age out of the displayed history window.

Dashboard history and mission logs cover a rolling seven days; older records
remain in SQLite. The latest observation/assessment is returned even if it is
older than that window. Trend rules consider successive observations within
the current seven-day window. Submitted check-ins are labeled `user_checkin`,
not falsely labeled synthetic; seeded and simulated observations have explicit
synthetic provenance.

Do not commit the database or sidecars to Git. SQLite survives process restarts
on the **same filesystem**, but ephemeral/autoscale publishing may replace that
filesystem, and separate instances do not share it. This is not guaranteed
production durability, backup, encryption, or synchronization. Do not put real
crew health records in this unauthenticated demonstration. No PostgreSQL
conversion, schema push, or data deletion occurs.

## Explainable anomaly and risk rules

The baseline includes heart rate, sleep, stress, activity, and optional radiation.
At least five earlier measurements are required per signal. A standard-deviation
floor avoids division by zero and exaggerated changes in almost-constant data:
5 beats/min, 0.75 sleep hours, 1 stress point, 20 activity minutes, 1 microsievert
per 24h respectively. Adverse-direction deviations at 2 and 3 adjusted standard
deviations are minor and major flags. Sleep/activity decreases, stress/radiation
increases, and heart-rate changes in either direction are considered.

Risk labels are exactly:

- **Normal** — no flagged comparison or subjective prioritization signal; not
  medical clearance. Missing radiation is still explicitly reported unavailable.
- **Attention Required** — a flagged change, insufficient baseline, elevated
  reported stress/isolation, low mood, short sleep, or optional model outlier.
- **High Priority Alert** — at least two major changes across at least three
  signals; or two sustained trends with at least two current signals; or a score
  of at least 8 with at least one major change across at least three signals.

Score = summed deviation severity (minor 1, major 2), subjective hints (1 each
without double-counting the same signal), sustained-trend count, optional model
outlier (1), and insufficient-baseline indicator (1).
Trends require three successive recent check-ins below the usual sleep pattern,
above the usual stress/heart-rate pattern, or above the usual radiation pattern.
Full comparisons, thresholds, and explanations are in the analysis modules.
A single minor spike or model result cannot independently trigger high priority.

These are **unvalidated demonstration rules**, not clinical diagnoses or
mission-approved exposure limits. Radiation deviations compare patterns only;
they never establish safe/unsafe exposure.

### Optional Isolation Forest

```sh
uv sync --frozen --extra ml
SPACEHEALTH_ANOMALY_METHOD=isolation_forest \
  uv run --frozen --extra ml python -m backend.main
```

Use the same `--extra ml` flag in the service's run/build commands if enabling
this option in managed hosting. Baseline comparison always runs. The optional
model uses scikit-learn `IsolationForest`, `random_state=42`, one worker, 128
trees, baseline-only fitting, and standardized inputs. Missing radiation is
excluded from the model rather than filled with zero. An unavailable optional
package or insufficient complete rows is explicitly reported, without disabling
baseline analysis. Seven seeded rows are far too few for clinical validation.

## Offline-first companion and privacy

`POST /companion/support` requires `{"astronaut_id":1}` and reads that astronaut's
latest sleep, mood, stress, and isolation state. It returns one empathetic summary,
one relaxation/action suggestion, one family audio/message recommendation and
its selection reason. The recommendation does **not** imply an actual recording
exists, and does not send or play anything.

It is deterministic and makes **no network calls by default**. No key or internet
connection is required. Optional online generation requires all three:

- `LLM_API_KEY` in environment secrets (never in code, logs, or request bodies);
- `LLM_BASE_URL`, an HTTPS OpenAI-compatible API base such as a provider's `/v1`;
- `LLM_MODEL`, the chosen provider's model identifier.

No provider is configured or required by this project. Use the secure integration/
secret setup if you later select one; do not paste credentials into chat or files.
Online calls additionally require per-request `"allow_online":true`.
Only the latest four well-being values are sent: no astronaut identity, notes,
history, radiation, or other physical readings. Provider data policies still
apply. `SPACEHEALTH_OFFLINE=true` disables calls even with consent/configuration.

Calls have bounded timeouts, a 16 KiB response cap, no retries/redirects, and
schema validation. Unavailable services, malformed/oversized output, and detected
diagnostic or medication/safety claims fall back to the deterministic response.
The family-resource recommendation always remains the conditional offline choice.
This conservative filter is not a validated clinical safety system.

`/health.offline_mode` means **online generation is disabled or incompletely
configured**, not a network connectivity test. Each companion response's `mode`
and `fallback_reason` describe what actually happened for that request. A
configured provider can therefore report `offline_mode:false` while an individual
request falls back offline.

## Deterministic judging scenarios

- `/simulate/normal` → **Normal**
- `/simulate/fatigue_isolation` → **Attention Required**
- `/simulate/critical_stress` → **High Priority Alert**

All use the same analysis/risk/companion code as the live endpoints, fixed
synthetic values/timestamps, no provider calls, and no database reads/writes.
`synthetic:true`, `persisted:false` are explicit. They cannot alter saved history.

## Verification and shared API contract

```sh
uv run --frozen --extra ml pytest -q
uv run --frozen python scripts/export-openapi.py
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/api-server run build
uv run --frozen python scripts/smoke-backend.py http://localhost:8000
```

The canonical shared contract is `lib/api-spec/openapi.yaml`; export it from the
Pydantic/FastAPI definitions whenever those change, then regenerate the existing
workspace client/Zod helpers. Keep title **Api**, `/api` base URL, `HealthStatus`,
and `healthCheck` intact. A test checks the shared contract equals live OpenAPI.
No frontend consumers are modified.

Tests cover invalid/missing input, synthetic idempotent seeds, actual separate
process persistence, immutable baselines, transactional rollback, risk safeguards,
missing radiation, optional model reproducibility/unavailability, latest-state
companion support, opt-in minimization, and network/format/safety fallbacks.
HTTP smoke checks do not submit observations or change stored data. No automated
browser tests are used.
