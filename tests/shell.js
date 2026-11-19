// Run with gnome-shell-test-tool --headless --extension <zip> <absolute path to this file>.
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const METRICS = {};
const uuid = 'gold-rate@gold-rate.local';
function check(condition, message) {
    if (!condition)
        throw new Error(message);
    print(`PASS: ${message}`);
}
function delay(ms) {
    return new Promise(resolve => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    }));
}
function fixture(extension, currency, price = 3110.34768) {
    const state = extension._state;
    state.request?.cancellable.cancel();
    state.request = null;
    state.cache.set(currency, {currency, price, updatedAt: Date.now()});
    extension._render(state);
    return state;
}

export async function run() {
    let record;
    for (let i = 0; i < 100; i++) {
        record = Main.extensionManager.lookup(uuid);
        if (record?.stateObj?._state)
            break;
        await delay(100);
    }
    const extension = record?.stateObj;
    check(Boolean(extension?._state), 'Extension enabled in GNOME Shell');
    let state = fixture(extension, 'USD');
    check(Main.panel.statusArea[uuid] === extension._indicator, 'Indicator mounted in top bar');
    check(extension._label.text.includes('USD 100.00/g'), 'Gram price rendered');
    state.settings.set_string('unit', 'ounce');
    check(extension._label.text.includes('/oz t'), 'Unit change updates display');
    state.settings.set_int('quantity', 10);
    check(extension._label.text.endsWith('/10oz t'), 'Quantity change updates display');
    state.settings.set_string('currency', 'INR');
    check(!extension._label.text.includes('USD'), 'Old currency never relabeled as new');
    fixture(extension, 'INR', 300000);
    check(extension._label.text.includes('INR'), 'New currency rendered');
    state.errors.set('INR', 'Offline');
    extension._render(state);
    check(extension._label.text.includes('⚠'), 'Failed update retains price with warning');
    state.errors.clear();
    state.cache.get('INR').updatedAt -= 600_000;
    extension._render(state);
    check(extension._label.text.includes('⚠'), 'Old source timestamp marked stale');
    extension._indicator.menu.open();
    extension._currencyMenu.menu.open();
    await delay(150);
    check(extension._currencyMenu.choices.length === 19, 'Currency submenu populated');
    extension._indicator.menu.close();
    const timer = state.timer;
    extension.disable();
    check(extension._state === null && extension._indicator === null, 'Disable clears state and indicator');
    check(!GLib.MainContext.default().find_source_by_id(timer), 'Disable removes timer');
    extension.enable();
    state = extension._state;
    check(Boolean(state), 'Re-enable succeeds');
    check(state.settings.get_string('currency') === 'INR', 'Settings persist across enable/disable');
    // Trigger a currency change while a request is pending, then disable immediately.
    state.settings.set_string('currency', 'JPY');
    extension.disable();
    await delay(200);
    check(extension._state === null, 'Late async callbacks leave disabled extension untouched');
    print('ALL SHELL CHECKS PASSED');
}
