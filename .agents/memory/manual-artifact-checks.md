---
name: Manual artifact checks
description: Difference between managed workflow and standalone shell build environments.
---

Standalone shell build commands do not automatically inherit the service environment supplied to a managed artifact workflow.

**Why:** A running SpaceHealth workflow had the configuration it needed, while manual production builds failed first for a missing port and then for a missing base path. The application itself was not broken.

**How to apply:** Before a manual artifact build, inspect its existing configuration and supply the required non-secret service values explicitly. Do not weaken application validation or change working workflow configuration merely to make a standalone shell command pass.
