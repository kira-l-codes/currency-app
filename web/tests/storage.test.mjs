/**
 * Saved data must survive the new build — including a record the build cannot read.
 *
 * Synthetic records only. Each test seeds storage BEFORE the page starts, because that is the case
 * that was untested before: a corrupt record sitting there while the app boots over it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const KEY = "currency.web.v2";

/**
 * Boots the real page with `seed` already in storage. `seed` may be an object (written as JSON) or a
 * raw string (written verbatim, so a malformed value can be tested exactly as it would sit on disk).
 */
function boot(seed) {
  const dom = new JSDOM(read("index.html"), {
    url: "https://currency.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fetch = async (url) => {
    const body = String(url);
    // A dead network: nothing may depend on a feed to keep saved data.
    if (body.includes("er-api") || body.includes("gold-api") || body.includes("coingecko")) throw new Error("offline");
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  if (seed !== undefined) {
    window.localStorage.setItem(KEY, typeof seed === "string" ? seed : JSON.stringify(seed));
  }
  window.eval(read("motion.js"));
  window.eval(read("logic.js"));
  window.eval(read("app.js"));
  window.__dom = dom;
  return window;
}

const close = (w) => w.__dom.window.close();
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const raw = (w) => w.localStorage.getItem(KEY);
const stored = (w) => JSON.parse(raw(w));
const click = (w, selector) => w.document.querySelector(selector).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));

const currentRecord = {
  v: 3,
  base: "LBP",
  amount: 125000,
  order: ["LBP", "USD", "XAU", "XAG"],
  pinned: ["LBP"],
  screen: "convert",
  chart: { base: "EUR", quote: "USD", period: "3M" },
  rates: { USD: 1, LBP: 89500, EUR: 0.92 },
  metals: { XAU: 1 / 3620, XAG: 1 / 42 },
  metalMeta: {
    XAU: { ounceUsd: 3620, atMs: 1790000000000, receivedAt: 1790000000000, tick: "flat", seq: 3 },
  },
  updated: 1790000000000,
  count: {
    bag: ["USD", "LBP"],
    counts: { USD: { 100: 3, 50: 1 }, LBP: { 100000: 8 } },
    expected: 1000,
    history: [
      { at: 1789990000000, bag: ["USD"], counts: { USD: { 100: 1 } }, expected: 100, total: 100 },
      { at: 1789991000000, bag: ["LBP"], counts: { LBP: { 100000: 2 } }, expected: null, total: 2.23 },
    ],
    collapsed: [],
  },
};

test("an unreadable record present at startup is preserved byte for byte, and nothing overwrites it", async () => {
  const corrupt = '{"v":3,"base":"USD", oops';
  const w = boot(corrupt);
  try {
    await wait();

    assert.equal(raw(w), corrupt, "startup replaced a record it could not read");

    // The notice is short and honest: it does not claim a recovery that did not happen.
    const notice = w.document.getElementById("storageWarning");
    assert.equal(notice.hidden, false, "no notice was shown");
    assert.match(notice.textContent, /could not be read/i);
    assert.match(notice.textContent, /left exactly as it is/i);
    assert.doesNotMatch(notice.textContent, /recovered|restored/i);

    // Later, ordinary save triggers must still leave it alone.
    assert.equal(w.App.saveState(), false, "a guarded save must report that it did nothing");
    click(w, "#list .row.base");            // a normal interaction on the convert screen
    w.App.state.amount = 4242;
    w.App.saveState();
    click(w, '[data-screen="count"]');      // a screen change is another save trigger
    w.App.saveState();

    assert.equal(raw(w), corrupt, "a later save replaced the unreadable record");
    assert.equal(w.App.state.amount, 4242, "the session still works in memory");
  } finally { close(w); }
});

