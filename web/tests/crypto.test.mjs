/**
 * The sixteen coins: same list and CoinGecko ids as Android, priced from one keyless call, badges
 * that are text (never a glyph the device may lack), and honest about age.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const kotlin = fs.readFileSync(new URL("../../app/src/main/java/com/lamahuissn/currency/data/Currencies.kt", import.meta.url), "utf8");

const NOW_S = Math.floor(Date.now() / 1000);
const FEED = (ageS = 5) => Object.fromEntries([
  ["bitcoin", 61000], ["ethereum", 2400], ["tether", 1], ["usd-coin", 1], ["binancecoin", 600],
  ["solana", 80], ["ripple", 1], ["cardano", 0.2], ["dogecoin", 0.05], ["tron", 0.3],
  ["the-open-network", 1], ["chainlink", 10], ["polkadot", 0.7], ["litecoin", 45],
  ["bitcoin-cash", 210], ["stellar", 0.13],
].map(([id, usd]) => [id, { usd, last_updated_at: NOW_S - ageS }]));

function boot({ coingecko, record } = {}) {
  const dom = new JSDOM(read("index.html"), { url: "https://currency.test/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  if (record) window.localStorage.setItem("currency.web.v2", JSON.stringify(record));
  window.__urls = [];
  window.fetch = async (url) => {
    const u = String(url);
    window.__urls.push(u);
    if (u.includes("er-api")) return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500, EUR: 0.92 } }) };
    if (u.includes("coingecko")) {
      if (coingecko === "down") throw new Error("offline");
      if (coingecko === "429") return { ok: false, status: 429, json: async () => ({ status: { error_code: 429 } }) };
      return { ok: true, json: async () => (coingecko || FEED()) };
    }
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.eval(read("motion.js")); window.eval(read("logic.js")); window.eval(read("app.js")); window.eval(read("screens.js"));
  return window;
}
const settle = () => new Promise((r) => setTimeout(r, 350));

test("the coin list and the CoinGecko ids equal Android's", async () => {
  const ids = kotlin.slice(kotlin.indexOf("val cryptoIds"));
  const android = Object.fromEntries([...ids.matchAll(/"([A-Z]+)" to "([a-z-]+)"/g)].map((m) => [m[1], m[2]]));
  const names = [...kotlin.slice(kotlin.indexOf("val crypto:"), kotlin.indexOf("val metals")).matchAll(/Currency\("([A-Z]+)", "([^"]*)", "((?:[^"\\]|\\.)*)"/g)]
    .map((m) => [m[1], m[2], m[3].replace(/\\\$/g, "$")]);
  assert.equal(Object.keys(android).length, 16);
  const w = boot();
  await settle();
  assert.deepEqual({ ...w.App.CRYPTO_IDS }, android);
  names.forEach(([code, name, sym]) => assert.deepEqual([...w.App.CAT[code]], [name, sym], code));
  w.close();
});

test("one request prices all sixteen coins and each converts both ways", async () => {
  const w = boot();
  await settle();
  const calls = w.__urls.filter((u) => u.includes("coingecko"));
  assert.equal(calls.length, 1);
  Object.values(w.App.CRYPTO_IDS).forEach((id) => assert.ok(calls[0].includes(id), id));
  Object.keys(w.App.CRYPTO_IDS).forEach((code) => {
    assert.ok(w.App.perUsd(code) > 0, code);
    const back = w.App.convert(w.App.convert(100, "USD", code), code, "USD");
    assert.ok(Math.abs(back - 100) < 1e-9, code);
  });
  assert.ok(Math.abs(w.App.convert(1, "SOL", "USD") - 80) < 1e-9);
  assert.ok(Math.abs(w.App.convert(1, "DOGE", "USD") - 0.05) < 1e-12);
  w.close();
});

test("coin badges are tickers on a coloured disc, not a glyph", async () => {
  const w = boot({ record: { v: 3, base: "USD", order: ["BTC", "ETH", "USDT", "LINK", "EUR"], pinned: [] } });
  await settle();
  const badge = (code) => w.document.querySelector(`#list .row[data-code="${code}"] .badge`);
  ["BTC", "ETH", "USDT", "LINK"].forEach((c) => {
    const b = badge(c);
    assert.ok(b.classList.contains("crypto"), c);
    assert.equal(b.textContent, c);
    assert.ok(b.style.background, c);
  });
  assert.ok(!badge("EUR").classList.contains("crypto"));
  w.close();
});

test("a fresh coin quote carries no warning; an old one reads delayed", async () => {
  const fresh = boot();
  await settle();
  assert.equal(fresh.App.cryptoNote("BTC"), "");
  fresh.close();
  const old = boot({ coingecko: FEED(2 * 3600) });
  await settle();
  assert.equal(old.App.cryptoNote("BTC"), "delayed");
  old.close();
});

test("when the coin feed fails, last prices stay but read cached; nothing is invented", async () => {
  const saved = { v: 3, base: "USD", order: ["BTC", "SOL"], pinned: [], rates: { BTC: 1 / 59000 }, cryptoAt: { BTC: Date.now() - 5 * 3600e3 } };
  for (const mode of ["down", "429"]) {
    const w = boot({ coingecko: mode, record: saved });
    await settle();
    assert.equal(w.App.cryptoNote("BTC"), "cached", mode);
    assert.ok(Math.abs(w.App.perUsd("BTC") - 1 / 59000) < 1e-15, "the old price is kept");
    assert.equal(w.App.perUsd("SOL"), undefined, "a coin never priced stays unpriced");
    assert.equal(w.document.querySelector('#list .row[data-code="SOL"] .pill-value').textContent, "—");
    assert.ok(w.document.querySelector('#list .row[data-code="BTC"] .row-code').textContent.includes("cached"));
    w.close();
  }
});

test("a coin the feed leaves out loses its price instead of keeping a stale one as live", async () => {
  const partial = FEED(); delete partial.solana;
  const w = boot({ coingecko: partial, record: { v: 3, base: "USD", order: ["SOL"], pinned: [], rates: { SOL: 1 / 99 } } });
  await settle();
  assert.equal(w.App.perUsd("SOL"), undefined);
  w.close();
});
