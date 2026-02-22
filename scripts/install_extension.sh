#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  echo "Error: run this script as your normal user, not with sudo/root." >&2
  exit 1
fi

UUID="activatelinux@example.com"
LEGACY_UUID="overlay-toggle@example.com"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/gnome-extension"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
LEGACY_DIR="$HOME/.local/share/gnome-shell/extensions/$LEGACY_UUID"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: extension source dir not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR/schemas" ]]; then
  echo "Error: missing schemas dir: $SOURCE_DIR/schemas" >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
rm -rf "$LEGACY_DIR"
mkdir -p "$TARGET_DIR"
cp -a "$SOURCE_DIR"/. "$TARGET_DIR"/

glib-compile-schemas "$TARGET_DIR/schemas"

echo "Installed extension to: $TARGET_DIR"
echo "Enable with: gnome-extensions enable $UUID"
echo "If already enabled, restart GNOME Shell session or disable/enable extension."
