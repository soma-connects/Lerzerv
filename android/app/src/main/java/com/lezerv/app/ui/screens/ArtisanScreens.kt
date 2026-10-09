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
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
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
import com.lezerv.app.data.AVAILABLE_BALANCE
import com.lezerv.app.data.PAID_THIS_MONTH
import com.lezerv.app.data.CLIENT_HOME
import com.lezerv.app.data.DEMAND_ZONES
import com.lezerv.app.data.DEMO_START_CODE
import com.lezerv.app.data.GeoPoint
import com.lezerv.app.data.KM
import com.lezerv.app.data.Pt
import com.lezerv.app.data.REQUEST_PIN
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.data.WEEK
import com.lezerv.app.data.naira
import com.lezerv.app.data.pad2
import com.lezerv.app.data.AREAS
import com.lezerv.app.data.remote.initialsOf
import com.lezerv.app.data.remote.isoMillis
import com.lezerv.app.data.remote.jobRef
import com.lezerv.app.data.remote.shortDate
import com.lezerv.app.state.Incoming
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
import com.lezerv.app.ui.map.MapCredit
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
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // A new request: bring its area into view, halfway between you and it, above the card.
        val pin = s.incomingPin
        val vw = maxWidth.value
        LaunchedEffect(s.incoming?.id) { pin?.let { s.lookAt(Pt((UX + it.x) / 2, (UY + it.y) / 2), vw, 230f) } }
        PannableMap(s, MapCredit(Alignment.TopStart, PaddingValues(start = 12.dp, top = 124.dp))) {
            // Demand zones are sample data; live has none yet.
            if (!s.isLive) DEMAND_ZONES.forEach { DemandZone(it.x, it.y, it.r, it.label) }
            MapCircle(UX, UY, s.radiusKm * KM / 2, Lz.Ink, alpha = .55f)
            if (s.requestOpen && !s.isLive) HomePin(REQUEST_PIN.x, REQUEST_PIN.y)
            // A live request shows its area (the street comes once accepted): ~1 km around its centre.
            s.incomingPin?.let { p ->
                MapCircle(p.x, p.y, KM, Lz.Accent, Lz.Accent.copy(alpha = .1f))
                HomePin(p.x, p.y)
            }
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
            if (!s.isLive) MapChip("Today ${naira(s.earnedToday)}")
            MapChip("Radius ${s.radiusKm} km")
        }
        Column(Modifier.align(Alignment.TopEnd).padding(top = 86.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            BellButton(s, Modifier.shadow(1.dp), size = 48, bg = Lz.Bg, border = Lz.Ink)
            com.lezerv.app.ui.components.IconBox("locate-fixed", { s.recenter() }, iconSize = 22, bg = Lz.Bg, fg = Lz.Accent,
                modifier = Modifier.shadow(1.dp).semantics { contentDescription = "My location" })
        }

        val bottom = Modifier.align(Alignment.BottomStart).padding(12.dp).fillMaxWidth()
        val incoming = s.incoming
        val current = s.live?.activeJob
        when {
            incoming != null -> RequestCard(s, incoming, bottom)
            current != null -> Hint("navigation", "${current.title} for ${current.clientFirstName ?: "your client"} is in progress. Tap to open it.", bottom.tap { s.push(Pushed.Navigate) }, Lz.Accent)
            // Online but the map doesn't know where they are: clients see them at their area's centre.
            on && s.isLive && !s.originFromGps -> Hint("locate-fixed", "Share your location so clients nearby can find you. Tap to allow it.", bottom.tap { s.useMyLocation() }, Lz.Accent)
            on && s.artisanJob == null -> Hint("timer", if (s.isLive) "Looking for requests within ${s.radiusKm} km. They pop up here, and you have a few seconds to accept." else "Looking for jobs within ${s.radiusKm} km. Hatched areas have more requests right now.", bottom, Lz.Accent)
            !on -> Hint("power", if (s.isLive) "You won’t get requests while offline. Clients can’t book you either." else "You won’t get requests while offline. Clients can still see your profile.", bottom)
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

/** The incoming request and its countdown (the backend's offer window when live, 30 s by default). */
@Composable
private fun RequestCard(s: LezervState, r: Incoming, modifier: Modifier) {
    val left = (r.endsAt - s.now).coerceAtLeast(0)
    Column(modifier.blueprint().shadow(12.dp).background(Lz.Bg).border(2.dp, Lz.Ink).padding(2.dp)) {
        Box(Modifier.fillMaxWidth().height(6.dp).background(Lz.Neutral200)) {
            Box(Modifier.fillMaxHeight().fillMaxWidth((left / 30_000f).coerceIn(0f, 1f)).background(Lz.Accent))
        }
        Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 14.dp)) {
            Row {
                Txt("NEW REQUEST · ${ceil(left / 1000.0).toInt()}S", label(color = Lz.Accent700), Modifier.weight(1f))
                Txt(r.tag.uppercase(), label(11, .1f))
            }
            Txt(r.title.uppercase(), heading(28, 30, weight = 700), Modifier.padding(top = 6.dp))
            Txt(r.sub, body(13, 19, color = Lz.Neutral800), Modifier.padding(top = 2.dp))
            Row(Modifier.padding(top = 12.dp, bottom = 14.dp).fillMaxWidth().borderTop(2.dp, Lz.Ink).borderBottom(1.dp, Lz.Divider).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Txt(r.pay?.first ?: "Price agreed with the client in chat", body(13), Modifier.weight(1f))
                r.pay?.let { Txt(it.second, heading(28, weight = 700)) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlineButton("Decline", { s.declineRequest() }, Modifier.weight(1f))
                PrimaryButton({ s.acceptIncoming() }, Modifier.weight(1.6f).alpha(if (s.live?.busy == true) .5f else 1f)) {
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
    if (s.isLive) { LiveArtisanJob(s); return }
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
                    CodeField(s)
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

@Composable
private fun CodeField(s: LezervState) {
    BasicTextField(
        s.code, { v -> s.code = v.filter(Char::isDigit).take(4) },
        Modifier.fillMaxWidth().height(64.dp).border(2.dp, Lz.Ink).padding(horizontal = 16.dp).semantics { contentDescription = "Start code" },
        singleLine = true, textStyle = heading(40, weight = 700, tracking = .5f), cursorBrush = SolidColor(Lz.Accent),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        decorationBox = { inner -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) { if (s.code.isEmpty()) Txt("••••", heading(40, weight = 700, tracking = .5f, color = Lz.Neutral500)); inner() } },
    )
}

/**
 * Live job screen for the artisan: head there (Google Maps has the real route), say you've
 * arrived, type the client's start code, work, mark complete. The server checks the code.
 */
@Composable
private fun LiveArtisanJob(s: LezervState) {
    val live = s.live ?: return
    val j = s.liveArtisanJob ?: return
    val done = live.justCompleted?.id == j.id
    val stage = when { done -> 3; j.status == "in_progress" -> 2; j.id in live.arrived -> 1; else -> 0 }
    val client = j.clientFirstName ?: "Your client"
    val address = j.addressText ?: j.areaName.orEmpty()
    // The client's pin once the job is theirs (0027); else the area, roughly; else the drawn spot.
    val pin = s.jobPin(j)
    val spot = pin?.first ?: (AREAS.firstOrNull { it.first == j.areaName }?.second ?: AREAS.first().second).let { Pt(it.first, it.second) }
    val exactPin = if (j.lat != null && j.lng != null) GeoPoint(j.lat, j.lng) else null
    val minutes = isoMillis(j.startedAt)?.let { ((s.now - it) / 60_000).toInt().coerceAtLeast(0) } ?: 0
    data class Stage(val kicker: String, val status: String, val big: String, val bigLabel: String, val action: Pair<String, () -> Unit>)
    val st = when (stage) {
        0 -> Stage("Head to $client", "On the way", jobRef(j.jobNumber)?.removePrefix("J-") ?: "—", "job no.", "I’ve arrived" to s::markArrived)
        1 -> Stage("You have arrived", "Start the job", "—", "code", "Start job" to s::startJob)
        2 -> Stage("Work started", "In progress", pad2(minutes), "min on job", "Mark job complete" to s::completeJob)
        else -> Stage("Job complete", "Nice work", "✓", "done", "Back to map" to s::finishArtisanJob)
    }
    Column(Modifier.fillMaxSize()) {
        Box {
            MapInset(220.dp, spot, s) {
                if (pin?.second == false) MapCircle(spot.x, spot.y, KM, Lz.Accent, Lz.Accent.copy(alpha = .1f))
                HomePin(spot.x, spot.y + 2)
            }
            Row(Modifier.padding(12.dp).fillMaxWidth().background(Lz.Ink).padding(start = 14.dp, end = 8.dp, top = 10.dp, bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LzIcon("map-pin", 24, Color.White)
                Column(Modifier.weight(1f)) {
                    Txt("DESTINATION", heading(20, 20, weight = 700, color = Color.White))
                    Txt(address, body(12, 16, color = Color.White.copy(alpha = .85f)))
                }
                Box(Modifier.heightIn(min = 40.dp).border(1.dp, Color.White).tap { s.navigateTo(address, exactPin) }.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                    Txt("NAVIGATE", heading(16, tracking = .05f, color = Color.White))
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
            PersonRow(initialsOf(client), client, address, { s.toast("Calls through a Lezerv number are coming. Use chat for now.") },
                { j.conversationId?.let(s::openChat) ?: s.toast("Chat opens in a moment") }, Modifier.padding(top = 14.dp))
            Column(Modifier.padding(top = 14.dp)) {
                KvLine("Job", j.title)
                j.detail("when")?.let { KvLine("When", it) }
                j.detail("items")?.let { KvLine("Items", it) }
                j.detail("estimate")?.let { KvLine("Client’s estimate", it) }
                j.agreedAmount?.let { KvLine("Agreed price", naira(it)) }
            }
            j.description?.let { Txt("“$it”", body(14, 20, color = Lz.Neutral800), Modifier.padding(top = 10.dp)) }
            if (stage == 1) Column(Modifier.padding(top = 18.dp)) {
                Txt("ENTER ${client.uppercase()}’S START CODE", label(), Modifier.padding(bottom = 8.dp))
                CodeField(s)
                Txt("$client reads it from their app. It proves you’re really at the door.", body(12, color = Lz.Neutral700), Modifier.padding(top = 6.dp))
            }
            if (stage == 3) Txt("$client confirms and reviews the job in their app.", body(13, 19, color = Lz.Neutral700), Modifier.padding(top = 12.dp))
            PrimaryWide(st.action.first, onClick = st.action.second, modifier = Modifier.padding(top = 18.dp),
                alpha = if ((stage == 1 && s.code.length != 4) || live.busy) .5f else 1f)
        }
    }
}

// ───────────────────────────── jobs ─────────────────────────────

@Composable
fun ArtisanJobsScreen(s: LezervState) {
    if (s.isLive) { LiveArtisanJobs(s); return }
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
private fun LiveArtisanJobs(s: LezervState) {
    val jobs = s.live?.artisanJobs.orEmpty()
    val current = jobs.filter { (it.status == "assigned" && !it.offerPending) || it.status == "in_progress" }
    val done = jobs.filter { it.status == "completed" }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
        SectionRule("01", "Current", Modifier.padding(top = 20.dp, bottom = 4.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            if (current.isEmpty()) Txt("Accepted requests show here until they’re done.", body(13, color = Lz.Neutral700), Modifier.padding(vertical = 14.dp))
            current.forEach { j ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).tap { s.openArtisanJob(j.id) }.padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Txt(j.title.uppercase(), heading(19, 21))
                        Txt(listOfNotNull(jobRef(j.jobNumber), j.clientFirstName, j.areaName, if (j.status == "in_progress") "In progress" else j.detail("when")).joinToString(" · "), body(12, color = Lz.Neutral800))
                    }
                    LzIcon("chevron-right", 20)
                }
            }
        }
        SectionRule("02", "Completed", Modifier.padding(top = 28.dp, bottom = 4.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            if (done.isEmpty()) Txt("Finished jobs from the last 60 days.", body(13, color = Lz.Neutral700), Modifier.padding(vertical = 14.dp))
            done.forEach { j ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Txt(j.title, body(15, weight = 600))
                        Txt(listOfNotNull(jobRef(j.jobNumber), j.clientFirstName, j.completedAt?.let(::shortDate)).joinToString(" · "), body(12, color = Lz.Neutral700))
                    }
                    j.agreedAmount?.let { Txt(naira(it), heading(19)) }
                }
            }
        }
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
    if (s.isLive) {
        val done = s.live?.artisanJobs.orEmpty().filter { it.status == "completed" }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Txt("LAST 60 DAYS · AGREED WITH CLIENTS", label(color = Lz.Neutral700))
            Txt(naira(done.sumOf { it.agreedAmount ?: 0.0 }), heading(64, 62, weight = 700))
            Txt("${done.size} completed job${if (done.size == 1) "" else "s"}. Payouts through Lezerv arrive with in-app payments; until then this is a record of agreed prices, not money held for you.",
                body(14, 21, color = Lz.Neutral800))
        }
        return
    }
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
        // Available / held / paid out: the three states money moves through (first design, slide 13).
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 24.dp).fillMaxWidth().blueprint().border(1.dp, Lz.Ink)) {
            MoneyCell("Available", naira(AVAILABLE_BALANCE), "to withdraw", Modifier.weight(1f))
            MoneyCell("In escrow", naira(s.earnedToday), "until confirmed", Modifier.weight(1f).borderLeft(1.dp, Lz.Divider))
            MoneyCell("Paid out", naira(PAID_THIS_MONTH), "this month", Modifier.weight(1f).borderLeft(1.dp, Lz.Divider))
        }
        if (!s.payoutSaved) Row(
            Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp).fillMaxWidth().background(Lz.Accent100).border(1.dp, Lz.Accent).tap { s.push(Pushed.Payout) }.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            LzIcon("circle-alert", 20, Lz.Accent800)
            Column {
                Txt("Add your payout account.", body(14, 20, weight = 700, color = Lz.Accent900))
                Txt("Bank account and BVN are needed before the first withdrawal.", body(14, 20, color = Lz.Accent900))
            }
        }
        PrimaryWide(if (s.payoutSaved) "Withdraw to ${s.payoutLabel}" else "Add payout account", "landmark", { s.withdraw() }, Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp))
        SectionRule("01", "How you are paid", Modifier.padding(top = 28.dp, bottom = 10.dp))
        Txt("The client pays Lezerv when they book. Lezerv holds it, takes 20% commission and releases the rest when the client confirms the job is done, or automatically after 24 hours.",
            body(14, 21, color = Lz.Neutral800), Modifier.padding(horizontal = 20.dp))
        SectionRule("02", "Activity", Modifier.padding(top = 28.dp, bottom = 4.dp))
        CompletedList(s, plus = true)
    }
}

