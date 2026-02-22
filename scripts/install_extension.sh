#!/usr/bin/env bash
set -euo pipefail

UUID="activatelinux@example.com"
LEGACY_UUID="overlay-toggle@example.com"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/gnome-extension"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
LEGACY_DIR="$HOME/.local/share/gnome-shell/extensions/$LEGACY_UUID"

rm -rf "$TARGET_DIR"
rm -rf "$LEGACY_DIR"
mkdir -p "$TARGET_DIR"
cp -a "$SOURCE_DIR"/. "$TARGET_DIR"/

glib-compile-schemas "$TARGET_DIR/schemas"

echo "Installed extension to: $TARGET_DIR"
echo "Enable with: gnome-extensions enable $UUID"
echo "If already enabled, restart GNOME Shell session or disable/enable extension."
