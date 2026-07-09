#!/usr/bin/env bash
set -euo pipefail

# Run the backend from the repository root while loading backend/.env
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR/backend"

# Load .env into the environment for the process (if present)
if [ -f .env ]; then
  # shellcheck source=/dev/null
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

exec bun --watch src/index.ts
