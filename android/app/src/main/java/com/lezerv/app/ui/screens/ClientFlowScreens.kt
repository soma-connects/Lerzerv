package com.lezerv.app.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lezerv.app.data.Artisan
import com.lezerv.app.data.LAUNDRY_ITEMS
import com.lezerv.app.data.LAUNDRY_STEPS
import com.lezerv.app.data.OPTIONS
import com.lezerv.app.data.PICKUP_WINDOWS
import com.lezerv.app.data.Pt
import com.lezerv.app.data.SERVICE_STEPS
import com.lezerv.app.data.SLOTS
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.data.WHENS
import com.lezerv.app.data.fixed1
import com.lezerv.app.data.naira
import com.lezerv.app.data.optionPrice
import com.lezerv.app.data.pad2
import com.lezerv.app.state.ClientJob
import com.lezerv.app.state.LezervState
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.Initials
import com.lezerv.app.ui.components.KvLine
import com.lezerv.app.ui.components.OutlineButton
import com.lezerv.app.ui.components.PrimaryButton
import com.lezerv.app.ui.components.PrimaryWide
import com.lezerv.app.ui.components.RadioRow
import com.lezerv.app.ui.components.SectionRule
import com.lezerv.app.ui.components.Segments
import com.lezerv.app.ui.components.Tag
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.components.ChoiceChip
import com.lezerv.app.ui.components.blueprint
import com.lezerv.app.ui.components.borderBottom
import com.lezerv.app.ui.components.borderLeft
import com.lezerv.app.ui.components.borderTop
import com.lezerv.app.ui.components.tap
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.map.CentredMarker
import com.lezerv.app.ui.map.MAP_H
import com.lezerv.app.ui.map.MAP_W
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

// ───────────────────────────── shared bits ─────────────────────────────

/** Scrollable body above a fixed bottom action bar (Profile, Book). */
@Composable
internal fun ScrollWithBar(bar: @Composable RowScope.() -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()), content = content)
        Row(
            Modifier.fillMaxWidth().background(Lz.Bg).borderTop(2.dp, Lz.Ink).padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) { bar() }
    }
}

/** "TOTAL / ₦12,000" block on the left of a bottom bar. */
@Composable
internal fun BarFigure(k: String, v: String, unit: String? = null, size: Int = 26, modifier: Modifier = Modifier) {
    Column(modifier) {
        Txt(k.uppercase(), label(11, .1f, Lz.Neutral700))
        Row(verticalAlignment = Alignment.Bottom) {
            Txt(v, heading(size, size + 2, weight = 700))
            if (unit != null) Txt(" $unit", body(14, weight = 500, color = Lz.Neutral700), Modifier.padding(bottom = 3.dp))
        }
    }
}

/** A fixed-size window onto the map, centred on a map point. Used for small inset maps. */
@Composable
internal fun MapInset(height: Dp, center: Pt, blueprint: Boolean, modifier: Modifier = Modifier, content: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit) {
    BoxWithConstraints(modifier.fillMaxWidth().height(height).clipToBounds()) {
        val w = maxWidth.value
        val h = maxHeight.value
        MapWorld((w / 2 - center.x).coerceIn(w - MAP_W, 0f), (h / 2 - center.y).coerceIn(h - MAP_H, 0f), blueprint, content = content)
    }
}

@Composable
internal fun HomePin(x: Float, y: Float, stem: Int = 10) = com.lezerv.app.ui.map.MapPin(x, y, "home", 28, Lz.Ink, Color.White, stem = stem)

// ───────────────────────────── profile ─────────────────────────────

