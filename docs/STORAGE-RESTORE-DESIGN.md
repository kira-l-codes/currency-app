# Storage, Restore and update design — revision 2, for review

**Status: proposal only.** No schema, migration, Restore implementation, protocol, workflow, tag,
release, APK, deploy or deletion is authorized by this document or by the reviews that preceded it.
This revision replaces revision 1 rather than amending it, because the Batch 3 review found
contradictions between revision 1's sections, not only missing details.

Reference: `parity/batch-1` at `7374cf3`. Remote `main` remains `5ee4819`.

---

## 0. What changed from revision 1, and why

| Review point | Revision 1 said | Revision 2 says |
| --- | --- | --- |
| §2A startup | sections 3, 3.3 and 10 described three different boot flows | one decision table (§2), every input combination, including partial writes |
| §2A identity | backup keyed by a hash of the *current* legacy value | the backup records the **original** raw bytes and a `migrationId` that never derives from the mutable projection |
| §2A corrupt canonical | implied a fall back to the projection | corrupt/unsupported canonical ⇒ **read-only recovery**, never silently replaced |
| §2A app vs snapshot | one example conflated the two | app-state envelope and Count snapshot are separate shapes with separate versions (§1.1, §1.2, §8) |
| §2A build vs schema | `writerBuild` treated as compatibility | build identity and schema version are independent; neither proves the assets agree (§1.3, §7) |
| §2B conflicts | `writerSeq` + `storage` events | a real write protocol: Web Locks + re-read + revision compare-and-write, and a read-only fallback where locks are absent (§3) |
| §2B old tabs | "nobody loses saved sessions" | the actual boundary: canonical is isolated; an old tab's edit can still be overwritten **in the projection**, and that is detected and preserved before the overwrite (§3.6) |
| §2C interruption | "no half-record" | a journalled phase protocol with a defined source of truth after a failure at **every** write (§4) |
| §2C rollback order | legacy written first, canonical parked after | canonical preserved and verified first; legacy bytes retained; a durable mode marker; then the chosen legacy restore (§5) |
| §2C restore vs export | one "rollback" action | three distinct actions with three different loss summaries (§5.3) |
| §2D backup limits | implied disaster recovery | same-origin backup only; clearing site data removes both; offline export/import is part of the design (§6) |
| §2D corrupt source | "keep bytes, start empty" | explicit read-only/import path; no parse-then-normalise (§2.4) |
| §2E assets | excluded | a prerequisite section: build manifest, activation policy, read-only before write (§7) |
| §3 Restore | partial contract | complete contract: one representation, dirty definition, cancellation, immutability, manual rates, numeric form, Expected encoding, stable IDs (§8) |
| §5 CI | retries any failure | bounded retry classification and reporter status capture are **proposed**, not implemented (§11.2) |

---

## 1. Vocabulary, versions and identities

### 1.1 Schema versions of stored state

| Name | Meaning | Written by |
| --- | --- | --- |
| **S0** | unversioned record: no `v` field; either ounce prices (1.3) or unit rates (1.5–1.7) in `metals` | every build before this branch |
| **S1** | `v: 3`: amounts as JSON numbers, `count.{bag,counts,expected,history,collapsed}`, `metalMeta` | this branch |
| **S2** | proposed canonical: `v: 4`, app-state envelope (§1.2) | nothing yet |

**Snapshots are versioned separately:** `SN1` is the Count snapshot shape in §8. A snapshot inside an
S2 envelope carries `snV: 1`; it is not an S-version.

### 1.2 Two shapes, not one

**App-state envelope (S2)** — the whole session, stored at the canonical key:

