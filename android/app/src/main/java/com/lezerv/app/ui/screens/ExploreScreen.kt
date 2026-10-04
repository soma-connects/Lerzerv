package com.lezerv.app.ui.screens

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.Artisan
import com.lezerv.app.data.SERVICES
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.data.artisan
import com.lezerv.app.data.fixed1
import com.lezerv.app.data.naira
import com.lezerv.app.data.pad2
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Sheet
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.OutlineButton
import com.lezerv.app.ui.components.PrimaryButton
import com.lezerv.app.ui.components.Tag
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.components.blueprint
import com.lezerv.app.ui.components.borderBottom
import com.lezerv.app.ui.components.borderTop
import com.lezerv.app.ui.components.tap
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.map.MAP_H
import com.lezerv.app.ui.map.MAP_W
import com.lezerv.app.ui.map.MapCircle
import com.lezerv.app.ui.map.MapPin
import com.lezerv.app.ui.map.MapWorld
import com.lezerv.app.ui.map.UserDot
import com.lezerv.app.ui.map.at
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.body
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label

/** CSS `ease`. */
internal val CssEase = CubicBezierEasing(.25f, .1f, .25f, 1f)

/**
 * Shared pannable map used by the client Explore tab and the artisan Map tab.
 * The default view puts the user dot horizontally centred, 300dp from the top.
 */
@Composable
internal fun PannableMap(s: LezervState, content: @Composable androidx.compose.foundation.layout.BoxScope.() -> Unit) {
    BoxWithConstraints(Modifier.fillMaxSize().clipToBounds()) {
        val vw = maxWidth.value
        val vh = maxHeight.value
        val minX = minOf(0f, vw - MAP_W)
        val minY = minOf(0f, vh - MAP_H)
        val px = (s.panX ?: (vw / 2 - UX)).coerceIn(minX, 0f)
        val py = (s.panY ?: (300f - UY)).coerceIn(minY, 0f)
        val spec = if (s.dragging) snap<Float>() else tween(450, easing = CssEase)
        val ax by animateFloatAsState(px, spec, label = "panX")
        val ay by animateFloatAsState(py, spec, label = "panY")
        val density = LocalDensity.current.density
        val bounds by rememberUpdatedState(Triple(minX, minY, px to py))
        Box(
            Modifier.fillMaxSize().pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { s.panX = bounds.third.first; s.panY = bounds.third.second; s.dragging = true },
                    onDragEnd = { s.dragging = false },
                    onDragCancel = { s.dragging = false },
                ) { change, d ->
                    change.consume()
                    s.panX = ((s.panX ?: 0f) + d.x / density).coerceIn(bounds.first, 0f)
                    s.panY = ((s.panY ?: 0f) + d.y / density).coerceIn(bounds.second, 0f)
                }
            },
        ) { MapWorld(ax, ay, s.blueprintMap, content = content) }
    }
}

