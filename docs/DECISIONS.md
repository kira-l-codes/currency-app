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

## Held: more crypto coins on the web
Android lists 16 crypto coins. The web has BTC and ETH only. Adding the rest needs a price source
for each coin (the web currently has none for them), so it was held until the owner decides.

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
