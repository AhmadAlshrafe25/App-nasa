# SpaceHealth

SpaceHealth is an offline-first astronaut health dashboard. Some readings shown in the current prototype are samples; external space-weather reports are identified separately and never presented as onboard measurements.

## Real external data

### NASA DONKI coronal mass ejections

The Space environment panel combines NOAA's latest planetary K-index and GOES proton-flux observations with a NASA DONKI CME analysis. The Python API calls NASA's `GET https://api.nasa.gov/DONKI/CME` endpoint and exposes the normalized result at `GET /api/space-weather/nasa-cmes`.

The dashboard surfaces the latest reported CME analysis speed and event time as one metric, with the raw recent event records tucked into an optional details disclosure. The analysis speed is an event report value, not a spacecraft wind reading. Event detail links point back to the NASA CCMC DONKI record. The app refreshes this endpoint periodically; the backend caches upstream results for 30 minutes.

Set `NASA_API_KEY` as a server-side environment secret for regular use. If it is not set, the backend uses NASA's public `DEMO_KEY`, which has a low request quota. Never commit an API key to GitHub or expose it in browser code.

NASA DONKI CME records do not provide crew biometrics or a personal radiation dose. They are not spacecraft-local sensor measurements, and this integration does not translate them into a mission-specific forecast or exposure limit. NOAA's Kp and GOES proton flux are shown separately as near-Earth space-environment observations.

### NOAA near-Earth space-weather observations

The adjacent Space weather panel reads NOAA SWPC planetary K-index and GOES integral proton-flux observations. It displays each observation's own UTC timestamp and freshness state. These near-Earth observations are not measurements from the astronaut's vehicle.

### Historical storm context from Kaggle

The collapsed **Historical storm activity** view uses the annual summary from Live Atlas's [Geomagnetic Storms and Kp Index Since 1932](https://www.kaggle.com/datasets/liveatlasearth/geomagnetic-storms-since-1932) dataset (CC BY 4.0). The app includes the compact annual summary, not the full daily archive. It shows G1+ storm days, G4+/G5 days, and each year's peak planetary Kp. The 2026 row is partial through October 29, 2026.

Attribution: Live Atlas, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), derived from GFZ Potsdam's [Kp data record](https://doi.org/10.5880/Kp.0001). The historical chart is context only—not a live feed, spacecraft-local reading, dose estimate, forecast, medical measurement, or safety limit. Kaggle astronaut-health uploads with an unknown license were not included.

## Data that remains simulated

Crew vital signs, cabin-air readings, radiation examples, muscle/bone visualizations, and workout effects in this prototype are local sample or simulation data. The NASA and NOAA feeds do **not** make those health readings real. Actual onboard health and cabin monitoring requires a supplied spacecraft sensor gateway and calibration/mission rules.

## Run checks

```sh
pnpm --filter @workspace/spacehealth run typecheck
pnpm --filter @workspace/spacehealth run test:e2e
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/spacehealth run build
uv run --frozen pytest backend/tests
```
