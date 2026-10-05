package com.lezerv.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.ARTISAN_SCHEDULE
import com.lezerv.app.data.CLIENT_HOME
import com.lezerv.app.data.DEMAND_ZONES
import com.lezerv.app.data.DEMO_START_CODE
import com.lezerv.app.data.KM
import com.lezerv.app.data.Pt
import com.lezerv.app.data.REQUEST_PIN
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.data.WEEK
import com.lezerv.app.data.naira
import com.lezerv.app.data.pad2
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.ui.components.KvLine
import com.lezerv.app.ui.components.OutlineButton
import com.lezerv.app.ui.components.PrimaryButton
import com.lezerv.app.ui.components.PrimaryWide
import com.lezerv.app.ui.components.SectionRule
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.components.blueprint
import com.lezerv.app.ui.components.borderBottom
import com.lezerv.app.ui.components.borderLeft
import com.lezerv.app.ui.components.borderTop
import com.lezerv.app.ui.components.tap
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.map.CentredMarker
import com.lezerv.app.ui.map.DemandZone
import com.lezerv.app.ui.map.MapCircle
import com.lezerv.app.ui.map.MapWorld
import com.lezerv.app.ui.map.RouteLine
import com.lezerv.app.ui.map.UserDot
import com.lezerv.app.ui.map.along
import com.lezerv.app.ui.map.centerOn
import com.lezerv.app.ui.map.routePoints
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.body
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label
import kotlin.math.ceil
import kotlin.math.roundToInt

// ───────────────────────────── map + incoming requests ─────────────────────────────

@Composable
fun ArtisanMapScreen(s: LezervState) {
    val on = s.online
    Box(Modifier.fillMaxSize()) {
        PannableMap(s) {
            DEMAND_ZONES.forEach { DemandZone(it.x, it.y, it.r, it.label) }
            MapCircle(UX, UY, s.radiusKm * KM / 2, Lz.Ink, alpha = .55f)
            if (s.requestOpen) HomePin(REQUEST_PIN.x, REQUEST_PIN.y)
            UserDot()
        }

        // online / offline switch
        Row(
            Modifier.padding(12.dp).fillMaxWidth().blueprint().heightIn(min = 60.dp).shadow(4.dp)
                .background(if (on) Lz.Accent else Lz.Bg).border(2.dp, if (on) Lz.Accent else Lz.Ink).padding(start = 14.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val fg = if (on) Color.White else Lz.Ink
            Column(Modifier.weight(1f)) {
                Txt(if (on) "ONLINE" else "OFFLINE", heading(24, 24, weight = 700, color = fg))
                Txt(if (on) "Receiving requests within ${s.radiusKm} km" else "Go online to receive job requests", body(12, color = fg.copy(alpha = .85f)))
            }
            Box(
                Modifier.size(64.dp, 36.dp).background(if (on) Color.White else Color.Transparent).border(2.dp, if (on) Color.White else Lz.Ink)
                    .tap { s.toggleOnline() }.semantics { contentDescription = "Online"; stateDescription = if (on) "On" else "Off" }.padding(3.dp),
                contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
            ) { Box(Modifier.size(26.dp).background(if (on) Lz.Accent else Lz.Ink)) }
        }
        Row(Modifier.padding(start = 12.dp, top = 86.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MapChip("Today ${naira(s.earnedToday)}")
            MapChip("Radius ${s.radiusKm} km")
        }
        Column(Modifier.align(Alignment.TopEnd).padding(top = 86.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BellButton(s, Modifier.shadow(1.dp), size = 48, bg = Lz.Bg, border = Lz.Ink)
            com.lezerv.app.ui.components.IconBox("locate-fixed", { s.recenter() }, iconSize = 22, bg = Lz.Bg, fg = Lz.Accent,
                modifier = Modifier.shadow(1.dp).semantics { contentDescription = "My location" })
        }

        val bottom = Modifier.align(Alignment.BottomStart).padding(12.dp).fillMaxWidth()
        when {
            s.requestOpen -> RequestCard(s, bottom)
            on && s.artisanJob == null -> Hint("timer", "Looking for jobs within ${s.radiusKm} km. Hatched areas have more requests right now.", bottom, Lz.Accent)
            !on -> Hint("power", "You won’t get requests while offline. Clients can still see your profile.", bottom)
        }
    }
}

@Composable
private fun MapChip(text: String) {
    Box(Modifier.background(Lz.Bg).border(1.dp, Lz.Ink).padding(horizontal = 10.dp, vertical = 6.dp)) { Txt(text.uppercase(), label(11, .1f)) }
}

@Composable
private fun Hint(icon: String, text: String, modifier: Modifier, tint: Color = Lz.Ink) {
    Row(modifier.background(Lz.Bg).border(1.dp, Lz.Ink).padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        LzIcon(icon, 22, tint)
        Txt(text, body(14, 20))
    }
}

/** PROPOSAL: 30-second request timer. */
@Composable
private fun RequestCard(s: LezervState, modifier: Modifier) {
    val left = (s.requestEndsAt - s.now).coerceAtLeast(0)
    Column(modifier.blueprint().shadow(12.dp).background(Lz.Bg).border(2.dp, Lz.Ink).padding(2.dp)) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Lz.Neutral200)) {
            Box(Modifier.fillMaxHeight().fillMaxWidth(left / 30_000f).background(Lz.Accent))
        }
        Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 14.dp)) {
            Row {
                Txt("NEW REQUEST · ${ceil(left / 1000.0).toInt()}S", label(color = Lz.Accent700), Modifier.weight(1f))
                Txt("0.9 KM · 4 MIN", label(11, .1f))
            }
            Txt("LEAKING KITCHEN SINK", heading(28, 30, weight = 700), Modifier.padding(top = 6.dp))
            Txt("Plumbing · Amaka O. · Lekki Phase 1 · Now", body(13, 19, color = Lz.Neutral800), Modifier.padding(top = 2.dp))
            Row(Modifier.padding(top = 12.dp, bottom = 14.dp).fillMaxWidth().borderTop(2.dp, Lz.Ink).borderBottom(1.dp, Lz.Divider).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt("Call-out, you receive", body(13), Modifier.weight(1f))
                Txt("₦6,400", heading(28, weight = 700))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlineButton("Decline", { s.declineRequest() }, Modifier.weight(1f))
                PrimaryButton({ s.acceptRequest() }, Modifier.weight(1.6f)) {
                    Txt("ACCEPT", heading(18, tracking = .05f, color = Color.White), Modifier.weight(1f))
                    LzIcon("check", 20, Color.White)
                }
            }
        }
    }
}

