# Currency

Convert currencies, read rate charts, and count cash by banknote. Gold and silver are priced by the
ounce, gram and karat. It comes as a native Android app and as a web app that installs to the home
screen. Both are free, need no API keys and no account.

- Web app: https://kira-l-codes.github.io/currency-app/
- Source: https://github.com/kira-l-codes/currency-app
- Everything here lives on one branch: `main`.

## Features

- **Convert.** One base amount against a watch list of fiat currencies, crypto and metals. Swipe a
  row right to pin it, left to delete it. Reorder by dragging. Pull down to refresh. Tap a row to set
  the base; tap the base to open the keypad.
- **Keypad arithmetic.** `1500×3`, `200+350`. `×` and `÷` bind before `+` and `−`. A half-typed or
  divide-by-zero entry is never converted.
- **Add Currency.** Search by name, code, country or region. Fiat, Crypto and Metal tabs.
- **Metals.** Tapping gold or silver opens a sheet with the ounce price, a LIVE / DELAYED / OFFLINE
  badge, the gram price at 24 / 22 / 21 / 18 karat, and the 21k gold pound (7.32 g). Silver shows the
  ounce and the gram. It never changes the base currency.
- **Chart.** Daily line for a pair, 1D to 2Y. A pair with no published history says so.
- **Count.** Count cash by banknote with `− n +` steppers per denomination (real ladders for 20
  currencies), a subtotal in its own currency and in USD, and an expected amount that answers
  `Match`, `Short` or `Over`. Counts persist, Save writes a history entry, and each currency can have
  a manual street rate.
- **Honest data.** Stale or offline rates are labelled, never shown as live. A value that cannot be
  known is shown as unknown, not guessed.

## Web and Android

The two builds are meant to behave the same. Android is the reference; where Android is wrong the
mistake is fixed there too rather than copied. `docs/CONTRACT.md` lists every rule, how each build
stands, and which test checks it.

Known differences: Android lists 16 crypto coins, the web has BTC and ETH only (see
`docs/DECISIONS.md`). Web storage is `localStorage`, Android uses SharedPreferences, and there is no
sync between them. Touch behaviour (swipe, pull-to-refresh, vibration, sound, splash) is written from
the Android code and checked in tests, but has not been verified on a real phone for the web.

## Data sources (all keyless)

| What | Source |
| --- | --- |
| Fiat rates | `open.er-api.com/v6/latest/USD` |
| History | `api.frankfurter.dev` (ECB reference rates) |
| Crypto | `api.coingecko.com` |
| Gold and silver | `api.gold-api.com/price/XAU`, `/XAG` |

Every rate is stored as units of that currency per 1 USD. These are reference rates and can differ
from street or exchanger rates.

## Run and test

Web (no build step, no server):

```bash
cd web
npm ci
node --test tests/*.test.mjs        # all web tests
npx serve .                          # or any static server, then open it
```

Android:

```bash
export ANDROID_HOME=/path/to/android-sdk
export JAVA_HOME=/path/to/jdk-21
./gradlew :app:testDebugUnitTest     # JVM tests
```

A release APK needs a signing keystore kept outside the repo
(`CURRENCY_KEYSTORE_PROPERTIES=~/.currency/keystore.properties`). The release build fails if it is
missing, so an unsigned APK cannot ship by accident. The keystore is never committed.

## CI and deploy

- `validate.yml` runs on every push and pull request: web tests (Node 22) and JVM tests. Nothing in it
  deploys or releases.
- `pages.yml` runs on pushes to `main` that touch `web/`: it re-runs the web tests, then publishes
  `web/` to GitHub Pages. If tests fail, nothing deploys.
- `release-apk.yml` builds and signs the APK from the Actions tab or by pushing a tag such as `v1.9.4`.
  It needs these repository secrets: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`,
  `KEY_PASSWORD`.

## Branch and commit rules

- One branch, `main`. Finished work is merged into it and the extra branch is deleted.
- Merging to `main` deploys the web app.
- Commit messages say what changed and why, for example `Metals sheet: match Android`, not
  `Update app.js`. Group related files into one commit.

## Layout

```
app/        Android app (Kotlin, Jetpack Compose) and JVM tests
web/        web app: index.html, app.js, screens.js, logic.js, motion.js, sw.js, tests/
docs/       CONTRACT.md, DECISIONS.md, STORAGE-RESTORE-DESIGN.md, CHANGELOG at repo root
design/     HTML design demos and comparison screenshots
.github/    CI and release workflows
```

Web notes: money goes through one `convert(value, from, to)` function (divide into USD, multiply
out). The service worker caches only the app shell, never prices.

## Docs

- `CHANGELOG.md` what changed and when
- `docs/CONTRACT.md` the behaviour both builds must share, with checks
- `docs/DECISIONS.md` why things are the way they are, and what is parked or held
- `docs/STORAGE-RESTORE-DESIGN.md` parked design, not implemented

## License

No license file yet. The code is public to read, not licensed for reuse.