```jsonc
{
  "v": 4,                       // envelope schema
  "build": { "commit": "7374cf3", "assets": "sha256:…" },   // identity, advisory (§7)
  "rev": 17,                    // write revision, monotonic, bumped inside the lock
  "migration": {
    "id": "0f3c…",                        // uuid v4, created once
    "sourceFingerprint": "sha256:…",      // of the ORIGINAL raw legacy bytes at backup time
    "sourceVersion": null,                // S0 has no version
    "backupKey": "currency.web.backup.0f3c…",
    "completedAt": 1790000000000
  },
  "settings": { "base": "USD", "amount": "100", "order": ["USD","LBP"], "pinned": ["LBP"],
                "soundOn": true, "screen": "convert",
                "chart": { "base": "EUR", "quote": "USD", "period": "3M" } },
  "data": {
    "fiatRates": { "USD": "1", "LBP": "89500" },          // units per USD, decimal STRINGS
    "fiatAt": 1790000000000, "fiatSource": "open.er-api.com",
    "cryptoRates": { "BTC": "0.0000163" }, "cryptoAt": 1790000000000,
    "metals": {
      "XAU": { "usdPerOz": "3620.15", "publishedAt": 1790000000000, "atKnown": true, "seq": 4 },
      "XAG": { "usdPerOz": "42.05",  "publishedAt": null,         "atKnown": false, "seq": 2 }
    }
  },
  "count": { /* active Count state, §8.1 */ },
  "history": [ /* SN1 snapshots, newest first, cap 40 */ ]
}
```

**Count snapshot (SN1)** — one saved session; immutable once written (§8).

The envelope's rates are the *live* ones; a snapshot's rates are the ones that session was valued at.
Revision 1 used one record for both, which is how it ended up with an example that was neither.

### 1.3 Build identity is not schema compatibility

- `schema` (S0/S1/S2) decides what may be read and written.
- `build.commit` + `build.assets` identify the exact code and asset set. Two different commits may
  support the same schema; a different commit is **not** proof of incompatibility.
- `build.assets` is a SHA-256 over a manifest of the served asset hashes (§7). It is the only field
  that can detect "HTML from one build, script from another".
- No build may refuse a record **only** because the commit differs; it refuses on schema, or because
  its own assets disagree (§7).

### 1.4 Keys

| Key | Purpose | Written by |
| --- | --- | --- |
| `currency.web.state.v4` | canonical S2 envelope — authoritative | new builds only |
| `currency.web.v2` | legacy key; holds S0/S1 and, later, a **projection** of S2 | old builds and new (projection) |
| `currency.web.backup.<migrationId>` | immutable original bytes + envelope | new builds, once |
| `currency.web.journal` | migration/rollback phase journal (§4) | new builds |
| `currency.web.mode` | durable mode marker: `normal` \| `readonly` \| `legacy-active` | new builds |
| `currency.web.recovery.<ts>` | recovery copies created by rollback (§5) | new builds |
| `currency.web.legacy-edit.<ts>` | an older tab's projection edits, preserved before overwrite (§3.6) | new builds |
| `currency.web.corrupt.<ts>` | preserved corrupt source (§2.4) | new builds, explicit action |

Names are provisional; none is written by a shipped build today except `currency.web.v2`.

---

## 2. Startup state machine

### 2.1 Read order

1. `mode` — cheap, decides whether this boot may write at all.
2. `journal` — an unfinished migration or rollback outranks everything else.
3. canonical `state.v4`.
4. legacy `v2`.
5. backups and recovery copies — listed, never parsed for state.

### 2.2 Decision table

`C` = canonical, `L` = legacy, `B` = at least one backup, `J` = journal, `M` = mode marker. "RO" =
read-only session with an export path and a visible message.