// ───────────────────────────── turn-by-turn to the client ─────────────────────────────

@Composable
fun ArtisanNavigateScreen(s: LezervState) {
    val job = s.artisanJob ?: return
    val pts = routePoints(Pt(UX, UY), CLIENT_HOME)
    val pos = if (job.stage == 0) along(pts, job.t) else CLIENT_HOME
    data class Stage(val kicker: String, val status: String, val big: String, val bigLabel: String, val action: Pair<String, () -> Unit>?)
    val st = when (job.stage) {
        0 -> Stage("Heading to client", "On the way", pad2(maxOf(1, ceil((1 - job.t) * 4).toInt())), "min", null)
        1 -> Stage("You have arrived", "Start the job", "—", "code", "Start job" to s::startJob)
        2 -> Stage("Timer running", "In progress", pad2(((s.now - job.startedAt) / 60_000).toInt()), "min on job", "Mark job complete" to s::completeJob)
        else -> Stage("Job complete", "Nice work", "+6.4K", "naira", "Back to map" to s::finishArtisanJob)
    }
    Column(Modifier.fillMaxSize()) {
        BoxWithConstraints(Modifier.fillMaxWidth().height(320.dp).clipToBounds()) {
            val (tx, ty) = centerOn(pts, maxWidth.value, 320f)
            MapWorld(tx, ty, s.blueprintMap) {
                RouteLine(pts, job.stage > 0)
                HomePin(REQUEST_PIN.x, REQUEST_PIN.y)
                CentredMarker(pos.x, pos.y, "navigation", 40, Lz.Accent, Color.White, Color.White, iconSize = 20, shadow = true)
            }
            Row(Modifier.padding(12.dp).fillMaxWidth().background(Lz.Ink).padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LzIcon("arrow-left", 26, Color.White, Modifier.rotate(45f)) // ↖ for "turn left" (prototype rotated 135°, which pointed ↗)
                Column {
                    Txt(if (job.stage == 0) "TURN LEFT · 200 M" else "DESTINATION", heading(22, 22, weight = 700, color = Color.White))
                    Txt(if (job.stage == 0) "onto Admiralty Way" else "12 Admiralty Way, on your right", body(12, color = Color.White.copy(alpha = .8f)))
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(2.dp).background(Lz.Ink))
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 22.dp)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Txt(st.kicker.uppercase(), label(color = Lz.Accent700))
                    Txt(st.status.uppercase(), heading(34, 34, weight = 700), Modifier.padding(top = 2.dp))
                }
                Column(horizontalAlignment = Alignment.End) {
                    Txt(st.big, heading(56, 50, weight = 700, color = Lz.Accent))
                    Txt(st.bigLabel.uppercase(), label())
                }
            }
            PersonRow("AO", "Amaka O.", "12 Admiralty Way, Lekki Phase 1", { s.toast("Calling Amaka through a Lezerv number") }, { s.push(Pushed.Chat) }, Modifier.padding(top = 14.dp))
            if (job.stage == 1) {
                Column(Modifier.padding(top = 18.dp)) {
                    Txt("ENTER THE CLIENT’S START CODE", label(), Modifier.padding(bottom = 8.dp))
                    BasicTextField(
                        s.code, { v -> s.code = v.filter(Char::isDigit).take(4) },
                        Modifier.fillMaxWidth().height(64.dp).border(2.dp, Lz.Ink).padding(horizontal = 16.dp).semantics { contentDescription = "Start code" },
                        singleLine = true, textStyle = heading(40, weight = 700, tracking = .5f), cursorBrush = SolidColor(Lz.Accent),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        decorationBox = { inner -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) { if (s.code.isEmpty()) Txt("••••", heading(40, weight = 700, tracking = .5f, color = Lz.Neutral500)); inner() } },
                    )
                    Row(Modifier.padding(top = 6.dp).fillMaxWidth()) {
                        Txt(if (s.code.length == 4) (if (s.codeOk) "Code accepted" else "That code doesn’t match") else "Ask Amaka for her code", body(12, color = Lz.Neutral700), Modifier.weight(1f))
                        if (s.demo) Txt("Demo: fill $DEMO_START_CODE", body(12, weight = 700, color = Lz.Accent700), Modifier.tap { s.code = DEMO_START_CODE })
                    }
                }
            }
            if (job.stage == 3) {
                Column(Modifier.padding(top = 16.dp)) {
                    KvLine("Call-out", "₦8,000"); KvLine("Lezerv fee (20%)", "−₦1,600"); KvLine("You earn", "₦6,400")
                    Txt("Paid to GTBank ••4821 once Amaka confirms, or automatically after 24 hours.", body(12, 18, color = Lz.Neutral700), Modifier.padding(top = 8.dp))
                }
            }
            st.action?.let { (l, f) -> PrimaryWide(l, onClick = f, modifier = Modifier.padding(top = 18.dp), alpha = if (job.stage == 1 && !s.codeOk) .5f else 1f) }
        }
    }
}

