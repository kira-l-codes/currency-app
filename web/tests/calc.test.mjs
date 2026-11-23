/**
 * The arithmetic itself: fiat, metals, crypto, and the edges that break calculators.
 *
 * These call the same functions the rows call, on the same code the browser runs, with fixed rates
 * so the numbers are the test's, not the market's.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

/** Boots with fixed feeds: 1 USD = 89,500 LBP / 0.92 EUR; gold $3,620/oz; BTC $61,000. */
function boot() {
  const dom = new JSDOM(read("index.html"), {
    url: "https://currency.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fetch = async (url) => {
    const body = String(url);
    if (body.includes("er-api")) {
      return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500, EUR: 0.92, JPY: 150 } }) };
    }
    if (body.includes("gold-api.com/price/XAU")) return { ok: true, json: async () => ({ price: 3620, updatedAt: "2026-11-23T10:00:00Z" }) };
    if (body.includes("gold-api.com/price/XAG")) return { ok: true, json: async () => ({ price: 42, updatedAt: "2026-11-23T10:00:00Z" }) };
    if (body.includes("coingecko")) return { ok: true, json: async () => ({ bitcoin: { usd: 61000 }, ethereum: { usd: 2400 } }) };
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.eval(read("motion.js"));
  window.eval(read("logic.js"));
  window.eval(read("app.js"));
  window.__dom = dom;
  return window;
}

/** Waits for the boot refresh to land, then hands the app to the test. */
async function withApp(fn) {
  const w = boot();
  try {
    await new Promise((r) => setTimeout(r, 350));
    await fn(w);
  } finally {
    w.__dom.window.close();
  }
}

const close = (value) => Math.abs(value) < 1e-9 ? 0 : value;

test("fiat converts both ways without drift", async () => {
  await withApp((w) => {
    const usdToLbp = w.App.convert(100, "USD", "LBP");
    assert.equal(close(usdToLbp - 8_950_000), 0, `100 USD in LBP, got ${usdToLbp}`);

    const lbpToUsd = w.App.convert(8_950_000, "LBP", "USD");
    assert.equal(close(lbpToUsd - 100), 0, `round trip, got ${lbpToUsd}`);

    assert.equal(close(w.App.convert(100, "USD", "EUR") - 92), 0);
  });
});

test("a metal is priced by the ounce in both directions", async () => {
  await withApp((w) => {
    // 1 XAU is the ounce price in dollars, and the ounce price in dollars is 1 XAU.
    assert.equal(close(w.App.convert(1, "XAU", "USD") - 3620), 0);
    assert.equal(close(w.App.convert(3620, "USD", "XAU") - 1), 0);
    assert.equal(close(w.App.convert(1, "XAG", "USD") - 42), 0);
    // A tenth of an ounce, the way a jeweller quotes.
    assert.equal(close(w.App.convert(0.1, "XAU", "USD") - 362), 0);
  });
});

test("crypto is quoted from its own feed, not from a fixed table", async () => {
  await withApp((w) => {
    const btc = w.App.convert(100, "USD", "BTC");
    assert.ok(Math.abs(btc - 100 / 61_000) < 1e-12, `100 USD in BTC, got ${btc}`);
    assert.ok(Math.abs(w.App.convert(btc, "BTC", "USD") - 100) < 1e-9);
  });
});

test("zero stays zero and never becomes Infinity or NaN", async () => {
  await withApp((w) => {
    assert.equal(w.App.convert(0, "USD", "LBP"), 0);
    assert.equal(w.App.convert(0, "XAU", "USD"), 0);
    assert.equal(w.App.convert(100, "USD", "ZZZ"), 0, "an unknown code has no price, so no number");
  });
});

test("very large amounts keep their magnitude", async () => {
  await withApp((w) => {
    const huge = w.App.convert(1e12, "LBP", "USD");
    assert.ok(Math.abs(huge - 1e12 / 89500) < 1e-3, `1e12 LBP in USD, got ${huge}`);
    assert.ok(Number.isFinite(huge));
    // 8,955,000 LBP is the amount the screenshots use; it must not lose its cents.
    assert.equal(w.App.figure(8_955_000.12), "8,955,000.12");
  });
});

test("keypad arithmetic agrees with the displayed expression", async () => {
  await withApp((w) => {
    assert.equal(w.App.evaluate("2+3×4"), 14);
    assert.equal(w.App.evaluate("0.1+0.2"), 0.30000000000000004);
    assert.equal(w.App.figure(w.App.evaluate("0.1+0.2")), "0.30", "display rounds, arithmetic does not");
    assert.equal(w.App.evaluate("5.×3"), 15);
    assert.equal(w.App.evaluate("1000000÷3"), 333333.3333333333);
  });
});

test("a failed feed leaves the row without a number, never with a fake one", async () => {
  const dom = new JSDOM(read("index.html"), {
    url: "https://currency.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fetch = async (url) => {
    const body = String(url);
    if (body.includes("gold-api") || body.includes("coingecko")) throw new Error("offline");
    if (body.includes("er-api")) return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500 } }) };
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.eval(read("motion.js"));
  window.eval(read("logic.js"));
  window.eval(read("app.js"));
  try {
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(window.App.perUsd("XAU"), undefined, "no gold price was invented");
    assert.equal(window.App.perUsd("BTC"), undefined, "no crypto price was invented");
    assert.equal(window.App.convert(100, "USD", "XAU"), 0, "and no conversion claims one");
    assert.equal(close(window.App.convert(100, "USD", "LBP") - 8_950_000), 0, "fiat still works");
  } finally { dom.window.close(); }
});