| # | State | Action | Writes this boot |
| --- | --- | --- | --- |
| 1 | C valid S2, no J | load C | none until the user acts |
| 2 | C valid S2, J = `done` | load C, clear J | clears J only |
| 3 | C valid S2, J = `migrate:<P0..P4>` | resume from the recorded phase (§4.2) | per §4.2 |
| 4 | C valid S2, J = `rollback:*` | finish the rollback (§5.1) | per §5.1 |
| 5 | C valid S2, L stale projection | load C, refresh projection | projection only |
| 6 | C corrupt, B exists | **RO recovery**: offer backups, offer "start fresh"; never overwrite C | none |
| 7 | C corrupt, no B | RO; "start fresh" copies C to `corrupt.<ts>` first, on explicit action | on action only |
| 8 | C valid but unsupported `v` (e.g. 5) | RO: export + "this build cannot edit this record" | none |
| 9 | C absent, L valid, no B | migrate (§4): backup L, verify, write C, projection, done | yes, after verification |
| 10 | C absent, L valid, B exists, no J | migration died before the canonical write: if B's fingerprint matches L, resume at `backup-verified` | yes |
| 11 | C absent, L corrupt | RO: keep raw bytes, export raw text, "start fresh" copies first | on action only |
| 12 | C absent, L absent, B exists | RO: "restore this backup" | on action only |
| 13 | C absent, L absent, no B | clean first launch: defaults, write C with `rev: 1` | yes |
| 14 | storage blocked / full | memory-only session, banner "saving is off", export offered | none |
| 15 | M = `legacy-active` | RO: "an older build is active for this data"; no auto re-migration | none |
| 16 | M = `readonly` (a backup failed earlier) | RO until storage is resolved | none |

**Migration identity.** `migration.id` is generated and journalled *before* the backup, so a crash
between "made an id" and "made a backup" is repeatable. The envelope stores
`sourceFingerprint` = SHA-256 of the exact original string, and canonical copies that value — so a
later boot can answer "which original does this come from?" without hashing the mutable projection.

**No per-boot backup.** Rows 1 and 5 are the common path and write no backup. A backup per boot would
grow without bound and would capture already-migrated data as if it were the original.

### 2.3 First launch under blocked storage

Row 14: the app runs in memory, says so, and offers export. It never reports a save it did not make.

### 2.4 Corruption and unsupported schemas

- A parse failure never leads to "start empty and overwrite". The raw string is preserved, and the
  user chooses between export, "start fresh" (which copies the raw bytes aside first) and nothing.
- An unsupported version is **read-only**, not "best effort": unknown fields survive export because the
  whole record is exported as-is, not re-serialised from a partial model.
- A supported version with unknown fields (forward-compatible additions) loads and **preserves** those
  fields on write, via a raw-preserving envelope: the writer merges its known fields into the parsed
  object rather than rebuilding the object from scratch.

---

## 3. Write protocol

### 3.1 Why not `writerSeq` + events

`storage` events notify other documents *after* a change; they are not exclusion. Two tabs can both
read `rev: 17` and both write `rev: 18`. An automatic reload on a storage event can also discard
unsaved work in the other tab. Revision 1 proposed exactly that, and it was wrong.

### 3.2 Primary protocol — Web Locks

Every write goes through one helper:

```
withWriteLock(fn):
  if (!navigator.locks) return Unsupported
  return navigator.locks.request("currency-store", { mode: "exclusive" }, async () => {
    fresh = readCanonical()                 // RE-READ inside the lock
    if (fresh.rev !== memory.rev) return Conflict(fresh)   // compare-and-write, not "greater than"
    newState = fn(fresh)                    // pure: state -> state
    newState.rev = fresh.rev + 1
    writeCanonical(newState)
    verify: read back, compare rev and a payload hash
    return Written
  })
```

Applied to: migration phases, ordinary autosave, Restore, recovery actions, rollback, projection
writes. The revision is re-read **under** the lock.

### 3.3 Losing writer

The loser never silently retries and never reloads. It receives `Conflict(freshState)` and offers
three explicit choices: **keep mine** (re-apply onto the fresh revision, a visible merge decision),
**keep theirs** (discard mine after exporting mine to a file), **export mine and stop**.

### 3.4 Support and fallback

Web Locks: Chrome/Edge 69+, Safari 15.4+, Firefox 96+. Where absent:

