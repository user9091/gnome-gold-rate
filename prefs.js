// SPDX-License-Identifier: GPL-2.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {CURRENCIES, UNITS} from './model.js';

export default class GoldRatePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window.set_default_size(600, 620);
        const page = new Adw.PreferencesPage({title: 'Gold Rate', icon_name: 'preferences-system-symbolic'});
        window.add(page);
        const display = new Adw.PreferencesGroup({title: 'Price display', description: 'Changes appear immediately in your top bar.'});
        page.add(display);
        this._combo(display, settings, 'currency', 'Currency', CURRENCIES.map(([code, name]) => [code, `${code} — ${name}`]), window);
        this._combo(display, settings, 'unit', 'Weight unit', UNITS, window);
        this._spin(display, settings, 'quantity', 'Weight quantity', 'For example, 10 with grams shows the price for 10 g.', 1, 1000, 1);
        this._spin(display, settings, 'decimal-places', 'Decimal places', 'Number of digits after the decimal point.', 0, 4, 1);
        const updates = new Adw.PreferencesGroup({title: 'Updates'});
        page.add(updates);
        this._spin(updates, settings, 'refresh-seconds', 'Refresh interval (seconds)', 'Minimum 30 seconds; default 60 seconds.', 30, 3600, 30);
        const about = new Adw.PreferencesGroup({title: 'About the price',
            description: 'Pure gold spot reference, excluding taxes, making charges and dealer premiums. An ounce is a troy ounce: 31.1034768 g. Older quotes and failed updates are marked ⚠ in the top bar.'});
        page.add(about);
        const source = new Adw.ActionRow({title: 'Gold API', subtitle: 'Free • No API key • Internet connection required'});
        const link = new Gtk.LinkButton({label: 'Website', uri: 'https://gold-api.com', valign: Gtk.Align.CENTER});
        source.add_suffix(link);
        about.add(source);
    }

    _combo(group, settings, key, title, choices, window) {
        const row = new Adw.ComboRow({title,
            model: Gtk.StringList.new(choices.map(([, label]) => label))});
        const sync = () => {
            row.selected = Math.max(0, choices.findIndex(([value]) => value === settings.get_string(key)));
        };
        sync();
        row.connect('notify::selected', () => settings.set_string(key, choices[row.selected][0]));
        const signal = settings.connect(`changed::${key}`, sync);
        window.connect('close-request', () => { settings.disconnect(signal); return false; });
        group.add(row);
    }

    _spin(group, settings, key, title, subtitle, lower, upper, step) {
        const row = new Adw.SpinRow({title, subtitle,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: step, page_increment: step * 2})});
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
}
