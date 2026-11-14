# SpaceHealth

An astronaut wrist-display prototype with a separate Python health-monitoring and
offline well-being API. Synthetic demonstrations only; not medical diagnosis or
a radiation safety system.

## Run & Operate

- `pnpm --filter @workspace/spacehealth run dev` — wrist frontend with radiation monitoring and an on-device Daily log.
- `pnpm --filter @workspace/api-server run dev` — Python FastAPI on `0.0.0.0:8000`.
- `uv sync --frozen` — reproducible Python dependencies (Python 3.11/3.12; Replit module is 3.12).
- `uv run --frozen --extra ml pytest -q` — backend tests including the optional model.
- `uv run --frozen python scripts/export-openapi.py` then `pnpm --filter @workspace/api-spec run codegen` — refresh shared contracts and generated helpers.
- `uv run --frozen python scripts/smoke-backend.py http://localhost:8000` — read-only HTTP smoke checks.
- `pnpm run typecheck` — workspace type checks.

## Backend

- Required modules live in `backend/`, `ai/`, and `companion/`.
- Full setup, fields/units, examples, risk rules, offline semantics, privacy, and storage lifecycle: **`backend/README.md`**.
- Local `astronaut_health.db` is initialized at API startup with two fictional astronauts (IDs 1 and 2), seven immutable synthetic baseline samples, and seven logs each. Submitted check-ins and assessment snapshots are transactional and survive same-filesystem process restarts.
- `SPACEHEALTH_DB_PATH` can select another local SQLite path.
- No `DATABASE_URL`, API key, paid provider, or internet connection is required. The old PostgreSQL/Express packages remain unused scaffolding; do not push or migrate them for this backend.
- The Rust direction was explicitly replaced by Python. Do not merge the cancelled Rust task over this backend or the current frontend.

## Routing and API contract

The API artifact routes `/api`, `/health`, `/healthz`, `/astronauts`,
`/companion/support`, `/simulate`, `/docs`, `/redoc`, and `/openapi.json`.
Do not route all of `/companion` to Python: that legacy frontend route now redirects to the Daily log.
The frontend owns `/`; the backend does not replace it.

Root API paths also work under `/api`. `/api/healthz` preserves its original
`{"status":"ok"}` response. Shared OpenAPI stays titled `Api`, with `/api` base URL
and existing health identifiers preserved. Generated client files may change
when backend contracts change; frontend consumers are not automatically wired.

## Product constraints

- Keep wrist screens blue, glanceable, concise, and understandable without technical knowledge. Radiation anomalies are the priority; technical units need optional definitions.
- Never imply simulated measurements came from a real dosimeter.
- Statistical radiation deviations are not validated exposure limits. Missing is unknown, never zero; marking an alert seen does not resolve a condition.
- Risk labels: `Normal`, `Attention Required`, `High Priority Alert`. A single minor spike cannot trigger high priority.
- Current frontend scope excludes Chat, family connection, and remote communications. `/log` replaces Check-in; `/wellbeing` and `/companion` redirect there. Do not restore communications features from older tasks without renewed approval.
- Daily logs retain the previous on-device check-in storage and are not uploaded. Existing stored chat records are left untouched rather than deleted.
- Daily reminders use device-local time, fire once per calendar day while the web app runs, and skip a day already logged. Closed browsers, device sleep, permissions, or audio restrictions can prevent or delay alerts; do not promise a closed-app alarm.
- Spoken reminders select only locally installed speech voices. Unsupported or blocked voice/notification features must visibly report their limitations.
- Offline companion output is non-diagnostic, with one action and a conditional family-message recommendation. No actual family recordings are assumed accessible.

## Storage and privacy limitations

This MVP has no authentication and deliberately permits all-origin CORS. Use only
demo data. SQLite files are excluded from Git/deploy bundles and are not guaranteed
durable across ephemeral/autoscale replacements or shared between instances.
No encryption, backup system, cloud sync, real sensors, or clinical validation is
provided. Keep data private until those protections are explicitly designed.

Post-merge setup installs Node/Python dependencies only; SQLite seeds at startup.
It must not push the unused PostgreSQL scaffold.
