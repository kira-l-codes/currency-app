/**
 * Web/Android parity rules: per-metal freshness, count quantities survive hiding a currency,
 * a base change adds no row, and the count keypad is the small integer pad.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const M = require("../motion.js");
const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

const NOW = Date.parse("2026-11-26T12:00:00Z");

// ── metal freshness, the rules MetalFreshnessTest holds on Android ──
test("fresh gold and stale silver report different states", () => {
  assert.equal(M.metalState(true, true, NOW - 20_000, NOW), "live");
  assert.equal(M.metalState(true, true, NOW - 20 * 60_000, NOW), "offline");
});
test("an old publication is old, however recently it arrived", () => {
  assert.equal(M.metalState(true, true, NOW - 60 * 60_000, NOW), "offline");
});
test("a price with no publication time is unknown, never live", () => {
  assert.equal(M.metalState(true, false, NOW, NOW), null);
  assert.equal(M.metalState(true, false, 0, NOW), null);
});
test("a metal with no price is unknown", () => {
  assert.equal(M.metalState(false, true, NOW - 1000, NOW), null);
});
test("each metal is measured from its own publication", () => {
  assert.equal(M.metalState(true, true, NOW - 10 * 60_000, NOW), "delayed");
  assert.equal(M.metalState(true, true, NOW - 5_000, NOW), "live");
});

// ── whole app ──
function boot(record) {
  const dom = new JSDOM(read("index.html"), { url: "https://currency.test/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  if (record) window.localStorage.setItem("currency.web.v2", JSON.stringify(record));
  window.fetch = async (url) => {
    const u = String(url);
    if (u.includes("gold-api.com/price/XAU")) return { ok: true, json: async () => ({ price: 3620, updatedAt: "2026-11-23T10:00:00Z" }) };
    if (u.includes("gold-api.com/price/XAG")) return { ok: true, json: async () => ({ price: 42 }) };   // no provider time
    if (u.includes("coingecko")) return { ok: true, json: async () => ({ bitcoin: { usd: 61000 }, ethereum: { usd: 2400 } }) };
    if (u.includes("er-api")) return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500, EUR: 0.92, AED: 3.67 } }) };
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  window.eval(read("motion.js"));
  window.eval(read("logic.js"));
  window.eval(read("app.js"));
  window.__dom = dom;
  return window;
}
const close = (w) => w.__dom.window.close();
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const click = (w, sel) => {
  const el = w.document.querySelector(sel);
  assert.ok(el, `missing element: ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const keys = (w, list) => list.forEach((k) => click(w, `[data-key="${k}"]`));

test("the web gives gold and silver their own freshness; no provider time reads unknown", async () => {
  const w = boot();
  try {
    await wait(200);
    assert.equal(w.App.metalFeedFor("XAU"), "offline", "gold published days ago is not live");
    assert.equal(w.App.metalFeedFor("XAG"), null, "silver with no provider time is unknown");
    assert.match(w.document.getElementById("convertSource").textContent, /gold offline · silver age unknown/);
  } finally { close(w); }
});

test("a numeric cache with no publication record is unknown, not fresh", () => {
  const w = boot({ v: 3, metals: { XAU: 1 / 3620 }, metalMeta: {} });
  try {
    assert.equal(w.App.metalFeedFor("XAU"), null);
  } finally { close(w); }
});

test("a base change does not add the old base as a row", () => {
  const w = boot({ v: 3, base: "USD", order: ["LBP", "EUR", "AED"], pinned: [] });
  try {
    click(w, '#list .row[data-code="EUR"]');
    assert.equal(w.App.state.base, "EUR");
    assert.equal(JSON.stringify([...w.App.state.order]), JSON.stringify(["LBP", "EUR", "AED"]));
    assert.ok(!w.App.state.order.includes("USD"));
  } finally { close(w); }
});

test("removing a currency from the bag keeps its quantities; adding it back shows them", () => {
  const w = boot({ v: 3, count: { bag: ["USD", "EUR"], counts: { EUR: { 50: 3 } }, expected: null, history: [], collapsed: [] } });
  try {
    w.App.state.screen = "count";
    w.CountView.render();
    const removeButtons = [...w.document.querySelectorAll("#bag .cur-foot button")];
    removeButtons[1].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    assert.equal(JSON.stringify([...w.App.state.count.bag]), JSON.stringify(["USD"]));
    assert.equal(w.App.state.count.counts.EUR[50], 3, "quantities are kept");
    w.App.state.count.bag.push("EUR");
    w.CountView.render();
    assert.match(w.document.getElementById("bag").textContent, /3 notes/);
  } finally { close(w); }
});

function openNotes(w) {
  w.App.state.screen = "count";
  w.CountView.render();
  click(w, "#bag .count-val");
}

test("the quantity keypad is integer-only: no point, no operators, no shortcuts", () => {
  const w = boot({ v: 3, count: { bag: ["USD"], counts: {}, expected: null, history: [], collapsed: [] } });
  try {
    openNotes(w);
    const kp = w.document.getElementById("keypad");
    assert.ok(kp.classList.contains("kp-notes"));
    keys(w, ["1", ".", "+", "×", "2", "1K", "C"]);
    assert.equal(w.document.getElementById("kpValue").textContent, "12");
    click(w, "#kpGo");
    const usdRow = Object.values(w.App.state.count.counts.USD || {});
    assert.deepEqual(usdRow.map(Number), [12]);
  } finally { close(w); }
});

test("the quantity keypad caps at 12 characters, and the first key replaces the value", () => {
  const w = boot({ v: 3, count: { bag: ["USD"], counts: {}, expected: null, history: [], collapsed: [] } });
  try {
    openNotes(w);
    keys(w, Array(15).fill("9"));
    assert.equal(w.document.getElementById("kpValue").textContent.length, 12);
  } finally { close(w); }
});

test("Expected keeps a decimal point but has no operators; Convert keeps the full pad", () => {
  const w = boot({ v: 3, count: { bag: ["USD"], counts: {}, expected: null, history: [], collapsed: [] } });
  try {
    w.App.state.screen = "count";
    w.CountView.render();
    click(w, "#expectedLabel");
    const kp = w.document.getElementById("keypad");
    assert.ok(kp.classList.contains("kp-plain"));
    keys(w, ["1", "2", ".", "5", "+", "×"]);
    assert.equal(w.document.getElementById("kpValue").textContent, "12.5");
    click(w, "#kpGo");
    assert.equal(w.App.state.count.expected, 12.5);

    click(w, "#list .row.base");
    assert.ok(!kp.classList.contains("kp-plain") && !kp.classList.contains("kp-notes"));
  } finally { close(w); }
});
