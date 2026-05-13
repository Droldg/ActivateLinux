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

        const positionGroup = new Adw.PreferencesGroup({
            title: _('Position'),
        });

        const marginRightRow = new Adw.SpinRow({
            title: _('Right margin'),
            subtitle: _('Pixels from the right edge'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 2000,
                step_increment: 1,
                page_increment: 10,
                value: settings.get_int('margin-right'),
            }),
        });
        marginRightRow.connect('notify::value', row => {
            settings.set_int('margin-right', Math.round(row.value));
        });

        const marginBottomRow = new Adw.SpinRow({
            title: _('Bottom margin'),
            subtitle: _('Pixels from the bottom edge'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 2000,
                step_increment: 1,
                page_increment: 10,
                value: settings.get_int('margin-bottom'),
            }),
        });
        marginBottomRow.connect('notify::value', row => {
            settings.set_int('margin-bottom', Math.round(row.value));
        });

        positionGroup.add(marginRightRow);
        positionGroup.add(marginBottomRow);

        page.add(behaviorGroup);
        page.add(textGroup);
        page.add(positionGroup);
        window.add(page);

        window.set_default_size(700, 480);
    }
}
