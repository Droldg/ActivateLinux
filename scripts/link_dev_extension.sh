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
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
LEGACY_DIR="$HOME/.local/share/gnome-shell/extensions/$LEGACY_UUID"

detect_gnome_major() {
  local shell_version
  shell_version="$(gnome-shell --version 2>/dev/null || true)"
  printf '%s\n' "$shell_version" | grep -oE '[0-9]+' | head -n1
}

GNOME_MAJOR="$(detect_gnome_major)"
if [[ "$GNOME_MAJOR" =~ ^[0-9]+$ ]] && (( GNOME_MAJOR < 45 )); then
  SOURCE_DIR="$REPO_ROOT/gnome-extension-44"
else
  SOURCE_DIR="$REPO_ROOT/gnome-extension"
fi

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: extension source dir not found: $SOURCE_DIR" >&2
  exit 1
fi

if [[ ! -d "$SOURCE_DIR/schemas" ]]; then
  echo "Error: missing schemas dir: $SOURCE_DIR/schemas" >&2
  exit 1
fi

mkdir -p "$(dirname -- "$TARGET_DIR")"
rm -rf "$TARGET_DIR"
rm -rf "$LEGACY_DIR"
ln -s "$SOURCE_DIR" "$TARGET_DIR"

glib-compile-schemas "$SOURCE_DIR/schemas"

echo "Linked extension: $TARGET_DIR -> $SOURCE_DIR"
echo "Enable with: gnome-extensions enable $UUID"
