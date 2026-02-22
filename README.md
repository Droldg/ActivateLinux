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
