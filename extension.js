// SPDX-License-Identifier: GPL-2.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {fetchQuote} from './api.js';
import {CURRENCIES, UNITS, formatPrice, isStale} from './model.js';

export default class GoldRateExtension extends Extension {
    enable() {
        const state = {
            settings: this.getSettings(),
            session: new Soup.Session({timeout: 20, user_agent: 'GoldRate-GNOME/1.0'}),
            cache: new Map(), errors: new Map(), attempts: new Map(),
            request: null, timer: 0,
        };
        this._state = state;
        this._indicator = new PanelMenu.Button(0.0, 'Gold Rate');
        const box = new St.BoxLayout({style_class: 'gold-rate-panel'});
        this._icon = new St.Icon({
            gicon: new Gio.FileIcon({file: this.dir.get_child('icons').get_child('gold-bar.svg')}),
            icon_size: 20,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._label = new St.Label({text: '…', y_align: Clutter.ActorAlign.CENTER});
        box.add_child(this._icon);
        box.add_child(this._label);
        this._indicator.add_child(box);

        const heading = new PopupMenu.PopupMenuItem('Gold spot price', {reactive: false});
        heading.label.add_style_class_name('gold-rate-heading');
        this._indicator.menu.addMenuItem(heading);
        this._priceItem = new PopupMenu.PopupMenuItem('Loading…', {reactive: false});
        this._indicator.menu.addMenuItem(this._priceItem);
        this._statusItem = new PopupMenu.PopupMenuItem('Connecting to Gold API…', {reactive: false});
        this._indicator.menu.addMenuItem(this._statusItem);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._currencyMenu = this._addChoices('Currency', 'currency', CURRENCIES);
        this._unitMenu = this._addChoices('Weight', 'unit', UNITS);
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._refreshItem = this._indicator.menu.addAction('Refresh now', () => this._refresh(state));
        this._indicator.menu.addAction('Preferences…', () => this.openPreferences());
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._indicator.menu.addMenuItem(new PopupMenu.PopupMenuItem(
            'Pure gold spot • excludes taxes and dealer fees', {reactive: false}));
        this._indicator.menu.addAction('Source: gold-api.com ↗', () => {
            Gio.AppInfo.launch_default_for_uri_async('https://gold-api.com', null, null,
                (_source, result) => {
                    try {
                        Gio.AppInfo.launch_default_for_uri_finish(result);
                    } catch (error) {
                        console.error(`Gold Rate: ${error.message}`);
                    }
                });
        });

        state.settingsSignal = state.settings.connect('changed', (_settings, key) => {
            this._render(state);
            if (key === 'refresh-seconds')
                this._schedule(state);
            if (key === 'currency')
                this._refresh(state);
        });
        this._indicator.menu.connect('open-state-changed', () => this._render(state));
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._schedule(state);
        this._refresh(state);
    }

    _addChoices(title, key, choices) {
        const submenu = new PopupMenu.PopupSubMenuMenuItem(title);
        submenu.choices = choices.map(([value, name]) => {
            const item = new PopupMenu.PopupMenuItem(key === 'currency' ? `${value} — ${name}` : name);
            item.connect('activate', () => this._state.settings.set_string(key, value));
            submenu.menu.addMenuItem(item);
            return {value, item};
        });
        this._indicator.menu.addMenuItem(submenu);
        return submenu;
    }

    _schedule(state) {
        if (state.timer)
            GLib.Source.remove(state.timer);
        state.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            state.settings.get_int('refresh-seconds'), () => {
                this._refresh(state);
                return GLib.SOURCE_CONTINUE;
            });
    }

    async _refresh(state) {
        if (this._state !== state)
            return;
        const currency = state.settings.get_string('currency');
        if (state.request?.currency === currency)
            return;
        if (state.request) {
            state.request.cancellable.cancel();
            // A cancelled request did not yield a quote. Let that currency retry
            // immediately if selected again rather than leaving an empty display.
            state.attempts.delete(state.request.currency);
            state.request = null;
        }
        // Respect the provider's 30-second cache, including manual refreshes and errors.
        const now = GLib.get_monotonic_time() / 1_000_000;
        if (now - (state.attempts.get(currency) ?? -Infinity) < 30) {
            this._render(state);
            return;
        }
        const request = {currency, cancellable: new Gio.Cancellable()};
        state.request = request;
        state.attempts.set(currency, now);
        this._render(state);
        try {
            const quote = await fetchQuote(state.session, currency, request.cancellable);
            if (this._state !== state || state.request !== request)
                return;
            state.cache.set(currency, quote);
            state.errors.delete(currency);
        } catch (error) {
            if (this._state !== state || state.request !== request || request.cancellable.is_cancelled())
                return;
            state.errors.set(currency, error.message);
            console.error(`Gold Rate: ${error.message}`);
        } finally {
            if (this._state === state && state.request === request) {
                state.request = null;
                this._render(state);
            }
        }
    }

    _render(state) {
        if (this._state !== state)
            return;
        const currency = state.settings.get_string('currency');
        const unit = state.settings.get_string('unit');
        const quantity = state.settings.get_int('quantity');
        const quote = state.cache.get(currency);
        const error = state.errors.get(currency);
        const busy = state.request?.currency === currency;
        const stale = quote && (error || isStale(quote, state.settings.get_int('refresh-seconds')));
        this._currencyMenu.label.text = `Currency: ${currency}`;
        this._unitMenu.label.text = `Weight: ${quantity} ${unit === 'gram' ? 'g' : 'oz t'}`;
        for (const [menu, selected] of [[this._currencyMenu, currency], [this._unitMenu, unit]]) {
            for (const {value, item} of menu.choices)
                item.setOrnament(value === selected ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.NONE);
        }
        if (quote) {
            const formatted = formatPrice(quote, unit, quantity, state.settings.get_int('decimal-places'));
            this._label.text = `${formatted}${stale ? ' ⚠' : ''}`;
            this._priceItem.label.text = formatted;
            this._statusItem.label.text = `${stale ? 'Last quote' : 'Quote'}: ${new Date(quote.updatedAt).toLocaleString()}`;
            if (error)
                this._statusItem.label.text += ' • Update failed; retrying automatically';
            else if (busy)
                this._statusItem.label.text += ' • Refreshing…';
            else if (stale)
                this._statusItem.label.text += ' • Source price is older than expected';
        } else {
            this._label.text = `${currency} ${busy ? '…' : '—'}`;
            this._priceItem.label.text = busy ? 'Loading gold price…' : 'Price unavailable';
            this._statusItem.label.text = error ? 'Connection or API error • Retrying automatically' : 'Waiting for a quote…';
        }
        this._indicator.accessible_name = `Gold Rate: ${this._priceItem.label.text}${stale ? ', stale quote' : ''}`;
        this._refreshItem.setSensitive(!busy);
        this._refreshItem.label.text = busy ? 'Refreshing…' : 'Refresh now (30-second API cache)';
    }

    disable() {
        const state = this._state;
        this._state = null;
        if (state) {
            if (state.timer)
                GLib.Source.remove(state.timer);
            state.settings.disconnect(state.settingsSignal);
            state.request?.cancellable.cancel();
            state.session.abort();
        }
        this._indicator?.destroy();
        this._indicator = null;
        this._icon = null;
        this._label = null;
        this._priceItem = null;
        this._statusItem = null;
        this._currencyMenu = null;
        this._unitMenu = null;
        this._refreshItem = null;
    }
}
