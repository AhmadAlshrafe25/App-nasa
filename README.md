# SpaceHealth

SpaceHealth is an offline-first astronaut health dashboard. Some readings shown in the current prototype are samples; external space-weather reports are identified separately and never presented as onboard measurements.

## Real external data

### NASA DONKI coronal mass ejections

The Readings page includes NASA's DONKI coronal mass ejection (CME) reports for the previous seven UTC days. The Python API calls NASA's `GET https://api.nasa.gov/DONKI/CME` endpoint and exposes the normalized result at `GET /api/space-weather/nasa-cmes`.

The interface displays up to three recent reports and uses the NASA event start time, source location, active-region number, and the speed from the analysis NASA marks most accurate. Event detail links point back to the NASA CCMC DONKI record. The app refreshes this endpoint periodically; the backend caches upstream results for 30 minutes.

Set `NASA_API_KEY` as a server-side environment secret for regular use. If it is not set, the backend uses NASA's public `DEMO_KEY`, which has a low request quota. Never commit an API key to GitHub or expose it in browser code.

These are NASA event reports, not spacecraft-local sensor measurements, mission-specific forecasts, dose estimates, or exposure limits.

### NOAA near-Earth space-weather observations

The adjacent Space weather panel reads NOAA SWPC planetary K-index and GOES integral proton-flux observations. It displays each observation's own UTC timestamp and freshness state. These near-Earth observations are not measurements from the astronaut's vehicle.

## Data that remains simulated

Crew vital signs, cabin-air readings, radiation examples, muscle/bone visualizations, and workout effects in this prototype are local sample or simulation data. The NASA and NOAA feeds do **not** make those health readings real. Actual onboard health and cabin monitoring requires a supplied spacecraft sensor gateway and calibration/mission rules.

## Run checks

```sh
pnpm --filter @workspace/spacehealth run typecheck
pnpm --filter @workspace/spacehealth run test:e2e
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/spacehealth run build
uv run --frozen pytest backend/tests
```
