#!/bin/bash
set -e
pnpm install --frozen-lockfile
uv sync --frozen
# SQLite initializes idempotently at API startup. Do not push the unused
# PostgreSQL scaffold or require DATABASE_URL for this backend.
