package com.lezerv.app.ui.map

import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.LocalPlane
import com.lezerv.app.data.MapAim
import kotlin.math.roundToInt

/**
 * Where map units land on screen, for whichever map is underneath.
 *
 * Screens place pins in map units (see LocalPlane). On the drawn map one unit is one dp
 * inside the 720×1040 world. On the real map (MapLibre) a unit becomes a latitude and
 * longitude, then a pixel on the current camera; it moves and scales as people pan and zoom.
 *
 * Both functions are called while laying out, never while composing, so a camera move
 * only re-places the pins instead of rebuilding them.
 */
@Stable
interface MapProjection {
    /** Pixels from the map's top-left corner to map point ([x], [y]). */
    fun Density.toPx(x: Float, y: Float): Offset
    /** Pixels one map unit covers right now. */
    fun Density.unitPx(): Float
}

/** The drawn map: one unit = one dp. */
object DrawnProjection : MapProjection {
    override fun Density.toPx(x: Float, y: Float) = Offset(x.dp.toPx(), y.dp.toPx())
    override fun Density.unitPx() = 1.dp.toPx()
}

val LocalMapProjection = staticCompositionLocalOf<MapProjection> { DrawnProjection }

/**
 * Places a child at map point ([x], [y]), then [dx]/[dy] further in dp. The point is
 * on the map (it moves with it); the dp shift is on screen (a pin's size doesn't zoom).
 */
fun Modifier.at(x: Float, y: Float, dx: Dp = 0.dp, dy: Dp = 0.dp): Modifier = composed {
    val p = LocalMapProjection.current
    offset {
        val o = with(p) { toPx(x, y) }
        IntOffset((o.x + dx.toPx()).roundToInt(), (o.y + dy.toPx()).roundToInt())
    }
}

/**
 * A square [r] map units either side of ([cx], [cy]): grows and shrinks with the zoom.
 * Zoomed right in, a ring can be tens of thousands of pixels across, more than a layout can
 * hold; it would be off screen anyway, so past [MAX_SIDE_PX] it isn't drawn.
 */
internal fun Modifier.mapSquare(cx: Float, cy: Float, r: Float): Modifier = composed {
    val p = LocalMapProjection.current
    layout { measurable, _ ->
        val side = (2 * r * with(p) { unitPx() }).roundToInt().coerceAtLeast(0).let { if (it > MAX_SIDE_PX) 0 else it }
        val placeable = measurable.measure(Constraints.fixed(side, side))
        layout(side, side) {
            val c = with(p) { toPx(cx, cy) }
            placeable.place((c.x - side / 2f).roundToInt(), (c.y - side / 2f).roundToInt())
        }
    }
}

private const val MAX_SIDE_PX = 16_000

/**
 * A real map the screens can draw on, provided by the platform (MapLibre on Android).
 * When there is none (desktop previews, the demo) screens use the drawn Lekki map.
 */
interface GeoMap {
    /**
     * Shows the map for [plane], looking where [aim] says, with [overlay] (pins, rings,
     * the user dot) placed through [LocalMapProjection]. [interactive] = pan and zoom.
     * [grid] draws the blueprint grid over it, like the drawn map's. [credit] says where
     * the map data's credit line goes, clear of the screen's own cards.
     */
    @Composable
    fun Show(plane: LocalPlane, aim: MapAim, interactive: Boolean, grid: Boolean, credit: MapCredit, modifier: Modifier, overlay: @Composable BoxScope.() -> Unit)
}

/**
 * Where the "© OpenStreetMap" line sits. The map data is free on the condition that it is
 * credited where people can see it, so screens keep it out from under their sheets.
 */
data class MapCredit(val align: Alignment = Alignment.BottomEnd, val padding: PaddingValues = PaddingValues(4.dp))

val LocalGeoMap = staticCompositionLocalOf<GeoMap?> { null }