@Composable
fun ProfileScreen(s: LezervState, id: String) {
    val a = s.artisan(id) ?: return
    ScrollWithBar(bar = {
        BarFigure("From", naira(a.from), a.unit, modifier = Modifier.weight(1f))
        PrimaryButton({ s.startBooking(a.id) }) {
            Txt((if (a.laundry) "Book pickup" else "Book").uppercase(), heading(20, tracking = .05f, color = Color.White))
            LzIcon("arrow-right", 20, Color.White)
        }
    }) {
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 22.dp, bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Box(Modifier.blueprint().size(96.dp, 112.dp).background(Lz.Accent100).border(1.dp, Lz.Accent), contentAlignment = Alignment.Center) {
                Txt(a.ini, heading(42, weight = 700, color = Lz.Accent800))
            }
            Column(Modifier.height(112.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Txt(a.name.uppercase(), heading(38, 36, weight = 700))
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Tag(a.service.label, fg = Lz.Accent800, border = Lz.Accent)
                    if (a.verified) Tag("ID verified", Lz.Accent, Color.White, Lz.Accent, icon = "badge-check")
                    AvailTag(a)
                }
            }
        }
        Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth().borderTop(2.dp, Lz.Ink).borderBottom(2.dp, Lz.Ink)) {
            Stat("Rating", fixed1(a.rating), "${a.reviews} reviews", Modifier.weight(1f).padding(vertical = 12.dp))
            Stat("Jobs", "${a.jobs}", "on Lezerv", Modifier.weight(1f).borderLeft(1.dp, Lz.Divider).padding(horizontal = 14.dp, vertical = 12.dp))
            Stat("Away", fixed1(a.km), "km · ${a.eta} min", Modifier.weight(1f).borderLeft(1.dp, Lz.Divider).padding(horizontal = 14.dp, vertical = 12.dp))
        }
        // Privacy: clients see an approximate area until they book.
        Box(Modifier.padding(start = 20.dp, end = 20.dp, top = 22.dp).blueprint().border(1.dp, Lz.Ink).padding(1.dp)) {
            MapInset(130.dp, Pt(a.x, a.y), s.blueprintMap) {
                MapCircle(a.x, a.y, 60f, Lz.Accent, Lz.Accent.copy(alpha = .12f))
                UserDot()
            }
            Box(Modifier.align(Alignment.BottomStart).padding(8.dp).background(Lz.Bg).border(1.dp, Lz.Ink).padding(horizontal = 8.dp, vertical = 3.dp)) {
                Txt("APPROXIMATE AREA · EXACT LOCATION AFTER BOOKING", label(10, .05f), ellipsis = true)
            }
        }
        SectionRule("01", "About", Modifier.padding(top = 26.dp, bottom = 10.dp))
        Txt(a.bio, body(15, 23), Modifier.padding(horizontal = 20.dp))
        SectionRule("02", "Services and prices", Modifier.padding(top = 26.dp, bottom = 4.dp))
        Column(Modifier.padding(horizontal = 20.dp)) {
            val opts = if (a.laundry) LAUNDRY_ITEMS.map { it.first to naira(it.second) } else OPTIONS.getValue(a.svc).mapIndexed { i, l -> l to naira(optionPrice(a, i)) }
            opts.forEach { (l, p) ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Txt(l, body(15), Modifier.weight(1f)); Txt(p, heading(20))
                }
            }
            Txt("Starting prices. The artisan confirms the final price before work starts.", body(12, 17, color = Lz.Neutral700), Modifier.padding(top = 8.dp))
        }
        SectionRule("03", "Reviews", Modifier.padding(top = 26.dp, bottom = 4.dp))
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 24.dp)) {
            val reviews = s.reviewsFor(a.id)
            if (reviews.isNullOrEmpty()) Txt(if (reviews == null) "Loading reviews…" else "No written reviews yet.", body(14, 21, color = Lz.Neutral700), Modifier.padding(vertical = 12.dp))
            reviews.orEmpty().forEach { r ->
                Column(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp)) {
                    Row {
                        Txt("${r.name} · ${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}", body(13, weight = 700), Modifier.weight(1f))
                        Txt(r.ago, body(13, color = Lz.Neutral700))
                    }
                    Txt(r.text, body(14, 21), Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

@Composable
private fun Stat(k: String, v: String, sub: String, modifier: Modifier) {
    Column(modifier) {
        Txt(k.uppercase(), label(10, color = Lz.Neutral700))
        Txt(v, heading(38, 40, weight = 700))
        Txt(sub, body(11, color = Lz.Neutral700))
    }
}

// ───────────────────────────── book ─────────────────────────────

@Composable
fun BookScreen(s: LezervState) {
    val a = s.artisan(s.bookArtisan) ?: return
    val bt = s.bookTotal()
    ScrollWithBar(bar = {
        // Live there are no payments yet: the request goes to Lezerv, who confirm artisan and price.
        BarFigure(if (s.isLive) "Estimate" else "Total", naira(bt.total), size = 30, modifier = Modifier.weight(1f))
        PrimaryButton({ if (s.isLive) s.sendRequest() else s.openPay() }, modifier = Modifier.alpha(if (s.live?.busy == true) .5f else 1f)) {
            Txt(if (s.isLive) "SEND REQUEST" else "PAY", heading(20, tracking = .05f, color = Color.White))
            LzIcon(if (s.isLive) "send" else "arrow-right", 20, Color.White)
        }
    }) {
        if (a.laundry) LaundryForm(s) else ServiceForm(s, a)
        SectionRule(if (a.laundry) "04" else "03", "Where", Modifier.padding(top = 24.dp, bottom = 12.dp))
        val ad = s.account.currentAddress
        Column(Modifier.padding(horizontal = 20.dp).blueprint().border(1.dp, Lz.Ink)) {
            if (ad != null) Box(Modifier.borderBottom(1.dp, Lz.Ink).padding(1.dp)) {
                MapInset(109.dp, Pt(ad.x, ad.y), s.blueprintMap) { HomePin(ad.x, ad.y + 2, stem = 8) }
            }
            Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                LzIcon("map-pin", 20, Lz.Accent)
                Column(Modifier.weight(1f)) {
                    Txt(ad?.title ?: "Add where the artisan should come", body(15, weight = 600))
                    Txt(ad?.sub ?: "Saved for next time", body(12, color = Lz.Neutral700))
                }
                Box(Modifier.height(36.dp).tap { if (ad == null) s.account.editAddress(null) else s.account.pickingAddress = true }.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                    Txt(if (ad == null) "ADD" else "CHANGE", heading(16, tracking = .05f, color = Lz.Accent700))
                }
            }
        }
        BasicTextField(
            s.note, { s.note = it },
            Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp).fillMaxWidth().heightIn(min = 76.dp).border(1.dp, Lz.Divider).padding(horizontal = 12.dp, vertical = 10.dp),
            textStyle = body(14, 20), cursorBrush = SolidColor(Lz.Accent),
            decorationBox = { inner ->
                Box { if (s.note.isEmpty()) Txt(if (a.laundry) "Anything to know? Stains, delicate items, gate code" else "Describe the problem. Photos help the artisan bring the right parts.", body(14, 20, color = Lz.Neutral600)); inner() }
            },
        )
        SectionRule(if (a.laundry) "05" else "04", if (s.isLive) "Estimate" else "Payment", Modifier.padding(top = 24.dp, bottom = 4.dp))
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 20.dp)) {
            KvLine(if (a.laundry) "Items" else OPTIONS.getValue(a.svc)[s.option], naira(bt.sub))
            if (bt.extra > 0) KvLine("Express return", naira(bt.extra))
            KvLine("Lezerv service fee (5%)", naira(bt.fee))
            if (s.isLive) RequestNote(a.first, Modifier.padding(top = 14.dp)) else EscrowNote(Modifier.padding(top = 14.dp))
        }
    }
}

