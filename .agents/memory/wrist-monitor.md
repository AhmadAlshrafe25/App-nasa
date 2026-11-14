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

The muscle and bone experience should support a large, region-based body map for a future sensor-equipped concept.

**Why:** The user asked for a bigger body showing which muscle or bone has a sensor-detected concern, rather than only whole-body indices.

**How to apply:** Keep anatomical region selection central. Until real validated hardware is integrated, label regional readings simulated and do not equate a sensor flag with confirmed tissue damage.

Use detailed anatomical body artwork, not blocky polygons or a simple silhouette, for the muscle and bone figure.

**Why:** The user repeatedly clarified that “whole detailed body figure” meant visible anatomical detail, not merely more selectable geometric regions.

**How to apply:** Preserve detailed muscle fibers and skeleton illustrations across front/back views. Muscle status overlays must follow muscle-group contours rather than circles or oval sensor rings; keep them subtle so artwork remains visible.

The body map should have a holographic presentation with green good regions, yellow danger regions, and red weakness/break concerns.

**Why:** The user explicitly requested these regional status colors and a holographic, interactive appearance.

**How to apply:** Apply the same colors to anatomy overlays, labels, legends, and region details. Keep unavailable gray and all injury-related examples explicitly simulated, not a diagnosis.

Do not display a full body-region list beside the anatomy; show a region's simulation sample only after that body part is selected.

**Why:** The user explicitly requested removing the list and opening details by clicking the body itself.

**How to apply:** Keep anatomy regions directly clickable with an accessible selection path, and start without a selected detail.

The body should rotate continuously through 360 degrees with drag or scroll, rather than only switching between front/back pictures.

**Why:** The user explicitly asked to scroll the model around to see the back.

**How to apply:** Keep actual three-dimensional anatomy available and preserve selection during rotation. After the user asked for easier zooming, use drag for rotation and vertical scrolling for zoom, with a visible zoom slider, percentage, and reset. The user subsequently requested removing the illustrated view entirely; show a short load error and Retry rather than restoring it.

Show bones and muscles together in one simple 3D body; bones highlight on hover and open their sample when clicked.

**Why:** The user explicitly requested a combined model, removal of the illustrated map, and removal of extra explanatory text.

**How to apply:** Do not restore separate anatomy-system tabs, scenario/comparison clutter, or an illustrated fallback. Keep only concise controls, selected-part details, a small simulation label, and expandable required model credits. Hovered bones must visibly highlight and remain clickable through translucent muscles.

Selected anatomy details belong in a floating box beside the selected part, not below the model.

**Why:** The user explicitly requested a nearby hovering box that explains what is wrong with a yellow or red bone.

**How to apply:** Anchor the box to the selected anatomy through rotation/zoom and keep it inside narrow screens. Include a concise explanation of the simulated concern, not only its status color or sample number; never imply a confirmed injury.

Daily logs use automatically determined Earth Day and Hour, with the entry taken from the astronaut’s voice. Only crew mood and stress are manual fields; the archive belongs below them.

**Why:** The user explicitly requested this simpler recording flow and vertical archive placement.

**How to apply:** Stamp the actual recording time, keep the real audio as the entry when local transcription is unavailable, and do not restore editable dates, typed log entries, or extra biometric inputs without approval.

The shared mission motto must use the exact requested spelling “Ad astra per asphera”; retain the SpaceHealth product name and clinical/navigation labels.

**Why:** The user explicitly requested this spelling and shared branding rather than replacing status labels or repeating the motto in cards.

**How to apply:** Keep the motto in shared branding across modules. The shared Earth clock is Eastern civil time, but this does not authorize changing device-local daily logs or reminders, or recalculating mission day.

Family messaging was explicitly approved as a limited exception and now includes invitation-only real audio/video recordings in Astro and the family sender portal. The Daily log stays on-device; this is not open chat.

**Why:** The user explicitly requested voice or video messages from family on Earth and selected email/password access.

**How to apply:** Keep recordings scoped to the private family channel; do not expand this into general chat or broaden who can access media without renewed approval.
