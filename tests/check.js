import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import {fetchQuote} from '../api.js';
import {CURRENCIES, TROY_OUNCE_GRAMS, convertWeight, formatPrice, isStale, validateQuote} from '../model.js';

let passed = 0;
function check(condition, message) {
    if (!condition)
        throw new Error(message);
    passed++;
}
function throws(callback, message) {
    let failed = false;
    try { callback(); } catch { failed = true; }
    check(failed, message);
}
async function rejects(callback, message) {
    let failed = false;
    try { await callback(); } catch { failed = true; }
    check(failed, message);
}

const now = Date.now();
const payload = {symbol: 'XAU', currency: 'USD', price: TROY_OUNCE_GRAMS * 100,
    updatedAt: new Date(now).toISOString()};
const quote = validateQuote(payload, 'USD', now);
check(Math.abs(convertWeight(quote.price, 'gram') - 100) < 1e-10, 'Troy ounce to grams');
check(Math.abs(convertWeight(quote.price, 'gram', 10) - 1000) < 1e-9, '10 grams');
check(convertWeight(quote.price, 'ounce', 2) === quote.price * 2, '2 troy ounces');
check(formatPrice(quote, 'gram', 1, 2).includes('USD'), 'Currency code is unambiguous');
check(formatPrice(quote, 'ounce', 2, 2).endsWith('/2oz t'), 'Weight shown correctly');
check(!isStale(quote, 60, now + 299_000), 'Recent quote is fresh');
check(isStale(quote, 60, now + 301_000), 'Old quote is stale');
check(!isStale(quote, 3600, now + 3_601_000), 'Long refresh interval is respected');
for (const price of [0, -1, null, '123', NaN, Infinity])
    throws(() => validateQuote({...payload, price}, 'USD', now), `Invalid price ${price}`);
throws(() => validateQuote({...payload, currency: 'EUR'}, 'USD', now), 'Reject wrong currency');
throws(() => validateQuote({...payload, symbol: 'XAG'}, 'USD', now), 'Reject wrong metal');
throws(() => validateQuote({...payload, updatedAt: 'invalid'}, 'USD', now), 'Reject invalid timestamp');
throws(() => validateQuote({...payload, updatedAt: new Date(now + 600_000).toISOString()}, 'USD', now), 'Reject future timestamp');
throws(() => convertWeight(100, 'pound'), 'Reject unsupported unit');
throws(() => convertWeight(100, 'gram', 0), 'Reject zero quantity');

const schema = Gio.SettingsSchemaSource.new_from_directory(
    GLib.build_filenamev([GLib.get_current_dir(), 'schemas']), Gio.SettingsSchemaSource.get_default(), false)
    .lookup('org.gnome.shell.extensions.gold-rate', false);
const settings = new Gio.Settings({settings_schema: schema});
for (const [code] of CURRENCIES)
    check(settings.set_string('currency', code), `Schema permits ${code}`);
check(settings.get_int('refresh-seconds') === 60, 'Default refresh interval');
check(settings.get_string('unit') === 'gram', 'Default unit');

if (ARGV.includes('--live')) {
    const session = new Soup.Session({timeout: 20});
    try {
        for (const currency of ['USD', 'INR', 'JPY']) {
            const result = await fetchQuote(session, currency, null);
            check(result.currency === currency && result.price > 0, `Live ${currency} quote`);
            print(`Live ${currency}: ${formatPrice(result, 'gram', 1, 2)}`);
        }
    } finally {
        session.abort();
    }
} else {
    // Exercise real libsoup I/O against a deterministic local server.
    const server = new Soup.Server();
    let mode = 'ok';
    server.add_handler(null, (_server, message) => {
        message.set_status(mode === 'http' ? 503 : 200, null);
        const body = mode === 'bad-json' ? '<html>error</html>' : JSON.stringify(
            mode === 'wrong-currency' ? {...payload, currency: 'EUR'} : payload);
        message.set_response('application/json', Soup.MemoryUse.COPY, new TextEncoder().encode(body));
    });
    server.listen_local(0, Soup.ServerListenOptions.IPV4_ONLY);
    const base = server.get_uris()[0].to_string().replace(/\/$/, '');
    const session = new Soup.Session({timeout: 2});
    try {
        const result = await fetchQuote(session, 'USD', null, base);
        check(result.price === quote.price, 'HTTP success parsed through libsoup');
        for (mode of ['http', 'bad-json', 'wrong-currency'])
            await rejects(() => fetchQuote(session, 'USD', null, base), `Reject ${mode}`);
        const cancellable = new Gio.Cancellable();
        cancellable.cancel();
        await rejects(() => fetchQuote(session, 'USD', cancellable, base), 'Cancellation');
        await rejects(() => fetchQuote(session, 'XXX', null, base), 'Unsupported currency before HTTP');
    } finally {
        session.abort();
        server.disconnect();
    }
}
print(`PASS: ${passed} checks`);