- persistence becomes **read-only**: the session works in memory, says so, and offers export;
- an "optimistic" single-writer mode is **not** offered — it is the unprotected path the review
  rejected;
- the reason is shown in the recovery screen so a support report can see it.

### 3.5 Unsaved work is never reloaded by a notification

A `storage` event on the canonical key raises a banner ("another tab saved changes") with **Reload**
and **Export mine**. It does not reload by itself, and it never discards dirty state without a choice.

### 3.6 Old tabs — the real boundary

An old build cannot be made to participate. Revised statement, replacing revision 1's claim:

> Canonical sessions are isolated from old builds: they cannot read or write
> `currency.web.state.v4`. Their edits touch only the projection at `currency.web.v2`.

What can still be lost: an old tab's **newly saved sessions or edits**, because the new build rewrites
the projection from canonical. Mitigation, before any projection write:

1. read the projection; if its fingerprint differs from the one this build last wrote, something else
   changed it;
2. copy it verbatim to `currency.web.legacy-edit.<ts>`, listed in the recovery screen as "changes from
   an older tab — not merged";
3. only then write the projection.

Disclosed limitation: those edits are preserved as a copy to inspect and export, **not merged**, and a
browser cannot force an unmodified old tab to stop. The recovery screen says exactly that.

### 3.7 Projection writes

The projection is derived, never authoritative. It is written only inside the lock, after canonical
verification, and never read back into canonical on a boot where canonical is valid (row 1). Its shape
is what the oldest supported build reads: today S1 with `metals` in unit rates (§9).

---

## 4. Migration, phase by phase

### 4.1 Sequence

| Phase | Write | Verify | On failure |
| --- | --- | --- | --- |
| P0 `started` | journal `{phase: P0, migrationId}` | read back | stop; RO; nothing else written |
| P1 `backup` | `backup.<id>` = original raw + envelope | read back **byte-equal** | stop; RO; legacy untouched; "backup failed, saving off" |
| P2 `backup-verified` | journal | read back | stop; resume P2 next boot |
| P3 `canonical` | `state.v4` rev 1 | read back + hash | stop at P3; next boot re-runs P3; the write is idempotent (same id, same rev) |
| P4 `projection` | `v2` projection | read back + fingerprint | **canonical stays active**; saving continues; projection marked stale and retried next boot; UI says the old-build copy is out of date |
| P5 `done` | journal `{phase: P5}` | read back | next boot sees P4 and re-runs P4/P5 — both idempotent |

**Source of truth after interruption:** the journal's phase. Canonical is written whole and
idempotently, so a repeated P3 cannot fork history.

### 4.2 Resume rules

- phase < P3 ⇒ canonical absent or unverified: re-run from that phase.
- phase = P4 ⇒ canonical is authoritative; **saving is allowed**; the projection is repaired in the
  background, and a failed repair never blocks saving.
- phase = P5 ⇒ clear the journal only.

### 4.3 What the user sees

No half-record. Either canonical is authoritative (P3 onward) or the legacy record is (before P3), and
the banner names which one is in use.

---

## 5. Rollback and the three recovery actions

### 5.1 Order, corrected

Revision 1 wrote legacy first and parked canonical after — losing canonical if the second write failed.

1. **Preserve canonical**: copy `state.v4` to `recovery.<ts>`, verify by hash. Failure ⇒ no rollback.
2. **Preserve the current legacy bytes** to `legacy-before-rollback.<ts>` (they may hold an old tab's
   edits).
3. Write `mode = legacy-active` (durable; row 15).
4. Write the chosen bytes to `v2`, verify.
5. Park canonical at `recovery.<ts>` — it stays; it is not deleted.
6. Journal `rollback:done`.

A failure at any step leaves a marker the next boot can finish or undo, and never deletes a verified
copy.

### 5.2 Reopening new code after a rollback

