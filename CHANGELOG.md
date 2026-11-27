# Changelog

Web version numbers are the ones shown in the app. Android is untouched on 2026-11-26.

## 2026-11-27 — web 2.6 and Android 1.9.5 (optional manual LBP rate)

- **Manual LBP rate, optional.** In the list menu, "Manual LBP rate" takes the number of LBP per 1 USD
  as people trade it (for example 90,000). While it is on, every LBP figure uses it (list, Count) and
  the status line says "LBP manual 90,000". "Back to automatic LBP rate" turns it off. It is saved on
  the device, a refresh does not overwrite it, and the saved automatic table and saved counts are
  never changed. Only LBP is affected.
- Tests: new `lbp-manual.test.mjs` (web 99/99) and `LbpManualTest` (Android). Android versionCode 25.
- Service worker cache bumped to v26.

## 2026-11-27 — Android 1.9.4 (coin icons)

- **Crypto icons fixed on Android.** Coins showed a lone letter placeholder. Each coin is now a coloured
  disc with its ticker, the same as the web badges. New `CryptoBadge` rules with unit tests.
- Signed with the repo release key. Install by updating over 1.9.3 from the first fork build (versionCode 24).

## 2026-11-27 — web 2.5 (all 16 coins, icon fix)

- **16 crypto coins on the web**, the same list and names as Android: BTC, ETH, USDT, USDC, BNB, SOL,
  XRP, ADA, DOGE, TRX, TON, LINK, DOT, LTC, BCH, XLM. Priced from CoinGecko (no key), one request.
- **Crypto icons fixed.** The ₿ symbol drew an empty box on some browsers. Coin badges are now a
  coloured disc with the ticker, in every list.
- **Honest age for coins.** "cached" when the feed could not be reached, "delayed" when the provider
  price is over an hour old. A coin with no price shows a dash.
- Add Currency's Crypto tab lists all 16. Service worker cache bumped to v25.
- Tests: new `crypto.test.mjs` (7 cases). Web suite 95/95.

## 2026-11-26 — web 2.2 to 2.4 (web parity with Android)

All checked in CI. Final state: web 89/89 tests, JVM 142 tests, 0 failures.

### Web 2.4 — live QA fixes
Found by running the live site in a real Chrome with real clicks and drags.
- Reorder moved only one row per drag. Now moves as far as you drag.
- The old page kept showing after an update (service worker cache). Fixed.
- The Set button in Count was clipped on small screens. Fixed.
- The Close button on the metals sheet is fixed.
- Duplicate clear button in the currency search is removed.

### Web 2.2 — second batch
- **Metals sheet.** Tapping gold or silver opens the sheet (ounce price, LIVE / DELAYED / OFFLINE
  badge, gram at 24/22/21/18k, gold pound, silver gram) instead of putting a value into the converter.
  Matches Android's `MetalsSheet`. The age text refreshes every 15 s while open.
- **Swipe.** Right pins, left deletes, with a vibration. The base row does not swipe.
- **Reorder.** Menu opens reorder mode with a Done pill.
- **Add Currency screen.** Search, Fiat / Crypto / Metal tabs, letter sections and A–Z scrubber.
- **Chart pair picker.** Lists the base and the rows, with a tick on the selected pair.
- **Sound, vibration, splash** (splash once per launch). Pull-to-refresh with a thin progress bar.
- **Safety.** A saved count for a denomination Android lacks (EUR 500, AED 1000) still shows and
  counts in rows, totals and the note count.
- **Pin order.** Pinned rows first, in pin order, as on Android.

### Web — first batch
- Metal price freshness is tracked per metal.
- Hiding a currency in Count no longer wipes its quantities.
- The Count keypad matches Android (integer-only quantities).
- Banknote denominations for 20 currencies, default list, currency list and Sort menu now match
  Android, checked by tests that read the Kotlin source.

### Docs and tooling
- `docs/CONTRACT.md` updated with section 11 for the screens above.
- New tests: `screens.dom.test.mjs`, `parity.dom.test.mjs`.

## 2026-11-23 — parity phase closed
- Web and Android aligned on keypad, evaluation, money formatting, stored-state versioning, metals
  rules and feed states (`docs/CONTRACT.md`). Web 1.9, 57 web tests and 142 JVM tests green.
- Android candidate APK 1.9.3 adopted for daily use.
- Storage / Restore redesign written up but parked (`docs/STORAGE-RESTORE-DESIGN.md`).

## Earlier
- 2026-11-06: repository created (`lamahuissn-web/currency-app`) with the Android app and the first web build.
