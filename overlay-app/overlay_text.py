#!/usr/bin/env python3
"""Wayland overlay text app using GTK4 + Gtk4LayerShell.

Reads text/margins from JSON config and styling from CSS.
Designed to run as a systemd --user service.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Gtk4LayerShell", "1.0")

from gi.repository import Gdk, Gtk, Gtk4LayerShell  # type: ignore

DEFAULT_TEXT = "Overlay is running"
DEFAULT_MARGIN_RIGHT = 24
DEFAULT_MARGIN_BOTTOM = 24


class OverlayWindow(Gtk.ApplicationWindow):
    def __init__(self, app: Gtk.Application, config: dict, css_path: Path):
        super().__init__(application=app)
        self.set_title("My Overlay")
        self.set_decorated(False)
        self.set_resizable(False)
        self.set_focusable(False)

        self._init_layer_shell(config)
        self._apply_css(css_path)
        self._build_ui(config)

    def _init_layer_shell(self, config: dict) -> None:
        if not Gtk4LayerShell.is_supported():
            raise RuntimeError("Gtk4LayerShell is not supported in this environment")

        Gtk4LayerShell.init_for_window(self)

        # Prefer OVERLAY if available; fallback to TOP for compatibility.
        layer = getattr(Gtk4LayerShell.Layer, "OVERLAY", Gtk4LayerShell.Layer.TOP)
        Gtk4LayerShell.set_layer(self, layer)

        Gtk4LayerShell.set_anchor(self, Gtk4LayerShell.Edge.BOTTOM, True)
        Gtk4LayerShell.set_anchor(self, Gtk4LayerShell.Edge.RIGHT, True)
        Gtk4LayerShell.set_anchor(self, Gtk4LayerShell.Edge.TOP, False)
        Gtk4LayerShell.set_anchor(self, Gtk4LayerShell.Edge.LEFT, False)

        margin_right = int(config.get("margin_right", DEFAULT_MARGIN_RIGHT))
        margin_bottom = int(config.get("margin_bottom", DEFAULT_MARGIN_BOTTOM))
        Gtk4LayerShell.set_margin(self, Gtk4LayerShell.Edge.RIGHT, margin_right)
        Gtk4LayerShell.set_margin(self, Gtk4LayerShell.Edge.BOTTOM, margin_bottom)

        Gtk4LayerShell.set_keyboard_mode(self, Gtk4LayerShell.KeyboardMode.NONE)

    def _apply_css(self, css_path: Path) -> None:
        provider = Gtk.CssProvider()
        if css_path.exists():
            provider.load_from_path(str(css_path))

        display = Gdk.Display.get_default()
        if display is None:
            raise RuntimeError("No GDK display available")

        Gtk.StyleContext.add_provider_for_display(
            display,
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

    def _build_ui(self, config: dict) -> None:
        text = str(config.get("text", DEFAULT_TEXT)).strip() or DEFAULT_TEXT

        container = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        container.add_css_class("overlay-container")

        label = Gtk.Label(label=text)
        label.add_css_class("overlay-label")
        label.set_wrap(True)
        label.set_xalign(1.0)
        label.set_halign(Gtk.Align.END)
        label.set_valign(Gtk.Align.END)

        container.append(label)
        self.set_child(container)


def load_config(config_path: Path) -> dict:
    if not config_path.exists():
        return {
            "text": DEFAULT_TEXT,
            "margin_right": DEFAULT_MARGIN_RIGHT,
            "margin_bottom": DEFAULT_MARGIN_BOTTOM,
        }

    try:
        raw = config_path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("config root must be an object")
        return data
    except Exception as exc:  # pragma: no cover - runtime safety path
        print(f"[overlay] Failed to read config: {exc}", file=sys.stderr)
        return {
            "text": DEFAULT_TEXT,
            "margin_right": DEFAULT_MARGIN_RIGHT,
            "margin_bottom": DEFAULT_MARGIN_BOTTOM,
        }


def build_arg_parser(default_config: Path, default_css: Path) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Wayland text overlay app")
    parser.add_argument("--config", type=Path, default=default_config)
    parser.add_argument("--css", type=Path, default=default_css)
    return parser


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    default_config = script_dir / "config.json"
    default_css = script_dir / "style.css"

    parser = build_arg_parser(default_config, default_css)
    args = parser.parse_args()

    config = load_config(args.config)

    app = Gtk.Application(application_id="org.example.overlay.app")

    def on_activate(application: Gtk.Application) -> None:
        try:
            window = OverlayWindow(application, config, args.css)
            window.present()
        except Exception as exc:  # pragma: no cover - runtime safety path
            print(f"[overlay] Startup failed: {exc}", file=sys.stderr)
            application.quit()

    app.connect("activate", on_activate)
    return app.run(sys.argv)


if __name__ == "__main__":
    raise SystemExit(main())
