package com.lezerv.app.data.remote

import com.lezerv.app.data.Artisan
import com.lezerv.app.data.GeoPoint
import com.lezerv.app.data.KM
import com.lezerv.app.data.LEKKI_PHASE_1
import com.lezerv.app.data.LocalPlane
import com.lezerv.app.data.Review
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

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

/**
 * Where to draw an artisan, in map units around [plane]'s origin (you). With map_artisans()
 * we have a rounded position; with search_artisans() only a distance, so the pin goes at
 * that distance in a direction derived from the id (stable between refreshes, clearly
 * "approximate" in the UI).
 */
fun mapPosition(dto: MapArtisanDto, plane: LocalPlane = LocalPlane(LEKKI_PHASE_1)): Pair<Float, Float> {
    val h = stableHash(dto.id)
    // Spread artisans that share a spot so their pins don't stack: ~100 m within a rounded
    // ~550 m square, ~500 m around an area's centre, where many can share the exact point.
    val spread = if (dto.approximate) 50.0 else 100.0
    val jitterE = ((h % 21) - 10) / spread
    val jitterN = (((h / 21) % 21) - 10) / spread
    if (dto.lat != null && dto.lng != null) {
        val p = plane.toMap(GeoPoint(dto.lat, dto.lng))
        return (p.x + jitterE * KM).toFloat() to (p.y - jitterN * KM).toFloat()
    }
    val bearing = (h % 360) * PI / 180
    return plane.toMap(dto.distanceKm * sin(bearing), dto.distanceKm * cos(bearing)).let { it.x to it.y }
}

/** "Tunde Bakare" → "TB". */
fun initialsOf(name: String): String =
    name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }

/** Backend row → the app's Artisan model, placed around [plane]'s origin. */
fun MapArtisanDto.toArtisan(plane: LocalPlane = LocalPlane(LEKKI_PHASE_1)): Artisan {
    val svc = categories.firstNotNullOfOrNull(::appCategory) ?: "repair"
    // The artisan's own category for that chip: booking must name one they offer.
    val slug = categories.firstOrNull { appCategory(it) == svc }
    val (from, unit) = TYPICAL_FROM.getValue(svc)
    val (x, y) = mapPosition(this, plane)
    return Artisan(
        id = id, name = displayName, ini = initialsOf(displayName),
        svc = svc, x = x, y = y,
        rating = (avgRating * 10).roundToInt() / 10.0, reviews = totalReviews, jobs = completedJobs,
        from = from, unit = unit, online = isAvailable, verified = isVerified, laundry = svc == "laundry",
        bio = bio?.takeIf { it.isNotBlank() } ?: "${yearsExperience.takeIf { it > 0 }?.let { "$it years’ experience. " } ?: ""}Verified by Lezerv.",
        busyLabel = "Not taking jobs now",
        slug = slug,
        areaLabel = areaName?.takeIf { approximate },
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
    val t = parseIso(iso)?.atZoneSameInstant(zone) ?: return ""
    val today = Instant.ofEpochMilli(nowMs).atZone(zone).toLocalDate()
    return when (t.toLocalDate()) {
        today -> "%02d:%02d".format(t.hour, t.minute)
        today.minusDays(1) -> "Yesterday"
        else -> "${t.dayOfMonth} ${MONTHS[t.monthValue - 1]}"
    }
}

private fun parseIso(iso: String): OffsetDateTime? {
    val normal = iso.trim().replace(' ', 'T').let { if (Regex("[+-]\\d{2}$").containsMatchIn(it)) "$it:00" else it }
    return runCatching { OffsetDateTime.parse(normal) }.getOrNull()
}

/** A database timestamp as epoch milliseconds, for countdowns. */
fun isoMillis(iso: String?): Long? = iso?.let(::parseIso)?.toInstant()?.toEpochMilli()

/** Whole seconds left until [iso], never negative. */
fun secondsLeft(iso: String?, nowMs: Long): Int = isoMillis(iso)?.let { ((it - nowMs + 999) / 1000).toInt().coerceAtLeast(0) } ?: 0

/** "J-1042", the reference people read out to support. */
fun jobRef(number: Long?): String? = number?.let { "J-$it" }

/** The app's areas → service_areas slugs (0008). Lekki Phase 1, Ikate and Osapa are all Lekki. */
fun areaSlug(area: String): String = if (area.startsWith("Ikoyi")) "ikoyi" else "lekki"

/**
 * One line under a job in the Jobs tab, from its status (0008), quote (0018) and offer (0023).
 * [nowMs] drives the "waiting for Tunde · 23s" countdown.
 */
fun jobStatus(j: JobDto, nowMs: Long): String {
    val who = j.artisan?.displayName?.takeIf { it.isNotBlank() } ?: "Your artisan"
    val asked = j.requested?.displayName?.substringBefore(' ')
    return when (j.status) {
        "open" -> if (asked != null) "$asked couldn’t take it · Lezerv is finding someone else" else "Requested · Lezerv is confirming an artisan"
        "assigned" -> when {
            j.offerPending -> "Waiting for ${who.substringBefore(' ')} to accept · ${secondsLeft(j.offerExpiresAt, nowMs)}s"
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
