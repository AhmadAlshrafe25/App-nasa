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

Astro now uses real audio/video recordings sent by invited family members through a private account flow; it is not a live Earth feed.

**Why:** The user later asked for real messages from family, chose email/password accounts, and approved the private invitation flow.

**How to apply:** Keep family recordings behind invitation-based access and private storage. Do not imply a live Earth connection or reuse the earlier fictional Astro voice sample as a real message.

Astro belongs in a floating button near the lower-right side of the dashboard, not in the navigation tabs.

**Why:** The user explicitly corrected its placement and asked for a side button down on the dashboard rather than a new tab.

**How to apply:** Open the existing Astro dialog from the floating button and keep it above the mobile navigation.

Muscle and bone belong on their own main navigation page, not inside Readings.

**Why:** The user clarified that “another tab” meant a separate main navigation destination, not just tabs within the Readings card.

**How to apply:** Keep the entire muscle and bone impact section off the Readings page, accessible through its own navigation item on desktop and mobile.

Daily logs use automatically determined Earth Day and Hour, with the entry taken from the astronaut’s voice. Only crew mood and stress are manual fields; the archive belongs below them.

**Why:** The user explicitly requested this simpler recording flow and vertical archive placement.

**How to apply:** Stamp the actual recording time, keep the real audio as the entry when local transcription is unavailable, and do not restore editable dates, typed log entries, or extra biometric inputs without approval.

The shared mission motto must use the exact requested spelling “Ad astra per asphera”; retain the SpaceHealth product name and clinical/navigation labels.

**Why:** The user explicitly requested this spelling and shared branding rather than replacing status labels or repeating the motto in cards.

**How to apply:** Keep the motto in shared branding across modules. The shared Earth clock is Eastern civil time, but this does not authorize changing device-local daily logs or reminders, or recalculating mission day.

Family messaging was explicitly approved as a limited exception and now includes invitation-only real audio/video recordings in Astro and the family sender portal. The Daily log stays on-device; this is not open chat.

**Why:** The user explicitly requested voice or video messages from family on Earth and selected email/password access.

**How to apply:** Keep recordings scoped to the private family channel; do not expand this into general chat or broaden who can access media without renewed approval.
