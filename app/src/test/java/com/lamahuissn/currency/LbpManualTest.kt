package com.lamahuissn.currency

import com.lamahuissn.currency.ui.ConvertUi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** The optional manual Lebanese pound rate: replaces LBP only, and off means the automatic rate. */
class LbpManualTest {

    private val auto = ConvertUi(
        base = "USD",
        amount = 1.0,
        usdTo = mapOf("USD" to 1.0, "LBP" to 89_500.0, "EUR" to 0.92),
    )

    @Test fun offByDefaultUsesAutomaticRate() {
        assertNull(auto.lbpManual)
        assertEquals(89_500.0, auto.converted("LBP")!!, 1e-6)
    }

    @Test fun manualRateReplacesOnlyLbp() {
        val manual = auto.copy(lbpManual = 90_000.0)
        assertEquals(90_000.0, manual.converted("LBP")!!, 1e-6)
        assertEquals(0.92, manual.converted("EUR")!!, 1e-9)
        assertEquals(1.0, manual.copy(base = "LBP", amount = 90_000.0).converted("USD")!!, 1e-9)
    }

    @Test fun savedTableIsNeverTouched() {
        val manual = auto.copy(lbpManual = 90_000.0)
        assertEquals(89_500.0, manual.usdTo["LBP"]!!, 0.0)
    }

    @Test fun turningItOffBringsBackTheAutomaticRate() {
        val back = auto.copy(lbpManual = 90_000.0).copy(lbpManual = null)
        assertEquals(89_500.0, back.converted("LBP")!!, 1e-6)
    }
}
