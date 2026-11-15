#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-git@github.com:MostafaRastegar/mr-opencode.git}"
TOOL_URL="${TOOL_URL:-https://raw.githubusercontent.com/MostafaRastegar/mr-opencode/main/scripts/opc-sync.py}"

# Ensure python3
if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2; exit 1
fi

# Fetch tool if not present locally
if [ ! -f "./opc-sync.py" ]; then
  curl -fsSL "$TOOL_URL" -o /tmp/opc-sync.py
  TOOL=/tmp/opc-sync.py
else
  TOOL=./opc-sync.py
fi

echo "==> Running doctor..."
python3 "$TOOL" --repo "$REPO_URL" doctor

echo "==> Pulling OpenCode configuration..."
python3 "$TOOL" --repo "$REPO_URL" pull

echo "==> Verifying..."
python3 "$TOOL" --repo "$REPO_URL" verify

echo "==> Done. Backup of previous config (if any) was created automatically."
