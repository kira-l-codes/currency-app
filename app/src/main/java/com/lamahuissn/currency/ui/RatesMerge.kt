package com.lamahuissn.currency.ui

import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.PriceMotion
import com.lamahuissn.currency.data.Tick

/**
 * The two merges the refresh path actually performs, as plain functions.
 *
 * They live outside the ViewModel because the review's point was fair: a test that calls a helper
 * the production path never calls proves nothing. [AppViewModel.refresh] and
 * [AppViewModel.refreshMetals] call exactly these, and so do the tests.
 */
object RatesMerge {

    /**
     * Folds a fresh metal read into what the app already knows.
     *
     * Returns **every** publication known — not just this round's — plus whether anything moved.
     * The earlier version returned only the changes, and the caller wrote that into the state, so a
     * refresh that landed between two 30-second publications (or that failed the metal fetch while
     * fiat succeeded) deleted gold and silver from the list and from the cache.
     */
    fun motion(
        previous: Map<String, MetalMotion>,
        quotes: Map<String, Metals.Quote>,
        receivedAt: Long,
    ): Pair<Map<String, MetalMotion>, Boolean> {
        if (quotes.isEmpty()) return previous to false
        val next = previous.toMutableMap()
        var moved = false
        quotes.forEach { (code, quote) ->
            val before = previous[code]
            val stamp = quote.atMs.takeIf { it > 0L } ?: receivedAt
            // An older or repeated publication is not news: ignore it silently.
            if (!PriceMotion.accept(quote.ounceUsd, stamp, before?.atMs ?: 0L)) return@forEach
            next[code] = MetalMotion(
                ounceUsd = quote.ounceUsd,
                atMs = stamp,
                receivedAt = receivedAt,
                tick = PriceMotion.tick(before?.ounceUsd, quote.ounceUsd),
                seq = (before?.seq ?: 0) + 1,
            )
            moved = true
        }
        return next to moved
    }

    /**
     * The metal entries for the conversion table: what is already priced, overlaid with anything
     * accepted this round. Fiat rows are not touched here — the caller merges this on top of the
     * fresh fiat table, so a metal failure can never empty the currency list, and a fiat success can
     * never invent a metal price.
     */
    fun metalPrices(
        previousTable: Map<String, Double>,
        motion: Map<String, MetalMotion>,
    ): Map<String, Double> {
        val kept = previousTable.filterKeys { Metals.isMetal(it) }
        return kept + motion.mapValues { Metals.perUsd(it.value.ounceUsd) }
    }

    /**
     * The metal book as one stored line per metal: `CODE|ounceUsd|publishedAtMs|seq`.
     *
     * The numeric rate table alone cannot answer "how old is this gold price", so the publication
     * time has to be stored with it. Anything unreadable is dropped rather than guessed at.
     */
    fun encodeBook(motion: Map<String, MetalMotion>): String =
        motion.entries
            .filter { it.value.ounceUsd > 0 && it.value.atMs > 0 }
            .joinToString("\n") { (code, m) -> "$code|${m.ounceUsd}|${m.atMs}|${m.seq}" }

    /** Reads [encodeBook] back. A restored price has no direction: nothing moved while we slept. */
    fun decodeBook(raw: String): Map<String, MetalMotion> {
        if (raw.isBlank()) return emptyMap()
        val out = LinkedHashMap<String, MetalMotion>()
        raw.split('\n').forEach { line ->
            val parts = line.split('|')
            if (parts.size != 4) return@forEach
            val code = parts[0].trim()
            val usd = parts[1].toDoubleOrNull() ?: return@forEach
            val at = parts[2].toLongOrNull() ?: return@forEach
            val seq = parts[3].toIntOrNull() ?: return@forEach
            if (code.isEmpty() || usd <= 0.0 || at <= 0L) return@forEach
            out[code] = MetalMotion(
                ounceUsd = usd,
                atMs = at,
                receivedAt = at,      // the age of the price is the age of its publication
                tick = Tick.Flat,
                seq = seq,
            )
        }
        return out
    }

    /**
     * The table after a refresh: the fiat/crypto answer as the base, then the metals carried over
     * from the previous table unless a newer publication replaced them.
     */
    fun table(
        fiatTable: Map<String, Double>,
        previousTable: Map<String, Double>,
        motion: Map<String, MetalMotion>,
    ): Map<String, Double> = fiatTable + metalPrices(previousTable, motion)
}
