package com.lezerv.app.ui.map

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.lezerv.app.data.Pt
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.theme.LocalLzFonts
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label
import kotlin.math.hypot

const val MAP_W = 720f
const val MAP_H = 1040f

/**
 * Lezerv's own map of Lekki, ported from project/lz-map.js.
 *
 * It is drawn by the app, not Google Maps, so only Lezerv pins appear on it.
 * For launch the build notes propose MapLibre Native on OpenStreetMap tiles with a
 * Lezerv style; this drawn map keeps the demo self-contained until then.
 */
private class Block(val x: Float, val y: Float, val w: Float, val h: Float, val park: Boolean)

/** Same Park–Miller generator and loop order as the JS, so the blocks land in the same places. */
private val BLOCKS: List<Block> by lazy {
    var s = 7L
    fun r(): Double { s = (s * 16807) % 2147483647; return (s - 1).toDouble() / 2147483646 }
    val out = ArrayList<Block>()
    var x = -260
    while (x < 980) {
        var y = -260
        while (y < 1300) {
            val v = r()
            val w = 58f - 9f
            val h = 50f - 9f
            when {
                v < 0.07 -> {}
                v < 0.22 -> {
                    out += Block(x + 4f, y + 4f, w / 2 - 2, h, false)
                    out += Block(x + 4f + w / 2 + 2, y + 4f, w / 2 - 2, h, false)
                }
                v < 0.3 -> out += Block(x + 4f, y + 4f, w, h, true)
                else -> out += Block(x + 4f, y + 4f, w, h, false)
            }
            y += 50
        }
        x += 58
    }
    out
}

private fun svgPath(d: String): Path = PathParser().parsePathString(d).toPath()
private val WATER_SOUTH by lazy { svgPath("M0 846 C120 812 220 880 360 858 S600 808 720 842 L720 1040 L0 1040Z") }
private val WATER_NW by lazy { svgPath("M0 120 C60 140 90 210 70 300 S40 420 0 460Z") }
private val SHORE by lazy { svgPath("M0 846 C120 812 220 880 360 858 S600 808 720 842") }
private val ROADS by lazy {
    listOf(
        "M-10 790 C200 768 420 806 730 760" to 16f, "M300 -10 C318 260 286 500 338 790" to 11f, "M-10 330 L730 222" to 10f,
        "M560 -10 C540 300 600 520 590 780" to 8f, "M-10 610 C220 580 480 640 730 560" to 8f, "M120 130 L190 790" to 6f,
    ).map { svgPath(it.first) to it.second }
}

private data class MapLabel(val x: Float, val y: Float, val angle: Float, val text: String, val size: Int, val alpha: Float = 1f)
private val LABELS = listOf(
    MapLabel(380f, 778f, -2f, "LEKKI–EPE EXPRESSWAY", 10), MapLabel(308f, 200f, 86f, "ADMIRALTY WAY", 10),
    MapLabel(420f, 262f, -8f, "ADMIRALTY RD", 10), MapLabel(540f, 150f, 92f, "FREEDOM WAY", 9),
    MapLabel(20f, 598f, -4f, "ADEBAYO DOHERTY RD", 9), MapLabel(380f, 140f, 0f, "LEKKI PHASE 1", 20, .55f),
    MapLabel(40f, 700f, 0f, "OSAPA", 20, .55f), MapLabel(600f, 430f, 0f, "IKATE", 20, .55f),
    MapLabel(60f, 30f, 0f, "IKOYI", 20, .55f), MapLabel(250f, 960f, 0f, "LAGOS LAGOON", 16, .7f),
)

