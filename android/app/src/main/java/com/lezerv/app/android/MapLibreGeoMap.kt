package com.lezerv.app.android

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.lezerv.app.data.KM
import com.lezerv.app.data.LocalPlane
import com.lezerv.app.data.MapAim
import com.lezerv.app.data.Pt
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.map.GeoMap
import com.lezerv.app.ui.map.LocalMapProjection
import com.lezerv.app.ui.map.MapCredit
import com.lezerv.app.ui.map.MapProjection
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.label
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.BackgroundLayer
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.PropertyFactory
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.pow

/**
 * The real map: MapLibre (open source) drawing OpenStreetMap data, tinted in Lezerv's colours.
 *
 * MapLibre is an Android View, so it sits inside Compose through AndroidView. The pins stay
 * Compose (the same composables the drawn map uses): an overlay on top asks MapLibre where
 * each lat/lng is on screen, through [LocalMapProjection]. Every camera move bumps a counter
 * the overlay reads while laying out, so pins follow the map frame by frame without being
 * rebuilt.
 *
 * [styleUrl] is the map's look and data source (BuildConfig.MAP_STYLE_URL): OpenFreeMap's
 * free "positron" style unless local.properties names another.
 */
class MapLibreGeoMap(private val styleUrl: String) : GeoMap {

