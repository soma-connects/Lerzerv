package com.lezerv.app.data

import kotlin.math.PI
import kotlin.math.cos

/** A point on Earth in degrees, as GPS and the backend give it. */
data class GeoPoint(val lat: Double, val lng: Double)

/** A position from the phone, and how sure it is (radius in metres). */
data class GeoFix(val point: GeoPoint, val accuracyM: Float)

/**
 * Lekki Phase 1, the centre of the drawn map (its scale bar reads 6.4478° N 3.4723° E).
 * "You" are here until the phone's GPS says otherwise, and always in the demo.
 */
val LEKKI_PHASE_1 = GeoPoint(6.4478, 3.4723)

/** Kilometres per degree of latitude (nearly the same everywhere). */
private const val KM_PER_LAT = 110.57

/**
 * The app's flat "map units" around [origin]. Every screen positions things in map units:
 * the origin sits at ([UX], [UY]), [KM] units make a kilometre, east is +x and north is −y.
 *
 * Treating this patch of the Earth as flat is fine at the app's scale: within 10 km it is
 * off by a few metres, less than a GPS fix. So the drawn map, the real map and distances
 * all work from the same numbers.
 */
data class LocalPlane(val origin: GeoPoint) {
    /** Kilometres per degree of longitude, which shrinks away from the equator. */
    private val kmPerLng = 111.32 * cos(origin.lat * PI / 180)

    fun toMap(p: GeoPoint): Pt = toMap((p.lng - origin.lng) * kmPerLng, (p.lat - origin.lat) * KM_PER_LAT)

    fun toMap(eastKm: Double, northKm: Double): Pt = Pt((UX + eastKm * KM).toFloat(), (UY - northKm * KM).toFloat())

    fun toGeo(p: Pt): GeoPoint = GeoPoint(origin.lat + (UY - p.y) / KM / KM_PER_LAT, origin.lng + (p.x - UX) / KM / kmPerLng)

    /** Straight-line distance in km between two points. */
    fun km(a: GeoPoint, b: GeoPoint): Double {
        val pa = toMap(a); val pb = toMap(b)
        return kotlin.math.hypot((pa.x - pb.x).toDouble(), (pa.y - pb.y).toDouble()) / KM
    }
}

/**
 * Where a map should look: [target] (map units) placed [fromTop] dp below the top edge and
 * centred across. A new [seq] asks again, e.g. "my location" tapped twice.
 */
data class MapAim(val target: Pt, val fromTop: Float, val seq: Int = 0)

/**
 * Centre points of the backend's service areas the app's address form offers, the same
 * values migration 0025 seeds. An address without its own pin is shown here.
 */
val AREA_CENTRES = mapOf(
    "lekki" to GeoPoint(6.4450, 3.4900),
    "ikoyi" to GeoPoint(6.4541, 3.4339),
)
