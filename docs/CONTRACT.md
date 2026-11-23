# CONTRACT — what both builds must do

Android is the reference for behaviour. The web follows it, and where Android is wrong the web does
not copy the mistake — the mistake gets fixed on Android too.

This file exists because a review found four places where the two builds answered the same tap
differently. Anything written here must be true of **both**, and every line has a test or a check
behind it.

## Keypad

| Tap | Result | Why |
| --- | --- | --- |
| `1K` / `100` / `10` | the entry becomes `1000` / `100` / `10` | a shortcut, not an append: `7` then `1K` is 1000 |
| first digit after opening | replaces the shown amount | the amount is a starting point, not text to edit |
| `.` when the operand already has one | ignored | `0.5` then `.` then `2` is `0.52`, never `0.5.2` |
| `.` on an empty entry | types `0.` | |
| operator on an empty entry | ignored | |
| operator after an operator | replaces it | `5 + − 3` reads `5−3` |
| a leading `0` | never accumulates | `00` then `7` is `7` |
| more than 24 characters | ignored | |
| `⌫` | removes one character | |
| `C` | clears the entry | |

The pad types the symbols it shows — `×`, `÷`, `−` — and the parser reads those symbols directly.
ASCII-only rules silently failed on `5 − 3`.

## Evaluation

- A dangling operator is not an error: `5 +` evaluates to `5`.
- `×` and `÷` bind tighter than `+` and `−`.
- Division by zero and unparseable text return "no value", never `0`.
- Both builds use one evaluator each, but they must agree on these four lines.

## Money

- An amount is stored as **text** (a double's exact decimal), never as `Float`:
  `1,234,567.89` must return as `1,234,567.89`.
- Web state records are versioned; a stored shape that no longer matches is migrated on load, never
  silently reinterpreted.

## Metals

- The rate table means **units per 1 USD**. An ounce priced at `$3,620` is `1/3620` in that table.
- A row shows the ounce price, not the rate: `$3,620.00 / oz`.
- A publication is accepted only if it is newer than the last one seen; two polls inside one
  publication move nothing and animate nothing.
- A refresh that brings no new publication must **keep** the prices already on screen.
- Feed state is per source: `LIVE` (fresh), `DELAYED` (older than expected), `OFFLINE` (no fresh
  data). A price is never shown as live when it is not.

## Count

- `Short` is red, `Over` is amber, on both builds.
- `Expected` is money: stored exactly, shown with cents.

## Open questions

These are not decided yet, so neither build should change behaviour until they are:

1. **Restore** — does restoring a saved count replace the bag, add to it, or ask first?
2. **Denomination list** — one shared list of notes for both builds, and who owns it?
3. **Count keypad** — the smaller Android pad or the full one?
4. **Row order after a base change** — Android keeps a fixed target list; the web adds the old base
   as a row. Pick one.