/** The 720×1040 map drawing itself. [blueprint] adds the faint green engineering grid. */
@Composable
fun LzMapCanvas(blueprint: Boolean, modifier: Modifier = Modifier) {
    val measurer = rememberTextMeasurer()
    val headingFont = LocalLzFonts.current.heading
    val block = Lz.Ink.copy(alpha = 0.07f)
    val roadEdge = Lz.Ink.copy(alpha = 0.22f)
    val grid = Lz.Accent.copy(alpha = 0.16f)
    Canvas(modifier.requiredSize(MAP_W.dp, MAP_H.dp)) {
        drawRect(Lz.Bg)
        // Everything below is authored in map units (= dp); scale once so strokes scale too.
        val k = density
        withTransform({ scale(k, k, pivot = Offset.Zero) }) {
            rotate(-9f, pivot = Offset(360f, 520f)) {
                BLOCKS.forEach { drawRect(if (it.park) Lz.Accent200 else block, Offset(it.x, it.y), Size(it.w, it.h)) }
            }
            if (blueprint) {
                for (x in 0..720 step 40) drawLine(grid, Offset(x.toFloat(), 0f), Offset(x.toFloat(), MAP_H), if (x % 200 == 0) 1f else .5f)
                for (y in 0..1040 step 40) drawLine(grid, Offset(0f, y.toFloat()), Offset(MAP_W, y.toFloat()), if (y % 200 == 0) 1f else .5f)
            }
            drawPath(WATER_SOUTH, Lz.Accent100)
            drawPath(WATER_NW, Lz.Accent100)
            drawPath(SHORE, Lz.Accent400, style = Stroke(1f))
            ROADS.forEach { (p, w) ->
                drawPath(p, roadEdge, style = Stroke(w + 3, cap = StrokeCap.Square))
                drawPath(p, Color.White, style = Stroke(w, cap = StrokeCap.Square))
            }
        }
        // SVG <text> puts the baseline at (x, y) and rotates about that point.
        LABELS.forEach { l ->
            val style = TextStyle(fontFamily = headingFont, fontWeight = FontWeight.SemiBold, fontSize = (l.size / fontScale).sp, letterSpacing = ((if (l.size > 12) 3f else 1.2f) / fontScale).sp, color = Lz.Neutral700.copy(alpha = l.alpha))
            val layout = measurer.measure(l.text, style)
            val px = Offset(l.x * density, l.y * density)
            rotate(l.angle, pivot = px) { drawText(layout, topLeft = Offset(px.x, px.y - layout.firstBaseline)) }
        }
    }
}

/**
 * A pannable "world": the map plus anything positioned on it in map units.
 * [panX]/[panY] translate the world inside its clipped parent.
 */
@Composable
fun MapWorld(panX: Float, panY: Float, blueprint: Boolean, modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit = {}) {
    Box(
        modifier
            .wrapContentSize(Alignment.TopStart, unbounded = true)
            .requiredSize(MAP_W.dp, MAP_H.dp)
            .graphicsLayer { translationX = panX * density; translationY = panY * density },
    ) {
        LzMapCanvas(blueprint)
        content()
    }
}

/** Places a child so that its top-left is at map point (x, y). */
fun Modifier.at(x: Float, y: Float) = offset(x.dp, y.dp)

/** Pulsing "you are here" dot at the client's position. */
@Composable
fun UserDot(at: Pt = Pt(UX, UY)) {
    val pulse = rememberInfiniteTransition(label = "pulse")
    val p by pulse.animateFloat(0f, 1f, infiniteRepeatable(tween(2400, easing = LinearEasing), RepeatMode.Restart), label = "p")
    Box(Modifier.at(at.x - 40, at.y - 40).size(80.dp)) {
        // ease-out: fast start, slow finish, like the CSS keyframes
        val e = 1f - (1f - p) * (1f - p)
        Box(Modifier.size(80.dp).scale(.25f + .75f * e).graphicsLayer { alpha = .9f * (1f - e) }.background(Lz.Accent.copy(alpha = .3f), CircleShape))
        Box(Modifier.offset(31.dp, 31.dp).size(18.dp).shadow(2.dp, CircleShape).background(Color.White, CircleShape).padding(3.dp).background(Lz.Accent, CircleShape))
    }
}

/** Square map marker with a stem; the stem tip is at (x, y). */
@Composable
fun MapPin(x: Float, y: Float, icon: String, size: Int = 28, bg: Color = Lz.Ink, fg: Color = Color.White, border: Color = bg, stem: Int = 10, label: String? = null, shadow: Boolean = false, modifier: Modifier = Modifier) {
    // Fixed-width column so a long name label overflows centred instead of shifting the pin.
    Column(modifier.at(x - size / 2f, y - size - stem).width(size.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(size.dp).then(if (shadow) Modifier.shadow(3.dp) else Modifier).background(bg).border(2.dp, border), contentAlignment = Alignment.Center) { LzIcon(icon, 18.coerceAtMost(size - 10), fg) }
        Box(Modifier.size(2.dp, stem.dp).background(border))
        if (label != null) Box(Modifier.wrapContentWidth(unbounded = true).padding(top = 4.dp).background(Lz.Ink).padding(horizontal = 8.dp, vertical = 3.dp)) { Txt(label.uppercase(), heading(14, tracking = .04f, color = Color.White)) }
    }
}

