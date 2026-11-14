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

The user selected a labeled, fictional Astro sample with browser-generated speech instead of real family media or a live Earth connection.

**Why:** Real voice/video delivery needs authentic media and secure transmission, which this demo does not have.

**How to apply:** Keep the transcript visible, disclose that the voice is computer-generated and the example is fictional, and do not imply real messages or video are connected.

Daily logs use automatically determined Earth Day and Hour, with the entry taken from the astronaut’s voice. Only crew mood and stress are manual fields; the archive belongs below them.

**Why:** The user explicitly requested this simpler recording flow and vertical archive placement.

**How to apply:** Stamp the actual recording time, keep the real audio as the entry when local transcription is unavailable, and do not restore editable dates, typed log entries, or extra biometric inputs without approval.

The shared mission motto must use the exact requested spelling “Ad astra per asphera”; retain the SpaceHealth product name and clinical/navigation labels.

**Why:** The user explicitly requested this spelling and shared branding rather than replacing status labels or repeating the motto in cards.

**How to apply:** Keep the motto in shared branding across modules. The shared Earth clock is Eastern civil time, but this does not authorize changing device-local daily logs or reminders, or recalculating mission day.

Family messaging was explicitly approved as a limited exception: only the Mission overview Companion and Family Care panel (text messages for AST-01, mark viewed). The Daily log stays on-device, with no chat or separate messaging page.

**Why:** The user asked for family messaging in the frontend-to-backend connection request, overriding the earlier no-communications rule for that panel only.

**How to apply:** Do not expand this into chat, uploads, media playback, or a new page without renewed approval.
