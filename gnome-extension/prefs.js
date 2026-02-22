import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OverlayPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: _('Overlay'),
            icon_name: 'video-display-symbolic',
        });

        const behaviorGroup = new Adw.PreferencesGroup({
            title: _('Behavior'),
        });

        const autostartRow = new Adw.SwitchRow({
            title: _('Autostart when extension is enabled'),
            subtitle: _('Starts my-overlay.service when GNOME extension is enabled'),
        });
        settings.bind('autostart', autostartRow, 'active', 0);

        const stopOnDisableRow = new Adw.SwitchRow({
            title: _('Stop service when extension is disabled'),
            subtitle: _('If enabled, disable() runs systemctl --user stop my-overlay.service'),
        });
        settings.bind('stop-on-disable', stopOnDisableRow, 'active', 0);

        behaviorGroup.add(autostartRow);
        behaviorGroup.add(stopOnDisableRow);

        const pathsGroup = new Adw.PreferencesGroup({
            title: _('Paths (for future integration)'),
            description: _('Current MVP reads overlay config from overlay-app/config.json via systemd service.'),
        });

        const scriptPathRow = new Adw.EntryRow({
            title: _('Overlay script path'),
            text: settings.get_string('overlay-script-path'),
        });
        scriptPathRow.connect('changed', row => {
            settings.set_string('overlay-script-path', row.text);
        });

        const configPathRow = new Adw.EntryRow({
            title: _('Overlay config path'),
            text: settings.get_string('config-path'),
        });
        configPathRow.connect('changed', row => {
            settings.set_string('config-path', row.text);
        });

        const textRow = new Adw.EntryRow({
            title: _('Overlay text (future use)'),
            text: settings.get_string('text'),
        });
        textRow.connect('changed', row => {
            settings.set_string('text', row.text);
        });

        pathsGroup.add(scriptPathRow);
        pathsGroup.add(configPathRow);
        pathsGroup.add(textRow);

        page.add(behaviorGroup);
        page.add(pathsGroup);
        window.add(page);

        window.set_default_size(700, 480);
    }
}
