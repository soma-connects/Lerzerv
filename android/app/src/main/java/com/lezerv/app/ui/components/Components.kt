package com.lezerv.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label

// ───────────────────────────── Modifiers ─────────────────────────────

/** Tap handler with button semantics (screen readers announce it as a button). */
fun Modifier.tap(enabled: Boolean = true, onClick: () -> Unit): Modifier =
    clickable(enabled = enabled, role = Role.Button, onClick = onClick)

/**
 * The Industry system's "+" registration marks: an 11dp cross that sits 6dp outside
 * each corner of a box. CSS draws them as `.blueprint > .corner`; here it's one draw pass.
 */
fun Modifier.blueprint(color: Color = Lz.Ink.copy(alpha = 0.55f)): Modifier = drawWithContent {
    drawContent()
    val s = 1.dp.toPx()
    val arm = 11.dp.toPx()
    val out = 6.dp.toPx()
    val mid = 5.dp.toPx()
    listOf(Offset(-out, -out), Offset(size.width - arm + out, -out), Offset(-out, size.height - arm + out), Offset(size.width - arm + out, size.height - arm + out)).forEach { o ->
        drawRect(color, topLeft = Offset(o.x + mid, o.y), size = androidx.compose.ui.geometry.Size(s, arm))
        drawRect(color, topLeft = Offset(o.x, o.y + mid), size = androidx.compose.ui.geometry.Size(arm, s))
    }
}

fun Modifier.borderTop(width: Dp, color: Color) = drawBehind {
    drawRect(color, size = size.copy(height = width.toPx()))
}

fun Modifier.borderBottom(width: Dp, color: Color) = drawBehind {
    val w = width.toPx()
    drawRect(color, topLeft = Offset(0f, size.height - w), size = size.copy(height = w))
}

fun Modifier.borderLeft(width: Dp, color: Color) = drawBehind {
    drawRect(color, size = size.copy(width = width.toPx()))
}

/** CSS `border: Npx dashed` on a circle. */
fun Modifier.dashedCircle(color: Color, width: Dp = 1.5.dp, fill: Color = Color.Transparent) = drawBehind {
    val w = width.toPx()
    if (fill != Color.Transparent) drawCircle(fill)
    drawCircle(color, radius = size.minDimension / 2 - w / 2, style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(w * 3, w * 3))))
}

/** Hairline-on-hover look is web-only; on touch we darken while pressed instead. */
@Composable
private fun pressed(source: MutableInteractionSource): Boolean = source.collectIsPressedAsState().value

// ───────────────────────────── Text ─────────────────────────────

@Composable
fun Txt(text: String, style: TextStyle, modifier: Modifier = Modifier, maxLines: Int = Int.MAX_VALUE, ellipsis: Boolean = false) {
    BasicText(text, modifier, style, maxLines = if (ellipsis) 1 else maxLines, overflow = if (ellipsis) TextOverflow.Ellipsis else TextOverflow.Clip, softWrap = !ellipsis)
}

/** "01 ── LABEL ────────" section heading with the Modernist 2dp ink rule. */
@Composable
fun SectionRule(num: String, title: String, modifier: Modifier = Modifier, gutter: Dp = 20.dp) {
    Row(modifier.fillMaxWidth().padding(horizontal = gutter), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Txt(num, heading(15, color = Lz.Accent700))
        Txt(title.uppercase(), label())
        Box(Modifier.weight(1f).height(2.dp).background(Lz.Ink))
    }
}

/** Key/value line used in payment breakdowns. */
@Composable
fun KvLine(k: String, v: String, size: Int = 14, vPad: Dp = 10.dp) {
    Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = vPad), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Txt(k, com.lezerv.app.ui.theme.body(size, color = Lz.Neutral800), Modifier.weight(1f))
        Txt(v, com.lezerv.app.ui.theme.body(size, weight = 600))
    }
}

/** Small uppercase status tag. */
@Composable
fun Tag(text: String, bg: Color = Color.Transparent, fg: Color = Lz.Ink, border: Color = Lz.Divider, icon: String? = null) {
    Row(
        Modifier.background(bg).border(1.dp, border).padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (icon != null) LzIcon(icon, 13, fg)
        Txt(text.uppercase(), label(11, 0.08f, fg))
    }
}

/** Initials block used as an avatar ("TB", "AO"). */
@Composable
fun Initials(text: String, w: Int, h: Int, fontSize: Int, modifier: Modifier = Modifier, solid: Boolean = false) {
    Box(
        modifier.size(w.dp, h.dp).background(if (solid) Lz.Accent else Lz.Accent100).border(1.dp, Lz.Accent),
        contentAlignment = Alignment.Center,
    ) { Txt(text, heading(fontSize, weight = 700, color = if (solid) Lz.White else Lz.Accent800)) }
}

// ───────────────────────────── Buttons ─────────────────────────────

/**
 * The one green action per view: square, condensed uppercase label, blueprint corners.
 * Content is laid out by the caller so it can be "label … price" or "label → icon".
 */
