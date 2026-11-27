package com.lamahuissn.currency.data

import android.content.Context
import org.json.JSONObject

/**
 * What the owner chose, kept across launches: the base currency and amount, the rows he watches,
 * the last rate table (so the list is readable with no network), and the chart's pair.
 */
class Prefs(context: Context) {

    private val sp = context.getSharedPreferences("currency", Context.MODE_PRIVATE)

    var base: String
        get() = sp.getString("base", DEFAULT_BASE) ?: DEFAULT_BASE
        set(value) = sp.edit().putString("base", value).apply()

    var amount: Double
        get() = sp.getString("amountStr", null)?.toDoubleOrNull()
            ?: sp.getFloat("amount", 1f).toDouble()   // installs written before the fix
        set(value) = sp.edit().putString("amountStr", value.toString()).apply()

    var targets: List<String>
        get() {
            val raw = sp.getString("targets", null) ?: return DEFAULT_TARGETS
            return raw.split(',').filter { it.isNotBlank() }
        }
        set(value) = sp.edit().putString("targets", value.joinToString(",")).apply()

    /** Codes pinned to the top of the list, in the order they were pinned. */
    var pinned: List<String>
        get() {
            val raw = sp.getString("pinned", null) ?: return emptyList()
            return raw.split(',').filter { it.isNotBlank() }
        }
        set(value) = sp.edit().putString("pinned", value.joinToString(",")).apply()

    /** Touch sound on/off, from the list menu. Default on. */
    var soundOn: Boolean
        get() = sp.getBoolean("soundOn", true)
        set(value) = sp.edit().putBoolean("soundOn", value).apply()

    /**
     * Optional street rate for the Lebanese pound, in LBP per 1 USD. Null means off: the automatic
     * rate is used. Kept apart from [cachedRates] so a refresh never overwrites it and turning it
     * off brings the automatic rate straight back.
     */
    var lbpManual: Double?
        get() = sp.getString("lbpManual", null)?.toDoubleOrNull()?.takeIf { it > 0.0 && it.isFinite() }
        set(value) {
            if (value != null && value > 0.0 && value.isFinite()) {
                sp.edit().putString("lbpManual", value.toString()).apply()
            } else {
                sp.edit().remove("lbpManual").apply()
            }
        }

    /** Set once, on the update that brought gold and silver into the list. */
    var metalsSeeded: Boolean
        get() = sp.getBoolean("metalsSeeded", false)
        set(value) = sp.edit().putBoolean("metalsSeeded", value).apply()

    var updatedAt: Long
        get() = sp.getLong("updatedAt", 0L)
        set(value) = sp.edit().putLong("updatedAt", value).apply()

    var cachedRates: Map<String, Double>
        get() {
            val raw = sp.getString("rates", null) ?: return emptyMap()
            val out = HashMap<String, Double>()
            try {
                val json = JSONObject(raw)
                for (code in json.keys()) out[code] = json.getDouble(code)
            } catch (e: Exception) {
                return emptyMap()
            }
            return out
        }
        set(value) {
            val json = JSONObject()
            for ((code, rate) in value) json.put(code, rate)
            sp.edit().putString("rates", json.toString()).apply()
        }

    /**
     * What each metal's last accepted publication said, so a restart can tell the row's age and
     * refuse an older publication instead of accepting it as new. One line per metal:
     * `CODE|ounceUsd|publishedAtMs|seq`.
     *
     * The numeric rate in [cachedRates] alone lost the publication time, which is why a restarted
     * app could not say how old gold was, and why the first refresh after a restart looked like news.
     */
    var metalBook: String
        get() = sp.getString("metalBook", "") ?: ""
        set(value) = sp.edit().putString("metalBook", value).apply()

    var chartBase: String
        get() = sp.getString("chartBase", "EUR") ?: "EUR"
        set(value) = sp.edit().putString("chartBase", value).apply()

    var chartQuote: String
        get() = sp.getString("chartQuote", "USD") ?: "USD"
        set(value) = sp.edit().putString("chartQuote", value).apply()

    var chartPeriod: String
        get() = sp.getString("chartPeriod", "3M") ?: "3M"
        set(value) = sp.edit().putString("chartPeriod", value).apply()

    companion object {
        const val DEFAULT_BASE = "USD"
        val DEFAULT_TARGETS = listOf("LBP", "EGP", "TRY", "EUR", "INR", "GBP", "DKK", "BTC", "SYP", "NGN", "SAR")
    }
}
