package com.lamahuissn.currency

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.lamahuissn.currency.data.FeedState
import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.Prefs
import com.lamahuissn.currency.data.Tick
import com.lamahuissn.currency.ui.ConvertUi
import com.lamahuissn.currency.ui.MetalMotion
import com.lamahuissn.currency.ui.RatesMerge
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The production freshness path: the functions `ConvertScreen` calls to fill `MetalsSheet`.
 *
 * The review's objection was exact — `metalStateOf` had no call site, the sheet still used the
 * shared `metalsAt`, and the age was computed from receipt time. These cases drive
 * [ConvertUi.metalFeed] and [ConvertUi.metalPublishedAt], which is what the screen passes to the
 * sheet, plus a real storage round trip for the restart case.
 *
 * Scope note: the reducer is exercised directly. Driving both ViewModel coroutines with a controlled
 * completion order is **not** covered here — that is a coroutine test this batch does not have.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class MetalFreshnessTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val now = 1_790_000_100_000L
    private val goldUsd = 3620.0
    private val silverUsd = 42.0

    private fun motion(usd: Double, publishedAt: Long, receivedAt: Long = publishedAt, atKnown: Boolean = true, seq: Int = 1) =
        MetalMotion(usd, publishedAt, receivedAt, Tick.Flat, seq, atKnown)

    private fun ui(
        gold: MetalMotion? = motion(goldUsd, now - 20_000),
        silver: MetalMotion? = motion(silverUsd, now - 20_000),
    ) = ConvertUi(
        usdTo = buildMap {
            put("USD", 1.0)
            if (gold != null) put("XAU", Metals.perUsd(goldUsd))
            if (silver != null) put("XAG", Metals.perUsd(silverUsd))
        },
        metalMotion = buildMap {
            if (gold != null) put("XAU", gold)
            if (silver != null) put("XAG", silver)
        },
    )

    @Test
    fun `fresh gold and stale silver report different states in the sheet path`() {
        val state = ui(
            gold = motion(goldUsd, now - 20_000),          // 20 s old
            silver = motion(silverUsd, now - 20 * 60_000), // 20 min old
        )
        assertEquals(FeedState.Live, state.metalFeed("XAU", now))
        assertEquals(FeedState.Offline, state.metalFeed("XAG", now))
    }

    @Test
    fun `an old publication received just now is still old`() {
        // The feed handed us a price published an hour ago in this same second.
        val state = ui(gold = motion(goldUsd, now - 60 * 60_000, receivedAt = now))
        assertEquals(
            "receipt time must not make an old publication fresh",
            FeedState.Offline,
            state.metalFeed("XAU", now),
        )
        assertEquals(now - 60 * 60_000, state.metalPublishedAt("XAU"))
    }

    @Test
    fun `a price with no publication time reports unknown age, not live`() {
        val state = ui(gold = motion(goldUsd, now, receivedAt = now, atKnown = false))
        assertNull("an invented timestamp cannot prove freshness", state.metalFeed("XAU", now))
        assertNull(state.metalPublishedAt("XAU"))
    }

    @Test
    fun `restart keeps the classification and does not flash`() {
        val prefs = Prefs(context)
        // Gold published 20 s before the app closed, silver 20 min before.
        val book = mapOf(
            "XAU" to motion(goldUsd, now - 20_000),
            "XAG" to motion(silverUsd, now - 20 * 60_000),
        )
        prefs.metalBook = RatesMerge.encodeBook(book)
        prefs.cachedRates = mapOf("USD" to 1.0, "XAU" to Metals.perUsd(goldUsd), "XAG" to Metals.perUsd(silverUsd))

        val restored = ConvertUi(usdTo = Prefs(context).cachedRates, metalMotion = RatesMerge.decodeBook(Prefs(context).metalBook))
        assertEquals(FeedState.Live, restored.metalFeed("XAU", now))
        assertEquals(FeedState.Offline, restored.metalFeed("XAG", now))
        assertEquals(Tick.Flat, restored.metalMotion.getValue("XAU").tick)
        assertNull("a restored price must not flash", restored.motionOf("XAU", now))
    }

    @Test
    fun `an unknown publication time survives a restart as unknown`() {
        val prefs = Prefs(context)
        prefs.metalBook = RatesMerge.encodeBook(mapOf("XAU" to motion(goldUsd, now, atKnown = false)))
        val restored = RatesMerge.decodeBook(Prefs(context).metalBook)
        assertEquals(false, restored.getValue("XAU").atKnown)
    }

    @Test
    fun `repeated and older publications do not reset freshness`() {
        val current = mapOf("XAU" to motion(goldUsd, now - 20_000, seq = 3))
        // Same publication again.
        val repeated = RatesMerge.motion(current, mapOf("XAU" to Metals.Quote(goldUsd, now - 20_000)), now)
        assertEquals(false, repeated.second)
        assertEquals(now - 20_000, repeated.first.getValue("XAU").atMs)

        // An older one.
        val older = RatesMerge.motion(current, mapOf("XAU" to Metals.Quote(goldUsd - 5, now - 90_000)), now)
        assertEquals(false, older.second)
        assertEquals(now - 20_000, older.first.getValue("XAU").atMs)
    }

    @Test
    fun `a numeric cache with no publication record is explicitly unknown`() {
        // Upgrading from a build that stored only rates: there is a price and no proof of its age.
        val legacy = ConvertUi(usdTo = mapOf("USD" to 1.0, "XAU" to Metals.perUsd(goldUsd)), metalMotion = emptyMap())
        assertNotNull("the price is there", legacy.usdTo["XAU"])
        assertNull("but its freshness is not", legacy.metalFeed("XAU", now))
    }

    @Test
    fun `a metal with no price is unknown, not offline`() {
        val state = ui(gold = null)
        assertNull(state.metalFeed("XAU", now))
    }

    @Test
    fun `freshness is measured per metal from its own publication`() {
        val state = ui(
            gold = motion(goldUsd, now - 10 * 60_000),      // 10 min: delayed
            silver = motion(silverUsd, now - 5_000),        // 5 s: live
        )
        assertEquals(FeedState.Delayed, state.metalFeed("XAU", now))
        assertEquals(FeedState.Live, state.metalFeed("XAG", now))
        assertTrue(state.metalPublishedAt("XAG")!! > state.metalPublishedAt("XAU")!!)
    }
}
