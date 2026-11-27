# Decisions and notes

Short record of why things are the way they are. Add a line here when a decision is made.

## Web matches Android (decided 2026-11-23)
The web app should behave like the Android app. Android is the reference, but its bugs are not
copied. Correct numbers (metals conversion, stale crypto shown as live, count page) came before
visual parity. Rules and checks: `docs/CONTRACT.md`.

Choices made when parity work started:
- Restore replaces the saved count, and asks first if there are unsaved changes.
- Row order follows Android's fixed target list, with pinned rows first.
- The Count keypad is the smaller integer-only one.
- Banknote denominations should come from one shared file bundled into both apps (not done yet).

## One branch
Only `main`. Extra branches are merged and deleted. Keeps things simple. Merging to `main` deploys
the web app, so tests must be green first (CI enforces this).

## Stable daily-use version
The goal is a stable app to use and fix when something really breaks, not an open-ended stream of
features. Fix real bugs as they appear.

## This repository is a separate copy
`kira-l-codes/currency-app` was created on 2026-11-26 as a fork of the original
`lamahuissn-web/currency-app` (last commit there: 2026-11-23, `42b4e3e`). The original repository
belongs to an account we do not have access to, so we work in our own copy. All work since then is
here, and the live web app is served from here. The original is not updated.

## Parked: storage and restore redesign
`docs/STORAGE-RESTORE-DESIGN.md` proposes a versioned storage format, safe migration, multi-tab
write safety and a Restore flow. It is a proposal only. Nothing in it is implemented. Pick it up
only if storage problems show up in real use.

## Crypto: all 16 coins on the web (decided 2026-11-27)
The owner confirmed the web should list the same 16 coins as Android and asked for fixed icons.
- **Source: CoinGecko `simple/price`, no key.** It is the source Android already uses, so both builds
  quote the same numbers. One request prices all 16 coins, allows browser calls (CORS), and returns
  the time each coin was last updated (`include_last_updated_at`). Checked on 2026-11-27 against
  Coinbase's spot price for all 16 coins: every one within 0.5% (BTC 61,618 vs 61,604 USD).
- **Honest age.** A coin whose provider update is over an hour old reads "delayed". If the feed cannot
  be reached (offline, rate limit, bad reply) the last prices stay and read "cached". A coin the feed
  leaves out loses its price and shows a dash. Nothing is made up.
- **Icons.** The old badge printed the symbol (₿, Ξ). Devices without a font for ₿ drew an empty box.
  A coin badge is now a coloured disc with the ticker as text, which every device can draw. In
  amounts, a symbol the device cannot draw falls back to the ticker.
- **Free-tier limit.** CoinGecko's keyless tier is rate limited. One call per refresh keeps the app
  well inside it. A limit shows as "cached", not as a wrong price.
- **Not done:** coin charts. Android draws them from CoinGecko history. The web chart uses ECB data,
  which has no coins, so it says so instead of drawing a guess.

## Not verified on a real phone
Web pull-to-refresh, vibration, sound and the splash animation were written from the Android code
and covered by tests, but only a real phone can confirm them. Report anything odd.

## Known limits
- Rates are reference rates, not street or exchanger rates. Count has a manual rate per currency for
  that reason.
- Web and Android do not sync. Each stores its own data.
- "Exact money" is not promised: values round-trip as typed within the display precision, but this
  is not a decimal-exact engine.
- No license file yet.

## Optional manual LBP rate (decided 2026-11-27)
The owner asked for it after a friend pointed out that the street rate for the Lebanese pound differs
from the automatic reference rate. It is a switch, never forced: off by default, one number (LBP per
USD), shown clearly while on, kept apart from the automatic table so a refresh cannot overwrite it.
It changes only LBP. No other currency, saved count or saved table is touched.
