# Storage and Restore — design for review, no schema work yet

Status: **proposal**. Nothing here is implemented. The review gate requires this document before any
new persisted schema, and before Restore changes what a saved session means.

Reference: `parity/batch-1`, after `139231b`. `main` remains `5ee4819`.

---

## 1. What the review proved about the old rollback plan

My earlier plan said "the old reader refuses what it cannot understand, and `downgrade()` restores the
old shape". Both halves are wrong, and the review demonstrated it:

- Old main `5ee4819` and the branch reader both loaded a synthetic `v:4` record, discarded unknown
  fields, and **wrote a reconstructed record back at startup** — silently, with no rejection.
- `migrateRecord()` tolerating a future version is irrelevant once `saveState()` runs: the fields it
  does not model are gone.
- `downgrade()` in new code cannot be invoked by an old build. Checking out an old commit runs old
  code only.

Conclusion: **a version number is not a compatibility mechanism.** Isolation and a preserved original
are, and both must exist before the first write.

## 2. Versions, named

| Name | What it is | Where | Reader that must keep working |
| --- | --- | --- | --- |
| `KEY` | the storage key string `currency.web.v2` — a name, not a schema version | `localStorage` | every shipped build |
| **A — legacy-unversioned** | records written before this batch: no `v` field, ounce prices where unit rates belong (1.3) or unit rates (1.5–1.7) | `KEY` | old main `5ee4819` (reads, ignores `v`), current build (migrates to C) |
| **B — current** | `v: 3`, amounts as JSON numbers, `count.history[]`, `metalMeta` | `KEY` | current build; **old main reads it but loses `v` and unknown fields on save** |
| **C — snapshot** | proposed: `v: 4`, Count records carry their own valuation (rates + direction + source), per-metal book, explicit `expected: {state: "absent" \| "zero" \| "value", value}` | new canonical key (below) | current build only |

Old main is **not** a supported reader of C. C lives where old code cannot see it (section 4), and the
legacy key receives a projection that old code can read and rewrite without harming C.

## 3. Backup that actually protects the original

Order of operations on boot, before anything else may write:

1. Read `KEY` **raw, as a string**. Do not parse it first; the bytes are the thing being preserved.
2. If a backup already exists for this source, leave it alone (see 3.3).
3. Write the backup to `currency.web.backup.v3.<sourceHash>` with a small envelope:
   `{ "createdAt": <ms>, "sourceKey": KEY, "sourceVersion": <v or null>, "raw": "<the exact original string>" }`.
4. **Read it back and compare byte-for-byte** with what was intended. Only then continue.
5. On any failure — quota, blocked storage, read-back mismatch — do **not** migrate, do **not**
   autosave, keep the canonical value untouched, and surface an actionable error: the app works in
   memory for this session, and tells the user that saving is off until storage allows a backup.

### 3.1 Backup failure stops destructive progress

The current `saveState()` swallows exceptions ("private mode: it still works, it just forgets"). For
migration that is unacceptable: a failed backup followed by a migration destroys the only copy of the
original. Migration is therefore attempted **only** after step 4 succeeds.

### 3.2 One original, never overwritten

`currency.web.backup.v3.*` is written **once per source record**, keyed by a hash of the original
string. A later boot, an upgrade, a corrupted record or a second migration attempt finds the envelope
already present and does not touch it. The envelope keeps `createdAt`, `sourceVersion` and the raw
text, so the recovery path can always identify what it is looking at.

If the record changes materially (different hash) a *new* envelope is created; old envelopes are kept
until the user deletes them from the recovery screen. Nothing prunes them automatically.

### 3.3 Repeated boots

Second boot: the canonical record is now C. The backup step sees a valid backup for the *original*
source and does nothing. It does not re-back-up the migrated record — that would replace the only
copy of the pre-migration data with post-migration data.

## 4. Isolation from old readers

New canonical data goes in a **separate key**: `currency.web.state.v4` (name to be confirmed at
implementation, but it must not be a key any shipped build writes).

`currency.web.v2` becomes a **projection** maintained by the new build and readable by old builds:

- It is written from C by an explicit `projectToLegacy(c)` step: amounts, order, pinned, base, chart
  pair, `count.bag/counts/expected/history` in the legacy shape, `rates`, `metals` as unit rates.
