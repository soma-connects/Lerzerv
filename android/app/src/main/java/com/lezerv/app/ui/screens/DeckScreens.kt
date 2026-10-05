package com.lezerv.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.PAY_METHODS
import com.lezerv.app.data.artisan
import com.lezerv.app.data.naira
import com.lezerv.app.state.ClientJob
import com.lezerv.app.state.LezervState
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.PrimaryButton
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.components.blueprint
import com.lezerv.app.ui.components.borderBottom
import com.lezerv.app.ui.components.borderLeft
import com.lezerv.app.ui.components.borderTop
import com.lezerv.app.ui.components.tap
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.body
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label

// Pieces from the first design ("Lezerv App Deck"), restyled for v2.

// ───────────────────────────── pay into escrow (slide 8) ─────────────────────────────

/** PROPOSAL: Paystack isn't connected yet, so the chosen method is recorded but not charged. */
@Composable
fun PaySheet(s: LezervState) {
    val a = artisan(s.bookArtisan) ?: return
    val b = s.bookTotal()
    Box(Modifier.fillMaxSize().background(Lz.Scrim).tap { s.closePay() }, contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(2.dp, Lz.Ink).tap { }.verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 20.dp, bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Txt("PAY INTO ESCROW", heading(34, 34, weight = 700), Modifier.weight(1f))
                IconBox("x", { s.closePay() }, size = 40, iconSize = 22, border = null, modifier = Modifier.semantics { contentDescription = "Close" })
            }
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Txt("NGN", heading(20, weight = 700), Modifier.padding(bottom = 8.dp))
                Txt(naira(b.total).removePrefix("₦"), heading(60, 56, weight = 700))
            }
            Txt("Held by Lezerv until you confirm the job is done. ${a.first} receives ${naira(s.artisanTakeHome(b))} after 20% commission.",
                body(14, 20, color = Lz.Neutral800), Modifier.padding(top = 6.dp, bottom = 16.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PAY_METHODS.forEachIndexed { i, m ->
                    val on = s.payMethod == i
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 60.dp).background(if (on) Lz.Accent100 else Color.Transparent).border(1.dp, if (on) Lz.Accent else Lz.Divider)
                            .tap { s.payMethod = i }.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        LzIcon(m.icon, 22, if (on) Lz.Accent800 else Lz.Ink)
                        Column(Modifier.weight(1f)) {
                            Txt(m.title.uppercase(), heading(20, 22, tracking = .03f))
                            Txt(if (i == 1) s.account.defaultCard?.let { "${it.label} · or a new card" } ?: m.sub else m.sub, body(12, 16, color = Lz.Neutral700))
                        }
                        if (on) LzIcon("check", 20, Lz.Accent700)
                    }
                }
            }
            Row(Modifier.padding(top = 14.dp).fillMaxWidth().background(Lz.Accent100).border(1.dp, Lz.Accent).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LzIcon("info", 16, Lz.Accent800)
                Txt("Preview. Card and escrow switch on when Paystack is connected.", body(12, 17, color = Lz.Accent800))
            }
            PrimaryButton({ s.pay() }, Modifier.padding(top = 16.dp).fillMaxWidth(), minHeight = 54.dp) {
                Txt("PAY ${naira(b.total)}", heading(20, tracking = .05f, color = Color.White), Modifier.weight(1f))
                LzIcon("lock", 22, Color.White)
            }
        }
    }
}

// ───────────────────────────── job spec block (slide 7) ─────────────────────────────

/** Status pill per stage, using the Board's pill styles (fill strength rises with progress). */
internal fun statusPill(j: ClientJob): Triple<String, Color, Color> {
    val labels = if (j.laundry) listOf("Matched", "Rider coming", "Picked up", "Washing", "Delivering", "Completed")
    else listOf("Matched", "On the way", "Arrived", "In progress", "Completed")
    return when {
        j.stage == j.lastStage -> Triple(labels[j.stage], Lz.Accent800, Lz.Bg)
        j.stage == 0 -> Triple(labels[0], Lz.Accent200, Lz.Accent900)
        else -> Triple(labels[j.stage], Lz.Accent, Lz.Bg)
    }
}

/** Engineering title-block of the job: number, status, service, when; then what's in escrow. */
@Composable
fun JobSpec(j: ClientJob, service: String, modifier: Modifier = Modifier) {
    val (pill, pbg, pfg) = statusPill(j)
    Column(modifier.fillMaxWidth().blueprint().border(1.dp, Lz.Divider)) {
        Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider)) {
            SpecCell("Job no.", Modifier.weight(1f)) { Txt(j.number, heading(22)) }
            SpecCell("Status", Modifier.weight(1f).borderLeft(1.dp, Lz.Divider)) {
                Box(Modifier.background(pbg).padding(horizontal = 8.dp, vertical = 3.dp)) { Txt(pill.uppercase(), label(11, .08f, pfg)) }
            }
        }
        Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider)) {
            SpecCell("Service", Modifier.weight(1f)) { Txt(service.uppercase(), heading(20)) }
            SpecCell(if (j.laundry) "Pickup" else "When", Modifier.weight(1f).borderLeft(1.dp, Lz.Divider)) { Txt(j.whenLabel.uppercase(), heading(20), ellipsis = true) }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            LzIcon("lock", 16, Lz.Accent700)
            Txt("Held in escrow · ${j.payMethod}", body(13, color = Lz.Neutral800), Modifier.weight(1f))
            Txt(naira(j.total), body(14, weight = 700))
        }
    }
}

@Composable
private fun SpecCell(k: String, modifier: Modifier, value: @Composable () -> Unit) {
    Column(modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Txt(k.uppercase(), label(10, color = Lz.Neutral700))
        value()
    }
}

// ───────────────────────────── "needs your reply" (slide 6) ─────────────────────────────

@Composable
fun NeedsReplyCard(title: String, text: String, onTap: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().blueprint().background(Lz.Accent100).border(1.dp, Lz.Accent).tap(onClick = onTap).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        LzIcon("circle-alert", 22, Lz.Accent800)
        Column(Modifier.weight(1f)) {
            Txt("NEEDS YOUR REPLY", label(color = Lz.Accent800))
            Txt(title.uppercase(), heading(20, 22))
            Txt(text, body(12, 16, color = Lz.Accent800))
        }
        LzIcon("chevron-right", 20)
    }
}

// ───────────────────────────── chat pieces (slide 9) ─────────────────────────────

@Composable
fun ChatProtectionBanner() {
    Row(
        Modifier.fillMaxWidth().background(Lz.Accent100).borderBottom(1.dp, Lz.Accent).padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LzIcon("lock", 16, Lz.Accent800)
        Txt("Phone numbers, emails and links are hidden. Keep chat and payment on Lezerv.", body(12, 17, color = Lz.Accent800))
    }
}

/** Centred dashed line Lezerv writes into the thread. */
@Composable
fun SystemLine(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(horizontal = 16.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.dashedBorder(Lz.Neutral500).padding(horizontal = 12.dp, vertical = 8.dp)) {
            Txt(text, body(12, 17, color = Lz.Neutral800).copy(textAlign = androidx.compose.ui.text.style.TextAlign.Center))
        }
    }
}

