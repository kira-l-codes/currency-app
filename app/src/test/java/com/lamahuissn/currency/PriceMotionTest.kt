package com.lamahuissn.currency

import com.lamahuissn.currency.data.FeedState
import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.PriceMotion
import com.lamahuissn.currency.data.Tick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The animation is only as honest as these rules: a price that moved lights the row, a price that
 * did not stays still, and a number nobody refreshed is never called live.
 */
class PriceMotionTest {

    // ── direction ────────────────────────────────────────────────────────────

    @Test
    fun `a higher ounce price is a rise`() {
        assertEquals(Tick.Up, PriceMotion.tick(previousUsd = 4037.80, nextUsd = 4041.10))
    }

    @Test
    fun `a lower ounce price is a fall`() {
        assertEquals(Tick.Down, PriceMotion.tick(previousUsd = 4037.80, nextUsd = 4030.05))
    }

    @Test
    fun `the same publication does not animate`() {
        assertEquals(Tick.Flat, PriceMotion.tick(previousUsd = 4037.80, nextUsd = 4037.80))
    }

    @Test
    fun `sub-cent float noise does not animate`() {
        // The feed returns 3860.669922 twice; JSON round-tripping can wobble the last digits.
        assertEquals(Tick.Flat, PriceMotion.tick(previousUsd = 3860.669922, nextUsd = 3860.672))
        assertEquals(Tick.Up, PriceMotion.tick(previousUsd = 3860.669922, nextUsd = 3860.69))
    }

    @Test
    fun `the first price of a session is not a movement`() {
        assertEquals(Tick.Flat, PriceMotion.tick(previousUsd = null, nextUsd = 4037.80))
    }

    @Test
    fun `a broken number is never a movement`() {
        assertEquals(Tick.Flat, PriceMotion.tick(4037.80, 0.0))
        assertEquals(Tick.Flat, PriceMotion.tick(4037.80, Double.NaN))
        assertEquals(Tick.Flat, PriceMotion.tick(0.0, 4037.80))
    }

    // ── accepting a publication ──────────────────────────────────────────────

    @Test
    fun `a newer publication is accepted`() {
        assertTrue(PriceMotion.accept(nextUsd = 4037.80, nextAtMs = 1_700_000_030_000, lastAcceptedAtMs = 1_700_000_000_000))
    }

    @Test
    fun `the same publication is ignored however often it is polled`() {
        val publishedAt = 1_700_000_000_000
        assertFalse(PriceMotion.accept(nextUsd = 4037.80, nextAtMs = publishedAt, lastAcceptedAtMs = publishedAt))
    }

    @Test
    fun `an out of order reply cannot walk the price backwards`() {
        assertFalse(PriceMotion.accept(nextUsd = 4000.00, nextAtMs = 1_699_999_970_000, lastAcceptedAtMs = 1_700_000_000_000))
    }

    @Test
    fun `nonsense prices are refused`() {
        assertFalse(PriceMotion.accept(nextUsd = 0.0, nextAtMs = 1_700_000_030_000, lastAcceptedAtMs = 0L))
        assertFalse(PriceMotion.accept(nextUsd = -5.0, nextAtMs = 1_700_000_030_000, lastAcceptedAtMs = 0L))
        assertFalse(PriceMotion.accept(nextUsd = Double.NaN, nextAtMs = 1_700_000_030_000, lastAcceptedAtMs = 0L))
    }

    @Test
    fun `the first publication is always accepted`() {
        assertTrue(PriceMotion.accept(nextUsd = 4037.80, nextAtMs = 1_700_000_000_000, lastAcceptedAtMs = 0L))
    }

    /**
     * The whole point, end to end: a first sighting draws nothing, a repeated publication draws
     * nothing, and only the next real publication with a new price animates.
     */
    @Test
    fun `a repeated publication never animates, the next real one does`() {
        var lastAccepted = 0L
        var previous: Double? = null
        var accepted = 0
        var animated = 0

        // (price, provider timestamp) as three consecutive polls: two inside one publication,
        // then one that carries the next publication.
        val polls = listOf(
            3860.66 to 1_700_000_000_000L,
            3860.66 to 1_700_000_000_000L,
            3862.12 to 1_700_000_030_000L,
        )

        polls.forEach { (price, publishedAt) ->
            if (!PriceMotion.accept(price, publishedAt, lastAccepted)) return@forEach
            accepted++
            if (PriceMotion.tick(previous, price) != Tick.Flat) animated++
            previous = price
            lastAccepted = publishedAt
        }

        assertEquals(2, accepted)      // the duplicate poll was dropped
        assertEquals(1, animated)      // only the real move lit the row
    }