Row 15: `legacy-active` ⇒ read-only, offering "migrate again from the current legacy data" (new
`migrationId`, new backup) or "restore the parked canonical record" (explicit, with a diff of what the
old build changed since). Silent merging is never performed.

### 5.3 Three actions, three losses

| Action | Produces | Loses | When |
| --- | --- | --- | --- |
| **Restore the original pre-upgrade bytes** | `v2` exactly as before the first migration | every session saved after the upgrade | you want the pre-upgrade behaviour, exactly |
| **Export the current legacy projection** | an S1-shaped file with today's sessions and settings | new-only semantics: per-snapshot valuations, publication times, hidden-vs-removed | you want an old build to keep working with recent data |
| **Full-fidelity canonical export** | the S2 envelope, unknown fields included | nothing | backup, another device, review |

Each shows its own loss summary before it runs. None is called "rollback" alone.

---

## 6. Backups, export, quota

### 6.1 What a same-origin backup is

It protects against **this application** overwriting data. It is not disaster recovery: clearing site
data removes the original, the backup and the projection. Only an exported file survives that, so
offline export/import is part of the design, not an extra.

### 6.2 Envelope

```jsonc
{ "kind": "currency-backup", "createdAt": 1790000000000, "migrationId": "…",
  "sourceKey": "currency.web.v2", "sourceVersion": null,
  "sourceFingerprint": "sha256:…", "raw": "<exact original string>" }
```

- Hash: SHA-256 via `crypto.subtle.digest`. Without `crypto.subtle` (non-secure context) backups are
  **not** created and persistence is read-only: an unverifiable backup is not a backup.
- The raw string is stored verbatim, never re-serialised.
- Later lookup is by `migrationId` recorded in canonical, not by re-hashing the projection.

### 6.3 Checking an existing envelope

- Envelope unreadable, or `raw` missing ⇒ treated as **no backup** (rows 9/10), file preserved.
- Envelope fingerprint ≠ canonical's `migration.sourceFingerprint` ⇒ RO; the two disagree and the app
  must not guess.

### 6.4 Failure semantics

| Failure | Effect |
| --- | --- |
| quota exceeded writing the backup | no migration; `mode = readonly`; banner with "export now"; saving resumes after the next successful backup — never by deleting a copy |
| quota exceeded writing canonical | journal stays P3; legacy remains authoritative; retry next boot |
| quota exceeded writing the projection | canonical saving continues; projection marked stale (§4.1 P4) |
| read-back mismatch | treated as a write failure; the previous value is left in place |
| storage blocked entirely | row 14 |
| recovery copy too large | export straight to a **file**; the storage copy is skipped with that reason shown |

### 6.5 Cleanup

Nothing is pruned automatically. The recovery screen lists size and date; deletion is per item,
confirmed, and refuses to delete the only verified copy of the canonical record.

### 6.6 Import

Import reads a file **outside** the lock, validates kind/version/fingerprint, and shows a diff before
offering to apply. Imported data is never executed and never applied automatically.

---

## 7. Asset and build coherence — a prerequisite

### 7.1 The problem

The service worker serves navigations network-first and assets cache-first with background refresh. A
version constant inside `app.js` cannot detect that `index.html` came from build A and `app.js` from
build B. Storage safety depends on that detection, so this section is a prerequisite even if its
implementation lands after the schema.

### 7.2 Proposed mechanism

1. **Asset manifest** `web/build-manifest.json`:
   `{ "build": "<short sha>", "assets": { "app.js": "sha256:…", "logic.js": "sha256:…", "app.css": "sha256:…", "index.html": "sha256:…" } }`,
   with `?v=<build>` on every tag.
2. **Startup check** before any storage write: fetch the manifest (`cache: "no-store"`), verify the
   loaded script hashes. Mismatch or an older manifest ⇒ **read-only**, banner "this page mixed two
   versions — reload".
