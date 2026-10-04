package com.lezerv.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.REVIEW_TAGS
import com.lezerv.app.data.artisan
import com.lezerv.app.data.naira
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Role
import com.lezerv.app.ui.components.ChoiceChip
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.Initials
import com.lezerv.app.ui.components.OutlineButton
import com.lezerv.app.ui.components.PrimaryWide
import com.lezerv.app.ui.components.SectionRule
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

// ───────────────────────────── jobs ─────────────────────────────

@Composable
fun ClientJobsScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
        SectionRule("01", "Active", Modifier.padding(top = 20.dp, bottom = 12.dp))
        val j = s.job
        val a = s.jobArtisan
        if (j != null && a != null) {
            val c = trackCopy(j, a)
            val eta = if (j.moving) " · ${com.lezerv.app.data.pad2(etaMinutes(j, a))} min" else ""
            Row(
                Modifier.padding(horizontal = 20.dp).fillMaxWidth().blueprint().background(Lz.Accent100).border(1.dp, Lz.Accent).tap { s.push(Pushed.Track) }.padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                LzIcon(if (j.laundry) "truck" else "navigation", 26, Lz.Accent700)
                Column(Modifier.weight(1f)) {
                    Txt(c.kicker.uppercase(), label(color = Lz.Accent800))
                    Txt(j.title.uppercase(), heading(22, 24, weight = 700))
                    Txt("${a.name} · ${c.status}$eta", body(13, color = Lz.Accent800))
                }
                LzIcon("chevron-right", 20)
            }
        } else {
            Txt("Nothing in progress. Find someone on the map to get started.", body(14, 20, color = Lz.Neutral800), Modifier.padding(horizontal = 20.dp))
        }
        SectionRule("02", "Past", Modifier.padding(top = 28.dp, bottom = 4.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            s.past.forEach { p ->
                val pa = artisan(p.artisanId) ?: return@forEach
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Txt(p.title.uppercase(), heading(20, 22))
                        Txt("${pa.name} · ${p.date} · ${naira(p.total)}", body(12, color = Lz.Neutral800))
                    }
                    OutlineButton("Book again", { s.startBooking(pa.id) }, icon = "refresh-cw", height = 40.dp, fontSize = 15)
                }
            }
        }
    }
}

// ───────────────────────────── messages ─────────────────────────────

@Composable
fun MessagesScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        s.messages.keys.filter { it != "client" }.forEach { k ->
            val a = artisan(k) ?: return@forEach
            val last = s.messages.getValue(k).last()
            Row(
                Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).tap { s.openChat(k) }.padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Initials(a.ini, 48, 52, 20)
                Column(Modifier.weight(1f)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Txt(a.name.uppercase(), heading(20, 22), Modifier.weight(1f), ellipsis = true)
                        Txt(last.at, body(11, color = Lz.Neutral700))
                    }
                    Txt((if (last.me) "You: " else "") + last.text, body(13, 18, color = Lz.Neutral800), ellipsis = true)
                }
            }
        }
        Row(Modifier.padding(20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            LzIcon("eye-off", 18, Lz.Accent)
            Txt("Phone numbers, emails and links are hidden in chat. Calls go through a Lezerv number.", body(12, 18, color = Lz.Neutral800))
        }
    }
}

@Composable
fun ChatScreen(s: LezervState) {
    val msgs = s.chatMessages
    val scroll = rememberScrollState()
    LaunchedEffect(msgs.size) { scroll.scrollTo(scroll.maxValue) }
    Column(Modifier.fillMaxSize()) {
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val maxBubble = maxWidth * 0.78f
            Column(Modifier.fillMaxSize().verticalScroll(scroll).padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                msgs.forEach { m ->
                    Column(
                        Modifier.align(if (m.me) Alignment.End else Alignment.Start).widthIn(max = maxBubble)
                            .background(if (m.me) Lz.Accent else Color.Transparent).border(1.dp, if (m.me) Lz.Accent else Lz.Ink).padding(horizontal = 12.dp, vertical = 10.dp),
                    ) {
                        val fg = if (m.me) Color.White else Lz.Ink
                        Txt(m.text, body(14, 20, color = fg))
                        Txt(m.at + if (m.masked) " · details hidden" else "", body(10, color = fg.copy(alpha = .7f)), Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth().borderTop(2.dp, Lz.Ink).padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BasicTextField(
                s.draft, { s.draft = it },
                Modifier.weight(1f).height(48.dp).border(1.dp, Lz.Ink).padding(horizontal = 12.dp),
                singleLine = true, textStyle = body(15), cursorBrush = SolidColor(Lz.Accent),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send), keyboardActions = KeyboardActions(onSend = { s.send() }),
                decorationBox = { inner -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) { if (s.draft.isEmpty()) Txt("Message", body(15, color = Lz.Neutral600)); inner() } },
            )
            IconBox("send", { s.send() }, bg = Lz.Accent, fg = Color.White, border = null, modifier = Modifier.semantics { contentDescription = "Send" })
        }
    }
}

// ───────────────────────────── account ─────────────────────────────

internal data class AccountRow(val icon: String, val title: String, val sub: String, val onTap: (() -> Unit)? = null)

@Composable
internal fun AccountRows(rows: List<AccountRow>, modifier: Modifier = Modifier) {
    Column(modifier) {
        rows.forEach { r ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = 60.dp).borderBottom(1.dp, Lz.Divider).then(if (r.onTap != null) Modifier.tap(onClick = r.onTap) else Modifier),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                LzIcon(r.icon, 22, Lz.Accent)
                Column(Modifier.weight(1f)) {
                    Txt(r.title, body(15, weight = 600))
                    Txt(r.sub, body(12, color = Lz.Neutral700))
                }
                LzIcon("chevron-right", 18)
            }
        }
    }
}

