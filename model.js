// SPDX-License-Identifier: GPL-2.0-or-later
export const TROY_OUNCE_GRAMS = 31.1034768;
export const CURRENCIES = [
    ['USD', 'US Dollar'], ['EUR', 'Euro'], ['GBP', 'British Pound'],
    ['JPY', 'Japanese Yen'], ['CAD', 'Canadian Dollar'],
    ['AUD', 'Australian Dollar'], ['CHF', 'Swiss Franc'],
    ['CNY', 'Chinese Yuan'], ['HKD', 'Hong Kong Dollar'],
    ['SGD', 'Singapore Dollar'], ['SEK', 'Swedish Krona'],
    ['NOK', 'Norwegian Krone'], ['DKK', 'Danish Krone'],
    ['NZD', 'New Zealand Dollar'], ['MXN', 'Mexican Peso'],
    ['INR', 'Indian Rupee'], ['BRL', 'Brazilian Real'],
    ['ZAR', 'South African Rand'], ['KRW', 'South Korean Won'],
];
export const UNITS = [['gram', 'Grams (g)'], ['ounce', 'Troy ounces (oz t)']];

export function validateQuote(data, currency, now = Date.now()) {
    if (data?.symbol !== 'XAU' || data.currency !== currency ||
        typeof data.price !== 'number' || !Number.isFinite(data.price) || data.price <= 0)
        throw new Error('The API returned an invalid gold price or currency.');
    const updatedAt = Date.parse(data.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt > now + 300_000)
        throw new Error('The API returned an invalid price timestamp.');
    return {price: data.price, currency, updatedAt};
}

export function convertWeight(pricePerOunce, unit, quantity = 1) {
    if (!['gram', 'ounce'].includes(unit) || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000)
        throw new Error('Invalid weight selection.');
    return pricePerOunce * quantity / (unit === 'gram' ? TROY_OUNCE_GRAMS : 1);
}

export function weightLabel(unit, quantity) {
    return `${quantity === 1 ? '' : quantity}${unit === 'gram' ? 'g' : 'oz t'}`;
}

export function formatPrice(quote, unit, quantity, decimals) {
    const amount = convertWeight(quote.price, unit, quantity);
    return `${quote.currency} ${new Intl.NumberFormat(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(amount)}/${weightLabel(unit, quantity)}`;
}

export function isStale(quote, refreshSeconds, now = Date.now()) {
    return now - quote.updatedAt > Math.max(300, refreshSeconds * 2) * 1000;
}