3. **Service worker policy**: navigation network-first with a 3 s timeout and cache fallback; assets
   cache-first **keyed by `?v=`**, so two builds never share an entry. `CACHE` carries the build id;
   activation deletes other caches and posts `build-changed` to open tabs, which show "reload to
   finish updating" — they do not reload themselves.
4. **Activation effect**: an activating worker writes nothing. The tab decides on reload, and storage
   initialisation runs only after the manifest check passes.

### 7.3 Test requirement (not run)

Installed PWA, two builds: open under A, deploy B, keep the tab open, go offline, return online.
Assert: no mixed assets, no write from a mismatched tab, banner shown, record untouched after reload.

---

## 8. Count state and the Restore contract

### 8.1 One representation

```jsonc
"count": {
  "currencies": {
    "USD": { "state": "active",  "counts": { "100": 3, "50": 1 } },
    "EUR": { "state": "hidden",  "counts": { "50": 2 }, "hiddenAt": 1789990000000 },
    "SAR": { "state": "removed", "counts": {}, "removedAt": 1789991000000 }
  },
  "order": ["USD", "EUR", "SAR"],
  "collapsed": ["SAR"],
  "expected": { "state": "absent" },     // or {"state":"zero"} or {"state":"value","value":"1000.00"}
  "manualRates": { "EUR": { "unitsPerUsd": "0.90", "setAt": 1789999000000 } },
  "valuation": { "mode": "live", "capturedAt": 1790000000000 }
}
```

- `hidden` keeps quantities and can be re-shown; `removed` keeps no quantities but keeps its position.
  One vocabulary, three states, no fourth meaning.
- `expected` has exactly one shape: `{state, value?}` with `value` a decimal **string**. Revision 1's
  example used `usd` and omitted `value` for zero; corrected here and in §8.4.

### 8.2 Restore semantics

- **Replacement, not merge**: the whole `count` object becomes the snapshot's.
- **Scope**: the active session only. History, settings and live rates are untouched.
- **Dirty** = the serialised active `count` differs from the baseline captured at the last Save or
  Restore. Nothing else counts — a live price tick with no manual edit does not dirty the session.
- **Confirmation** only when dirty; cancelling changes nothing at all: not the selection, not the
  baseline, not history, not persisted bytes.

### 8.3 Immutability and revaluation

- A snapshot is written once with its own `valuation.rates`, `direction: "unitsPerUsd"`, `mode`
  (`saved`/`manual`/`live`), `source` and `capturedAt`. Live updates never change it.
- **Revalue at current rates** applies to the *active* session: recompute, mark dirty, create **no**
  snapshot. A new snapshot happens only on Save, with its own id.
- Manual rates take precedence for the currencies they name, per currency, with their own `setAt`; a
  snapshot records which manual rates were in effect.
- Saved rates are shown as "saved rates, captured <time>", never as live.

### 8.4 Numbers

- Rates, amounts and Expected are decimal **strings**; totals are computed with a decimal helper
  (integer cents where the currency has two decimals, documented half-up rounding only at the final
  step) and stored as a string.
- `totalUsd` in a snapshot is what the app computed at save time; recomputation from the stored
  quantities and rates must match exactly or the difference is shown, not hidden.
- Display rounding is separate and never written back.

### 8.5 Edge cases

| Case | Behaviour |
| --- | --- |
| Expected absent | clears the active Expected; chip reads "no expected amount"; not 0 |
| Expected zero | restores 0; chip reads "expected 0" |
| Empty bag | allowed; total 0; Short/Over hidden without an Expected |
| Hidden quantities | restored with the snapshot; a currency that had quantities in another session is not resurrected |
| Currency not in today's catalog | restored as-is, labelled; total taken from the snapshot's saved total; no invented rate |
| Legacy snapshot with `totalUsd`, no rates | quantities restored; total reads **"saved total, rates unavailable"**; no recomputation claimed; the known total is not erased |
| Snapshot with neither rates nor a usable total | quantities only; total reads "unavailable"; record stays readable |
| Snapshot selection | by stable `id`, never by index (the 40-cap evicts) |
| Cap | oldest evicted first, stated in the UI; the currently restored snapshot is never evicted silently |

