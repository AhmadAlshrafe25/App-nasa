---
name: SpaceHealth space-weather source
description: Scope and labeling rules for SpaceHealth's live public space-weather data.
---

SpaceHealth's external space-weather context combines near-Earth NOAA observations with NASA DONKI coronal mass ejection reports; neither source is spacecraft-local sensor telemetry. Preserve the provider label and each observation/report time. Do not present these data as an onboard reading, dose estimate, or spacecraft safety alarm.

**Why:** No spacecraft API was available, so public NOAA and NASA sources provide real context without claiming to measure the astronaut's vehicle.

**How to apply:** Keep NOAA measurements separate from NASA CME event reports, timestamp them in UTC, label delayed or unavailable feeds, and only add onboard readings when a real sensor/API source is supplied.
