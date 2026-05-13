import Adw from 'gi://Adw';

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
            title: _('Show overlay when extension is enabled'),
            subtitle: _('Uses the built-in GNOME Shell overlay. No user service is started.'),
        });
        settings.bind('autostart', autostartRow, 'active', 0);

        behaviorGroup.add(autostartRow);

        const textGroup = new Adw.PreferencesGroup({
            title: _('Text'),
        });

        const titleRow = new Adw.EntryRow({
            title: _('Title'),
            text: settings.get_string('title'),
        });
        titleRow.connect('changed', row => {
            settings.set_string('title', row.text);
        });

        const textRow = new Adw.EntryRow({
            title: _('Body'),
            text: settings.get_string('text'),
        });
        textRow.connect('changed', row => {
            settings.set_string('text', row.text);
        });

        textGroup.add(titleRow);
        textGroup.add(textRow);

        page.add(behaviorGroup);
        page.add(textGroup);
        window.add(page);

        window.set_default_size(700, 480);
    }
}
