/**
 * Whole-app tests: the real index.html, the real app.js, the real buttons.
 *
 * The review was right that pure-function tests are not enough — the keypad could stop calling the
 * rules and every unit test would still pass. This file loads the page in JSDOM, stubs the four
 * feeds with fixed numbers, and drives clicks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

/** Boots the app with fixed data, so nothing here depends on the network or the clock. */
function boot() {
  const dom = new JSDOM(read("index.html"), {
    url: "https://currency.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;

  window.fetch = async (url) => {
    const body = String(url);
    if (body.includes("gold-api.com/price/XAU")) return { ok: true, json: async () => ({ price: 3620, updatedAt: "2026-11-23T10:00:00Z" }) };
    if (body.includes("gold-api.com/price/XAG")) return { ok: true, json: async () => ({ price: 42, updatedAt: "2026-11-23T10:00:00Z" }) };
    if (body.includes("coingecko")) return { ok: true, json: async () => ({ bitcoin: { usd: 61000 }, ethereum: { usd: 2400 } }) };
    if (body.includes("er-api")) {
      return { ok: true, json: async () => ({ result: "success", rates: { LBP: 89500, EUR: 0.92, CHF: 0.88, AED: 3.67, JPY: 150 } }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

  window.eval(read("motion.js"));
  window.eval(read("logic.js"));
  window.eval(read("app.js"));
  // The app runs timers (metals, chart, clock). A live window keeps node's event loop alive, so
  // every test closes its own page when it is done.
  window.__dom = dom;
  return window;
}

const close = (window) => window.__dom.window.close();

const click = (window, selector) => {
  const el = window.document.querySelector(selector);
  assert.ok(el, `missing element: ${selector}`);
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
};

function tapKeys(window, keys) {
  for (const key of keys) click(window, `[data-key="${key}"]`);
}

/** Opens the amount keypad on the base row, clears it, and types [keys], then commits. */
function typeAndCommit(window, keys) {
  click(window, "#list .row.base");
  tapKeys(window, ["C", ...keys]);
  click(window, "#kpGo");
}

test("5.×3 commits 15", () => {
  const w = boot();
  try {
    typeAndCommit(w, ["5", ".", "×", "3"]);
    assert.equal(w.App.state.amount, 15);
  } finally { close(w); }
});

test("5.+3 commits 8, 5.÷2 commits 2.5, 5.−3 commits 2", () => {
  const cases = [
    { keys: ["5", ".", "+", "3"], value: 8, label: "5.+3" },
    { keys: ["5", ".", "÷", "2"], value: 2.5, label: "5.÷2" },
    { keys: ["5", ".", "−", "3"], value: 2, label: "5.−3" },
  ];
  for (const c of cases) {
    const w = boot();
    try {
      typeAndCommit(w, c.keys);
      assert.equal(w.App.state.amount, c.value, c.label);
    } finally { close(w); }
  }
});

test("a trailing point alone still commits, and 5+3. is 8", () => {
  const a = boot();
  try {
    typeAndCommit(a, ["5", "."]);
    assert.equal(a.App.state.amount, 5);
  } finally { close(a); }

  const b = boot();
  try {
    typeAndCommit(b, ["5", "+", "3", "."]);
    assert.equal(b.App.state.amount, 8);
  } finally { close(b); }

  const c = boot();
  try {
    assert.equal(c.App.evaluate("0."), 0);
  } finally { close(c); }
});

test("the 24-character cap holds for a dot at the limit and a digit after an operator", () => {
  // Only the expression half: the pad prints "expression = result", and the result has digits too.
  const entryLength = (w) =>
    w.document.getElementById("kpValue").textContent.split(" = ")[0].replace(/[^0-9.+−×÷]/g, "").length;
  const w = boot();
  try {
    click(w, "#list .row.base");
    tapKeys(w, ["C", ...Array(24).fill("9")]);
    assert.equal(entryLength(w), 24, "24 digits fill the entry");

    tapKeys(w, ["."]);
    assert.equal(entryLength(w), 24, "a dot at the limit is refused");

    // 23 digits and an operator is exactly 24, so the next digit must be refused too.
    click(w, "#kpClose");
    click(w, "#list .row.base");
    tapKeys(w, ["C", ...Array(23).fill("9"), "+", "7"]);
    assert.equal(entryLength(w), 24);
    // The pad prints "expression = result", so look at the expression, not the whole line.
    const expression = w.document.getElementById("kpValue").textContent.split(" = ")[0].trim();
    assert.ok(expression.endsWith("+"), "the digit after the operator at the limit is refused");
  } finally { close(w); }
});

test("CHF and AED keep their code in the badge", () => {
  const w = boot();
  try {
    assert.equal(w.App.signed("CHF", 10), "CHF 10.00");
    assert.equal(w.App.signed("AED", 10), "AED 10.00");
    assert.equal(w.App.signed("JPY", 10), "¥10.00", "a one-character symbol stays tight");
    assert.equal(w.App.signed("LBP", 8950000), "ل.ل 8,950,000.00", "a long symbol is spaced");
  } finally { close(w); }
});

test("a nonzero amount never renders as zero", () => {
  const w = boot();
  try {
    assert.equal(w.App.figure(0.0000091), "0.0000091");
    assert.equal(w.App.figure(1e-12), "<0.00000001");
  } finally { close(w); }
});