/** PROPOSAL: escrow needs backend work before launch. */
@Composable
private fun EscrowNote(modifier: Modifier) {
    Row(modifier.fillMaxWidth().background(Lz.Accent100).border(1.dp, Lz.Accent).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        LzIcon("lock", 20, Lz.Accent700)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Txt("Held by Lezerv until you confirm the job is done.", body(13, 19, weight = 700, color = Lz.Accent800))
            Txt("If the artisan doesn’t show, you get a full refund.", body(13, 19, color = Lz.Accent800))
            Box(Modifier.border(1.dp, Lz.Accent700).padding(horizontal = 5.dp, vertical = 1.dp)) { Txt("PROPOSAL", label(10, .1f, Lz.Accent800)) }
        }
    }
}

/** Live mode: what "Send request" does, since nothing is paid yet. */
@Composable
private fun RequestNote(first: String, modifier: Modifier) {
    Row(modifier.fillMaxWidth().background(Lz.Accent100).border(1.dp, Lz.Accent).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        LzIcon("send", 20, Lz.Accent700)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Txt("Nothing to pay now.", body(13, 19, weight = 700, color = Lz.Accent800))
            Txt("$first gets your request and has 30 seconds to accept. You agree the final price in chat before work starts.", body(13, 19, color = Lz.Accent800))
        }
    }
}

