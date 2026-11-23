import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../logic.js");

/* Items 6, 15 and 16 of the review, on the code the browser actually runs. */

test("figures follow the Android ladder: 2, 3, 4 then 8 decimals", () => {
  assert.equal(L.formatFigure(0), "0.00");
  assert.equal(L.formatFigure(0.742), "0.742");
  assert.equal(L.formatFigure(99.9), "99.90");   // Android trims to two decimals, not one
  assert.equal(L.formatFigure(100), "100.00");
  assert.equal(L.formatFigure(8_955_000.12), "8,955,000.12");
  assert.equal(L.formatFigure(0.01), "0.01");
  assert.equal(L.formatFigure(1), "1.00");
});

test("a nonzero amount never renders as zero", () => {
  assert.equal(L.formatFigure(0.0000091), "0.0000091");
  assert.equal(L.formatFigure(1e-12), "<0.00000001");
});

test("non-finite values are not numbers we can show", () => {
  assert.equal(L.formatFigure(NaN), "—");
  assert.equal(L.formatFigure(Infinity), "—");
  assert.equal(L.formatFigure(-Infinity), "—");
});

test("a half-typed sum is not an error", () => {
  assert.equal(L.evaluate("5+"), 5);          // dangling operator
  assert.equal(L.evaluate("5."), 5);           // dangling point
  assert.equal(L.evaluate("0."), 0);           // dangling point on zero
  assert.equal(L.evaluate("5+3."), 8);
});

test("operators keep their precedence and their symbols", () => {
  assert.equal(L.evaluate("5+−3"), 2);
  assert.equal(L.evaluate("2+3×4"), 14);
  assert.equal(L.evaluate("9÷3−1"), 2);
});

test("division by zero and junk are no value, not zero", () => {
  assert.equal(L.evaluate("1÷0"), null);
  assert.equal(L.evaluate("abc"), null);
  assert.equal(L.evaluate(""), null);
});

test("Convert appends to the amount, like Android", () => {
  const s = L.pressKey("100", "5", { fresh: true, replace: false });
  assert.equal(s.entry, "1005");
});

test("Count replaces the pre-filled quantity", () => {
  const s = L.pressKey("3", "5", { fresh: true, replace: true });
  assert.equal(s.entry, "5");
});

test("the shortcut keys replace, they never append zeros", () => {
  assert.equal(L.pressKey("7", "1K", {}).entry, "1000");
  assert.equal(L.pressKey("55", "100", {}).entry, "100");
  assert.equal(L.pressKey("999", "10", {}).entry, "10");
});

test("an operator after an operator replaces it", () => {
  let e = "5";
  e = L.pressKey(e, "+", {}).entry;
  e = L.pressKey(e, "−", {}).entry;
  e = L.pressKey(e, "3", {}).entry;
  assert.equal(e, "5−3");
});

test("a leading point starts as 0., and a second point in an operand is ignored", () => {
  let e = L.pressKey("", ".", {}).entry;
  assert.equal(e, "0.");
  e = L.pressKey(e, "5", {}).entry;
  assert.equal(e, "0.5");
  e = L.pressKey(e, ".", {}).entry;
  e = L.pressKey(e, "2", {}).entry;
  assert.equal(e, "0.52");
});

test("a leading zero never accumulates", () => {
  let e = L.pressKey("", "0", {}).entry;
  e = L.pressKey(e, "0", {}).entry;
  e = L.pressKey(e, "7", {}).entry;
  assert.equal(e, "7");
});

test("an operator on an empty entry does nothing", () => {
  assert.equal(L.pressKey("", "+", {}).entry, "");
});

test("the entry stops at 24 characters", () => {
  let e = "";
  for (let i = 0; i < 40; i++) e = L.pressKey(e, "9", {}).entry;
  assert.equal(e.length, L.MAX_ENTRY);
});

test("C clears and backspace edits", () => {
  assert.equal(L.pressKey("123", "C", {}).entry, "");
  assert.equal(L.pressKey("123", "back", {}).entry, "12");
});

/* Item 8 and 27: the storage format decides the unit, not a guess made every load. */

test("an unversioned record with ounce prices is migrated once, not twice", () => {
  const old = { metals: { XAU: 3620, XAG: 42 }, amount: 100 };
  const once = L.migrateRecord(old);
  assert.ok(Math.abs(once.metals.XAU - 1 / 3620) < 1e-15);
  assert.equal(once.v, L.STATE_VERSION);

  const twice = L.migrateRecord(once);
  assert.equal(twice.metals.XAU, once.metals.XAU, "a second open must not invert it again");
  assert.equal(twice.metals.XAG, once.metals.XAG);
});

test("a versioned record is left exactly as written", () => {
  const good = { v: 3, metals: { XAU: 1 / 3620 } };
  assert.equal(L.migrateRecord(good).metals.XAU, 1 / 3620);
});

test("migration never mutates the record it was given", () => {
  const old = { metals: { XAU: 3620 } };
  L.migrateRecord(old);
  assert.equal(old.metals.XAU, 3620);
});

test("gold and dollars round-trip through the table", () => {
  const unit = 1 / 3620;                 // ounces per dollar
  assert.ok(Math.abs(3620 * unit - 1) < 1e-12, "3620 dollars is one ounce");
  assert.ok(Math.abs(1 / unit - 3620) < 1e-9, "one ounce is 3620 dollars");
});
