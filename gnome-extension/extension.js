import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const SERVICE_NAME = 'my-overlay.service';
const POLL_INTERVAL_SECONDS = 5;
const FALLBACK_MARGIN_RIGHT = 24;
const FALLBACK_MARGIN_BOTTOM = 24;

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
        this._desiredRunning = false;
        this._serviceFailureNotified = false;
        this._fallbackVisible = false;
        this._fallbackHost = null;
        this._fallbackOverlay = null;
        this._fallbackLabel = null;
        this._settingsTextChangedId = this._settings.connect('changed::text', () => {
            this._updateFallbackOverlayText();
        });

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

        this.refreshServiceState().then(running => {
            this._desiredRunning = running;
            if (running)
                this._setFallbackOverlayVisible(true);

            if (this._settings.get_boolean('autostart') && !running)
                this.setServiceRunning(true);
            else
                this._syncUiState();
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

        this._destroyFallbackOverlay();

        if (this._settings && this._settingsTextChangedId) {
            this._settings.disconnect(this._settingsTextChangedId);
            this._settingsTextChangedId = 0;
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
        return this.setServiceRunning(!this._desiredRunning);
    }

    async setServiceRunning(shouldRun) {
        if (this._busy)
            return;

        this._desiredRunning = shouldRun;
        this._serviceFailureNotified = false;
        if (shouldRun)
            this._setFallbackOverlayVisible(true);
        else
            this._setFallbackOverlayVisible(false);

        this._setBusy(true);

        try {
            let action = shouldRun ? 'start' : 'stop';
            let result = await this._runSystemctl([action, SERVICE_NAME]);
            if (!result.ok) {
                console.error(`[overlay-extension] systemctl ${action} failed: ${result.stderr || result.stdout}`);
                if (shouldRun)
                    this._notifyStartFailure(result.stderr || result.stdout);
            }
        } catch (error) {
            console.error(`[overlay-extension] setServiceRunning error: ${error}`);
            if (shouldRun)
                this._notifyStartFailure(String(error));
        }

        await this.refreshServiceState();

        this._setBusy(false);
    }

    async refreshServiceState() {
        try {
            let result = await this._runSystemctl(['is-active', SERVICE_NAME]);
            let running = result.ok && result.stdout.trim() === 'active';
            this._isRunning = running;

            if (this._desiredRunning) {
                this._setFallbackOverlayVisible(true);
                if (!running && !this._serviceFailureNotified) {
                    this._notifyStartFailure(_('Service is inactive'));
                    this._serviceFailureNotified = true;
                }
                if (running)
                    this._serviceFailureNotified = false;
            } else {
                this._setFallbackOverlayVisible(false);
                this._serviceFailureNotified = false;
            }

            this._syncUiState();
            return running;
        } catch (error) {
            console.error(`[overlay-extension] refreshServiceState error: ${error}`);
            this._isRunning = false;
            if (this._desiredRunning)
                this._setFallbackOverlayVisible(true);
            this._syncUiState();
            return false;
        }
    }

    _setBusy(busy) {
        this._busy = busy;
        this._syncUiState();
    }

    _syncUiState() {
        const effectiveRunning = this._desiredRunning || this._isEffectivelyRunning();

        if (this._panelButton)
            this._panelButton.updateState(effectiveRunning, this._busy);

        if (this._quickToggle) {
            this._quickToggle.checked = effectiveRunning;
            if (typeof this._quickToggle.setSensitive === 'function')
                this._quickToggle.setSensitive(!this._busy);
            else
                this._quickToggle.reactive = !this._busy;
        }
    }

    _isEffectivelyRunning() {
        return this._desiredRunning || this._isRunning || this._fallbackVisible;
    }

    _setFallbackOverlayVisible(visible) {
        try {
            if (visible) {
                if (!this._fallbackHost) {
                    this._fallbackHost = new St.Widget({
                        reactive: false,
                        x_expand: true,
                        y_expand: true,
                        x_align: Clutter.ActorAlign.FILL,
                        y_align: Clutter.ActorAlign.FILL,
                        layout_manager: new Clutter.BinLayout(),
                    });

                    this._fallbackOverlay = new St.BoxLayout({
                        reactive: false,
                        track_hover: false,
                        x_align: Clutter.ActorAlign.END,
                        y_align: Clutter.ActorAlign.END,
                    });
                    this._fallbackOverlay.style = [
                        'padding: 10px 14px;',
                        `margin-right: ${FALLBACK_MARGIN_RIGHT}px;`,
                        `margin-bottom: ${FALLBACK_MARGIN_BOTTOM}px;`,
                        'border-radius: 10px;',
                        'border: 1px solid rgba(255, 255, 255, 0.22);',
                        'background-color: rgba(20, 20, 20, 0.65);',
                    ].join(' ');

                    this._fallbackLabel = new St.Label({
                        text: this._getOverlayText(),
                        y_align: Clutter.ActorAlign.CENTER,
                    });
                    this._fallbackLabel.style = [
                        'color: #ffffff;',
                        'font-size: 20px;',
                        'font-weight: 600;',
                    ].join(' ');

                    this._fallbackOverlay.add_child(this._fallbackLabel);
                    this._fallbackHost.add_child(this._fallbackOverlay);
                    try {
                        Main.layoutManager.addChrome(this._fallbackHost, {
                            trackFullscreen: false,
                        });
                    } catch (chromeError) {
                        console.error(`[overlay-extension] addChrome failed, fallback to uiGroup: ${chromeError}`);
                        Main.uiGroup.add_child(this._fallbackHost);
                    }
                }

                this._updateFallbackOverlayText();
                this._fallbackHost.show();
                this._fallbackVisible = true;
                this._syncUiState();
                return;
            }

            if (this._fallbackHost)
                this._fallbackHost.hide();
            this._fallbackVisible = false;
            this._syncUiState();
        } catch (error) {
            this._fallbackVisible = false;
            console.error(`[overlay-extension] fallback overlay error: ${error}`);
        }
    }

    _updateFallbackOverlayText() {
        if (!this._fallbackLabel)
            return;

        this._fallbackLabel.text = this._getOverlayText();
    }

    _getOverlayText() {
        const text = this._settings?.get_string('text') ?? '';
        return text.trim() || _('Overlay is running');
    }

    _notifyStartFailure(detail) {
        const message = _('Service failed to stay active. Showing built-in overlay fallback.');
        const body = detail ? String(detail).trim().split('\n')[0] : '';
        const full = body ? `${message}\n${body}` : message;

        if (typeof Main.notifyError === 'function')
            Main.notifyError(_('ActivateLinux'), full);
        else if (typeof Main.notify === 'function')
            Main.notify(_('ActivateLinux'), full);
    }

    _destroyFallbackOverlay() {
        if (this._fallbackHost) {
            this._fallbackHost.destroy();
            this._fallbackHost = null;
        }

        if (this._fallbackOverlay) {
            this._fallbackOverlay = null;
        }

        this._fallbackLabel = null;
        this._fallbackVisible = false;
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