@Composable
private fun MoneyCell(k: String, v: String, sub: String, modifier: Modifier) {
    Column(modifier.padding(horizontal = 12.dp, vertical = 12.dp)) {
        Txt(k.uppercase(), label(10, color = Lz.Neutral700), ellipsis = true)
        Txt(v, heading(24, weight = 700))
        Txt(sub, body(11, color = Lz.Neutral700))
    }
}

// ───────────────────────────── account + coverage radius ─────────────────────────────

@Composable
fun ArtisanAccountScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
        val me = s.live?.me
        AccountHeader(me?.let { initialsOf(it.displayName) } ?: "TB", me?.displayName ?: "Tunde Bakare") {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LzIcon("badge-check", 15, Lz.Accent700)
                Txt(if (me != null) listOfNotNull(if (me.isVerified) "ID verified" else "Approved", "★ ${com.lezerv.app.data.fixed1(me.avgRating)}").joinToString(" · ") else "ID verified · Plumbing · ★ 4.8",
                    body(13, weight = 600, color = Lz.Accent700))
            }
        }
        SectionRule("01", "Coverage radius", Modifier.padding(top = 4.dp, bottom = 12.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Txt("You get requests from clients inside this distance.", body(14, 20, color = Lz.Neutral800), Modifier.weight(1f))
                Txt("${s.radiusKm} KM", heading(40, 40, weight = 700), Modifier.padding(start = 12.dp))
            }
            StepSlider(s.radiusKm, 1, 10, { s.changeRadius(it) }, Modifier.padding(top = 12.dp).semantics { contentDescription = "Coverage radius" })
            Row { Txt("1 km", label(11, 0f, Lz.Neutral700), Modifier.weight(1f)); Txt("10 km", label(11, 0f, Lz.Neutral700)) }
        }
        SectionRule("02", "Account", Modifier.padding(top = 24.dp, bottom = 4.dp))
        AccountRows(
            // Verification, services and payouts are still sample screens; live hides them.
            (if (s.isLive) emptyList() else listOf(
                AccountRow("badge-check", "Verification", "ID and address verified") { s.push(Pushed.Verify(onboarding = false)) },
                AccountRow("wrench", "Services and prices", "Plumbing · ${s.account.services.count { it.on }} services") { s.push(Pushed.Services) },
                AccountRow("landmark", "Payout account", s.payoutLabel) { s.push(Pushed.Payout) },
            )) + listOf(
                AccountRow("life-buoy", "Help", "Questions and support chat") { s.push(Pushed.Help) },
                AccountRow("settings", "Settings", "Notifications, language, log out") { s.push(Pushed.Settings) },
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

