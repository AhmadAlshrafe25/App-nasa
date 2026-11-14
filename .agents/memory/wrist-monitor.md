---
name: Wrist monitor target
description: The intended physical display and communication constraints for SpaceHealth.
---

SpaceHealth is intended for an astronaut’s wrist monitor and the team accompanying the astronaut. The user explicitly asked to remove extra, unused text.

**Why:** A wrist display must communicate essential readings and actions quickly; a conventional dashboard with introductions and repeated explanatory paragraphs does not fit this use case.

**How to apply:** Design for very small screens, prioritize readings and alerts, use short labels and touch-friendly controls, and put secondary explanations in optional details. Do not imply live team connectivity until it exists.

Readings and trends belong on the same wrist-friendly screen, with a current value beside its relevant short history.

**Why:** The user asked to combine the two tabs and reiterated that the product is a wrist application.

**How to apply:** Keep radiation first, avoid a separate Trends destination, preserve short trend-period controls, and hide secondary configuration behind touch-friendly details.

The app's current scope excludes Chat and family/remote communication features; use a device-local daily health log with a daily spoken reminder instead.

**Why:** The user explicitly asked to replace Check-in with a Log tab, add daily voice notifications, and remove Chat because their intended scenario has no communications.

**How to apply:** Do not restore communications features from older plans without renewed approval. Keep reminder speech on-device and explain browser/open-app/audio limitations rather than promising background alarms on a closed web app.

Daily logs use automatically determined Earth Day and Hour, with the entry taken from the astronaut’s voice. Only crew mood and stress are manual fields; the archive belongs below them.

**Why:** The user explicitly requested this simpler recording flow and vertical archive placement.

**How to apply:** Stamp the actual recording time, keep the real audio as the entry when local transcription is unavailable, and do not restore editable dates, typed log entries, or extra biometric inputs without approval.