@Composable
private fun ServiceForm(s: LezervState, a: Artisan) {
    SectionRule("01", "What do you need", Modifier.padding(top = 20.dp, bottom = 4.dp))
    Column(Modifier.padding(horizontal = 20.dp)) {
        OPTIONS.getValue(a.svc).forEachIndexed { i, l ->
            RadioRow(l, s.option == i, { s.option = i }, { Txt(naira(optionPrice(a, i)), heading(19)) })
        }
    }
    SectionRule("02", "When", Modifier.padding(top = 24.dp, bottom = 12.dp))
    Segments(WHENS.indices.toList(), { it == s.whenIdx }, { s.whenIdx = it }, Modifier.padding(horizontal = 20.dp)) { i, fg ->
        Txt(WHENS[i].first.uppercase(), heading(19, 20, color = fg))
        Txt(WHENS[i].second.replace("{eta}", "${a.eta}"), body(11, color = fg.copy(alpha = .8f)))
    }
    if (s.whenIdx > 0) {
        @OptIn(ExperimentalLayoutApi::class)
        FlowRow(Modifier.padding(start = 20.dp, end = 20.dp, top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SLOTS.forEachIndexed { i, l -> ChoiceChip(l, s.slot == i, { s.slot = i }, 40.dp, 17) }
        }
    }
}

@Composable
private fun LaundryForm(s: LezervState) {
    SectionRule("01", "Items", Modifier.padding(top = 20.dp, bottom = 4.dp))
    Column(Modifier.padding(horizontal = 20.dp)) {
        LAUNDRY_ITEMS.forEachIndexed { i, (l, p) ->
            Row(Modifier.fillMaxWidth().heightIn(min = 58.dp).borderBottom(1.dp, Lz.Divider), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) { Txt(l, body(15)); Txt("${naira(p)} each", body(12, color = Lz.Neutral700)) }
                IconBox("minus", { s.changeCount(i, -1) }, 44, 18, modifier = Modifier.semantics { contentDescription = "Remove one" })
                Box(Modifier.width(36.dp), contentAlignment = Alignment.Center) { Txt("${s.laundryCounts[i]}", heading(26, weight = 700)) }
                IconBox("plus", { s.changeCount(i, 1) }, 44, 18, bg = Lz.Ink, fg = Color.White, modifier = Modifier.semantics { contentDescription = "Add one" })
            }
        }
    }
    SectionRule("02", "Pickup window", Modifier.padding(top = 24.dp, bottom = 4.dp))
    Column(Modifier.padding(horizontal = 20.dp)) {
        PICKUP_WINDOWS.forEachIndexed { i, l -> RadioRow(l, s.pickupWindow == i, { s.pickupWindow = i }, { LzIcon("truck", 18, Lz.Neutral700) }, 52.dp) }
    }
    SectionRule("03", "Return", Modifier.padding(top = 24.dp, bottom = 12.dp))
    Segments(listOf(false, true), { it == s.express }, { s.express = it }, Modifier.padding(horizontal = 20.dp)) { exp, fg ->
        Txt(if (exp) "EXPRESS" else "STANDARD", heading(19, 20, color = fg))
        Txt(if (exp) "24 hours · +₦2,000" else "Back in 48 hours", body(11, color = fg.copy(alpha = .8f)))
    }
}

// ───────────────────────────── live tracking ─────────────────────────────

/** Diagonal hatch for the current step (CSS repeating-linear-gradient 45°, 2dp on / 3dp off). */
private fun hatch(density: Float): Brush {
    val a = 5f * density / 1.4142f // a 5dp period measured along the 45° direction
    return Brush.linearGradient(
        0f to Lz.Accent, .4f to Lz.Accent, .4f to Color.Transparent, 1f to Color.Transparent,
        start = Offset.Zero, end = Offset(a, a), tileMode = TileMode.Repeated,
    )
}

/** Kicker, headline and explanation for each stage of a client job. */
internal data class TrackCopy(val kicker: String, val status: String, val sub: String)

