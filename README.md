# Gold Rate for GNOME Shell

<img src="icons/gold-bar.svg" width="64" height="64" alt="Gold bar icon">

Gold spot price in the top bar. Choose from 19 currencies, grams or troy ounces, and any whole-number weight from 1 to 1000. No signup or API key required.

## Install

Requires GNOME Shell 45–50, GJS, libsoup 3, and libadwaita 1.4 or newer for preferences. GNOME 50 is the primary target.

Build and install from source (requires Git and the `gnome-extensions` command):

```sh
git clone https://github.com/user9091/gnome-gold-rate.git
cd gnome-gold-rate
gnome-extensions pack . \
  --extra-source=model.js --extra-source=api.js --extra-source=icons \
  --extra-source=README.md --extra-source=LICENSE \
  --force --out-dir=dist
gnome-extensions install --force ./dist/gold-rate@gold-rate.local.shell-extension.zip
```

Log out and log back in so GNOME discovers the newly installed extension. Then run:

```sh
gnome-extensions enable gold-rate@gold-rate.local
```

Click the top bar price to change currency or weight unit, refresh, or open Preferences. Preferences also controls quantity (for example 10 g), decimals, and refresh interval. Settings persist across sessions.

You can also open preferences with:

```sh
gnome-extensions prefs gold-rate@gold-rate.local
```

## Display

The price appears beside a custom gold bar SVG icon, for example `USD 100.00/g`. The icon has shaded gold faces and scales cleanly on high DPI displays. `g` is grams. Ounces are **troy ounces** (`oz t`), exactly **31.1034768 g**. A quantity of 10 shows the total price for 10 selected units, for example `/10g`.

Prices represent pure gold spot reference prices. They exclude local taxes, jewelry making charges and dealer premiums. No karat adjustment is applied.

- Default: USD, one gram, two decimal places, refresh every 60 seconds.
- Currencies: USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, HKD, SGD, SEK, NOK, DKK, NZD, MXN, INR, BRL, ZAR, KRW.
- Minimum automatic/manual interval per currency: 30 seconds, including failed requests.
- On failure, the previous quote for that currency remains visible with `⚠`; retries occur automatically. With no previous quote, the bar shows `—`.
- `⚠` also appears when the provider's quote is older than five minutes or twice the configured interval, whichever is longer. The market may be closed. The popup displays the source timestamp in your local timezone.
- Quotes are kept in memory for the current enabled session. After restarting offline, a previous price is not shown.

## Data and privacy

Uses only [Gold API](https://gold-api.com/docs): `GET https://api.gold-api.com/price/XAU/{currency}`. It returns the spot price per troy ounce in the requested currency. Gram and quantity calculations happen locally. See the provider's [API notes](https://gold-api.com/llms.txt) and [terms](https://gold-api.com/terms).

Requests are HTTPS and asynchronous with a 20-second timeout. The provider receives your IP address and requested currency. This extension sends no personal settings besides the currency and has no telemetry. Free API availability is controlled by the provider.

## Build and test

Run from this source directory:

```sh
glib-compile-schemas --strict schemas
GSETTINGS_BACKEND=memory gjs -m tests/check.js
# Optional real API smoke test (makes three requests):
GSETTINGS_BACKEND=memory gjs -m tests/check.js --live
gnome-extensions pack . --extra-source=model.js --extra-source=api.js --extra-source=icons --extra-source=README.md --extra-source=LICENSE --force --out-dir=..
```

The GTK preferences test uses the installed GNOME preferences resources and creates no visible window. On Fedora:

```sh
GI_TYPELIB_PATH=/usr/lib64/gnome-shell/girepository-1.0 \
LD_LIBRARY_PATH=/usr/lib64/gnome-shell \
GSETTINGS_BACKEND=memory gjs -m tests/prefs.js
```

Validated on GNOME Shell 50.6: 47 deterministic model/schema/HTTP checks, live USD/INR/JPY API requests, 15 headless Shell integration checks, and 7 GTK preferences checks. GNOME 45–49 compatibility is declared using the same APIs; those versions were not runtime-tested.

GNOME 50 includes a headless integration test runner. This runs an isolated test Shell without modifying your desktop's extension settings:

```sh
dbus-run-session -- gnome-shell-test-tool --headless \
  --extension ../gold-rate@gold-rate.local.shell-extension.zip \
  "$PWD/tests/shell.js"
```

## Remove

```sh
gnome-extensions disable gold-rate@gold-rate.local
gnome-extensions uninstall gold-rate@gold-rate.local
```

License: GPL-2.0-or-later.
