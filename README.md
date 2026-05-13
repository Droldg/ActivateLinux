# ActivateLinux

## Install (GNOME session user only)

Run all commands as your normal desktop user.
Do not use `sudo` with these scripts.

```bash
cd ~/ActivateLinux/scripts
chmod +x install_extension.sh link_dev_extension.sh uninstall.sh
./install_extension.sh
gnome-extensions enable activatelinux@example.com
```

## Why no sudo

The install script uses:
- `$HOME/.local/share/gnome-shell/extensions`

Using `sudo` switches to root's home, which installs the extension in the wrong place.

## Overlay behavior

The overlay is drawn directly by the GNOME Shell extension. It does not install,
start, or require a `systemd --user` service.

Use the panel icon, the Quick Settings toggle, or extension preferences to show
or hide the built-in overlay.
