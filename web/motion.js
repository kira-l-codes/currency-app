/* The rules behind the gold and silver animation, shared by the page and by `node --test`.
 *
 * Written as a plain module with no DOM and no globals so the same file can be require()d by a test
 * runner and loaded by a <script> tag. Three rules, each one a test:
 *
 *   1. Only a real move animates — the feed publishes every 30 s, so a poll that lands inside the
 *      same publication returns the same price and a fraction of a cent is noise, not a market.
 *   2. Only a newer publication is accepted — the feed carries `updatedAt`, and a retry or an
 *      out-of-order reply must never walk the price backwards.
 *   3. Age decides the label — fresh is LIVE, one missed publication is DELAYED, and anything past
 *      fifteen minutes is OFFLINE. A stale number is never shown as live.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Motion = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PROVIDER_PERIOD_MS = 30_000;
  const LIVE_MAX_AGE_MS = 75_000;
  const DELAYED_MAX_AGE_MS = 15 * 60_000;
  const TICK_EPSILON_USD = 0.005;
  const FLASH_MS = 900;

  /** "2026-11-16T09:32:28Z" → epoch ms; null when the feed sends something unrepeatable. */
  function parseProviderAt(iso) {
    if (!iso || typeof iso !== "string") return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }

  /** Which way the price moved: "up", "down", or "flat" when it is not worth animating. */
  function tick(previousUsd, nextUsd) {
    if (!Number.isFinite(previousUsd) || previousUsd <= 0) return "flat";
    if (!Number.isFinite(nextUsd) || nextUsd <= 0) return "flat";
    const delta = nextUsd - previousUsd;
    if (Math.abs(delta) < TICK_EPSILON_USD) return "flat";
    return delta > 0 ? "up" : "down";
  }

  /** "live" | "delayed" | "offline", decided by age alone. */
  function feedState(hasPrice, ageMs) {
    if (!hasPrice) return "offline";
    if (ageMs >= 0 && ageMs <= LIVE_MAX_AGE_MS) return "live";
    if (ageMs >= 0 && ageMs <= DELAYED_MAX_AGE_MS) return "delayed";
    return "offline";
  }

  /**
   * One metal's state from its own publication time. null means the age is unknown: there is no
   * price, or the feed never said when it published (a receipt time is not a publication).
   */
  function metalState(hasPrice, atKnown, publishedAtMs, nowMs) {
    if (!hasPrice || !atKnown || !(publishedAtMs > 0)) return null;
    return feedState(true, ageMs(nowMs, publishedAtMs));
  }

  /** Strictly newer publication, usable price. `lastAcceptedAtMs` is 0 for "never accepted". */
  function accept(nextUsd, nextAtMs, lastAcceptedAtMs) {
    if (!Number.isFinite(nextUsd) || nextUsd <= 0) return false;
    return nextAtMs > lastAcceptedAtMs;
  }

  /** Age in ms, floored at zero so a skewed clock never reads as the future. */
  function ageMs(nowMs, atMs) {
    if (!atMs || atMs <= 0) return Number.MAX_SAFE_INTEGER;
    return Math.max(0, nowMs - atMs);
  }

  return {
    PROVIDER_PERIOD_MS, LIVE_MAX_AGE_MS, DELAYED_MAX_AGE_MS, TICK_EPSILON_USD, FLASH_MS,
    parseProviderAt, tick, feedState, metalState, accept, ageMs,
  };
});
