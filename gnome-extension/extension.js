import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const OVERLAY_WIDTH = 430;
const OVERLAY_HEIGHT = 170;

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
            this._controller.toggleOverlay();
        });
    }
});

const OverlayPanelButton = GObject.registerClass(
class OverlayPanelButton extends PanelMenu.Button {
    _init(controller) {
        super._init(0.0, 'ActivateLinux');
        this._controller = controller;
        this._suppressToggleSignal = false;

        this._icon = new St.Icon({
            icon_name: 'video-display-symbolic',
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this._switchItem = new PopupMenu.PopupSwitchMenuItem(_('Show Overlay'), false);
        this._switchSignalId = this._switchItem.connect('toggled', (_item, state) => {
            if (this._suppressToggleSignal)
                return;
            this._controller.setOverlayVisible(state);
        });

        this.menu.addMenuItem(this._switchItem);
    }

    updateState(visible) {
        this._suppressToggleSignal = true;
        this._switchItem.setToggleState(visible);
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
        this._visible = false;
        this._overlayHost = null;
        this._titleLabel = null;
        this._bodyLabel = null;

        this._textChangedId = this._settings.connect('changed::text', () => {
            this._updateOverlayText();
        });
        this._titleChangedId = this._settings.connect('changed::title', () => {
            this._updateOverlayText();
        });

        this._panelButton = new OverlayPanelButton(this);
        Main.panel.addToStatusArea(this.uuid, this._panelButton);

        this._setupQuickSettings();
        this.setOverlayVisible(this._settings.get_boolean('autostart'));

        console.log('[activatelinux] enabled');
    }

    disable() {
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

        this._destroyOverlay();

        if (this._settings && this._textChangedId) {
            this._settings.disconnect(this._textChangedId);
            this._textChangedId = 0;
        }

        if (this._settings && this._titleChangedId) {
            this._settings.disconnect(this._titleChangedId);
            this._titleChangedId = 0;
        }

        this._settings = null;
        console.log('[activatelinux] disabled');
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
            console.error(`[activatelinux] Quick Settings unavailable: ${error}`);
            this._systemIndicator = null;
            this._quickToggle = null;
        }
    }

    toggleOverlay() {
        this.setOverlayVisible(!this._visible);
    }

    setOverlayVisible(visible) {
        if (visible)
            this._showOverlay();
        else
            this._hideOverlay();

        this._syncUiState();
    }

    _showOverlay() {
        if (!this._overlayHost)
            this._buildOverlay();

        this._updateOverlayText();
        this._overlayHost.show();
        this._visible = true;
    }

    _hideOverlay() {
        if (this._overlayHost)
            this._overlayHost.hide();
        this._visible = false;
    }

    _buildOverlay() {
        this._overlayHost = new St.Widget({
            reactive: false,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            layout_manager: new Clutter.BinLayout(),
        });

        const overlay = new St.BoxLayout({
            vertical: true,
            reactive: false,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            width: OVERLAY_WIDTH,
            height: OVERLAY_HEIGHT,
        });
        overlay.style = [
            'background-color: rgba(28, 27, 43, 0.96);',
            'border-radius: 0 0 6px 0;',
            'padding: 98px 0 0 95px;',
        ].join(' ');

        this._titleLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._titleLabel.style = [
            'color: rgba(155, 154, 168, 0.58);',
            'font-size: 29px;',
            'font-weight: 400;',
        ].join(' ');

        this._bodyLabel = new St.Label({
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._bodyLabel.style = [
            'color: rgba(165, 164, 178, 0.64);',
            'font-size: 20px;',
            'font-weight: 400;',
            'padding-top: 5px;',
        ].join(' ');

        overlay.add_child(this._titleLabel);
        overlay.add_child(this._bodyLabel);
        this._overlayHost.add_child(overlay);

        try {
            Main.layoutManager.addChrome(this._overlayHost, {
                trackFullscreen: false,
            });
        } catch (error) {
            console.error(`[activatelinux] addChrome failed, fallback to uiGroup: ${error}`);
            Main.uiGroup.add_child(this._overlayHost);
        }
    }

    _updateOverlayText() {
        if (!this._titleLabel || !this._bodyLabel)
            return;

        const title = this._settings?.get_string('title').trim() || _('Activate Linux');
        const text = this._settings?.get_string('text').trim() || _('Go to Settings to activate Linux.');

        this._titleLabel.text = title;
        this._bodyLabel.text = text;
    }

    _syncUiState() {
        if (this._panelButton)
            this._panelButton.updateState(this._visible);

        if (this._quickToggle)
            this._quickToggle.checked = this._visible;
    }

    _destroyOverlay() {
        if (this._overlayHost) {
            this._overlayHost.destroy();
            this._overlayHost = null;
        }

        this._titleLabel = null;
        this._bodyLabel = null;
        this._visible = false;
    }
}
