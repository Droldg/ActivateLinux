const {GObject, Gio, GLib, St} = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const _ = ExtensionUtils.gettext;

const SERVICE_NAME = 'my-overlay.service';
const POLL_INTERVAL_SECONDS = 5;

const OverlayPanelButton = GObject.registerClass(
class OverlayPanelButton extends PanelMenu.Button {
    _init(controller) {
        super._init(0.0, 'ActivateLinux');
        this._controller = controller;
        this._suppressToggleSignal = false;

        const iconPath = `${Me.path}/icons/overlay-symbolic.svg`;
        const gicon = Gio.icon_new_for_string(iconPath);
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

        const refreshItem = new PopupMenu.PopupMenuItem(_('Refresh Status'));
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

class OverlayExtension44 {
    constructor() {
        this._settings = null;
        this._panelButton = null;
        this._pollId = 0;
        this._busy = false;
        this._isRunning = false;
    }

    enable() {
        this._settings = ExtensionUtils.getSettings('org.example.overlay');
        this._busy = false;
        this._isRunning = false;

        this._panelButton = new OverlayPanelButton(this);
        Main.panel.addToStatusArea(Me.metadata.uuid, this._panelButton);

        this._pollId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            POLL_INTERVAL_SECONDS,
            () => {
                this.refreshServiceState();
                return GLib.SOURCE_CONTINUE;
            }
        );

        this.refreshServiceState(() => {
            if (this._settings.get_boolean('autostart') && !this._isRunning)
                this.setServiceRunning(true);
        });

        log('[overlay-extension-44] enabled');
    }

    disable() {
        if (this._pollId) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }

        const stopOnDisable = this._settings ? this._settings.get_boolean('stop-on-disable') : true;
        if (stopOnDisable) {
            this._runSystemctl(['stop', SERVICE_NAME], (_result, error) => {
                if (error)
                    logError(error, '[overlay-extension-44] stop on disable failed');
            });
        }

        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }

        this._settings = null;
        log('[overlay-extension-44] disabled');
    }

    setServiceRunning(shouldRun) {
        if (this._busy)
            return;

        this._setBusy(true);
        const action = shouldRun ? 'start' : 'stop';
        this._runSystemctl([action, SERVICE_NAME], (result, error) => {
            if (error) {
                logError(error, '[overlay-extension-44] setServiceRunning error');
            } else if (!result.ok) {
                log(`[overlay-extension-44] systemctl ${action} failed: ${result.stderr || result.stdout}`);
            }

            this.refreshServiceState(() => this._setBusy(false));
        });
    }

    refreshServiceState(done) {
        this._runSystemctl(['is-active', SERVICE_NAME], (result, error) => {
            if (error) {
                logError(error, '[overlay-extension-44] refreshServiceState error');
                this._isRunning = false;
            } else {
                this._isRunning = result.ok && result.stdout.trim() === 'active';
            }

            this._syncUiState();

            if (done)
                done(this._isRunning);
        });
    }

    _setBusy(busy) {
        this._busy = busy;
        this._syncUiState();
    }

    _syncUiState() {
        if (this._panelButton)
            this._panelButton.updateState(this._isRunning, this._busy);
    }

    _runSystemctl(systemctlArgs, callback) {
        const argv = ['systemctl', '--user'].concat(systemctlArgs);
        const proc = Gio.Subprocess.new(
            argv,
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );

        proc.communicate_utf8_async(null, null, (process, res) => {
            try {
                const [, stdout, stderr] = process.communicate_utf8_finish(res);
                callback({
                    ok: process.get_exit_status() === 0,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    exitStatus: process.get_exit_status(),
                }, null);
            } catch (error) {
                callback(null, error);
            }
        });
    }
}

function init() {
    ExtensionUtils.initTranslations();
    return new OverlayExtension44();
}
