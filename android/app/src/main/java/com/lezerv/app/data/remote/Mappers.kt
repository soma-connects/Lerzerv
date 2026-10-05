package com.lezerv.app.data.remote

import com.lezerv.app.data.Artisan
import com.lezerv.app.data.KM
import com.lezerv.app.data.Review
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Where "you" are until the app reads the phone's GPS (next step): Lekki Phase 1,
 * the centre of the drawn map (its scale bar reads 6.4478° N 3.4723° E).
 */
const val REF_LAT = 6.4478
const val REF_LNG = 3.4723

/** Backend category slug → the app's category chip. */
fun appCategory(slug: String): String? = when (slug) {
    "cleaning" -> "clean"
    "laundry" -> "laundry"
    "cooking" -> "cook"
    "plumbing", "borehole-water" -> "plumb"
    "electrical", "solar-inverter" -> "elec"
    "ac-refrigeration" -> "ac"
    "generator-power" -> "gen"
    "carpentry", "appliance-repair", "painting", "masonry-tiling", "pest-control", "landscaping", "home-security" -> "repair"
    else -> null
}

/** App chip → the slug create_service_job() expects. */
fun backendSlug(appKey: String): String = when (appKey) {
    "clean" -> "cleaning"; "laundry" -> "laundry"; "cook" -> "cooking"; "plumb" -> "plumbing"
    "elec" -> "electrical"; "ac" -> "ac-refrigeration"; "gen" -> "generator-power"
    else -> "appliance-repair"
}

/**
 * Indicative Lagos "from" prices per category, matching the website's pricing page
 * (Aug 2026). Used until artisans set their own prices (artisan_services, migration B).
 */
val TYPICAL_FROM = mapOf(
    "clean" to (25000 to "per visit"), "gen" to (20000 to "call-out"), "plumb" to (15000 to "call-out"),
    "repair" to (15000 to "call-out"), "elec" to (15000 to "call-out"), "ac" to (15000 to "per unit"),
    "cook" to (18000 to "per day"), "laundry" to (12000 to "per load"),
)

private fun stableHash(s: String): Int = s.fold(17) { h, c -> h * 31 + c.code }.let { abs(it) }

/** Kilometres east/north of the reference point → drawn-map units. */
private fun toMap(eastKm: Double, northKm: Double): Pair<Float, Float> =
    (UX + eastKm * KM).toFloat() to (UY - northKm * KM).toFloat()

/**
 * Where to draw an artisan. With map_artisans() we have a rounded position; with
 * search_artisans() only a distance, so the pin goes at that distance in a direction
 * derived from the id (stable between refreshes, clearly "approximate" in the UI).
 */
fun mapPosition(dto: MapArtisanDto): Pair<Float, Float> {
    val h = stableHash(dto.id)
    // Spread artisans that share a ~550 m grid square so their pins don't stack.
    val jitterE = ((h % 21) - 10) / 100.0
    val jitterN = (((h / 21) % 21) - 10) / 100.0
    if (dto.lat != null && dto.lng != null) {
        val east = (dto.lng - REF_LNG) * 111.32 * cos(REF_LAT * PI / 180)
        val north = (dto.lat - REF_LAT) * 110.57
        return toMap(east + jitterE, north + jitterN)
    }
    val bearing = (h % 360) * PI / 180
    return toMap(dto.distanceKm * sin(bearing), dto.distanceKm * cos(bearing))
}

/** "Tunde Bakare" → "TB". */
fun initialsOf(name: String): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }

/** Backend row → the app's Artisan model. */
fun MapArtisanDto.toArtisan(): Artisan {
    val svc = categories.firstNotNullOfOrNull(::appCategory) ?: "repair"
    val (from, unit) = TYPICAL_FROM.getValue(svc)
    val (x, y) = mapPosition(this)
    return Artisan(
        id = id, name = displayName, ini = initialsOf(displayName),
        svc = svc, x = x, y = y,
        rating = (avgRating * 10).roundToInt() / 10.0, reviews = totalReviews, jobs = completedJobs,
        from = from, unit = unit, online = isAvailable, verified = isVerified, laundry = svc == "laundry",
        bio = bio?.takeIf { it.isNotBlank() } ?: "${yearsExperience.takeIf { it > 0 }?.let { "$it years’ experience. " } ?: ""}Verified by Lezerv.",
        busyLabel = "Not taking jobs now",
    )
}

private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")

/** "2026-09-12T10:22:00+00:00" → "12 Sep". */
fun shortDate(iso: String): String {
    val parts = iso.take(10).split("-")
    if (parts.size != 3) return ""
    val month = MONTHS.getOrNull((parts[1].toIntOrNull() ?: 0) - 1) ?: return ""
    return "${parts[2].toInt()} $month"
}

/**
 * When something happened, the way chats and notifications show it: "09:12" today,
 * "Yesterday", otherwise "12 Sep", in the phone's time zone.
 * Accepts both the REST form (…T09:12:00.123+00:00) and Postgres text (… 09:12:00+00).
 */
fun timeLabel(iso: String, nowMs: Long, zone: ZoneId): String {
    val normal = iso.trim().replace(' ', 'T').let { if (Regex("[+-]\\d{2}$").containsMatchIn(it)) "$it:00" else it }
    val t = runCatching { OffsetDateTime.parse(normal).atZoneSameInstant(zone) }.getOrNull() ?: return ""
    val today = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
    return when (t.toLocalDate()) {
        today -> "%02d:%02d".format(t.hour, t.minute)
        today.minusDays(1) -> "Yesterday"
        else -> "${t.dayOfMonth} ${MONTHS[t.monthValue - 1]}"
    }
}

/** The app's areas → service_areas slugs (0008). Lekki Phase 1, Ikate and Osapa are all Lekki. */
fun areaSlug(area: String): String = if (area.startsWith("Ikoyi")) "ikoyi" else "lekki"

/** One line under a job in the Jobs tab, from its service_jobs status (0008) and quote (0018). */
fun jobStatus(j: JobDto): String {
    val who = j.artisan?.displayName?.takeIf { it.isNotBlank() } ?: "Your artisan"
    return when (j.status) {
        "open" -> "Requested · Lezerv is confirming an artisan"
        "assigned" -> when {
            j.agreedAmount != null -> "$who · price agreed, ${com.lezerv.app.data.naira(j.agreedAmount)}"
            j.quotedAmount != null -> "$who proposed ${com.lezerv.app.data.naira(j.quotedAmount)}"
            else -> "$who is assigned · chat to agree a time"
        }
        "in_progress" -> "$who is on the job"
        "completed" -> "Completed"
        "cancelled" -> "Cancelled"
        else -> j.status.replace('_', ' ').replaceFirstChar { it.uppercase() }
    }
}

/** Jobs that are still happening (shown under "Active"); the rest are history. */
val JobDto.active get() = status in setOf("open", "assigned", "in_progress")

fun ReviewDto.toReview() = Review(reviewer, rating, comment?.takeIf { it.isNotBlank() } ?: "No comment.", shortDate(createdAt))