@Composable
fun ExploreScreen(s: LezervState) {
    val list = s.visibleArtisans
    val sel = artisan(s.selected)
    val sheetH by animateDpAsState(if (sel != null) 214.dp else if (s.sheet == Sheet.List) 470.dp else 132.dp, tween(250, easing = CssEase), label = "sheet")

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val vw = maxWidth.value
        PannableMap(s) {
            // 2.5 km ring around the user
            MapCircle(UX, UY, 300f, Lz.Accent, Lz.Accent.copy(alpha = .05f))
            Box(Modifier.at(330f, 210f).background(Lz.Bg).border(1.dp, Lz.Accent).padding(horizontal = 8.dp, vertical = 2.dp)) { Txt("2.5 KM", label(10, color = Lz.Accent700)) }
            UserDot()
            // draw busy pins under available ones, the selected pin on top
            list.sortedBy { if (it.id == s.selected) 2 else if (it.online) 1 else 0 }.forEach { a -> ArtisanPin(a, a.id == s.selected) { s.pick(a.id, vw) } }
        }

        // search + category chips
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SearchBar(s)
            Row(Modifier.padding(horizontal = 0.dp).fillMaxWidth().horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SERVICES.forEach { c ->
                    val on = s.category == c.key
                    Row(
                        Modifier.height(38.dp).shadow(1.dp).background(if (on) Lz.Accent else Lz.Bg).border(1.dp, if (on) Lz.Accent else Lz.Ink).tap { s.pickCategory(c.key) }.padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        LzIcon(if (on) "check" else c.icon, 16, if (on) Color.White else Lz.Ink)
                        Txt(c.label.uppercase(), heading(16, tracking = .04f, color = if (on) Color.White else Lz.Ink))
                    }
                }
            }
        }

        // map controls
        Column(Modifier.align(Alignment.TopEnd).padding(top = 128.dp, end = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            IconBox("layers", { s.blueprintMap = !s.blueprintMap }, iconSize = 22, bg = Lz.Bg, modifier = Modifier.shadow(1.dp).semantics { contentDescription = "Map style" })
            IconBox("locate-fixed", { s.recenter() }, iconSize = 22, bg = Lz.Bg, fg = Lz.Accent, modifier = Modifier.shadow(1.dp).semantics { contentDescription = "My location" })
        }

        ScaleBar(Modifier.align(Alignment.BottomStart).padding(start = 12.dp, bottom = sheetH + 12.dp))

        // bottom sheet
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(sheetH).shadow(12.dp).background(Lz.Bg).borderTop(2.dp, Lz.Ink).padding(top = 2.dp)) {
            Box(Modifier.fillMaxWidth().height(22.dp).tap { s.toggleSheet() }.semantics { contentDescription = "Expand list" }, contentAlignment = Alignment.Center) {
                Box(Modifier.size(40.dp, 4.dp).background(Lz.Neutral500))
            }
            if (sel != null) SelectedArtisan(s, sel) else NearbyList(s, list)
        }
    }
}

@Composable
private fun ArtisanPin(a: Artisan, sel: Boolean, onTap: () -> Unit) {
    val bg = if (sel) Lz.Ink else if (a.online) Lz.Accent else Lz.Bg
    val fg = if (sel || a.online) Color.White else Lz.Accent
    val bd = if (sel) Lz.Ink else Lz.Accent
    MapPin(a.x, a.y, a.service.icon, if (sel) 44 else 36, bg, fg, bd, stem = 8, label = if (sel) a.name else null, shadow = true,
        modifier = Modifier.tap(onClick = onTap).semantics { contentDescription = a.name })
}

@Composable
private fun SearchBar(s: LezervState) {
    Row(
        Modifier.fillMaxWidth().blueprint().height(52.dp).shadow(4.dp).background(Lz.Bg).border(2.dp, Lz.Ink).padding(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(48.dp).background(Lz.Accent), contentAlignment = Alignment.Center) { Txt("L", heading(30, weight = 700, color = Color.White)) }
        LzIcon("search", 20, Lz.Neutral700, Modifier.padding(start = 12.dp, end = 8.dp))
        BasicTextField(
            s.query, { s.query = it; s.selected = null },
            Modifier.weight(1f).semantics { contentDescription = "Search" },
            singleLine = true, textStyle = body(15), cursorBrush = SolidColor(Lz.Accent),
            decorationBox = { inner -> Box { if (s.query.isEmpty()) Txt("Search cleaning, laundry, plumbing", body(15, color = Lz.Neutral600), ellipsis = true); inner() } },
        )
        Box(
            Modifier.padding(end = 2.dp).size(44.dp).background(Lz.Accent100).border(1.dp, Lz.Accent).tap { s.openTab(com.lezerv.app.state.Tab.ClientAccount) }.semantics { contentDescription = "Account" },
            contentAlignment = Alignment.Center,
        ) { Txt("AO", heading(17, weight = 700, color = Lz.Accent800)) }
    }
}

@Composable
private fun ScaleBar(modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Box(Modifier.size(1.dp, 8.dp).background(Lz.Ink)); Box(Modifier.size(60.dp, 3.dp).background(Lz.Ink))
            Box(Modifier.size(1.dp, 8.dp).background(Lz.Ink)); Box(Modifier.size(60.dp, 3.dp).background(Lz.Bg).border(1.dp, Lz.Ink))
            Box(Modifier.size(1.dp, 8.dp).background(Lz.Ink))
        }
        Txt("0 · 500 · 1000 M  ·  6.4478° N 3.4723° E", label(9, color = Lz.Neutral800))
    }
}

