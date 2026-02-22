#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo "Error: run this script as your normal user, not with sudo/root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SERVICE_TEMPLATE="$REPO_ROOT/overlay-app/systemd/my-overlay.service"
TARGET_DIR="$HOME/.config/systemd/user"
TARGET_FILE="$TARGET_DIR/my-overlay.service"

mkdir -p "$TARGET_DIR"

sed "s|__REPO_ROOT__|$REPO_ROOT|g" "$SERVICE_TEMPLATE" > "$TARGET_FILE"

systemctl --user daemon-reload

echo "Installed: $TARGET_FILE"
echo "Next: systemctl --user enable my-overlay.service"
echo "Test: systemctl --user start my-overlay.service"