internal fun trackCopy(j: ClientJob, a: Artisan): TrackCopy {
    val fn = a.first
    val rows = if (j.laundry) listOf(
        TrackCopy("Booking confirmed", "Pickup booked", "Finding a rider from ${a.name}."),
        TrackCopy("Rider on the way", "Coming to you", "Have your laundry bagged and ready."),
        TrackCopy("Collected", "Picked up", "${j.title} counted and tagged at your door."),
        TrackCopy("At ${a.name}", "Washing", "Washed, ironed and folded. Usually ready in ${if (j.express) "24" else "48"} hours."),
        TrackCopy("Out for delivery", "On its way back", "The rider is bringing your laundry."),
        TrackCopy("Delivered", "All done", "Check your items, then rate and release payment."),
    ) else listOf(
        TrackCopy("Booking confirmed", "Confirming", "$fn is accepting your job."),
        TrackCopy("$fn is driving", "On the way", "Live location. Share the start code when they arrive."),
        TrackCopy("$fn is at your gate", "Arrived", "Give $fn the start code to begin the job."),
        TrackCopy("Timer running", "Working", "$fn is on the job. Payment stays in escrow."),
        TrackCopy("Finished", "Job done", "Check the work, then rate and release payment."),
    )
    return rows[j.stage]
}

/** Minutes until the moving artisan/rider arrives. */
internal fun etaMinutes(j: ClientJob, a: Artisan) = maxOf(1, ceil((1 - if (j.moving) j.t else 0f) * a.eta).toInt())

@Composable
fun TrackScreen(s: LezervState) {
    val j = s.job ?: return
    val a = s.jobArtisan ?: return
    val me = Pt(UX, UY)
    val base = Pt(a.x, a.y)
    val pts = routePoints(base, me)
    val pos = when {
        j.moving -> along(pts, j.t)
        if (j.laundry) j.stage == 5 else j.stage >= 2 -> me
        else -> base
    }
    val etaN = etaMinutes(j, a)
    val fn = a.first
    val steps = if (j.laundry) LAUNDRY_STEPS else SERVICE_STEPS
    val cur = trackCopy(j, a)
    val done = j.stage == j.lastStage
    val action: Pair<String, () -> Unit>? = when {
        done -> "Rate and release payment" to s::openReview
        !j.laundry && j.stage == 3 -> "Confirm the job is done" to s::advance
        else -> null
    }

    Column(Modifier.fillMaxSize()) {
        BoxWithConstraints(Modifier.fillMaxWidth().height(300.dp).clipToBounds()) {
            val (tx, ty) = centerOn(pts, maxWidth.value, 300f)
            val ax by animateFloatAsState(tx, tween(800, easing = CssEase), label = "tx")
            val ay by animateFloatAsState(ty, tween(800, easing = CssEase), label = "ty")
            MapWorld(ax, ay, s.blueprintMap) {
                RouteLine(pts, !j.moving)
                CentredMarker(base.x, base.y, if (j.laundry) "shirt" else a.service.icon, 26, Lz.Bg, Lz.Ink, Lz.Ink, iconSize = 14)
                UserDot()
                CentredMarker(pos.x, pos.y, if (j.laundry) "truck" else "navigation", 40, Lz.Ink, Color.White, Color.White, iconSize = 20, shadow = true)
            }
            LiveBadge(if (j.moving) "Live · updated now" else if (done) "Completed" else "Live tracking", Modifier.padding(12.dp))
        }
        Box(Modifier.fillMaxWidth().height(2.dp).background(Lz.Ink))
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 22.dp)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Txt(cur.kicker.uppercase(), label(color = Lz.Accent700))
                    Txt(cur.status.uppercase(), heading(36, 36, weight = 700), Modifier.padding(top = 2.dp))
                    Txt(cur.sub, body(14, 20, color = Lz.Neutral800), Modifier.padding(top = 4.dp))
                }
                if (j.moving) Column(horizontalAlignment = Alignment.End) {
                    Txt(pad2(etaN), heading(60, 52, weight = 700, color = Lz.Accent))
                    Txt("MIN AWAY", label())
                }
            }
            Row(Modifier.padding(top = 18.dp, bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                steps.forEachIndexed { i, l ->
                    Column(Modifier.weight(1f)) {
                        val m = Modifier.fillMaxWidth().height(8.dp)
                        Box(
                            when {
                                i < j.stage || (i == j.stage && done) -> m.background(Lz.Accent)
                                i == j.stage -> m.background(hatch(LocalDensity.current.density))
                                else -> m
                            }.border(1.dp, Lz.Accent),
                        )
                        // Like CSS: wrap at spaces ("RIDER / COMING"), but let a single long word ("DELIVERING")
                        // spill into the gap instead of breaking mid-word, which Compose would otherwise do.
                        val oneWord = ' ' !in l
                        Txt(l.uppercase(), label(9, if (steps.size > 5) .02f else .06f, if (i <= j.stage) Lz.Ink else Lz.Neutral600).copy(lineHeight = 12.sp),
                            Modifier.padding(top = 6.dp).then(if (oneWord) Modifier.wrapContentWidth(Alignment.Start, unbounded = true) else Modifier))
                    }
                }
            }
            PersonRow(a.ini, a.name, "${a.service.label} · ★ ${fixed1(a.rating)}" + if (j.laundry) " · Rider: Musa" else " · Toyota Corolla · LND 482 KJ",
                onCall = { s.toast("Calling through a Lezerv number. Your number stays hidden.") }, onChat = { s.openChat(a.id) }, modifier = Modifier.padding(top = 12.dp))
            if (!j.laundry && j.stage <= 2) StartCode(if (j.stage == 2) "$fn is here. Read out this code." else "Only share this when $fn is at your door.")
            Column(Modifier.padding(top = 16.dp)) {
                JobSpec(j, if (j.laundry) "Laundry" else a.service.label)
                // Ways out of a job: cancel (until arrival, see LezervState.canCancel) and help.
                Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    if (s.canCancel) Txt("CANCEL BOOKING", label(12, .08f, Lz.Accent700), Modifier.tap { s.openCancel() }.padding(vertical = 10.dp))
                    Txt("GET HELP", label(12, .08f, Lz.Accent700), Modifier.tap { s.push(com.lezerv.app.state.Pushed.Help) }.padding(vertical = 10.dp))
                }
            }
            if (action != null) PrimaryWide(action.first, onClick = action.second, modifier = Modifier.padding(top = 18.dp))
            if (s.demo && !done && action == null && j.stage != 0) {
                OutlineButton("Prototype · skip ahead", { s.advance() }, Modifier.padding(top = 10.dp).fillMaxWidth(), height = 44.dp, fontSize = 13, centered = true, dashed = true)
            }
        }
    }
}

