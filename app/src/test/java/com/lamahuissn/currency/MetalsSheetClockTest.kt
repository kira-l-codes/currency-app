package com.lamahuissn.currency

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.ui.CurrencyTheme
import com.lamahuissn.currency.ui.MetalsSheet
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The label has to age while the sheet is open.
 *
 * The review's finding was that the age was computed once per composition, so a failed or repeated
 * poll left "LIVE" on screen long after the price stopped being live. This drives the real sheet with
 * a movable clock and asserts the label crosses the boundary on its own tick.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36], qualifiers = "w411dp-h891dp")
class MetalsSheetClockTest {

    @get:Rule
    val compose = createComposeRule()

    private val goldUsd = 3620.0
    private val rates = mapOf("USD" to 1.0, "XAU" to Metals.perUsd(goldUsd))

    @Test
    fun `the label ages without a new publication`() {
        var clock = 1_790_000_000_000L
        val publishedAt = clock - 70_000        // 70 s old: still live at the first frame

        compose.setContent {
            CurrencyTheme {
                MetalsSheet(
                    code = "XAU",
                    rates = rates,
                    publishedAt = publishedAt,
                    onDismiss = {},
                    nowMsProvider = { clock },
                )
            }
        }

        compose.onNodeWithText("LIVE").assertIsDisplayed()

        // No new price arrives; only time passes. 70 s + 20 s crosses the 75 s live window.
        clock += 20_000
        compose.mainClock.advanceTimeBy(PriceMotionTick * 2)
        compose.waitForIdle()

        compose.onNodeWithText("DELAYED").assertIsDisplayed()
    }

    @Test
    fun `a price with no publication time never claims to be live`() {
        compose.setContent {
            CurrencyTheme {
                MetalsSheet(
                    code = "XAU",
                    rates = rates,
                    publishedAt = null,
                    onDismiss = {},
                    nowMsProvider = { 1_790_000_000_000L },
                )
            }
        }
        compose.onNodeWithText("AGE UNKNOWN").assertIsDisplayed()
    }

    private companion object {
        /** Two freshness ticks, in milliseconds, typed here so the test states the advance clearly. */
        const val PriceMotionTick = 15_000L
    }
}
