package com.lamahuissn.currency

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.Prefs
import com.lamahuissn.currency.data.Tick
import com.lamahuissn.currency.ui.MetalMotion
import com.lamahuissn.currency.ui.RatesMerge
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The review's point: the eight earlier tests simulated a restarted numeric cache. They never wrote
 * to storage and never read it back, so nothing proved that a publication time survives a restart.
 * This file does the round trip for real, and interleaves the two refresh paths.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class MetalBookTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    private fun book(): Map<String, MetalMotion> = mapOf(
        "XAU" to MetalMotion(ounceUsd = 3620.0, atMs = 1_790_000_000_000, receivedAt = 1_790_000_000_000, tick = Tick.Up, seq = 4),
        "XAG" to MetalMotion(ounceUsd = 42.0, atMs = 1_790_000_030_000, receivedAt = 1_790_000_030_000, tick = Tick.Down, seq = 7),
    )

    @Test
    fun `a publication time survives a real storage round trip`() {
        val prefs = Prefs(context)
        prefs.cachedRates = mapOf("USD" to 1.0, "XAU" to Metals.perUsd(3620.0), "XAG" to Metals.perUsd(42.0))
        prefs.metalBook = RatesMerge.encodeBook(book())

        // A new process: nothing is carried over in memory.
        val reopened = Prefs(context)
        val decoded = RatesMerge.decodeBook(reopened.metalBook)

        assertEquals(1_790_000_000_000L, decoded.getValue("XAU").atMs)
        assertEquals(1_790_000_030_000L, decoded.getValue("XAG").atMs)
        assertEquals(4, decoded.getValue("XAU").seq)
        assertEquals(3620.0, decoded.getValue("XAU").ounceUsd, 0.0)
        assertEquals(3620.0, Metals.ounceUsd(reopened.cachedRates.getValue("XAU")), 1e-9)
    }

    @Test
    fun `a restored price has no direction`() {
        // Nothing moved while the app was closed, so nothing may flash on the first paint.
        val decoded = RatesMerge.decodeBook(RatesMerge.encodeBook(book()))
        assertEquals(Tick.Flat, decoded.getValue("XAU").tick)
    }

    @Test
    fun `a four-field record keeps its price but claims no publication time`() {
        // The build that wrote four-field books substituted the receipt time when a quote carried no
        // timestamp, so the field cannot be trusted as a publication time. The price is real; the age
        // is unknown, and the sheet says so instead of inventing LIVE.
        val legacy = "XAU|3620.0|1790000000000|4"
        val decoded = RatesMerge.decodeBook(legacy)

        assertEquals(setOf("XAU"), decoded.keys)
        assertEquals(3620.0, decoded.getValue("XAU").ounceUsd, 0.0)
        assertFalse(decoded.getValue("XAU").atKnown)
    }

    @Test
    fun `a five-field record keeps the flag it was written with`() {
        val known = RatesMerge.decodeBook("XAU|3620.0|1790000000000|4|1")
        val unknown = RatesMerge.decodeBook("XAU|3620.0|1790000000000|4|0")
        assertTrue(known.getValue("XAU").atKnown)
        assertFalse(unknown.getValue("XAU").atKnown)
    }

    @Test
    fun `a corrupt line is dropped, not guessed at`() {
        val raw = "XAU|3620.0|1790000000000|4\nXAG|oops|later|7\n\nbroken"
        val decoded = RatesMerge.decodeBook(raw)
        assertEquals(setOf("XAU"), decoded.keys)
    }

    @Test
    fun `the first refresh after a restart does not treat the stored price as news`() {
        val prefs = Prefs(context)
        prefs.metalBook = RatesMerge.encodeBook(book())
        val restored = RatesMerge.decodeBook(prefs.metalBook)

        // The provider republishes the same numbers: nothing moved.
        val (motion, moved) = RatesMerge.motion(
            restored,
            mapOf("XAU" to Metals.Quote(3620.0, 1_790_000_000_000)),
            receivedAt = 1_790_000_500_000,
        )
        assertFalse(moved)
        assertEquals(4, motion.getValue("XAU").seq)

        // A genuinely newer publication is accepted.
        val (newer, didMove) = RatesMerge.motion(
            restored,
            mapOf("XAU" to Metals.Quote(3630.0, 1_790_000_060_000)),
            receivedAt = 1_790_000_500_000,
        )
        assertTrue(didMove)
        assertEquals(Tick.Up, newer.getValue("XAU").tick)
    }

    @Test
    fun `metal refreshes interleaved with fiat refreshes keep both`() {
        // A session: fiat refresh, a metal tick, then another fiat refresh with the metal feed down.
        var table: Map<String, Double> = mapOf("USD" to 1.0, "XAU" to Metals.perUsd(3620.0), "XAG" to Metals.perUsd(42.0))
        var motion: Map<String, MetalMotion> = RatesMerge.decodeBook(RatesMerge.encodeBook(book()))

        // 1. fiat refresh, metals unchanged
        var step = RatesMerge.motion(motion, emptyMap(), 1_790_001_000_000)
        motion = step.first
        table = RatesMerge.table(mapOf("USD" to 1.0, "LBP" to 89_500.0), table, motion)
        assertEquals(3620.0, Metals.ounceUsd(table.getValue("XAU")), 1e-9)

        // 2. a metal tick between fiat refreshes
        step = RatesMerge.motion(motion, mapOf("XAU" to Metals.Quote(3640.0, 1_790_001_030_000)), 1_790_001_030_000)
        motion = step.first
        table = RatesMerge.table(table, table, motion)
        assertEquals(3640.0, Metals.ounceUsd(table.getValue("XAU")), 1e-9)

        // 3. another fiat refresh, metal feed dead
        step = RatesMerge.motion(motion, emptyMap(), 1_790_001_060_000)
        motion = step.first
        table = RatesMerge.table(mapOf("USD" to 1.0, "LBP" to 89_600.0), table, motion)

        assertEquals("gold keeps the tick's price", 3640.0, Metals.ounceUsd(table.getValue("XAU")), 1e-9)
        assertEquals("silver keeps its own", 42.0, Metals.ounceUsd(table.getValue("XAG")), 1e-9)
        assertEquals(89_600.0, table.getValue("LBP"), 0.0)
    }
}
