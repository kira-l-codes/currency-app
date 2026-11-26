# CONTRACT — what both builds must do, and where that is checked

Android is the reference for behaviour. Where Android is wrong the web does not copy the mistake —
the mistake is fixed on Android too.

Every row carries three things: the rule, **where each build stands today**, and **the check** that
holds it. A row with no check is a wish, not a rule. This file is not a claim that the two builds are
identical; the open items at the bottom are the proof that they are not, yet.

Reference: branch `parity/batch-1`, after `8fb14ad` (the first batch review).

---

## 1. Keypad

| Tap | Rule | Android | Web | Check |
| --- | --- | --- | --- | --- |
| `1K` / `100` / `10` | replaces the entry with `1000` / `100` / `10` | ✅ | ✅ | `logic.test.mjs`, browser run |
| first digit, Convert | **appends** to the amount (`100` then `5` is `1005`) | ✅ | ✅ | `logic.test.mjs` |
| first digit, Count quantity | **replaces** the pre-filled quantity | ✅ | ✅ | `logic.test.mjs`, browser run |
| `.` on an empty entry | types `0.` | ✅ | ✅ | `logic.test.mjs` |
| `.` when the operand already has one | ignored | ✅ | ✅ | `logic.test.mjs` |
| operator on an empty entry | ignored | ✅ | ✅ | `logic.test.mjs` |
| operator after an operator | replaces it (`5 + − 3` → `5−3`) | ✅ | ✅ | `logic.test.mjs` |
| leading zero | never accumulates | ✅ | ✅ | `logic.test.mjs` |
| length | 24 characters, **on every path** (a dot at 24 and a digit after an operator are refused) | ✅ | ✅ | `logic.test.mjs`, `keypad.dom.test.mjs` |
| symbols | the pad types `× ÷ −`, and the parser reads those | ✅ | ✅ | `logic.test.mjs` |

The earlier version of this file claimed Convert **replaced** on the first digit. That was wrong
about Android and wrong about the web; both append. Count is the one that replaces.

## 2. Evaluation

| Rule | Android | Web | Check |
| --- | --- | --- | --- |
| a dangling operator is not an error (`5+` = 5) | ✅ | ✅ | `logic.test.mjs` |
| a dangling point is not an error **anywhere** (`5.` = 5, `0.` = 0, `5+3.` = 8, `5.×3` = 15, `5.+3` = 8, `5.÷2` = 2.5, `5.−3` = 2) | ✅ | ✅ | `logic.test.mjs`, `keypad.dom.test.mjs` |
| malformed input (`5..`) is rejected by the evaluator itself, not only by the keypad | ✅ | ✅ | `logic.test.mjs` |
| `×` and `÷` bind tighter than `+` and `−` | ✅ | ✅ | `logic.test.mjs` |
| division by zero is "no value", never `0` or `Infinity` | ✅ | ✅ | `logic.test.mjs` |
| unparseable text is "no value" | ✅ | ✅ | `logic.test.mjs` |

## 3. Figures and money

| Rule | Android | Web | Check |
| --- | --- | --- | --- |
| 2 decimals from 100 up, 3 from 1, 4 from 0.01, 8 below, trailing zeros trimmed to a minimum of 2 | ✅ `Format.formatValue` | ✅ `Logic.formatFigure` | `logic.test.mjs` |
| a nonzero value never renders as `0.00`; below 8 decimals it reads `<0.00000001` | ✅ `Format.kt` | ✅ | `logic.test.mjs`, `keypad.dom.test.mjs` |
| a three-letter code keeps its place in the badge (`CHF 10.00`, `AED 10.00`); a one-character symbol stays tight (`¥10.00`); a symbol longer than two characters is spaced (`ل.ل 8,950,000.00`) | ✅ | ✅ | `keypad.dom.test.mjs` |
| `NaN` / `Infinity` render `—` | ✅ | ✅ | `logic.test.mjs` |
| an amount is stored as text in Android, so `1,234,567.89` returns unchanged | ✅ | n/a (JSON number) | `PrefsPrecisionTest` |

**Honest limit.** "Exact money" is not what any of this provides. Android writing a `Double` as text
prevents *additional* `Float` loss on the way to disk; it does not make decimal arithmetic exact, and
a value already rounded by the old `Float` path stays rounded. The guarantee is a **round trip**: what
you type is what comes back, within the documented display precision. Nothing here promises a
decimal-exact engine.

## 4. Stored state

| Rule | Android | Web | Check |
| --- | --- | --- | --- |
| the record carries its own format version | SharedPreferences keys + legacy read | ✅ `v: 3` in the record | `logic.test.mjs` |
| an older shape is migrated **once**, by version | ✅ legacy `Float` keys still read | ✅ `migrateRecord` | `logic.test.mjs` |
| opening the app twice never re-migrates | ✅ | ✅ | `logic.test.mjs` |
| migration never mutates the record it was given | n/a | ✅ | `logic.test.mjs` |