    @Composable
    override fun Show(plane: LocalPlane, aim: MapAim, interactive: Boolean, grid: Boolean, credit: MapCredit, modifier: Modifier, overlay: @Composable BoxScope.() -> Unit) {
        val context = LocalContext.current
        val lifecycle = LocalLifecycleOwner.current.lifecycle
        val mapView = remember {
            MapLibre.getInstance(context) // once per process; cheap after the first call
            MapView(context).also { it.onCreate(null) }
        }
        var map by remember { mutableStateOf<MapLibreMap?>(null) }
        val camera = remember { mutableIntStateOf(0) }
        var size by remember { mutableStateOf(IntSize.Zero) }

        // MapView needs the activity's start/resume/pause/stop, and a destroy when it leaves.
        DisposableEffect(lifecycle, mapView) {
            val observer = LifecycleEventObserver { _, event ->
                when (event) {
                    Lifecycle.Event.ON_START -> mapView.onStart()
                    Lifecycle.Event.ON_RESUME -> mapView.onResume()
                    Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                    Lifecycle.Event.ON_STOP -> mapView.onStop()
                    else -> Unit
                }
            }
            lifecycle.addObserver(observer) // replays start/resume if the activity is already there
            onDispose {
                lifecycle.removeObserver(observer)
                // Leaving while the activity is still on screen: wind the map down ourselves.
                if (lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) mapView.onPause()
                if (lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) mapView.onStop()
                mapView.onDestroy()
            }
        }

        // Look where the screen asks: on first show, and whenever the aim or "you" change.
        var placed by remember { mutableStateOf(false) }
        LaunchedEffect(map, aim, plane, size) {
            val m = map ?: return@LaunchedEffect
            if (size.height == 0) return@LaunchedEffect
            val zoom = if (placed) m.cameraPosition.zoom else ZOOM
            // The target should sit aim.fromTop dp from the top, so the camera's centre is
            // that much further down the map: convert the dp to map units at this zoom.
            val dpBelow = size.height / 2f / context.resources.displayMetrics.density - aim.fromTop
            val centre = plane.toGeo(Pt(aim.target.x, aim.target.y + dpBelow / dpPerUnit(plane, zoom)))
            val update = CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(centre.lat, centre.lng)).zoom(zoom).build())
            if (placed) m.animateCamera(update, 450) else m.moveCamera(update)
            placed = true
        }

        val projection = remember(map, plane) {
            object : MapProjection {
                override fun Density.toPx(x: Float, y: Float): Offset {
                    camera.intValue // re-place when the camera moves
                    val m = map ?: return Offset(-10_000f, -10_000f) // off screen until the map is ready
                    val g = plane.toGeo(Pt(x, y))
                    val p = m.projection.toScreenLocation(LatLng(g.lat, g.lng))
                    return Offset(p.x, p.y)
                }

                override fun Density.unitPx(): Float {
                    // A kilometre measured on screen, so rings zoom with the map.
                    val a = toPx(UX, UY)
                    val b = toPx(UX + KM, UY)
                    return hypot(b.x - a.x, b.y - a.y) / KM
                }
            }
        }

        Box(modifier.background(Lz.Bg)) {
            AndroidView(
                factory = { mapView.also { it.getMapAsync { m -> setUp(m, interactive) { camera.intValue++ }; map = m } } },
                modifier = Modifier.fillMaxSize().onSizeChanged { size = it },
            )
            // A still map (an inset in a scrolling page) must not take the finger: this layer
            // catches touches before MapLibre does, without using them, so the page scrolls.
            if (!interactive) Box(Modifier.fillMaxSize().pointerInput(Unit) {})
            CompositionLocalProvider(LocalMapProjection provides projection) {
                Box(Modifier.fillMaxSize(), content = overlay)
            }
            if (grid) BlueprintGrid()
            Txt("© OpenStreetMap", label(9, .02f, Lz.Neutral700),
                Modifier.align(credit.align).padding(credit.padding).background(Lz.Bg.copy(alpha = .85f)).padding(horizontal = 4.dp, vertical = 1.dp))
        }
    }

    private fun setUp(m: MapLibreMap, interactive: Boolean, onMove: () -> Unit) {
        m.setStyle(Style.Builder().fromUri(styleUrl)) { style -> tint(style) }
        with(m.uiSettings) {
            // The credit line is drawn by Show(); MapLibre's own buttons would sit under our cards.
            setAttributionEnabled(false)
            setLogoEnabled(false)
            setCompassEnabled(false)
            setRotateGesturesEnabled(false) // north stays up, like the drawn map
            setTiltGesturesEnabled(false)
            setScrollGesturesEnabled(interactive)
            setZoomGesturesEnabled(interactive)
            setDoubleTapGesturesEnabled(interactive)
        }
        m.setMinZoomPreference(9.0)  // Lagos and around
        m.setMaxZoomPreference(18.0) // street level
        m.addOnCameraMoveListener { onMove() }
        m.addOnCameraIdleListener { onMove() }
    }

    /** Water, parks and the ground in Lezerv's greens, so the real map looks like the designed one. */
    private fun tint(style: Style) {
        style.layers.forEach { layer ->
            val id = layer.id.lowercase()
            when {
                layer is BackgroundLayer -> layer.setProperties(PropertyFactory.backgroundColor(Lz.Bg.toArgb()))
                layer is FillLayer && "water" in id -> layer.setProperties(PropertyFactory.fillColor(Lz.Accent100.toArgb()))
                layer is FillLayer && ("park" in id || "grass" in id || "wood" in id) -> layer.setProperties(PropertyFactory.fillColor(Lz.Accent200.toArgb()))
            }
        }
    }

    private companion object {
        /**
         * The drawn map's scale (120 dp per km) at Lagos's latitude. MapLibre's zoom z shows
         * 78,271.5 × cos(lat) / 2^z metres per dp.
         */
        const val ZOOM = 13.2

        fun dpPerUnit(plane: LocalPlane, zoom: Double): Float {
            val metresPerDp = 78_271.517 * cos(plane.origin.lat * PI / 180) / 2.0.pow(zoom)
            return ((1000.0 / KM) / metresPerDp).toFloat()
        }
    }
}

/** The drawn map's faint green engineering grid, over the real map (the "layers" button). */
@Composable
private fun BlueprintGrid() {
    val line = Lz.Accent.copy(alpha = .16f)
    Canvas(Modifier.fillMaxSize()) {
        val step = 40 * density
        var x = 0f
        while (x < size.width) { drawLine(line, Offset(x, 0f), Offset(x, size.height), .5f * density); x += step }
        var y = 0f
        while (y < size.height) { drawLine(line, Offset(0f, y), Offset(size.width, y), .5f * density); y += step }
    }
}