@Composable
private fun SelectedArtisan(s: LezervState, a: Artisan) {
    Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 4.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.blueprint().size(68.dp, 76.dp).background(Lz.Accent100).border(1.dp, Lz.Accent), contentAlignment = Alignment.Center) {
                Txt(a.ini, heading(30, weight = 700, color = Lz.Accent800))
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Txt(a.name.uppercase(), heading(26, 26, weight = 700), Modifier.weight(1f, fill = false), ellipsis = true)
                    if (a.verified) LzIcon("badge-check", 18, Lz.Accent)
                }
                Txt("${a.service.label} · ★ ${fixed1(a.rating)} (${a.reviews}) · ${a.jobs} jobs", body(13, color = Lz.Neutral800))
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    AvailTag(a)
                    Tag("${fixed1(a.km)} km · ${a.eta} min")
                }
            }
            IconBox("x", { s.selected = null }, size = 40, iconSize = 22, border = null, modifier = Modifier.semantics { contentDescription = "Close" })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlineButton("Profile", { s.push(Pushed.Profile(a.id)) }, Modifier.weight(1f))
            PrimaryButton({ s.startBooking(a.id) }, Modifier.weight(1.6f), minHeight = 52.dp) {
                Txt((if (a.laundry) "Book pickup" else "Book now").uppercase(), heading(18, tracking = .05f, color = Color.White), Modifier.weight(1f))
                Txt(naira(a.from), heading(15, tracking = .05f, color = Color.White.copy(alpha = .85f)))
            }
        }
    }
}

@Composable
internal fun AvailTag(a: Artisan) = if (a.online) Tag("Available now", Lz.Accent, Color.White, Lz.Accent) else Tag("Busy until 3 pm", fg = Lz.Accent800, border = Lz.Accent)

@Composable
private fun ColumnScope.NearbyList(s: LezervState, list: List<Artisan>) {
    val catL = if (s.category == "all") "artisans" else SERVICES.first { it.key == s.category }.label.lowercase()
    Row(
        Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(start = 20.dp, end = 20.dp, top = 2.dp, bottom = 12.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Row {
                Txt("${list.count { it.online }}", heading(30, 30, weight = 700, color = Lz.Accent))
                Txt(" NEAR YOU", heading(30, 30, weight = 700))
            }
            Txt("Available $catL within 2.5 km · Lekki Phase 1", body(13, color = Lz.Neutral700), Modifier.padding(top = 3.dp))
        }
        val listOpen = s.sheet == Sheet.List
        OutlineButton(if (listOpen) "Map" else "List", { s.toggleSheet() }, icon = if (listOpen) "map" else "list", height = 40.dp, fontSize = 16)
    }
    BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
        val vw = maxWidth.value
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            val stroke = with(LocalDensity.current) { 1.dp.toPx() }
            list.forEachIndexed { i, a ->
                Row(
                    Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).tap { s.pick(a.id, vw) }.padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    // outlined numeral, CSS -webkit-text-stroke
                    Txt(pad2(i + 1), heading(30, 30, color = Lz.Accent700).copy(drawStyle = Stroke(stroke)), Modifier.width(34.dp))
                    Box(Modifier.size(36.dp).background(if (a.online) Lz.Accent else Lz.Bg).border(2.dp, Lz.Accent), contentAlignment = Alignment.Center) {
                        LzIcon(a.service.icon, 18, if (a.online) Color.White else Lz.Accent)
                    }
                    Column(Modifier.weight(1f)) {
                        Txt(a.name.uppercase(), heading(20, 22), ellipsis = true)
                        Txt("${a.service.label} · ★ ${fixed1(a.rating)} · ${if (a.online) "Available now" else "Busy until 3 pm"}", body(12, 17, color = Lz.Neutral800))
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Txt("${fixed1(a.km)} km", heading(20, 22))
                        Txt("${a.eta} MIN", label(11, .08f, Lz.Accent700))
                    }
                }
            }
            if (list.isEmpty()) Column(Modifier.padding(20.dp)) {
                Txt("NOBODY MATCHES HERE", heading(24))
                Txt("Clear the search or pick another category.", body(14, 20, color = Lz.Neutral800), Modifier.padding(top = 4.dp))
            }
        }
    }
}