---

## 9. Projection: exactly what it is

`projectToLegacy(s2) -> s1`:

- settings → the same fields; `amount` back to a JSON number;
- `fiatRates` + `cryptoRates` + `metals` → one `rates` map + `metals` in **unit rates**;
- `count` → `{bag, counts, expected, history, collapsed}` with `expected` as number-or-null (legacy
  cannot express absent vs zero);
- `history` → legacy snapshots with `total`, `at` and the fields legacy reads; valuation dropped;
- everything else omitted.

Stated losses: absent-vs-zero Expected, per-snapshot valuation, per-metal publication times, hidden
vs removed, unknown fields. The projection is never read back into canonical (row 1).

---

## 10. Acceptance matrix

| # | Scenario | Expected | Kind |
| --- | --- | --- | --- |
| A1 | Two tabs save within the same second | serialised by the lock; loser gets a choice; no silent loss | concurrent |
| A2 | Tab A dirty, tab B saves | A shows a banner; A is not reloaded; "export mine" works | concurrent |
| A3 | `navigator.locks` absent | read-only persistence, banner, export | fallback |
| A4 | Old tab saves while a new tab is open | old edit preserved as `legacy-edit.<ts>` before the projection write | old tab |
| A5 | Old tab runs while a new tab migrates | migration completes; projection rewritten; old edit preserved | old tab |
| A6 | Backup write fails (quota) | no migration, `readonly`, legacy untouched, saving off | quota |
| A7 | Backup read-back mismatch | treated as failure; nothing migrated | verify |
| A8 | Canonical write fails | journal stays P3; legacy authoritative; retry next boot | interruption |
| A9 | Projection write fails | canonical active, saving continues, projection repaired later | interruption |
| A10 | Kill between P1 and P3, restart | resume from journal; one backup; one canonical | interruption |
| A11 | Kill between P3 and P5, restart | canonical kept; projection repaired; journal cleared | interruption |
| A12 | Corrupt canonical | RO; bytes preserved; projection not substituted | corruption |
| A13 | Corrupt legacy, no canonical | RO; raw preserved; export raw; "start fresh" copies first | corruption |
| A14 | Unsupported canonical (S3) | RO; full-fidelity export; no write | schema |
| A15 | Supported schema with unknown fields | loads; unknown fields preserved on write | schema |
| A16 | Ten boots | one backup, no growth, stable values | idempotence |
| A17 | Rollback, then the old build runs | old build loads `v2`; canonical parked and verified | rollback |
| A18 | Rollback, then new code runs | row 15: RO, offers re-migrate or restore parked | rollback |
| A19 | Rollback with a failing recovery copy | rollback refuses to start | rollback |
| A20 | Export → clear site data → import | restored from the file; import validated, not auto-applied | export |
| A21 | Import of a truncated file | rejected with a reason; nothing written | export |
| A22 | Expected absent vs zero through save/restore | distinct in data and in UI | restore |
| A23 | Snapshot with a hidden currency, re-added elsewhere | no quantities leak from another session | restore |
| A24 | Restore while dirty, then cancel | nothing changes, including baseline and selection | restore |
| A25 | Revalue at live rates | total changes, session dirty, no new snapshot | restore |
| A26 | Legacy snapshot with `totalUsd`, no rates | "saved total, rates unavailable"; no recomputation claim | legacy |
| A27 | Restore after the 40-cap evicted entries | restores the chosen id, not a neighbour | restore |
| A28 | Mixed assets (HTML A + JS B) | read-only banner before any write | assets |
| A29 | Installed PWA update while open | banner; no write from a mismatched tab; offline launch still works | assets |
| A30 | Storage blocked on first launch | memory-only, export offered, no phantom saves | storage |
| A31 | Decimal totals such as 0.1 + 0.2 | stored strings, decimal helper, no float drift | numbers |
| A32 | Snapshot with a currency missing from the catalog | restored, labelled, total from the saved total | restore |
| A33 | One old tab and one new tab writing for a minute | canonical intact; projection conflicts logged and preserved | concurrent |
| A34 | Full-fidelity export opened by the next build | accepted; unknown fields survive a round trip | schema |

