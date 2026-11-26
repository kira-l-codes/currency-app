// Gaps 1-5 from the Android comparison: swipe, reorder, Add Currency, pair picker, metals sheet, sound.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const kotlin = (name) => fs.readFileSync(new URL(`../../app/src/main/java/com/lamahuissn/currency/data/${name}`, import.meta.url), "utf8");

function boot(record, { screens = true } = {}) {
  const dom = new JSDOM(read("index.html"), { url: "https://currency.test/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.__noSplash = true;
  if (record) window.localStorage.setItem("currency.web.v2", JSON.stringify(record));
  window.fetch = async (url) => {
    const u = String(url);
    if (u.includes("gold-api.com/price/XAU")) return { ok: true, json: async () => ({ price: 3110.34768, updatedAt: new Date().toISOString() }) };
    if (u.includes("gold-api.com/price/XAG")) return { ok: true, json: async () => ({ price: 31.1034768 }) };
    if (u.includes("coingecko")) return { ok: true, json: async () => ({ bitcoin: { usd: 61000 }, ethereum: { usd: 2400 } }) };
    if (u.includes("er-api")) return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500, EUR: 0.92, AED: 3.67 } }) };
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  window.scrollTo = () => {};
  window.eval(read("motion.js"));
  window.eval(read("logic.js"));
  window.eval(read("app.js"));
  if (screens) window.eval(read("screens.js"));
  window.__dom = dom;
  return window;
}
const close = (w) => w.__dom.window.close();
const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
const click = (w, sel) => {
  const el = typeof sel === "string" ? w.document.querySelector(sel) : sel;
  assert.ok(el, `missing element: ${sel}`);
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
};
const ptr = (w, el, type, x, y = 0) => el.dispatchEvent(new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
const swipe = (w, el, dx) => { ptr(w, el, "pointerdown", 200); ptr(w, el, "pointermove", 200 + dx / 2); ptr(w, el, "pointermove", 200 + dx); ptr(w, el, "pointerup", 200 + dx); };
const rec = (extra) => ({ v: 3, base: "USD", order: ["LBP", "EUR", "AED", "XAU"], pinned: [], ...extra });
const codes = (w) => [...w.document.querySelectorAll("#list .row")].map((r) => r.dataset.code);

test("a saved quantity for a denomination Android lacks keeps counting", () => {
  const w = boot(rec({ count: { bag: ["EUR", "AED"], counts: { EUR: { 500: 2, 50: 1 }, AED: { 1000: 3 } }, expected: null, history: [], collapsed: [] } }));
  try {
    assert.ok(w.App.denomsFor("EUR").includes(500), "EUR 500 stays");
    assert.ok(w.App.denomsFor("AED").includes(1000), "AED 1000 stays");
    const eur = w.App.denomsFor("EUR");
    assert.deepEqual([...eur], [...eur].sort((a, b) => b - a), "sorted descending");
    assert.ok(!w.App.denomsFor("EUR").includes(7), "no invented denominations");
  } finally { close(w); }
});

test("pinned rows come first, in the order they were pinned", () => {
  const w = boot(rec({ pinned: ["AED", "LBP"] }));
  try { assert.deepEqual(codes(w), ["USD", "AED", "LBP", "EUR", "XAU"]); } finally { close(w); }
});

test("swipe right pins, swipe left deletes, a short drag does neither", () => {
  const w = boot(rec());
  try {
    const row = (c) => w.document.querySelector(`#list .row[data-code="${c}"]`);
    swipe(w, row("EUR"), 20);
    assert.deepEqual([...w.App.state.pinned], [], "20px is below the commit distance");
    swipe(w, row("EUR"), 140);
    assert.deepEqual([...w.App.state.pinned], ["EUR"]);
    assert.equal(codes(w)[1], "EUR");
    swipe(w, row("LBP"), -140);
    assert.ok(!w.App.state.order.includes("LBP"), "LBP removed");
    assert.equal(w.App.state.base, "USD", "a swipe never changes the base");
    assert.equal(w.document.querySelector("#list .row.base").dataset.swipe, undefined);
    swipe(w, w.document.querySelector("#list .row.base"), 140);
    assert.deepEqual([...w.App.state.pinned], ["EUR"], "the base row is not swipeable");
  } finally { close(w); }
});

test("a mostly vertical drag is a scroll, not a swipe", () => {
  const w = boot(rec());
  try {
    const r = w.document.querySelector('#list .row[data-code="EUR"]');
    ptr(w, r, "pointerdown", 200, 0); ptr(w, r, "pointermove", 230, 100); ptr(w, r, "pointerup", 330, 100);
    assert.deepEqual([...w.App.state.pinned], []);
    assert.ok(w.App.state.order.includes("EUR"));
  } finally { close(w); }
});

test("the hint and empty list read like the app", () => {
  const w = boot(rec({ order: ["EUR"] }));
  try {
    assert.equal(w.document.getElementById("convertHint").textContent, "Swipe a row right to pin it, left to delete it. Pull down to refresh.");
    w.App.removeRow("EUR");
    assert.ok(w.document.querySelector("#list").textContent.includes("No currencies yet. Tap + to add one."));
  } finally { close(w); }
});

test("Reorder moves a row to the target's index and Done restores the list", () => {
  const w = boot(rec({ pinned: ["AED"] }));
  try {
    click(w, "#moreMenu");
    click(w, [...w.document.querySelectorAll("#menuList .menu-item")].find((b) => b.textContent.startsWith("Reorder")));
    assert.equal(w.document.getElementById("convertSub").textContent, "Drag a row up or down to move it.");
    assert.equal(w.document.getElementById("doneReorder").hidden, false);
    assert.deepEqual(codes(w), ["LBP", "EUR", "AED", "XAU"], "stored order, no base, pins not floated");
    assert.ok(w.App.moveRow("XAU", "LBP"));
    assert.deepEqual([...w.App.state.order], ["XAU", "LBP", "EUR", "AED"]);
    assert.ok(w.App.moveRow("XAU", "AED"));
    assert.deepEqual([...w.App.state.order], ["LBP", "EUR", "AED", "XAU"]);
    click(w, "#doneReorder");
    assert.equal(w.document.getElementById("doneReorder").hidden, true);
    assert.equal(codes(w)[1], "AED", "the pin returns to the top");
  } finally { close(w); }
});

test("Sound toggles from the menu and is remembered", () => {
  const w = boot(rec());
  try {
    const label = () => { click(w, "#moreMenu"); return [...w.document.querySelectorAll("#menuList .menu-item")].find((b) => b.textContent.startsWith("Sound")); };
    assert.ok(label().textContent.startsWith("Sound: on"));
    click(w, label());
    assert.equal(w.App.state.soundOn, false);
    assert.ok(label().textContent.startsWith("Sound: off"));
    assert.equal(JSON.parse(w.localStorage.getItem("currency.web.v2")).sound, false);
  } finally { close(w); }
});

test("tapping a metal opens its sheet and does not make it the base", async () => {
  const w = boot(rec());
  try {
    await wait();
    click(w, '#list .row[data-code="XAU"]');
    assert.equal(w.App.state.base, "USD");
    const sheet = w.document.getElementById("metalsSheet");
    assert.ok(sheet, "sheet opened");
    const t = sheet.textContent;
    assert.ok(t.includes("GOLD · SPOT") && t.includes("$3,110.35") && t.includes("1 troy ounce"));
    assert.ok(t.includes("Gram · 24k") && t.includes("$100.00"), "ounce / 31.1034768");
    assert.ok(t.includes("Gram · 18k") && t.includes("$75.00"));
    assert.ok(t.includes("Gold pound · 21k · 7.32 g") && t.includes("$640.50"), "gram(21) x 7.32");
    assert.ok(t.includes("LIVE"));
    assert.ok(t.includes("Spot price in USD. Jewellers add a premium over this for worked gold."));
  } finally { close(w); }
});

test("the silver sheet has one gram row, and a missing price says so", async () => {
  const w = boot(rec());
  try {
    await wait();
    const rows = w.Screens.metalRows("XAG", 31.1034768);
    assert.deepEqual(Array.from(rows.map((r) => r[0])), ["1 troy ounce", "Gram · fine (999)"]);
    assert.ok(Math.abs(rows[1][1] - 1) < 1e-9);
    delete w.App.state.metals.XAG; delete w.App.state.metalMeta.XAG;
    w.Screens.openMetals("XAG");
    assert.ok(w.document.getElementById("metalsSheet").textContent.includes("No price yet. Pull the list down to refresh once you are online."));
  } finally { close(w); }
});

test("Add Currency searches by name, code, country and region, and toggles rows", () => {
  const w = boot(rec());
  try {
    click(w, "#addRow");
    const q = (v) => { const i = w.document.getElementById("addSearch"); i.value = v; i.dispatchEvent(new w.Event("input", { bubbles: true })); };
    const shown = () => [...w.document.querySelectorAll("#addBody .add-row")].map((r) => r.dataset.code);
    q("Japan"); assert.ok(shown().includes("JPY"));
    q("Europe"); assert.ok(shown().includes("EUR") && shown().includes("CHF"));
    q("zzzz"); assert.ok(w.document.getElementById("addBody").textContent.includes('Nothing matches "zzzz".'));
    q("");
    click(w, '#addBody .add-row[data-code="JPY"]');
    assert.ok(w.App.state.order.includes("JPY"));
    assert.ok(w.document.getElementById("addBody").textContent.includes("Selected · 1"));
    click(w, '#addBody .add-row[data-code="JPY"]');
    assert.ok(!w.App.state.order.includes("JPY"));
    click(w, '#addBody .add-row[data-code="USD"]');
    assert.equal(w.App.state.base, "USD", "the base row is only tagged");
    assert.ok(w.document.querySelector('#addBody .add-row[data-code="USD"] .base-tag'));
    assert.ok(!w.document.getElementById("addScrub").hidden, "many sections show the scrubber");
    click(w, '.seg-tab[data-tab="crypto"]');
    assert.deepEqual(shown().sort(), ["BTC", "ETH"]);
    click(w, '.seg-tab[data-tab="metal"]');
    assert.deepEqual(shown().sort(), ["XAG", "XAU"]);
    assert.ok(w.document.getElementById("addBody").textContent.includes("priced by the troy ounce"));
    assert.ok(w.document.getElementById("addScrub").hidden, "two sections or fewer: no scrubber");
    click(w, ".overlay-screen .done-pill");
    assert.equal(w.document.getElementById("addScreen"), null);
  } finally { close(w); }
});

test("the country and region data equals Android's catalogue", () => {
  const src = kotlin("Currencies.kt");
  const fiat = src.slice(src.indexOf("val fiat"), src.indexOf("val crypto"));
  const w = boot(rec());
  try {
    const rows = [...fiat.matchAll(/Currency\("([A-Z]{3})", "(?:[^"\\]|\\.)*", "(?:[^"\\]|\\.)*", "[^"]*", "((?:[^"\\]|\\.)*)", "((?:[^"\\]|\\.)*)"\)/g)];
    assert.ok(rows.length > 150);
    rows.forEach((m) => assert.deepEqual([...w.Screens.GEO[m[1]]], [m[2], m[3]], m[1]));
  } finally { close(w); }
});

test("the chart pair picker lists the base and the list rows, with a tick on the choice", () => {
  const w = boot(rec());
  try {
    w.Screens.openPair({ title: "Chart against", codes: ["USD", "EUR", "USD", "AED"], selected: "EUR", onPick: () => {} });
    const rows = [...w.document.querySelectorAll("#pairScreen .picker-item")];
    assert.deepEqual(rows.map((r) => r.dataset.code), ["USD", "EUR", "AED"]);
    assert.ok(rows[1].querySelector(".check.on"));
    assert.ok(w.document.getElementById("pairScreen").textContent.includes("Chart against"));
  } finally { close(w); }
});

test("the app still works without screens.js", () => {
  const w = boot(rec(), { screens: false });
  try { click(w, '#list .row[data-code="EUR"]'); assert.equal(w.App.state.base, "EUR"); } finally { close(w); }
});

test("the splash shows once per launch", () => {
  const w = boot(rec());
  try {
    w.__noSplash = false;
    w.Screens.splash();
    assert.ok(w.document.getElementById("splash"));
    w.document.getElementById("splash").remove();
    w.Screens.splash();
    assert.equal(w.document.getElementById("splash"), null, "second call in the same launch does nothing");
  } finally { close(w); }
});
