import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Use the real GNOME preferences base class, not a mock.
Gio.resources_register(Gio.Resource.load('/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource'));
const {default: Preferences} = await import('../prefs.js');
const path = GLib.get_current_dir();
const [, bytes] = GLib.file_get_contents(`${path}/metadata.json`);
const metadata = {...JSON.parse(new TextDecoder().decode(bytes)), path, dir: Gio.File.new_for_path(path)};
Adw.init();
const preferences = new Preferences(metadata);
const window = new Adw.PreferencesWindow();
preferences.fillPreferencesWindow(window);

const combos = [];
const spins = [];
function visit(widget) {
    if (widget instanceof Adw.ComboRow)
        combos.push(widget);
    if (widget instanceof Adw.SpinRow)
        spins.push(widget);
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        visit(child);
}
visit(window);
function check(condition, message) {
    if (!condition)
        throw new Error(message);
    print(`PASS: ${message}`);
}
check(combos.length === 2, 'Currency and weight controls constructed');
check(spins.length === 3, 'Quantity, decimals and refresh controls constructed');
const currency = combos.find(row => row.title === 'Currency');
const unit = combos.find(row => row.title === 'Weight unit');
const quantity = spins.find(row => row.title === 'Weight quantity');
const settings = preferences.getSettings();
currency.selected = 15;
check(settings.get_string('currency') === 'INR', 'Currency preference writes settings');
settings.set_string('currency', 'JPY');
check(currency.selected === 3, 'Currency control follows external changes');
unit.selected = 1;
check(settings.get_string('unit') === 'ounce', 'Weight preference writes settings');
quantity.value = 10;
check(settings.get_int('quantity') === 10, 'Quantity preference writes settings');
settings.set_int('quantity', 5);
check(quantity.value === 5, 'Quantity control follows external changes');
window.close();
print('ALL PREFERENCES CHECKS PASSED');
