# requirements-notes.md

Runtime pakker paa Arch Linux:

```bash
sudo pacman -S --needed python python-gobject gtk4 gtk4-layer-shell
```

Valider imports i Python:

```bash
python -c "import gi; gi.require_version('Gtk', '4.0'); gi.require_version('Gtk4LayerShell','1.0'); from gi.repository import Gtk, Gtk4LayerShell; print('OK')"
```

Hvis `Gtk4LayerShell` ikke kan importeres, mangler typisk `gtk4-layer-shell` pakken eller korrekt GIR binding i systemet.
