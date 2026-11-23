/**
 * The rules the two builds share, as pure functions.
 *
 * They live in their own file so the browser and the tests run the same code: `web/app.js` imports
 * this object, and `web/tests/logic.test.mjs` imports it with node. A rule that only exists in a
 * test would prove nothing — the review was explicit about that.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const MAX_ENTRY = 24;
  const OPS = "+−×÷";
  const isOp = (c) => c.length === 1 && OPS.indexOf(c) >= 0;

  /**
   * How a converted figure is written — the same ladder as Android's `Format.formatValue`:
   * two decimals from 100 up, three between 1 and 100, four between 0.01 and 1, eight below that,
   * with trailing zeros trimmed but never below two decimals.
   *
   * A value too small to show at eight decimals is reported as a floor, not as `0.00`: a nonzero
   * amount rendered as zero is a lie the user cannot see through.
   */
  function formatFigure(value) {
    if (typeof value !== "number" || !isFinite(value)) return "—";
    const abs = Math.abs(value);
    let dp;
    if (value === 0) dp = 2;
    else if (abs >= 100) dp = 2;
    else if (abs >= 1) dp = 3;
    else if (abs >= 0.01) dp = 4;
    else dp = 8;

    // 8 decimals is the narrowest we print, so anything below half of that last digit would read
    // as 0.00000000 — say so instead of printing a zero that is not there.
    if (abs !== 0 && abs < 5e-9) return "<0.00000001";

    let text = value.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const dot = text.indexOf(".");
    if (dot < 0) return text;
    let end = text.length;
    while (end - dot > 3 && text[end - 1] === "0") end--;
    return text.slice(0, end);
  }

  /**
   * Evaluates what the keypad shows. A dangling operator is not an error (`5+` is 5) and neither is
   * a dangling point (`5.` is 5) — Android accepts both, and a half-typed sum must not be rejected
   * on one build and accepted on the other.
   */
  function evaluate(raw) {
    if (raw == null) return null;
    let src = String(raw)
      .replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, "")
      .trim();
    if (!src) return null;

    // `5..` is not a number that lost a digit, it is malformed input: reject it in the function
    // itself, not only in the keypad that happens to mask it.
    if (src.split(/[+\-*/()]/).some((operand) => (operand.match(/\./g) || []).length > 1)) return null;

    // A dangling point is a valid operand wherever it appears: `5.×3`, `5.+3`, `5.÷2`, `5.−3`,
    // and a trailing `5.`. Android's tokenizer reads all of them, so this build must too.
    src = src
      .replace(/(\d)\.(?=[+\-*/)])/g, "$1")
      .replace(/(\d)\.$/, "$1")
      .replace(/[+\-*/]+$/, "");

    const tokens = src.match(/\d*\.?\d+|[+\-*/()]/g);
    if (!tokens || tokens.join("") !== src.replace(/\s+/g, "")) return null;

    let i = 0;
    const peek = () => tokens[i];
    const isOperatorToken = (t) => t === "+" || t === "-" || t === "*" || t === "/";

    function factor() {
      const t = peek();
      if (t === "-") { i++; const v = factor(); return v == null ? null : -v; }
      if (t === "+") { i++; return factor(); }
      if (t === "(") {
        i++;
        const v = expr();
        if (v == null || peek() !== ")") return null;
        i++;
        return v;
      }
      if (t == null || isOperatorToken(t) || t === ")") return null;
      i++;
      const n = Number(t);
      return isFinite(n) ? n : null;
    }

    function term() {
      let v = factor();
      while (v != null && (peek() === "*" || peek() === "/")) {
        const op = peek(); i++;
        const r = factor();
        if (r == null) return null;
        if (op === "/" && r === 0) return null;      // division by zero is "no value", not Infinity
        v = op === "*" ? v * r : v / r;
      }
      return v;
    }

    function expr() {
      let v = term();
      while (v != null && (peek() === "+" || peek() === "-")) {
        const op = peek(); i++;
        const r = term();
        if (r == null) return null;
        v = op === "+" ? v + r : v - r;
      }
      return v;
    }

    const result = expr();
    if (result == null || i !== tokens.length) return null;
    return isFinite(result) ? result : null;
  }

  /**
   * One key press. Returns the new entry and whether the entry is still "fresh" (the value the sheet
   * opened with, untouched).
   *
   * `options.replace` decides what the first character does: Count replaces the pre-filled value,
   * Convert appends to it, exactly as the Android build does.
   */
  function pressKey(entry, key, options) {
    const opts = options || {};
    let text = String(entry == null ? "" : entry);
    let fresh = Boolean(opts.fresh);

    if (key === "C") return { entry: "", fresh: false };
    if (key === "back") return { entry: text.slice(0, -1), fresh: false };
    if (key === "1K" || key === "100" || key === "10") {
      // A shortcut replaces the entry; it never appends zeros.
      return { entry: { "1K": "1000", "100": "100", "10": "10" }[key], fresh: false };
    }

    const isDigit = /^[0-9]$/.test(key);
    const isDot = key === ".";

    if (fresh && opts.replace && (isDigit || isDot)) text = "";
    fresh = false;

    if (isOp(key)) {
      if (!text) return { entry: text, fresh };
      const last = text.slice(-1);
      if (isOp(last)) return { entry: text.slice(0, -1) + key, fresh };
      if (text.length >= MAX_ENTRY) return { entry: text, fresh };
      return { entry: text + key, fresh };
    }

    if (isDot) {
      const operand = text.split(/[+−×÷]/).pop();
      if (operand.indexOf(".") >= 0) return { entry: text, fresh };
      if (!text || isOp(text.slice(-1))) {
        if (text.length + 2 > MAX_ENTRY) return { entry: text, fresh };
        return { entry: text + "0.", fresh };
      }
      if (text.length >= MAX_ENTRY) return { entry: text, fresh };
      return { entry: text + ".", fresh };
    }

    if (!isDigit) return { entry: text, fresh };

    const last = text.slice(-1);
    if (isOp(last)) {
      if (text.length >= MAX_ENTRY) return { entry: text, fresh };
      return { entry: text + key, fresh };
    }
    if (text === "0") return { entry: key, fresh };
    if (text.length >= MAX_ENTRY) return { entry: text, fresh };
    return { entry: text + key, fresh };
  }

  /** The saved-state shape this build writes. Anything older is migrated on load. */
  const STATE_VERSION = 3;

  /**
   * Upgrades a stored record to [STATE_VERSION]. Called by `loadState`, and tested directly.
   *
   * v1 wrote the dollar price of a troy ounce into a table that means ounces per dollar. A record
   * with no version is indistinguishable from v1, and an ounce price is always >= 1 while a unit
   * rate never is, so that is the only signal available — used **once**, and never again once the
   * record carries a version.
   *
   * Returns a new object; the input is not mutated.
   */
  function migrateRecord(record) {
    if (!record || typeof record !== "object") return record;
    const from = Number(record.v) || 1;
    const out = Object.assign({}, record);
    if (from < 2) {
      if (out.metals && typeof out.metals === "object") {
        const fixed = {};
        Object.entries(out.metals).forEach(([code, v]) => {
          if (!(v > 0)) return;
          fixed[code] = v >= 1 ? 1 / v : v;
        });
        out.metals = fixed;
      }
      out.v = 2;
    }
    if (out.v < 3) {
      // v3 only names the shape: amounts stay plain JSON numbers, and the version is what records
      // the shape rather than the storage key's name.
      out.v = 3;
    }
    return out;
  }

  return { formatFigure, evaluate, pressKey, migrateRecord, MAX_ENTRY, STATE_VERSION, isOp };
});