@Composable
internal fun AccountHeader(ini: String, name: String, sub: @Composable () -> Unit) {
    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Initials(ini, 64, 68, 28, solid = true)
        Column { Txt(name.uppercase(), heading(28, 28, weight = 700)); sub() }
    }
}

/** Demo-only rows: switch role and reset, replacing the prototype's side panel. */
internal fun demoRows(s: LezervState): List<AccountRow> = if (!s.demo) emptyList() else listOf(
    AccountRow("refresh-cw", "Demo · switch to ${if (s.role == Role.Client) "artisan" else "client"}", "See the other side of a job") { s.switchRole(if (s.role == Role.Client) Role.Artisan else Role.Client) },
    AccountRow("refresh-cw", "Demo · reset", "Start the demo from the beginning") { s.reset() },
)

@Composable
fun ClientAccountScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        AccountHeader("AO", "Amaka Obi") { Txt("+234 803 ••• 4417 · Lekki Phase 1", body(13, color = Lz.Neutral800)) }
        AccountRows(
            listOf(
                AccountRow("map-pin", "Saved addresses", "Home · 12 Admiralty Way") { s.toast("Saved addresses") },
                AccountRow("credit-card", "Payment methods", "Card ••2291 · Bank transfer") { s.toast("Payment methods") },
                AccountRow("shield-check", "Safety", "Start codes, masked calls, trusted contacts") { s.toast("Safety centre") },
                AccountRow("wrench", "Become an artisan", "Earn with Lezerv in your area") { if (s.demo) s.switchRole(Role.Artisan) else s.toast("Artisan sign-up") },
                AccountRow("life-buoy", "Help", "Chat with Lezerv support") { s.toast("Support") },
            ) + demoRows(s),
            Modifier.padding(horizontal = 20.dp).borderTop(2.dp, Lz.Ink),
        )
    }
}

// ───────────────────────────── review + release payment ─────────────────────────────

@Composable
fun ReviewSheet(s: LezervState) {
    val j = s.job ?: return
    val a = s.jobArtisan ?: return
    Box(Modifier.fillMaxSize().background(Lz.Scrim).tap { }, contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(2.dp, Lz.Ink).tap { }.padding(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 22.dp)) {
            Box(Modifier.fillMaxWidth().padding(bottom = 10.dp), contentAlignment = Alignment.Center) { Box(Modifier.size(40.dp, 4.dp).background(Lz.Neutral500)) }
            Txt("JOB DONE", label(color = Lz.Accent700))
            Txt("HOW DID ${a.first.uppercase()} DO?", heading(34, 34, weight = 700), Modifier.padding(top = 4.dp, bottom = 16.dp))
            Row(Modifier.fillMaxWidth().border(1.dp, Lz.Ink)) {
                (1..5).forEach { n ->
                    val on = s.stars >= n
                    Box(
                        Modifier.weight(1f).height(56.dp).then(if (n > 1) Modifier.borderLeft(1.dp, Lz.Divider) else Modifier)
                            .background(if (on) Lz.Accent100 else Color.Transparent).tap { s.stars = n }.semantics { contentDescription = "$n stars" },
                        contentAlignment = Alignment.Center,
                    ) { LzIcon("star", 26, if (on) Lz.Accent else Lz.Neutral600, filled = on) }
                }
            }
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                REVIEW_TAGS.forEach { t -> ChoiceChip(t, t in s.reviewTags, { s.toggleTag(t) }) }
            }
            Row(Modifier.padding(top = 16.dp).fillMaxWidth().borderTop(2.dp, Lz.Ink).padding(vertical = 12.dp)) {
                Txt("Release to ${a.first}", body(14), Modifier.weight(1f))
                Txt(naira(j.total), body(14, weight = 700))
            }
            PrimaryWide("Submit and release payment", "check", { s.submitReview() })
        }
    }
}
