package com.lamahuissn.currency

import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.ui.ConvertUi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The arithmetic the rows depend on, on the Android side, with fixed rates.
 *
 * These are regression tests for behaviour that already worked: the point is that a future change to
 * the merge or the metal unit cannot quietly move a converted figure.
 */
class CalcTest {

    private val state = ConvertUi(
        base = "USD",
        amount = 100.0,
        usdTo = mapOf(
            "USD" to 1.0,
            "LBP" to 89_500.0,
            "EUR" to 0.92,
            "XAU" to Metals.perUsd(3620.0),
            "XAG" to Metals.perUsd(42.0),
            "BTC" to 1.0 / 61_000.0,
        ),
    )

    @Test
    fun `fiat converts both ways`() {
        assertEquals(8_950_000.0, state.converted("LBP")!!, 1e-6)
        assertEquals(92.0, state.converted("EUR")!!, 1e-9)
        assertEquals(100.0, state.copy(base = "LBP", amount = 8_950_000.0).converted("USD")!!, 1e-6)
    }

    @Test
    fun `a metal is priced by the ounce`() {
        assertEquals(362_000.0, state.copy(base = "XAU", amount = 100.0).converted("USD")!!, 1e-6)
        assertEquals(3_620.0, state.copy(amount = 1.0, base = "XAU").converted("USD")!!, 1e-6)
        assertEquals(42.0, state.copy(amount = 1.0, base = "XAG").converted("USD")!!, 1e-6)
    }

    @Test
    fun `crypto uses its own rate`() {
        val btc = state.converted("BTC")!!
        assertTrue("100 USD should be about 0.0016 BTC, got $btc", kotlin.math.abs(btc - 100.0 / 61_000.0) < 1e-12)
    }

    @Test
    fun `zero and unknown codes are no value, not a fake number`() {
        assertEquals(0.0, state.copy(amount = 0.0).converted("LBP")!!, 0.0)
        assertNull(state.converted("ZZZ"))
        assertNull(state.rate("USD", "ZZZ"))
        assertEquals(1.0, state.rate("USD", "USD")!!, 0.0)
    }

    @Test
    fun `a very large amount keeps its magnitude`() {
        val usd = state.copy(base = "LBP", amount = 1e12).converted("USD")!!
        assertTrue(kotlin.math.abs(usd - 1e12 / 89_500.0) < 1e-3)
        assertTrue(usd.isFinite())
    }

    @Test
    fun `a missing metal price never becomes a conversion`() {
        val withoutGold = state.copy(usdTo = state.usdTo - "XAU")
        assertNull(withoutGold.converted("XAU"))
    }
}