@Composable
fun PrimaryButton(onClick: () -> Unit, modifier: Modifier = Modifier, minHeight: Dp = 52.dp, enabled: Boolean = true, content: @Composable RowScope.() -> Unit) {
    val src = remember { MutableInteractionSource() }
    val down = pressed(src)
    Row(
        modifier
            .blueprint()
            .heightIn(min = minHeight)
            .background(if (down) Lz.Accent700 else Lz.Accent)
            .border(1.dp, Lz.Accent)
            .clickable(src, indication = null, enabled = enabled, role = Role.Button, onClick = onClick)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

/** Full-width primary button: "LABEL ……… →". */
@Composable
fun PrimaryWide(text: String, icon: String = "arrow-right", onClick: () -> Unit, modifier: Modifier = Modifier, alpha: Float = 1f) {
    PrimaryButton(onClick, modifier.fillMaxWidth().alpha(alpha), minHeight = 54.dp) {
        Txt(text.uppercase(), heading(20, tracking = 0.05f, color = Lz.White), Modifier.weight(1f))
        LzIcon(icon, 22, Lz.White)
    }
}

/** Hairline ink-outlined secondary button. */
@Composable
fun OutlineButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: String? = null, height: Dp = 52.dp, fontSize: Int = 18, centered: Boolean = false, dashed: Boolean = false) {
    val src = remember { MutableInteractionSource() }
    val down = pressed(src)
    Row(
        modifier
            .heightIn(min = height)
            .background(if (down) Lz.Neutral200 else Color.Transparent)
            .then(if (dashed) Modifier.dashedRect(Lz.Neutral500) else Modifier.border(1.dp, Lz.Ink))
            .clickable(src, indication = null, role = Role.Button, onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (centered) Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally) else Arrangement.spacedBy(6.dp),
    ) {
        if (icon != null) LzIcon(icon, (fontSize - 2).coerceAtMost(18))
        Txt(text.uppercase(), heading(fontSize, tracking = 0.05f))
    }
}

private fun Modifier.dashedRect(color: Color) = drawBehind {
    val w = 1.dp.toPx()
    drawRect(color, topLeft = Offset(w / 2, w / 2), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w), style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
}

/** Square icon button (call, chat, locate, layers…). */
@Composable
fun IconBox(icon: String, onClick: () -> Unit, size: Int = 48, iconSize: Int = 20, bg: Color = Color.Transparent, fg: Color = Lz.Ink, border: Color? = Lz.Ink, modifier: Modifier = Modifier) {
    Box(
        modifier.size(size.dp).background(bg).then(if (border != null) Modifier.border(1.dp, border) else Modifier).tap(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { LzIcon(icon, iconSize, fg) }
}

/** Selectable option row with a square radio: "■ Deep clean ……… ₦26,000". */
@Composable
fun RadioRow(text: String, selected: Boolean, onClick: () -> Unit, trailing: @Composable () -> Unit, minHeight: Dp = 56.dp) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = minHeight).background(if (selected) Lz.Accent100 else Color.Transparent).borderBottom(1.dp, Lz.Divider).tap(onClick = onClick).padding(horizontal = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(Modifier.size(20.dp).border(1.5.dp, Lz.Ink), contentAlignment = Alignment.Center) {
            Box(Modifier.size(10.dp).background(if (selected) Lz.Accent else Color.Transparent))
        }
        Txt(text, com.lezerv.app.ui.theme.body(15), Modifier.weight(1f))
        trailing()
    }
}

/** Equal-width segmented choices sharing 1dp ink borders ("Now | Later today | Schedule"). */
@Composable
fun <T> Segments(items: List<T>, selected: (T) -> Boolean, onPick: (T) -> Unit, modifier: Modifier = Modifier, cell: @Composable (T, Color) -> Unit) {
    Row(modifier.fillMaxWidth().border(1.dp, Lz.Ink)) {
        items.forEachIndexed { i, it ->
            val on = selected(it)
            Column(
                Modifier.weight(1f).heightIn(min = 64.dp).then(if (i > 0) Modifier.borderLeft(1.dp, Lz.Ink) else Modifier)
                    .background(if (on) Lz.Ink else Color.Transparent).tap { onPick(it) }.padding(horizontal = 10.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp, Alignment.CenterVertically),
            ) { cell(it, if (on) Lz.White else Lz.Ink) }
        }
    }
}

/** Toggle chip (time slots, review tags). Filled ink when on. */
@Composable
fun ChoiceChip(text: String, on: Boolean, onClick: () -> Unit, height: Dp = 38.dp, fontSize: Int = 16) {
    Box(
        Modifier.height(height).background(if (on) Lz.Ink else Color.Transparent).border(1.dp, Lz.Ink).tap(onClick = onClick).padding(horizontal = 12.dp),
        contentAlignment = Alignment.Center,
    ) { Txt(text.uppercase(), heading(fontSize, tracking = 0.04f, color = if (on) Lz.White else Lz.Ink)) }
}

@Composable
fun VSpace(h: Int) = Spacer(Modifier.height(h.dp))

@Composable
fun HSpace(w: Int) = Spacer(Modifier.width(w.dp))
