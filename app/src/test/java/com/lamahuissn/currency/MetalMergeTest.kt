package com.lamahuissn.currency

import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.Tick
import com.lamahuissn.currency.ui.ConvertUi
import com.lamahuissn.currency.ui.MetalMotion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The regression the review caught: a refresh that lands between two provider publications used to
 * write an empty metal map into the state, and gold and silver left the list until the next tick.
 */
class MetalMergeTest {

    private val goldPerUsd = Metals.perUsd(4000.0)

    private fun state() = ConvertUi(
        usdTo = mapOf("USD" to 1.0, "LBP" to 89_500.0, "XAU" to goldPerUsd),
        metalMotion = mapOf(
            "XAU" to MetalMotion(ounceUsd = 4000.0, atMs = 1_700_000_000_000, receivedAt = 1L, tick = Tick.Flat, seq = 1),
        ),
    )

    @Test
    fun `a quiet refresh keeps the metal prices`() {
        val prices = state().metalPrices(motion = emptyMap())
        assertTrue("gold must survive a refresh that brought no new publication", prices.containsKey("XAU"))
        assertEquals(4000.0, Metals.ounceUsd(prices.getValue("XAU")), 0.0001)
    }

    @Test
    fun `an accepted move overlays the stored price`() {
        val moved = mapOf(
            "XAU" to MetalMotion(ounceUsd = 4012.5, atMs = 1_700_000_030_000, receivedAt = 2L, tick = Tick.Up, seq = 2),
        )
        val prices = state().metalPrices(motion = moved)
        assertEquals(4012.5, Metals.ounceUsd(prices.getValue("XAU")), 0.0001)
    }

    @Test
    fun `the metal merge only carries metals, so fiat is never overwritten by it`() {
        val prices = state().metalPrices(motion = emptyMap())
        assertNull("fiat belongs to the fiat table, not to this merge", prices["LBP"])
        assertNull(prices["USD"])
    }

    @Test
    fun `a flash outside its window is not reported`() {
        val now = 10_000L
        val fresh = state().copy(
            metalMotion = mapOf(
                "XAU" to MetalMotion(4000.0, 1L, receivedAt = now - 100, tick = Tick.Up, seq = 2),
            ),
        )
        assertTrue(fresh.motionOf("XAU", now) != null)
        assertNull(fresh.motionOf("XAU", now + 5_000))
    }
}
