package com.lamahuissn.currency.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lamahuissn.currency.data.FeedState
import com.lamahuissn.currency.data.Metals
import com.lamahuissn.currency.data.PriceMotion
import kotlinx.coroutines.delay

/**
 * The gold and silver sheet: the ounce price, then the grams a jeweller actually quotes — 24, 22, 21
 * and 18 karat, plus the Lebanese gold pound. All in USD, as asked; the app's own rates stay in the
 * currency list and are not mixed in here.
 */
@Composable
fun MetalsSheet(
    code: String,
    rates: Map<String, Double>,
    /**
     * The provider's publication time for THIS metal, or null when the feed gave none.
     * Freshness is derived from it against a clock that keeps moving while the sheet is open, so a
     * failed or repeated poll cannot leave a stale label on screen. A fresh gold publication never
     * makes a stale silver sheet look fresh.
     */
    publishedAt: Long?,
    onDismiss: () -> Unit,
    /**
     * The clock this sheet reads. It is a parameter so a test can move time without waiting, and so
     * the age is computed from one explicit source rather than from ambient calls scattered around.
     */
    nowMsProvider: () -> Long = { System.currentTimeMillis() },
) {
    val ounce = Metals.ounceUsd(rates[code] ?: 0.0)
    val isGold = code == "XAU"

    // The age has to advance on its own. Recomputing only when the caller recomposes meant a sheet
    // left open during a failed feed kept saying LIVE; this ticker re-reads the clock every 15 s
    // while the sheet is composed (it stops when the sheet closes).
    var nowMs by remember { mutableLongStateOf(nowMsProvider()) }
    LaunchedEffect(publishedAt) {
        if (publishedAt == null) return@LaunchedEffect
        while (true) {
            delay(PriceMotion.FRESHNESS_TICK_MS)
            nowMs = nowMsProvider()
        }
    }
    val feed = PriceMotion.stateAt(ounce > 0.0, publishedAt, nowMs)
    val feedLabel = when (feed) {
        FeedState.Live -> "LIVE"
        FeedState.Delayed -> "DELAYED"
        FeedState.Offline -> "OFFLINE"
        null -> "AGE UNKNOWN"
    }
    val feedColor = when (feed) {
        FeedState.Live -> Ink.Green
        FeedState.Delayed -> Ink.Amber
        FeedState.Offline -> Ink.Red
        null -> Ink.Muted
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.66f))
            .combinedClickable(onClick = onDismiss, onLongClick = onDismiss),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .background(Ink.Surface)
                    .padding(bottom = 24.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, top = 18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = "${Metals.name(code).uppercase()} · SPOT",
                            color = Ink.Muted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            letterSpacing = 1.sp,
                        )
                        Text(
                            text = if (ounce > 0) Metals.money(ounce) else "—",
                            color = Ink.Text,
                            fontSize = 34.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = (-1).sp,
                            style = TextStyle(fontFeatureSettings = "tnum"),
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(feedColor))
                            Spacer(Modifier.width(6.dp))
                            Text(
                                feedLabel,
                                color = feedColor,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.8.sp,
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                text = "per troy ounce · USD" + when {
                                    publishedAt != null -> " · ${CountScreenTime.format(publishedAt)}"
                                    ounce > 0.0 -> " · update time unknown"
                                    else -> ""
                                },
                                color = Color(0xFF93BBA6),
                                fontSize = 11.sp,
                            )
                        }
                    }
                    Box(
                        Modifier
                            .height(30.dp)
                            .clip(RoundedCornerShape(15.dp))
                            .background(Ink.SurfaceHigh)
                            .combinedClickable(onClick = onDismiss, onLongClick = onDismiss)
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("Close", color = Ink.Text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }

                Spacer(Modifier.height(16.dp))

                if (ounce <= 0) {
                    Text(
                        "No price yet. Pull the list down to refresh once you are online.",
                        color = Ink.Muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp),
                    )
                    return@Column
                }

                MetalRow("1 troy ounce", Metals.money(ounce), strong = true)
                if (isGold) {
                    MetalRow("Gram · 24k", Metals.money(Metals.gramUsd(ounce, 24)))
                    MetalRow("Gram · 22k", Metals.money(Metals.gramUsd(ounce, 22)))
                    MetalRow("Gram · 21k", Metals.money(Metals.gramUsd(ounce, 21)))
                    MetalRow("Gram · 18k", Metals.money(Metals.gramUsd(ounce, 18)))
                    MetalRow(
                        "Gold pound · 21k · ${Metals.POUND_GRAMS} g",
                        Metals.money(Metals.poundUsd(ounce)),
                        spaced = true,
                    )
                } else {
                    MetalRow("Gram · fine (999)", Metals.money(Metals.gramUsd(ounce, 24)))
                }

                Text(
                    text = "Spot price in USD. Jewellers add a premium over this for worked gold.",
                    color = Ink.Muted.copy(alpha = 0.7f),
                    fontSize = 11.sp,
                    modifier = Modifier.padding(start = 18.dp, end = 18.dp, top = 14.dp),
                )
            }
        }
    }
}

@Composable
private fun MetalRow(label: String, value: String, strong: Boolean = false, spaced: Boolean = false) {
    if (spaced) Spacer(Modifier.height(8.dp))
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = if (strong) Ink.Text else Color(0xFFD7E7DD),
            fontSize = if (strong) 15.sp else 14.sp,
            fontWeight = if (strong) FontWeight.Bold else FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(12.dp))
        Text(
            value,
            color = if (strong) Ink.Green else Ink.Text,
            fontSize = if (strong) 17.sp else 15.sp,
            fontWeight = if (strong) FontWeight.ExtraBold else FontWeight.SemiBold,
            style = TextStyle(fontFeatureSettings = "tnum"),
        )
    }
}
