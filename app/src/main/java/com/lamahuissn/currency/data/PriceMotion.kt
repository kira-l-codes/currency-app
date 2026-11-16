package com.lamahuissn.currency.data

import java.time.Instant

/** Which way a price moved between two reads. [Flat] means "nothing worth animating". */
enum class Tick { Up, Down, Flat }

/** How much the metal feed can be trusted right now. */
enum class FeedState { Live, Delayed, Offline }

/**
 * The rules behind the gold and silver price animation, kept away from Compose so they can be
 * asserted instead of eyeballed.
 *
 * Three things have to hold, and each is a test:
 *
 * 1. **Only real moves animate.** `gold-api.com` publishes one price every 30 seconds; a poll that
 *    lands between two publications returns the same number. Re-animating that would be a light show
 *    with no market behind it, so a move smaller than [TICK_EPSILON_USD] is [Tick.Flat].
 * 2. **Only newer data is accepted.** The feed carries its own `updatedAt`; a response older than
 *    the one already on screen is ignored, so a retry or an out-of-order reply can never walk the
 *    price backwards.
 * 3. **Age decides the label.** A price seen within [LIVE_MAX_AGE_MS] is live, one within
 *    [DELAYED_MAX_AGE_MS] is delayed, and anything older is offline. A stale number is never called
 *    live.
 */
object PriceMotion {

    /** The provider's own cadence: one publication every 30 s, so the app polls no faster. */
    const val PROVIDER_PERIOD_MS = 30_000L

    /** One missed publication plus slack. */
    const val LIVE_MAX_AGE_MS = 75_000L

    /** Past this, the number on screen is history, not a quote. */
    const val DELAYED_MAX_AGE_MS = 15 * 60_000L

    /** Below half a cent, a change is noise from float round-tripping, not a market move. */
    const val TICK_EPSILON_USD = 0.005

    /** How long the flash and the arrow stay on screen. */
    const val FLASH_MS = 900L

    fun tick(previousUsd: Double?, nextUsd: Double): Tick {
        if (previousUsd == null || !previousUsd.isFinite() || previousUsd <= 0.0) return Tick.Flat
        if (!nextUsd.isFinite() || nextUsd <= 0.0) return Tick.Flat
        val delta = nextUsd - previousUsd
        if (kotlin.math.abs(delta) < TICK_EPSILON_USD) return Tick.Flat
        return if (delta > 0.0) Tick.Up else Tick.Down
    }

    fun state(hasPrice: Boolean, ageMs: Long): FeedState = when {
        !hasPrice -> FeedState.Offline
        ageMs in 0..LIVE_MAX_AGE_MS -> FeedState.Live
        ageMs in 0..DELAYED_MAX_AGE_MS -> FeedState.Delayed
        else -> FeedState.Offline
    }

    /**
     * True when [nextAtMs] is a strictly newer publication than [lastAcceptedAtMs] and the price is a
     * usable number. The caller passes 0 for "never accepted", and substitutes the local receipt time
     * when the feed omits a timestamp — a repeated publication must not re-trigger the animation.
     */
    fun accept(nextUsd: Double, nextAtMs: Long, lastAcceptedAtMs: Long): Boolean {
        if (!nextUsd.isFinite() || nextUsd <= 0.0) return false
        return nextAtMs > lastAcceptedAtMs
    }

    /** `"2026-11-16T09:32:28Z"` → epoch millis; null when the feed sends something unparseable. */
    fun parseProviderAt(iso: String?): Long? {
        if (iso.isNullOrBlank()) return null
        return runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull()
    }

    /** Milliseconds since [atMs], floored at zero so a clock skew never reads as "from the future". */
    fun ageMs(nowMs: Long, atMs: Long): Long = if (atMs <= 0L) Long.MAX_VALUE else (nowMs - atMs).coerceAtLeast(0L)
}