test("a valid current record loads and saves its meaningful fields", async () => {
  const w = boot(currentRecord);
  try {
    await wait();
    assert.equal(w.App.state.base, "LBP");
    assert.equal(w.App.state.amount, 125000);
    // jsdom values live in another realm, so a structural comparison is by JSON, not by prototype.
    assert.equal(JSON.stringify([...w.App.state.order]), JSON.stringify(["LBP", "USD", "XAU", "XAG"]));
    assert.equal(JSON.stringify(w.App.state.count.counts), JSON.stringify(currentRecord.count.counts));
    assert.equal(w.App.state.count.history.length, 2);
    assert.equal(w.App.state.count.expected, 1000);

    const after = stored(w);
    assert.equal(after.v, 3);
    assert.equal(after.amount, 125000);
    assert.equal(after.base, "LBP");
    assert.equal(JSON.stringify(after.count.counts), JSON.stringify(currentRecord.count.counts), "counts written back unchanged");
    assert.equal(after.count.history.length, 2, "no history record was dropped");
  } finally { close(w); }
});

test("an older unversioned record migrates once and keeps what it held", async () => {
  const old = {
    base: "USD",
    amount: 100,
    order: ["USD", "LBP", "XAU", "XAG"],
    pinned: [],
    // The 1.3 shape: ounce PRICES in the metals map.
    rates: { USD: 1, LBP: 89500 },
    metals: { XAU: 3620, XAG: 42 },
    updated: 1790000000000,
    count: { bag: ["USD", "LBP"], counts: { LBP: { 100000: 5 } }, expected: null, history: [{ at: 1789990000000, total: 5.58 }] },
  };
  const w = boot(old);
  try {
    await wait();
    assert.equal(w.App.state.amount, 100);
    assert.equal(w.App.state.count.counts.LBP[100000], 5);
    assert.equal(w.App.state.count.history.length, 1);
    assert.ok(Math.abs(w.App.state.metals.XAU - 1 / 3620) < 1e-12, "gold became a unit rate");

    const after = stored(w);
    assert.equal(after.v, 3, "the migration is recorded");
    assert.ok(Math.abs(after.metals.XAU - 1 / 3620) < 1e-12, "a second boot must not invert it again");
    assert.equal(after.count.history.length, 1);
  } finally { close(w); }
});

test("the record saved by one run opens correctly in the next run", async () => {
  // First run: a synthetic record is booted, changed, and saved by the app itself.
  const first = boot(currentRecord);
  let savedOutput = null;
  try {
    await wait();
    first.App.state.amount = 222000;
    first.App.state.count.counts.USD = { 100: 7 };
    first.App.saveState();
    savedOutput = raw(first);
    assert.ok(savedOutput && savedOutput.length > 0, "the app produced no record to reopen");
  } finally { close(first); }

  // Second run: a fresh page seeded with exactly what the first run wrote — not the original fixture.
  const second = boot(savedOutput);
  try {
    await wait();
    assert.equal(second.App.state.amount, 222000, "the saved amount did not come back");
    assert.equal(JSON.stringify(second.App.state.count.counts.USD), JSON.stringify({ 100: 7 }));
    assert.equal(second.App.state.count.history.length, 2, "history was lost across the reopen");
    assert.equal(second.App.state.base, "LBP");
    assert.equal(stored(second).v, 3);
  } finally { close(second); }
});

test("empty storage starts clean instead of crashing", async () => {
  const w = boot(undefined);
  try {
    await wait();
    assert.equal(w.App.state.amount, 100, "the web build's default amount is 100");
    assert.ok(w.App.state.order.length > 0, "default list");
    assert.equal(w.App.state.count.history.length, 0);
    assert.equal(w.document.getElementById("storageWarning").hidden, true, "no warning without a record");
  } finally { close(w); }
});

test("a valid record does not raise the warning and still saves", async () => {
  const w = boot(currentRecord);
  try {
    await wait();
    assert.equal(w.document.getElementById("storageWarning").hidden, true);
    assert.equal(w.App.saveState(), true);
  } finally { close(w); }
});
