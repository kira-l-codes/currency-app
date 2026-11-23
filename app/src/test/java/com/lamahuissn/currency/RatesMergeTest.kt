package com.lamahuissn.currency

import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.Tick
import com.lamahuissn.currency.ui.MetalMotion
import com.lamahuissn.currency.ui.RatesMerge
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The production refresh path, exercised through the reducer it actually calls.
 *
 * The previous batch tested a helper that `refresh()` never invoked, so gold could still vanish on a
 * cold start with a cached price and a failing metal feed. These cases are the ones the review
 * listed: cold start, metals failing while fiat succeeds, a partial metal response, a duplicate
 * publication, an older publication.
 */
class RatesMergeTest {

    private val goldUsd = 3620.0
    private val silverUsd = 42.0

    /** What `Prefs.cachedRates` holds after a previous session. */
    private val cachedTable = mapOf(
        "USD" to 1.0,
        "LBP" to 89_500.0,
        "EUR" to 0.92,
        "XAU" to Metals.perUsd(goldUsd),
        "XAG" to Metals.perUsd(silverUsd),
    )

    private fun quote(usd: Double, at: Long) = Metals.Quote(ounceUsd = usd, atMs = at)

    @Test
    fun `fiat succeeds while the metal feed fails and the cached metals survive`() {
        val (motion, moved) = RatesMerge.motion(emptyMap(), emptyMap(), receivedAt = 1_000L)
        val table = RatesMerge.table(mapOf("USD" to 1.0, "LBP" to 90_000.0), cachedTable, motion)

        assertFalse("no publication, no animation", moved)
        assertTrue("gold must not be deleted when its feed is down", table.containsKey("XAU"))
        assertTrue(table.containsKey("XAG"))
        assertEquals(goldUsd, Metals.ounceUsd(table.getValue("XAU")), 1e-9)
        assertEquals(90_000.0, table.getValue("LBP"), 0.0)   // fiat did refresh
    }

    @Test
    fun `a partial metal response keeps the metal it did not mention`() {
        val (motion, moved) = RatesMerge.motion(
            previous = emptyMap(),
            quotes = mapOf("XAU" to quote(3_650.0, 2_000L)),
            receivedAt = 2_000L,
        )
        val table = RatesMerge.table(mapOf("USD" to 1.0), cachedTable, motion)

        assertTrue(moved)
        assertEquals(3_650.0, Metals.ounceUsd(table.getValue("XAU")), 1e-9)
        assertEquals("silver was not in the response, so it keeps its price", silverUsd, Metals.ounceUsd(table.getValue("XAG")), 1e-9)
    }

    @Test
    fun `a duplicate publication moves nothing and shows no flash`() {
        val first = RatesMerge.motion(emptyMap(), mapOf("XAU" to quote(goldUsd, 5_000L)), 5_000L)
        val second = RatesMerge.motion(first.first, mapOf("XAU" to quote(goldUsd, 5_000L)), 6_000L)

        assertTrue("the first publication is news", first.second)
        assertFalse("the same publication again is not", second.second)
        assertEquals(1, second.first.getValue("XAU").seq)
        assertEquals(Tick.Flat, second.first.getValue("XAU").tick)
    }

    @Test
    fun `an older publication is ignored`() {
        val newer = RatesMerge.motion(emptyMap(), mapOf("XAU" to quote(3_700.0, 9_000L)), 9_000L)
        val older = RatesMerge.motion(newer.first, mapOf("XAU" to quote(3_600.0, 8_000L)), 9_500L)

        assertFalse(older.second)
        assertEquals(3_700.0, older.first.getValue("XAU").ounceUsd, 0.0)
    }

    @Test
    fun `a restart with a cache and then a failing feed keeps the price`() {
        // Session two: the state is built from the cache, the motion map is empty (nothing seen yet).
        val restored: Map<String, MetalMotion> = emptyMap()
        val (motion, moved) = RatesMerge.motion(restored, emptyMap(), receivedAt = 20_000L)
        val table = RatesMerge.table(mapOf("USD" to 1.0, "LBP" to 89_000.0), cachedTable, motion)

        assertFalse(moved)
        assertEquals(goldUsd, Metals.ounceUsd(table.getValue("XAU")), 1e-9)
        assertEquals(silverUsd, Metals.ounceUsd(table.getValue("XAG")), 1e-9)
    }

    @Test
    fun `the merge never invents a metal that was never priced`() {
        val table = RatesMerge.table(mapOf("USD" to 1.0), emptyMap(), emptyMap())
        assertFalse(table.containsKey("XAU"))
        assertFalse(table.containsKey("XAG"))
    }

    @Test
    fun `a fiat success does not touch a metal price`() {
        val table = RatesMerge.table(mapOf("USD" to 1.0, "XAU" to 999.0), cachedTable, emptyMap())
        // The fiat answer cannot contain metals, but if it ever did, the cached metal price wins:
        // the metal table is the one source for a metal.
        assertEquals(goldUsd, Metals.ounceUsd(table.getValue("XAU")), 1e-9)
    }

    @Test
    fun `a move is accepted once and keeps everything else`() {
        val previous = mapOf(
            "XAU" to MetalMotion(goldUsd, 1_000L, 1_000L, Tick.Flat, 1),
            "XAG" to MetalMotion(silverUsd, 1_000L, 1_000L, Tick.Flat, 1),
        )
        val (motion, moved) = RatesMerge.motion(previous, mapOf("XAU" to quote(3_630.0, 1_500L)), 1_500L)

        assertTrue(moved)
        assertEquals(2, motion.getValue("XAU").seq)
        assertEquals(Tick.Up, motion.getValue("XAU").tick)
        assertEquals(1, motion.getValue("XAG").seq)   // untouched, still known
    }
}
