# ActivateLinux

## Install (GNOME session user only)

Run all commands as your normal desktop user.
Do not use `sudo` with these scripts.

```bash
cd ~/ActivateLinux/scripts
chmod +x install_extension.sh install_service.sh link_dev_extension.sh uninstall.sh
./install_extension.sh
./install_service.sh
systemctl --user daemon-reload
systemctl --user enable --now my-overlay.service
gnome-extensions enable activatelinux@example.com
```

## Why no sudo

Scripts use:
- `$HOME/.local/share/gnome-shell/extensions`
- `$HOME/.config/systemd/user`
- `systemctl --user`

Using `sudo` switches to root's home and root's user bus, which breaks extension/service setup.

## Service behavior

The GNOME extension can start a separate overlay app via `my-overlay.service`, but detaches to a built-in GNOME Shell fallback overlay if the service cannot stay active. The service is therefore optional for the overlay feature; if it fails, the extension still tries to show an overlay from GNOME Shell.

If you want to debug the service, use:

```bash
systemctl --user status my-overlay.service
journalctl --user -u my-overlay.service --since "5 minutes ago"
```

If the service does not work on your system, you can disable the `autostart` setting in the extension preferences and rely on the fallback overlay instead.
