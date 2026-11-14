---
name: Accessible on-device journey
description: Why astronaut voice logs are stored locally without an app password, including safe import of earlier protected recordings.
---

Daily voice recordings, transcripts, mood, and stress stay in a device-local database, readable without an app password or cloud account. This is separate from invitation-only Astro family messages.

**Why:** The user rejected password protection so someone with the astronaut's device can read and hear the entire journey if the astronaut dies. This explicitly supersedes the earlier password-encrypted vault requirement.

**How to apply:** Open the Daily log directly and preserve the simple recording/archive controls. Do not reintroduce a setup gate, automatic password lock, account requirement, or encrypted-only archive for new logs. State clearly that anyone who can open the app in this browser can read or play the records. Keep daily recordings on the device; do not upload them.

Old password-encrypted recordings cannot be decrypted without their old password. Offer an optional one-time import, not an ongoing access gate.

**Why:** Removing the UI password cannot mathematically recover old ciphertext, and the user has not authorized deleting inaccessible recordings.

**How to apply:** Verify every imported record before marking import complete. Preserve original encrypted copies and unknown legacy fields. Never pretend old recordings are gone merely because they have not been imported, and never store the old password.

Storage errors, malformed old data, and conflicting copies must fail visibly without overwriting originals or clearing an unsaved voice recording.

**Why:** The purpose is preserving a readable journey, not merely a successful-looking save.

**How to apply:** Wait for the local database transaction and readback verification before success. Only remove an old browser-storage copy after verification. Browser persistent-storage permission reduces eviction risk but is not a backup; clearing site data can erase the journey.
