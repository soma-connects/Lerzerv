package com.lezerv.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Design tokens from the Industry design system (project/_ds/industry-…/styles.css),
 * with the v2 Lezerv dark-green accent ramp layered on top.
 *
 * CSS `color-mix(in srgb, X p%, transparent)` is the same as X at alpha p, so those
 * tokens are written as `.copy(alpha = …)`.
 */
object Lz {
    val Bg = Color(0xFFF2F2F3)
    val Surface = Color(0xFFE9E9EA)
    val Ink = Color(0xFF1D1F20)
    val White = Color.White
    val Divider = Ink.copy(alpha = 0.16f)

    // Brand: Lezerv dark green. PROPOSAL: match the exact hex once the logo file is supplied.
    val Accent = Color(0xFF1F6040)
    val Accent100 = Color(0xFFE8F3EC)
    val Accent200 = Color(0xFFCCE5D6)
    val Accent300 = Color(0xFF9FCBB0)
    val Accent400 = Color(0xFF5F9E78)
    val Accent500 = Color(0xFF2E7550)
    val Accent600 = Color(0xFF1A5236)
    val Accent700 = Color(0xFF14432C)
    val Accent800 = Color(0xFF0F3622)
    val Accent900 = Color(0xFF0A2618)

    val Neutral200 = Color(0xFFE7E7EA)
    val Neutral300 = Color(0xFFD4D4D7)
    val Neutral500 = Color(0xFF98989B)
    val Neutral600 = Color(0xFF7A7A7D)
    val Neutral700 = Color(0xFF5D5D60)
    val Neutral800 = Color(0xFF424244)

    /** Faint blueprint grid behind every screen (5% ink, 24dp pitch). */
    val Grid = Ink.copy(alpha = 0.05f)
    val Scrim = Color(0x730A140F)
}

/** The two type families: condensed uppercase headings and a plain body face. */
@Immutable
class LzFonts(val heading: FontFamily, val body: FontFamily)

val LocalLzFonts = staticCompositionLocalOf { LzFonts(FontFamily.SansSerif, FontFamily.SansSerif) }

// CSS line-height centres the glyphs in the line box; this matches it.
private val CssLineHeight = LineHeightStyle(LineHeightStyle.Alignment.Center, LineHeightStyle.Trim.None)

/** Barlow Condensed heading style. Callers uppercase their own strings, as the CSS did. */
@Composable
fun heading(size: Int, lineHeight: Int? = null, weight: Int = 600, tracking: Float = 0f, color: Color = Lz.Ink) = TextStyle(
    fontFamily = LocalLzFonts.current.heading,
    fontWeight = FontWeight(weight),
    fontSize = size.sp,
    lineHeight = lineHeight?.sp ?: TextUnit.Unspecified,
    letterSpacing = tracking.em,
    lineHeightStyle = CssLineHeight,
    color = color,
)

/** Archivo body style. */
@Composable
fun body(size: Int, lineHeight: Int? = null, weight: Int = 400, tracking: Float = 0f, color: Color = Lz.Ink) = TextStyle(
    fontFamily = LocalLzFonts.current.body,
    fontWeight = FontWeight(weight),
    fontSize = size.sp,
    lineHeight = lineHeight?.sp ?: TextUnit.Unspecified,
    letterSpacing = tracking.em,
    lineHeightStyle = CssLineHeight,
    color = color,
)

/** Small spaced-out uppercase label: "11px · 700 · .12em" everywhere in the prototype. */
@Composable
fun label(size: Int = 11, tracking: Float = 0.12f, color: Color = Lz.Ink) = body(size, weight = 700, tracking = tracking, color = color)