An **unversioned** web record is ambiguous: `1.3` wrote ounce prices there, `1.5`–`1.7` wrote unit
rates. The `>= 1` test is the only signal that exists for those records, it is applied once, and the
version written afterwards is what makes every later load unambiguous. It is not a permanent guess.

## 5. Metals

| Rule | Android | Web | Check |
| --- | --- | --- | --- |
| the rate table means **units per 1 USD**; an ounce is `1/price` | ✅ | ✅ | `RatesMergeTest`, `logic.test.mjs` |
| a row shows the ounce price (`$3,620.00 / oz`), never the rate | ✅ | ✅ | browser run |
| a publication is accepted only if it is newer than the last one | ✅ | ✅ | `RatesMergeTest`, `motion.test.mjs` |
| a duplicate publication moves nothing and flashes nothing | ✅ | ✅ | `RatesMergeTest`, `motion.test.mjs` |
| a refresh that brings **no** metal publication keeps the prices already known | ✅ `RatesMerge.table` | ✅ | `RatesMergeTest` |
| a publication's **time** survives a restart, so the row can say how old it is and an old price is not accepted as news | ✅ `Prefs.metalBook` | ✅ `metalMeta` in the record | `MetalBookTest` |
| the metal book is written on every accepted publication | ✅ | ✅ | `MetalBookTest` |
| a fiat success does not invent a metal price, and a metal failure does not empty the fiat list | ✅ | ✅ | `RatesMergeTest` |
| an empty metal feed never deletes a cached gold or silver price | ✅ | ✅ | `RatesMergeTest` |

## 6. Feed state

| Rule | Android | Web | Check |
| --- | --- | --- | --- |
| one metal's sheet shows **that** metal's freshness, from **that** metal's publication time (`ConvertScreen` → `MetalsSheet(feed = state.metalFeed(...))`) | ✅ | ✅ `metalFeedFor(code)` | `MetalFreshnessTest`, `parity.dom.test.mjs` |
| a price that arrived without a provider timestamp reads "age unknown", never `LIVE` | ✅ | ✅ | `MetalFreshnessTest`, `parity.dom.test.mjs` |
| a numeric cache with no publication record is "unknown", not fresh | ✅ | ✅ | `MetalFreshnessTest`, `parity.dom.test.mjs` |
| `LIVE` / `DELAYED` / `OFFLINE` for fiat and crypto is decided per source | ❌ one `updatedAt` | ❌ one `updated` | **open (item 10)** |
| a new receipt is not a new publication | ✅ | ✅ | `motion.test.mjs` |
| a fresh gold price does not make silver live | ✅ | ✅ | `motion.test.mjs` |
| fiat, crypto, gold and silver are still one timestamp in places | ❌ | ❌ | **open (item 10)** |

## 7. Count

| Rule | Android | Web | Check |
| --- | --- | --- | --- |
| `Short` is red, `Over` is amber | ✅ | ✅ | browser run |
| `Expected` is money and keeps its cents | ✅ text | ✅ JSON number | `PrefsPrecisionTest` |
| Restore is a full snapshot that replaces the bag | ❌ merges | ❌ replaces the bag only, no rates | **open (items 21, 22)** |
| unsaved changes are a real comparison, not a decorative dot | ❌ | ❌ | **open (item 24)** |
| hiding a currency keeps its quantities | ✅ | ✅ | `parity.dom.test.mjs` |
| the quantity keypad is a small integer-only pad (12 characters); Expected adds a point; no operators or shortcuts | ✅ `CountKeypadSheet` | ✅ | `parity.dom.test.mjs` |
| a base change never adds the old base as a row | ✅ `setBase` | ✅ | `parity.dom.test.mjs` |

## 8. Platform differences that are deliberate

- **Storage**: `localStorage` and a service worker on the web; SharedPreferences and an APK on
  Android. There is no sync, and none is planned.
- **Language**: English in both.
- **Chart touch**: the web reads a point under the finger; Android does not. Kept, not removed.

## 9. Open questions (do not change behaviour until decided)

1. **Restore semantics** — the review recommends: replace the snapshot, confirm when there are
   unsaved changes, restore the saved valuation rates, and label them as saved rather than live.
   Not implemented on either build yet.
2. **Denomination source** — one versioned data file bundled at build time, generated into each
   build. Structure and validation owned here; correctness of disputed denominations still needs a
   central-bank source and a date.
3. **Count keypad** — built on the web (quantities integer-only, `Expected` with a point).
4. **Row order after a base change** — Android keeps a fixed target list; the web now does the same.

## 10. What this file cannot claim

The rows above are backed by the tests named in them. They run in CI (`validate.yml`, verification
only — no tag, no deploy), and the counts reported in a hand-off are the ones that job printed, not a
number typed from a local run.
They do **not** cover the open items, the visual parity work, or the Android experience on a real
device: the APK has been exercised on the owner's phone, but not in this review pass, and no emulator
is available here.