// ───────────────────────────── jobs ─────────────────────────────

@Composable
fun ArtisanJobsScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
        SectionRule("01", "Scheduled", Modifier.padding(top = 20.dp, bottom = 4.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            ARTISAN_SCHEDULE.forEach { j ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.width(64.dp)) { Txt(j.day, heading(28, 28, weight = 700)); Txt(j.month.uppercase(), label(11, .1f, Lz.Neutral700)) }
                    Column(Modifier.weight(1f)) { Txt(j.title.uppercase(), heading(19, 21)); Txt(j.sub, body(12, color = Lz.Neutral800)) }
                    Txt(j.price, heading(19))
                }
            }
        }
        SectionRule("02", "Completed", Modifier.padding(top = 28.dp, bottom = 4.dp))
        CompletedList(s, plus = false)
    }
}

@Composable
private fun CompletedList(s: LezervState, plus: Boolean) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        s.artisanPast.forEach { j ->
            Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) { Txt(j.title, body(15, weight = 600)); Txt(j.sub, body(12, color = Lz.Neutral700)) }
                Txt((if (plus) "+" else "") + naira(j.pay), heading(19, color = if (plus) Lz.Accent700 else Lz.Ink))
            }
        }
    }
}

// ───────────────────────────── earnings ─────────────────────────────

