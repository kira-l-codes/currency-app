/** Optional manual LBP rate: off by default, replaces only LBP, saved, and reversible. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const KEY = "currency.web.v2";

function boot(seed) {
  const dom = new JSDOM(read("index.html"), { url: "https://currency.test/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.fetch = async (url) => {
    if (String(url).includes("er-api")) return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500, EUR: 0.92 } }) };
    throw new Error("offline");
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  if (seed) window.localStorage.setItem(KEY, JSON.stringify(seed));
  window.eval(read("motion.js")); window.eval(read("logic.js")); window.eval(read("app.js"));
  return window;
}
const settle = () => new Promise((r) => setTimeout(r, 300));

test("off by default: automatic LBP rate is used", async () => {
  const w = boot(); await settle();
  assert.equal(w.App.state.lbpManual, null);
  assert.equal(w.App.perUsd("LBP"), 89500);
  assert.equal(w.App.convert(1, "USD", "LBP"), 89500);
  w.close();
});

test("manual rate replaces only LBP, survives a refresh, and saves", async () => {
  const w = boot(); await settle();
  w.App.state.lbpManual = 90000; w.App.saveState();
  assert.equal(w.App.convert(1, "USD", "LBP"), 90000);
  assert.equal(w.App.convert(90000, "LBP", "USD"), 1);
  assert.ok(Math.abs(w.App.convert(1, "USD", "EUR") - 0.92) < 1e-9);
  await w.App.loadRates(); await settle();
  assert.equal(w.App.perUsd("LBP"), 90000);
  assert.equal(w.App.state.rates.LBP, 89500, "automatic rate is kept underneath");
  assert.equal(JSON.parse(w.localStorage.getItem(KEY)).lbpManual, 90000);
  w.close();
});

test("a saved manual rate loads; a bad one is ignored; turning off restores automatic", async () => {
  const w = boot({ v: 3, lbpManual: 91000 }); await settle();
  assert.equal(w.App.perUsd("LBP"), 91000);
  w.App.state.lbpManual = null;
  assert.equal(w.App.perUsd("LBP"), 89500);
  w.close();
  const bad = boot({ v: 3, lbpManual: -5 }); await settle();
  assert.equal(bad.App.state.lbpManual, null);
  bad.close();
});

test("menu shows the option and the status line says when it is on", async () => {
  const w = boot(); await settle();
  w.document.getElementById("moreMenu").click();
  assert.match(w.document.getElementById("menuList").textContent, /Manual LBP rate/);
  w.App.state.lbpManual = 90000; w.App.renderAll();
  assert.match(w.document.getElementById("convertSub").textContent, /LBP manual 90,000/);
  w.close();
});
