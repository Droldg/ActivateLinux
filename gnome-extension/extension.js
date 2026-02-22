import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const SERVICE_NAME = 'my-overlay.service';
const POLL_INTERVAL_SECONDS = 5;

const OverlayQuickToggle = GObject.registerClass(
class OverlayQuickToggle extends QuickSettings.QuickToggle {
    _init(controller) {
        super._init({
            title: _('Overlay'),
            iconName: 'video-display-symbolic',
            toggleMode: true,
        });

        this._controller = controller;
        this.connect('clicked', () => {
            this._controller.toggleService();
        });
    }
});

const OverlayPanelButton = GObject.registerClass(
class OverlayPanelButton extends PanelMenu.Button {
    _init(controller, iconFile) {
        super._init(0.0, 'ActivateLinux');
        this._controller = controller;
        this._suppressToggleSignal = false;

        let gicon = Gio.icon_new_for_string(iconFile);
        this._icon = new St.Icon({
            gicon,
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._switchItem = new PopupMenu.PopupSwitchMenuItem(_('Overlay Running'), false);
        this._switchSignalId = this._switchItem.connect('toggled', (_item, state) => {
            if (this._suppressToggleSignal)
                return;
            this._controller.setServiceRunning(state);
        });

        this.menu.addMenuItem(this._switchItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let refreshItem = new PopupMenu.PopupMenuItem(_('Refresh Status'));
        refreshItem.connect('activate', () => this._controller.refreshServiceState());
        this.menu.addMenuItem(refreshItem);
    }

    updateState(isRunning, busy) {
        this._suppressToggleSignal = true;
        this._switchItem.setToggleState(isRunning);
        this._switchItem.setSensitive(!busy);
        this._suppressToggleSignal = false;
    }

    destroy() {
        if (this._switchItem && this._switchSignalId) {
            this._switchItem.disconnect(this._switchSignalId);
            this._switchSignalId = 0;
        }
        super.destroy();
    }
});

export default class OverlayExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._busy = false;
        this._isRunning = false;

        let iconPath = `${this.path}/icons/overlay-symbolic.svg`;
        this._panelButton = new OverlayPanelButton(this, iconPath);
        Main.panel.addToStatusArea(this.uuid, this._panelButton);

        this._setupQuickSettings();

        this._pollId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            POLL_INTERVAL_SECONDS,
            () => {
                this.refreshServiceState();
                return GLib.SOURCE_CONTINUE;
            }
        );

        this.refreshServiceState().then(() => {
            if (this._settings.get_boolean('autostart') && !this._isRunning)
                this.setServiceRunning(true);
        });

        console.log('[overlay-extension] enabled');
    }

    disable() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }

        const stopOnDisable = this._settings?.get_boolean('stop-on-disable') ?? true;
        if (stopOnDisable) {
            this._runSystemctl(['stop', SERVICE_NAME]).catch(error =>
                console.error(`[overlay-extension] stop on disable failed: ${error}`)
            );
        }

        if (this._quickToggle) {
            this._quickToggle.destroy();
            this._quickToggle = null;
        }

        if (this._systemIndicator) {
            this._systemIndicator.destroy();
            this._systemIndicator = null;
        }

        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }

        this._settings = null;
        console.log('[overlay-extension] disabled');
    }

    _setupQuickSettings() {
        try {
            if (!Main.panel.statusArea.quickSettings)
                return;

            this._systemIndicator = new QuickSettings.SystemIndicator();
            this._quickToggle = new OverlayQuickToggle(this);

            this._systemIndicator.quickSettingsItems.push(this._quickToggle);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._systemIndicator);
        } catch (error) {
            console.error(`[overlay-extension] Quick Settings unavailable: ${error}`);
            this._systemIndicator = null;
            this._quickToggle = null;
        }
    }

    async toggleService() {
        return this.setServiceRunning(!this._isRunning);
    }

    async setServiceRunning(shouldRun) {
        if (this._busy)
            return;

        this._setBusy(true);

        try {
            let action = shouldRun ? 'start' : 'stop';
            let result = await this._runSystemctl([action, SERVICE_NAME]);
            if (!result.ok)
                console.error(`[overlay-extension] systemctl ${action} failed: ${result.stderr || result.stdout}`);
        } catch (error) {
            console.error(`[overlay-extension] setServiceRunning error: ${error}`);
        }

        await this.refreshServiceState();
        this._setBusy(false);
    }

    async refreshServiceState() {
        try {
            let result = await this._runSystemctl(['is-active', SERVICE_NAME]);
            let running = result.ok && result.stdout.trim() === 'active';
            this._isRunning = running;
            this._syncUiState();
            return running;
        } catch (error) {
            console.error(`[overlay-extension] refreshServiceState error: ${error}`);
            this._isRunning = false;
            this._syncUiState();
            return false;
        }
    }

    _setBusy(busy) {
        this._busy = busy;
        this._syncUiState();
    }

    _syncUiState() {
        if (this._panelButton)
            this._panelButton.updateState(this._isRunning, this._busy);

        if (this._quickToggle) {
            this._quickToggle.checked = this._isRunning;
            if (typeof this._quickToggle.setSensitive === 'function')
                this._quickToggle.setSensitive(!this._busy);
            else
                this._quickToggle.reactive = !this._busy;
        }
    }

    _runSystemctl(systemctlArgs) {
        const argv = ['systemctl', '--user', ...systemctlArgs];
        const proc = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        return new Promise((resolve, reject) => {
            proc.communicate_utf8_async(null, null, (p, res) => {
                try {
                    let [, stdout, stderr] = p.communicate_utf8_finish(res);
                    resolve({
                        ok: p.get_exit_status() === 0,
                        stdout: stdout ?? '',
                        stderr: stderr ?? '',
                        exitStatus: p.get_exit_status(),
                    });
                } catch (error) {
                    reject(error);
                }
            });
        });
    }
}
