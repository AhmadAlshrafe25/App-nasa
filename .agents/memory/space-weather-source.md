---
name: SpaceHealth space-weather source
description: Scope and labeling rules for SpaceHealth's live public space-weather data.
---

SpaceHealth's public space-weather feed provides near-Earth NOAA observations, not spacecraft-local sensor telemetry. Every displayed value must retain its observation time and freshness state. Do not present these measurements as an onboard reading, dose estimate, or spacecraft safety alarm.

**Why:** The user said no spacecraft API was available. Public Kp and GOES proton-flux data can provide current context, but they do not describe the vehicle's local environment.

**How to apply:** Preserve NOAA source attribution, timestamp each data point in UTC, label delayed or unavailable readings, and only replace this feed with onboard readings when a real sensor/API source is supplied.