@Composable
internal fun LiveBadge(text: String, modifier: Modifier = Modifier) {
    Row(modifier.blueprint().background(Lz.Bg).border(1.dp, Lz.Ink).padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(8.dp).background(Lz.Accent))
        Txt(text.uppercase(), label())
    }
}

/** Avatar, name, meta and masked call/chat buttons. */
@Composable
internal fun PersonRow(ini: String, name: String, meta: String, onCall: () -> Unit, onChat: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().borderTop(2.dp, Lz.Ink).borderBottom(1.dp, Lz.Divider).padding(vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Initials(ini, 52, 56, 22)
        Column(Modifier.weight(1f)) {
            Txt(name.uppercase(), heading(21, 22))
            Txt(meta, body(12, color = Lz.Neutral800))
        }
        IconBox("phone", onCall, modifier = Modifier.semantics { contentDescription = "Call" })
        IconBox("message-square", onChat, bg = Lz.Ink, fg = Color.White, modifier = Modifier.semantics { contentDescription = "Chat" })
    }
}

/** PROPOSAL: start code. The client reads it out so the artisan can start the job. */
@Composable
private fun StartCode(note: String) {
    Row(Modifier.padding(top = 18.dp).fillMaxWidth().blueprint().border(1.dp, Lz.Ink).padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { LzIcon("key-round", 15); Txt("START CODE", label()) }
            Txt(note, body(13, 18, color = Lz.Neutral800), Modifier.padding(top = 4.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            com.lezerv.app.data.DEMO_START_CODE.forEach { d ->
                Box(Modifier.size(32.dp, 44.dp).border(1.dp, Lz.Ink), contentAlignment = Alignment.Center) { Txt("$d", heading(28, weight = 700)) }
            }
        }
    }
}