    /** And a later publication with a real move must animate. */
    @Test
    fun `a later publication with a move animates`() {
        val first = Metals.Quote(ounceUsd = 3860.66, atMs = 1_700_000_000_000)
        val second = Metals.Quote(ounceUsd = 3862.12, atMs = 1_700_000_030_000)

        assertTrue(PriceMotion.accept(second.ounceUsd, second.atMs, first.atMs))
        assertEquals(Tick.Up, PriceMotion.tick(first.ounceUsd, second.ounceUsd))
    }

    // ── freshness labels ─────────────────────────────────────────────────────

    @Test
    fun `no price at all is offline`() {
        assertEquals(FeedState.Offline, PriceMotion.state(hasPrice = false, ageMs = 0L))
    }

    @Test
    fun `a fresh read is live`() {
        assertEquals(FeedState.Live, PriceMotion.state(hasPrice = true, ageMs = 0L))
        assertEquals(FeedState.Live, PriceMotion.state(hasPrice = true, ageMs = PriceMotion.LIVE_MAX_AGE_MS))
    }

    @Test
    fun `one missed publication is delayed, not live`() {
        assertEquals(FeedState.Delayed, PriceMotion.state(hasPrice = true, ageMs = PriceMotion.LIVE_MAX_AGE_MS + 1))
        assertEquals(FeedState.Delayed, PriceMotion.state(hasPrice = true, ageMs = PriceMotion.DELAYED_MAX_AGE_MS))
    }

    @Test
    fun `a quarter of an hour old is offline`() {
        assertEquals(FeedState.Offline, PriceMotion.state(hasPrice = true, ageMs = PriceMotion.DELAYED_MAX_AGE_MS + 1))
    }

    @Test
    fun `age is clamped so a clock skew never reads as the future`() {
        assertEquals(0L, PriceMotion.ageMs(nowMs = 1_000L, atMs = 5_000L))
        assertEquals(Long.MAX_VALUE, PriceMotion.ageMs(nowMs = 1_000L, atMs = 0L))
    }

    // ── provider timestamps ──────────────────────────────────────────────────

    @Test
    fun `the provider timestamp is parsed from its own ISO string`() {
        assertEquals(1_700_000_000_000L, PriceMotion.parseProviderAt("2023-11-14T22:13:20Z"))
    }

    @Test
    fun `an unparseable timestamp is null rather than zero`() {
        assertNull(PriceMotion.parseProviderAt("not a date"))
        assertNull(PriceMotion.parseProviderAt(""))
        assertNull(PriceMotion.parseProviderAt(null))
    }

    // ── the real body ────────────────────────────────────────────────────────

    private val goldBody = """
        {"currency":"USD","currencySymbol":"$","exchangeRate":1.0,"name":"Gold",
         "price":3865.75,"symbol":"XAU","updatedAt":"2026-11-16T09:32:28Z"}
    """.trimIndent()

    @Test
    fun `a quote carries both the price and the moment it was published`() {
        val quote = Metals.parseQuote(goldBody)!!
        assertEquals(3865.75, quote.ounceUsd, 0.0001)
        assertEquals(PriceMotion.parseProviderAt("2026-11-16T09:32:28Z"), quote.atMs)
    }

    @Test
    fun `a body with no timestamp still yields a usable price`() {
        val quote = Metals.parseQuote("""{"price":3865.75,"symbol":"XAU"}""")!!
        assertEquals(3865.75, quote.ounceUsd, 0.0001)
        assertEquals(0L, quote.atMs)
    }

    @Test
    fun `a body with no usable price yields nothing`() {
        assertNull(Metals.parseQuote("""{"price":0,"symbol":"XAU"}"""))
        assertNull(Metals.parseQuote("""{"symbol":"XAU"}"""))
        assertNull(Metals.parseQuote("not json"))
    }
}
