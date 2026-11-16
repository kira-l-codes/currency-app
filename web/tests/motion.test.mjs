import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// The page loads motion.js with a <script> tag; the test loads the very same file, so what ships is
// exactly what is asserted here.
const require = createRequire(import.meta.url);
const M = require("../motion.js");

const PUBLISHED = Date.parse("2026-11-16T09:32:28Z");

test("a higher ounce price is a rise", () => {
  assert.equal(M.tick(4037.8, 4041.1), "up");
});

test("a lower ounce price is a fall", () => {
  assert.equal(M.tick(4037.8, 4030.05), "down");
});

test("the same publication does not animate", () => {
  assert.equal(M.tick(3860.669922, 3860.669922), "flat");
});

test("sub-cent float noise does not animate", () => {
  assert.equal(M.tick(3860.669922, 3860.672), "flat");
  assert.equal(M.tick(3860.669922, 3860.69), "up");
});

test("the first sighting is not a movement", () => {
  assert.equal(M.tick(null, 4037.8), "flat");
  assert.equal(M.tick(undefined, 4037.8), "flat");
});

test("a broken number is never a movement", () => {
  assert.equal(M.tick(4037.8, 0), "flat");
  assert.equal(M.tick(4037.8, NaN), "flat");
  assert.equal(M.tick(0, 4037.8), "flat");
});

test("a newer publication is accepted", () => {
  assert.equal(M.accept(4037.8, PUBLISHED + 30_000, PUBLISHED), true);
});

test("the same publication is ignored however often it is polled", () => {
  assert.equal(M.accept(4037.8, PUBLISHED, PUBLISHED), false);
});

test("an out of order reply cannot walk the price backwards", () => {
  assert.equal(M.accept(4000, PUBLISHED - 30_000, PUBLISHED), false);
});

test("nonsense prices are refused", () => {
  assert.equal(M.accept(0, PUBLISHED, 0), false);
  assert.equal(M.accept(-5, PUBLISHED, 0), false);
  assert.equal(M.accept(NaN, PUBLISHED, 0), false);
});

test("the first publication is always accepted", () => {
  assert.equal(M.accept(4037.8, PUBLISHED, 0), true);
});

test("a repeated publication never animates, the next real one does", () => {
  const polls = [
    [3860.66, PUBLISHED],
    [3860.66, PUBLISHED],            // second poll inside the same publication
    [3862.12, PUBLISHED + 30_000],   // the next publication, a real move
  ];
  let lastAccepted = 0;
  let previous = null;
  let accepted = 0;
  let animated = 0;

  for (const [price, at] of polls) {
    if (!M.accept(price, at, lastAccepted)) continue;
    accepted += 1;
    if (M.tick(previous, price) !== "flat") animated += 1;
    previous = price;
    lastAccepted = at;
  }

  assert.equal(accepted, 2);
  assert.equal(animated, 1);
});

test("no price at all is offline", () => {
  assert.equal(M.feedState(false, 0), "offline");
});

test("a fresh read is live", () => {
  assert.equal(M.feedState(true, 0), "live");
  assert.equal(M.feedState(true, M.LIVE_MAX_AGE_MS), "live");
});

test("one missed publication is delayed, not live", () => {
  assert.equal(M.feedState(true, M.LIVE_MAX_AGE_MS + 1), "delayed");
  assert.equal(M.feedState(true, M.DELAYED_MAX_AGE_MS), "delayed");
});

test("a quarter of an hour old is offline", () => {
  assert.equal(M.feedState(true, M.DELAYED_MAX_AGE_MS + 1), "offline");
});

test("age is clamped so a clock skew never reads as the future", () => {
  assert.equal(M.ageMs(1000, 5000), 0);
  assert.equal(M.ageMs(1000, 0), Number.MAX_SAFE_INTEGER);
});

test("the provider timestamp is parsed from its own ISO string", () => {
  assert.equal(M.parseProviderAt("2026-11-16T09:32:28Z"), PUBLISHED);
});

test("an unparseable timestamp is null rather than zero", () => {
  assert.equal(M.parseProviderAt("not a date"), null);
  assert.equal(M.parseProviderAt(""), null);
  assert.equal(M.parseProviderAt(null), null);
});
