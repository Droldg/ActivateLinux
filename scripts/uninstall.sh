#!/usr/bin/env bash
set -euo pipefail

UUID="activatelinux@example.com"
LEGACY_UUID="overlay-toggle@example.com"
SERVICE_NAME="my-overlay.service"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
LEGACY_EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$LEGACY_UUID"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME"

echo "Stopping and disabling user service (if present)..."
systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true

if [[ -f "$SERVICE_FILE" ]]; then
  rm -f "$SERVICE_FILE"
  echo "Removed: $SERVICE_FILE"
else
  echo "Service file not found: $SERVICE_FILE"
fi

echo "Reloading user systemd daemon..."
systemctl --user daemon-reload

echo "Disabling extension in GNOME (if enabled)..."
gnome-extensions disable "$UUID" 2>/dev/null || true
gnome-extensions disable "$LEGACY_UUID" 2>/dev/null || true

if [[ -e "$EXT_DIR" ]]; then
  rm -rf "$EXT_DIR"
  echo "Removed extension dir: $EXT_DIR"
else
  echo "Extension dir not found: $EXT_DIR"
fi

if [[ -e "$LEGACY_EXT_DIR" ]]; then
  rm -rf "$LEGACY_EXT_DIR"
  echo "Removed legacy extension dir: $LEGACY_EXT_DIR"
else
  echo "Legacy extension dir not found: $LEGACY_EXT_DIR"
fi

echo "Uninstall complete."
