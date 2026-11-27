package com.lamahuissn.currency.data

/** What a coin badge looks like: colours match the web badges so both builds read the same. */
object CryptoBadge {
    private val colours: Map<String, Long> = mapOf(
        "BTC" to 0xFFF7931A, "ETH" to 0xFF627EEA, "USDT" to 0xFF26A17B, "USDC" to 0xFF2775CA,
        "BNB" to 0xFFC99400, "SOL" to 0xFF8A4DE8, "XRP" to 0xFF3A4650, "ADA" to 0xFF2A6FD6,
        "DOGE" to 0xFFC2A633, "TRX" to 0xFFD6342B, "TON" to 0xFF0098EA, "LINK" to 0xFF2A5ADA,
        "DOT" to 0xFFD0107A, "LTC" to 0xFF5C6B7A, "BCH" to 0xFF2FA84F, "XLM" to 0xFF4A5560,
    )

    fun isCoin(code: String): Boolean = CurrencyCatalog.crypto.any { it.code == code }

    fun colourOf(code: String): Long = colours[code] ?: 0xFF26262A

    /** Font size as a share of the disc, smaller for longer tickers so they stay inside it. */
    fun fontScale(code: String): Float = when {
        code.length <= 3 -> 0.30f
        else -> 0.24f
    }
}
