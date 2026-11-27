package com.lamahuissn.currency

import com.lamahuissn.currency.data.CryptoBadge
import com.lamahuissn.currency.data.Currencies
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CryptoBadgeTest {
    @Test
    fun everyCoinHasItsOwnColour() {
        Currencies.crypto.forEach { assertTrue(it.code, CryptoBadge.isCoin(it.code)) }
        val colours = Currencies.crypto.map { CryptoBadge.colourOf(it.code) }
        assertTrue(colours.none { it == 0xFF26262A })
    }

    @Test
    fun fiatAndMetalsAreNotCoins() {
        assertFalse(CryptoBadge.isCoin("USD"))
        assertFalse(CryptoBadge.isCoin("XAU"))
    }

    @Test
    fun longTickersGetSmallerText() {
        assertTrue(CryptoBadge.fontScale("DOGE") < CryptoBadge.fontScale("BTC"))
        assertEquals(0.30f, CryptoBadge.fontScale("ETH"), 0f)
    }
}
