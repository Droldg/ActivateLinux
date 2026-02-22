const {Gtk, Gio} = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

const _ = ExtensionUtils.gettext;

function init() {
    ExtensionUtils.initTranslations();
}

function _buildSwitchRow(settings, key, title, subtitle) {
    const row = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 12,
    });

    const labels = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
        hexpand: true,
    });

    const titleLabel = new Gtk.Label({
        label: title,
        xalign: 0,
        halign: Gtk.Align.START,
    });

    const subtitleLabel = new Gtk.Label({
        label: subtitle,
        xalign: 0,
        halign: Gtk.Align.START,
        wrap: true,
    });
    subtitleLabel.add_css_class('dim-label');

    const toggle = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
    });

    settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);

    labels.append(titleLabel);
    labels.append(subtitleLabel);
    row.append(labels);
    row.append(toggle);
    return row;
}

function _buildEntryRow(settings, key, title) {
    const row = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
    });

    const titleLabel = new Gtk.Label({
        label: title,
        xalign: 0,
        halign: Gtk.Align.START,
    });

    const entry = new Gtk.Entry({
        hexpand: true,
        text: settings.get_string(key),
    });
    entry.connect('changed', widget => {
        settings.set_string(key, widget.get_text());
    });

    row.append(titleLabel);
    row.append(entry);
    return row;
}

function buildPrefsWidget() {
    const settings = ExtensionUtils.getSettings('org.example.overlay');

    const root = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 16,
        margin_top: 24,
        margin_bottom: 24,
        margin_start: 24,
        margin_end: 24,
    });

    const title = new Gtk.Label({
        label: _('ActivateLinux'),
        xalign: 0,
        halign: Gtk.Align.START,
    });
    title.add_css_class('title-3');

    const description = new Gtk.Label({
        label: _('Start/stop my-overlay.service from GNOME Shell.'),
        xalign: 0,
        halign: Gtk.Align.START,
        wrap: true,
    });
    description.add_css_class('dim-label');

    root.append(title);
    root.append(description);
    root.append(_buildSwitchRow(
        settings,
        'autostart',
        _('Autostart when extension is enabled'),
        _('Starts my-overlay.service when GNOME extension is enabled')
    ));
    root.append(_buildSwitchRow(
        settings,
        'stop-on-disable',
        _('Stop service when extension is disabled'),
        _('If enabled, disable() runs systemctl --user stop my-overlay.service')
    ));
    root.append(_buildEntryRow(settings, 'overlay-script-path', _('Overlay script path')));
    root.append(_buildEntryRow(settings, 'config-path', _('Overlay config path')));
    root.append(_buildEntryRow(settings, 'text', _('Overlay text (future use)')));

    return root;
}