Fixtures for all of the above are disposable browser profiles with synthetic data.

---

## 11. Android and CI follow-ups — proposed, not implemented

### 11.1 Android freshness (open work)

| Ref | Finding | Proposal | Test |
| --- | --- | --- | --- |
| D1 | age is computed during composition with `System.currentTimeMillis()` and no clock-driven invalidation, so an open sheet can keep an old label when polls fail or repeat | a lifecycle-aware ticker (only while the sheet is open, paused in background) re-emitting freshness every 15 s | sheet open through 75 s and 15 min with no successful update; pause/resume; label must change |
| D2 | four-field books have unknown provenance — the old writer substituted receipt time for a missing publication time | decode four-field entries as `atKnown = false` unless a trustworthy provenance rule exists | fixture written by the old writer with a timestamp-free quote ⇒ "AGE UNKNOWN" |
| D3 | `RatesMerge.motion` compares `atMs` across different clocks (receipt vs publication) | an unknown-time quote never outranks a known publication; unknown-time quotes are ordered by `receivedAt`; a known publication older than the last known one is ignored; define the unknown→known transition and ±5 min skew | fixtures for each transition and for skew |
| D4 | no coroutine-level test of both refresh paths, no process-death test, no rendered-label test | ViewModel test with a controlled dispatcher; Robolectric render assertion on the sheet's text | three named tests |
| D5 | web per-metal freshness and fiat/crypto source status remain open | scope unchanged | — |

### 11.2 CI

| Ref | Finding | Proposal |
| --- | --- | --- |
| C1 | `for attempt in 1 2 3` retries **any** Gradle failure, so an intermittent real failure can pass on a later attempt; "every real failure stays red" is too broad | retry only on a recognised artifact-resolution signature (`MavenArtifactFetcher`, `Could not resolve`, `Connection reset`, HTTP 429/5xx); otherwise fail at once; keep every attempt's log as an artifact; state the policy in the workflow |
| C2 | the reporter's failure path redirects output to a file, so Python's explanation never reaches the log | capture the status, `cat` the file, then exit with the captured status |
| C3 | no downloadable test evidence | upload `app/build/test-results/**` and the web TAP log as artifacts (no secrets, no user data) |

C1 and C2 are **proposals**: the current workflow still retries any failure and still loses the
reporter's text on failure. This review did not authorize changing them.

---

## 12. Verified versus untested

**Verified on this branch** (checks named in `docs/CONTRACT.md`): keypad/parser rules, badge rules,
Android per-metal freshness wiring in the sheet, the metal book round trip, and the JVM/web suites as
reported by CI.

**Untested, and not to be implied:** every behaviour in this document (nothing here is implemented),
Android on a device or after process death, rendered labels, visual parity, service-worker updates,
old builds over real storage, multi-tab behaviour, quota failures, and the storage protocol entirely.

**Deliberately unchanged in this batch:** no code, no workflow, no dependency.

---

## 13. What approval would unlock, in order

1. Asset/build manifest and the read-only gate (§7) — every later step depends on knowing the assets
   agree.
2. Envelope, backup, journal and the startup table (§2, §4) with A1–A21.
3. Projection writer and old-tab preservation (§3.6, §9) with A4, A5, A33.
4. Snapshot schema and Restore (§8) with A22–A27, A32.
5. Rollback and the three recovery actions (§5) with A17–A19.
6. Export/import and the recovery screen (§6.6) with A20, A21, A34.
7. Android D1–D4 and CI C1–C3 alongside, not after.

Nothing in this list may begin before this document is reviewed.
