package com.lamahuissn.currency

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.lamahuissn.currency.data.CountPrefs
import com.lamahuissn.currency.data.CountState
import com.lamahuissn.currency.data.Prefs
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * The audit found the amount saved as a `Float`: 1,234,567.89 came back as 1,234,567.9. Money that
 * silently loses cents on the way to disk is worse than money that fails to save.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class PrefsPrecisionTest {

    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun `a typed amount survives a round trip to the last cent`() {
        val prefs = Prefs(context)
        prefs.amount = 1_234_567.89
        assertEquals(1_234_567.89, prefs.amount, 0.0)
    }

    @Test
    fun `a long cash amount keeps every digit`() {
        val prefs = Prefs(context)
        prefs.amount = 89_550_064.12
        assertEquals(89_550_064.12, prefs.amount, 0.0)
    }

    @Test
    fun `an install written as a float is still read`() {
        // What the previous build left behind.
        context.getSharedPreferences("currency", Context.MODE_PRIVATE)
            .edit().putFloat("amount", 12.5f).apply()
        assertEquals(12.5, Prefs(context).amount, 0.0)
    }

    @Test
    fun `the expected amount keeps its cents`() {
        val prefs = CountPrefs(context)
        prefs.save(CountState(expected = 1_000.07))
        assertEquals(1_000.07, CountPrefs(context).load().expected, 0.0)
    }
}
