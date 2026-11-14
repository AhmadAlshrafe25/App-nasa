---
name: Radiation monitoring scope
description: Product priority and safety boundaries for radiation anomaly monitoring.
---

Prioritize radiation anomaly detection on the astronaut wrist display; physiological metrics remain secondary.

**Why:** The user explicitly redirected the product to “anomalies radiation detection” after requesting a compact wrist monitor.

**How to apply:** Distinguish sample or simulated readings from measurements supplied by calibrated hardware. Statistical changes are not clinical or mission exposure limits. Missing signals must never be shown as zero radiation or a reassuring status. Acknowledging a finding does not resolve the measured condition.

Editable demo values must never produce operational emergency alarms or imply connected hardware. Label their source and unvalidated bands on the readings screen and in saved logs, not only inside a disclosure.

**Why:** A simulated-vitals expansion falsely implied live sensors and issued a recurring emergency alarm from example thresholds.

**How to apply:** Keep demo states silent and clearly marked. Preserve source provenance in records, and show missing legacy readings as unknown rather than filling them with current values.

The intended audience includes people unfamiliar with radiation terminology.

**Why:** The user asked for readings to be understandable to “anyone who doesn't know this stuff.”

**How to apply:** Lead with short, plain-language comparisons and statuses. Define technical units and preserve exact measurements in optional explanations. Do not replace physical units with invented scales or turn a comparison into a safety judgement.
