// SPDX-License-Identifier: GPL-2.0-or-later
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {CURRENCIES, validateQuote} from './model.js';

export const API_BASE = 'https://api.gold-api.com/price/XAU';

// baseUrl is injectable for local HTTP integration tests; the extension always uses HTTPS.
export function fetchQuote(session, currency, cancellable, baseUrl = API_BASE) {
    if (!CURRENCIES.some(([code]) => code === currency))
        return Promise.reject(new Error('Unsupported currency.'));
    const message = Soup.Message.new('GET', `${baseUrl}/${currency}`);
    message.request_headers.append('Accept', 'application/json');
    return new Promise((resolve, reject) => {
        session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
            try {
                const bytes = source.send_and_read_finish(result);
                if (message.status_code !== Soup.Status.OK)
                    throw new Error(`Gold API returned HTTP ${message.status_code}.`);
                resolve(validateQuote(JSON.parse(new TextDecoder().decode(bytes.get_data())), currency));
            } catch (error) {
                reject(error);
            }
        });
    });
}