/** Square marker centred on (x, y): the moving artisan/rider, or a job's origin. */
@Composable
fun CentredMarker(x: Float, y: Float, icon: String, size: Int, bg: Color, fg: Color, border: Color, borderW: Int = 2, iconSize: Int = size / 2, shadow: Boolean = false) {
    Box(
        Modifier.at(x - size / 2f, y - size / 2f).size(size.dp).then(if (shadow) Modifier.shadow(4.dp) else Modifier).background(bg).border(borderW.dp, border),
        contentAlignment = Alignment.Center,
    ) { LzIcon(icon, iconSize, fg) }
}

/** Dashed circle on the map in map units (coverage ring, approximate area). */
@Composable
fun MapCircle(cx: Float, cy: Float, r: Float, stroke: Color, fill: Color = Color.Transparent, strokeW: Float = 1.5f, alpha: Float = 1f) {
    Box(
        Modifier.at(cx - r, cy - r).size((r * 2).dp).graphicsLayer { this.alpha = alpha }.drawBehind {
            val w = strokeW.dp.toPx()
            drawCircle(fill)
            drawCircle(stroke, radius = size.minDimension / 2 - w / 2, style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(w * 3, w * 3))))
        },
    )
}

/** Hatched demand zone (CSS repeating-linear-gradient at 45°). */
@Composable
fun DemandZone(cx: Float, cy: Float, r: Float, text: String) {
    Box(
        Modifier.at(cx - r, cy - r).size((r * 2).dp).drawBehind {
            val circle = Path().apply { addOval(androidx.compose.ui.geometry.Rect(Offset.Zero, size)) }
            clipPath(circle) {
                val step = 8.dp.toPx() * 1.4142f
                val c = Lz.Accent.copy(alpha = .2f)
                var d = -size.height
                while (d < size.width) { drawLine(c, Offset(d, 0f), Offset(d + size.height, size.height), 2.dp.toPx()); d += step }
            }
            drawCircle(Lz.Accent, style = Stroke(1.dp.toPx()), radius = size.minDimension / 2 - .5f.dp.toPx())
        },
        contentAlignment = Alignment.Center,
    ) {
        Box(Modifier.background(Lz.Bg).border(1.dp, Lz.Accent).padding(horizontal = 6.dp, vertical = 2.dp)) { Txt(text.uppercase(), label(9, .1f, Lz.Accent800)) }
    }
}

// ───────────────────────────── routes ─────────────────────────────

/** Manhattan-style route: down/up to the midpoint row, across, then to the target. */
fun routePoints(a: Pt, b: Pt): List<Pt> {
    val my = Math.round((a.y + b.y) / 2).toFloat()
    return listOf(a, Pt(a.x, my), Pt(b.x, my), b)
}

/** Position a fraction [t] of the way along polyline [p]. */
fun along(p: List<Pt>, t: Float): Pt {
    val seg = (1 until p.size).map { hypot(p[it].x - p[it - 1].x, p[it].y - p[it - 1].y) }
    var d = t * seg.sum()
    seg.forEachIndexed { i, l ->
        if (d <= l) {
            val f = if (l > 0) d / l else 0f
            return Pt(p[i].x + (p[i + 1].x - p[i].x) * f, p[i].y + (p[i + 1].y - p[i].y) * f)
        }
        d -= l
    }
    return p.last()
}

/** Pan offset that centres a route in a [w]×[h] viewport, clamped to the map edges. */
fun centerOn(pts: List<Pt>, w: Float, h: Float): Pair<Float, Float> {
    val cx = (pts.minOf { it.x } + pts.maxOf { it.x }) / 2
    val cy = (pts.minOf { it.y } + pts.maxOf { it.y }) / 2
    return (w / 2 - cx).coerceIn(minOf(0f, w - MAP_W), 0f) to (h / 2 - cy).coerceIn(minOf(0f, h - MAP_H), 0f)
}

/** White-cased green route line; dotted once the trip is over. */
@Composable
fun RouteLine(pts: List<Pt>, done: Boolean) {
    Canvas(Modifier.requiredSize(MAP_W.dp, MAP_H.dp)) {
        val k = density
        withTransform({ scale(k, k, pivot = Offset.Zero) }) { drawRoute(pts, done) }
    }
}

private fun DrawScope.drawRoute(pts: List<Pt>, done: Boolean) {
    val path = Path().apply { pts.forEachIndexed { i, p -> if (i == 0) moveTo(p.x, p.y) else lineTo(p.x, p.y) } }
    drawPath(path, Color.White, style = Stroke(10f, join = StrokeJoin.Miter))
    drawPath(path, Lz.Accent, style = Stroke(5f, join = StrokeJoin.Miter, pathEffect = if (done) PathEffect.dashPathEffect(floatArrayOf(2f, 8f)) else null))
}
