---
name: Anatomy asset constraints
description: Why the rotatable anatomy uses a licensed source model and what to check before mirroring it.
---

Use genuinely detailed anatomical geometry for the rotatable body; do not substitute a basic mannequin or flip flat images and call it 360 degrees.

**Why:** The user repeatedly rejected simplified figures and requested a detailed holographic, rotatable body with selectable muscle regions.

**How to apply:** Preserve anatomical muscle/bone surfaces and their attribution. If changing the geometry of the Écorché source, review its CC BY-SA requirements and keep derivatives under the required license. Demo color changes are not validated medical interpretation.

Preflight App Storage authentication before attempting to mirror large anatomy assets.

**Why:** During the 360-body work, the existing storage helper failed in GoogleAuth project-ID discovery for both standard and non-resumable uploads. Model generation also returned an unavailable-service error, so a verified, commit-pinned open anatomy source was used instead.

**How to apply:** Do not repeatedly provision storage or change private-family access to work around public-asset delivery. Diagnose project-ID/authentication independently, then mirror only the public licensed asset once an upload succeeds. Never expose private family recordings through a public asset path.