- Fields C has that legacy cannot represent (per-record valuation, metal publication book, expected
  tri-state beyond legacy's number-or-null) are simply absent from the projection. **That is a lossy
  projection and is documented as lossy.**
- If an old tab overwrites the projection, the damage stops at the projection. C is untouched, and on
  its next save the new build rewrites the projection from C. The user may lose the *old tab's* edit;
  nobody loses saved sessions.

This is a candidate strategy, not a proven one: it must be tested with two real tabs and with an old
build actually running, as the review requires.

## 5. Rollback, precisely

Rollback means: **make the legacy key authoritative again and hand the user a compatible copy.**

1. The user opens the recovery screen (section 8) and exports or restores.
2. "Restore the pre-upgrade record" writes the raw text of the chosen backup envelope back to `KEY`,
   and moves C aside to `currency.web.state.v4.parked.<ms>` — it is not deleted.
3. Only then may an old build be launched. It reads `KEY`, sees a shape it understands, and behaves.

What is lost: anything only C could represent (per-record valuations, metal publication times). What
is **not** lost: the parked C record, the backup envelope, and every saved session in the legacy
projection. This is called a **lossy projection rollback**, never a full rollback.

## 6. Two tabs and mixed assets

- Every write stamps `writerSeq` and `writerBuild`. A tab that loads a record whose `writerSeq` is
  newer than the one it holds stops writing and shows "another tab changed your data — reload".
- A service worker may serve an old shell with new assets or the reverse. Assets are versioned by
  `VERSION` in `app.js` and the `CACHE` name; a build whose `VERSION` does not match the record's
  `writerBuild` treats the record as read-only.
- `storage` events (`window.addEventListener("storage")`) are the mechanism: on any external change to
  the canonical key, the other tab reloads rather than merging blindly.

## 7. What a saved Count session must contain (C)

```jsonc
{
  "v": 4,
  "id": "snapshot-uuid",
  "savedAt": 1790000000000,
  "bag": ["USD", "LBP"],
  "counts": { "USD": { "100": 3, "50": 1 }, "LBP": { "100000": 8 } },
  "hidden": { "EUR": { "counts": { "50": 2 }, "hiddenAt": 1789990000000 } },
  "expected": { "state": "absent" },              // or {"state":"zero"} or {"state":"value","usd":1000}
  "valuation": {
    "mode": "saved",                               // "saved" | "live" | "manual"
    "rates": { "USD": 1, "LBP": 89500 },           // units per USD, exactly as used
    "direction": "unitsPerUsd",
    "source": "open.er-api.com",
    "capturedAt": 1790000000000,
    "manual": { "EUR": { "unitsPerUsd": 0.9, "setAt": 1789999000000 } }
  },
  "totalUsd": 1234.56,
  "appVersion": "1.9.x",
  "writerBuild": 4
}
```

Rules that follow from this shape:

- **Restore replaces**: the active Count state becomes this snapshot. No merging of currencies.
- **Unsaved work first**: if the active state differs from the last saved/restored baseline, Restore
  asks; cancelling changes nothing.
- **Saved rates are shown as saved**, with their capture time, and the total is the snapshot's total
  unless the user presses "revalue at current rates", which recomputes and marks the session dirty.
- **Expected tri-state**: absent ("no expected amount") is not zero. A snapshot with absent Expected
  clears the current Expected; a snapshot with zero restores zero.
- **Hidden currencies** travel with their quantities and their hidden flag, so a currency re-added in
  another session cannot resurrect numbers that were not in this snapshot.
- **Old records without rates**: restored as "valuation unavailable", with the *quantities* restored
  and no invented total. The UI says the historical total cannot be recomputed.

## 8. Recovery and export, usable by a human

A "Storage" screen in the `···` menu, available without the network:

- lists every backup envelope and parked record with its creation time and source version;
- **Export** copies the exact JSON (and offers a download) — never deletes;
- **Compare** shows what the active record has that the backup does not;
- **Restore this copy** performs section 5 with a confirmation that names what will be lost;
- **Delete this copy** is explicit, per item, and never implied by a failed operation.

A hidden `localStorage` key is not a recovery procedure; this screen is.

## 9. Fixtures the acceptance tests must cover

Disposable browser profiles only; no real user data.

| # | Fixture | Must assert |
| --- | --- | --- |
| F1 | legacy-unversioned record with ounce prices | migrated once, original preserved byte-for-byte in a backup, second boot unchanged |
| F2 | current `v:3` record with sessions | no data loss, backup created, projection rewritten identically |
| F3 | future `v:4` record opened by this build | accepted, unknown fields **preserved on write**, not dropped |
| F4 | corrupt JSON | app starts with defaults, **original bytes kept**, visible message, no silent overwrite |
| F5 | storage full / blocked | no migration, canonical untouched, saving disabled with an actionable message |
| F6 | repeated startup (10×) | one backup, no growth, values stable |
| F7 | multiple saved sessions incl. hidden currencies and absent/zero Expected | all preserved through migration and export |
| F8 | partial write / interruption (kill between backup and migration) | next boot detects the incomplete state and resumes; no half-record |
| F9 | old tab + new tab, alternating saves | projection conflicts named, canonical never corrupted |
| F10 | explicit downgrade: park C, restore legacy, then **run the exact old build** | old build loads, and C is still intact in the parked key |

## 10. Migration sequence (C)

1. Read raw `KEY`.
2. Ensure backup (section 3). Failure ⇒ stop, read-only session, error shown.
3. Parse; if unparseable ⇒ keep bytes, start empty, show message (no overwrite until the user saves).
4. Migrate A→B→C by explicit steps, each a pure function with its own tests.
5. Write `currency.web.state.v4` (C).
6. Write the projection into `KEY` via `projectToLegacy`.
7. Only now allow autosave.

## 11. Restore acceptance matrix (before implementation is called done)

- Saved rate 89,500 LBP/USD, live rate 90,000: restore shows the saved rate and the saved total, both
  labelled saved, and a "revalue at live" action that changes the total and marks the session dirty.
- Expected absent → restore clears Expected and says "no expected amount"; Expected zero → restores 0
  and says "expected 0".
- Bag with a hidden currency → restore returns it with its quantities, and a currency that had
  quantities in the *other* session does not appear.
- Restore with unsaved edits → confirmation; cancel changes nothing, not even the selection.
- History with 40 records at the cap → eviction is oldest-first and the restored record is the one the
  user picked, not a neighbour.

## 12. Explicitly out of scope for this document

- Android's Count storage (its own snapshot work, same principles, separate implementation).
- Any service-worker cache strategy change.
- Any deployment, release or data deletion.