/** PROPOSAL: earnings and payouts need backend work. */
@Composable
fun EarningsScreen(s: LezervState) {
    val week = WEEK + ("S" to s.earnedToday)
    val max = week.maxOf { it.second }.coerceAtLeast(1)
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
        Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 20.dp)) {
            Txt("THIS WEEK · AFTER 20% FEE", label(color = Lz.Neutral700))
            Txt(naira(week.sumOf { it.second }), heading(64, 62, weight = 700))
        }
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp).fillMaxWidth().height(160.dp).borderBottom(2.dp, Lz.Ink), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Bottom) {
            week.forEachIndexed { i, (_, v) ->
                Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.Bottom), horizontalAlignment = Alignment.CenterHorizontally) {
                    Txt(if (v > 0) "${com.lezerv.app.data.fixed1(v / 1000.0)}k" else "—", label(9, 0f, Lz.Neutral800))
                    Box(Modifier.fillMaxWidth().height(maxOf(2f, 160f * (v.toFloat() / max * 82).roundToInt() / 100).dp).background(if (i == 6) Lz.Accent else Color.Transparent).border(1.dp, Lz.Accent))
                }
            }
        }
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            week.forEachIndexed { i, (d, _) -> Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { Txt(d, label(11, .1f, if (i == 6) Lz.Accent700 else Lz.Neutral700)) } }
        }
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp).fillMaxWidth().blueprint().border(1.dp, Lz.Ink)) {
            Column(Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 12.dp)) { Txt("AVAILABLE", label(10, color = Lz.Neutral700)); Txt(naira(48200), heading(30, weight = 700)) }
            Column(Modifier.weight(1f).borderLeft(1.dp, Lz.Divider).padding(horizontal = 14.dp, vertical = 12.dp)) { Txt("HELD IN ESCROW", label(10, color = Lz.Neutral700)); Txt(naira(s.earnedToday), heading(30, weight = 700)) }
        }
        PrimaryWide("Withdraw to ${s.payoutLabel}", "landmark", { s.withdraw() }, Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp))
        SectionRule("01", "Activity", Modifier.padding(top = 28.dp, bottom = 4.dp))
        CompletedList(s, plus = true)
    }
}

// ───────────────────────────── account + coverage radius ─────────────────────────────

@Composable
fun ArtisanAccountScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
        AccountHeader("TB", "Tunde Bakare") {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LzIcon("badge-check", 15, Lz.Accent700); Txt("ID verified · Plumbing · ★ 4.8", body(13, weight = 600, color = Lz.Accent700))
            }
        }
        SectionRule("01", "Coverage radius", Modifier.padding(top = 4.dp, bottom = 12.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Txt("You get requests from clients inside this distance.", body(14, 20, color = Lz.Neutral800), Modifier.weight(1f))
                Txt("${s.radiusKm} KM", heading(40, 40, weight = 700), Modifier.padding(start = 12.dp))
            }
            StepSlider(s.radiusKm, 1, 10, { s.radiusKm = it }, Modifier.padding(top = 12.dp).semantics { contentDescription = "Coverage radius" })
            Row { Txt("1 km", label(11, 0f, Lz.Neutral700), Modifier.weight(1f)); Txt("10 km", label(11, 0f, Lz.Neutral700)) }
        }
        SectionRule("02", "Account", Modifier.padding(top = 24.dp, bottom = 4.dp))
        AccountRows(
            listOf(
                AccountRow("badge-check", "Verification", "ID and address verified") { s.push(Pushed.Verify(onboarding = false)) },
                AccountRow("wrench", "Services and prices", "Plumbing · 3 services"),
                AccountRow("landmark", "Payout account", s.payoutLabel) { s.push(Pushed.Payout) },
                AccountRow("settings", "Settings", "Notifications, language"),
            ) + demoRows(s),
            Modifier.padding(horizontal = 20.dp),
        )
    }
}

/** Integer slider in the accent colour (the prototype used a native range input). */
@Composable
private fun StepSlider(value: Int, min: Int, max: Int, onChange: (Int) -> Unit, modifier: Modifier = Modifier) {
    fun pick(x: Float, w: Float) = (min + (x / w).coerceIn(0f, 1f) * (max - min)).roundToInt()
    Box(
        modifier.fillMaxWidth().height(32.dp)
            .pointerInput(min, max) { detectTapGestures { onChange(pick(it.x, size.width.toFloat())) } }
            .pointerInput(min, max) { detectHorizontalDragGestures { c, _ -> onChange(pick(c.position.x, size.width.toFloat())) } },
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val f = (value - min).toFloat() / (max - min)
            val r = 10.dp.toPx()
            val x = r + f * (size.width - 2 * r)
            val cy = size.height / 2
            drawLine(Lz.Neutral300, Offset(r, cy), Offset(size.width - r, cy), 4.dp.toPx())
            drawLine(Lz.Accent, Offset(r, cy), Offset(x, cy), 4.dp.toPx())
            drawCircle(Lz.Accent, r, Offset(x, cy))
        }
    }
}

