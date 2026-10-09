package com.lezerv.app.data.remote

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

/**
 * Where the backend lives. Comes from local.properties on Android (never committed);
 * when it isn't set the app runs on sample data only.
 */
data class BackendConfig(val url: String, val anonKey: String) {
    val isSet get() = url.startsWith("https://") && anonKey.isNotBlank()
}

// ─────────────────────────────────────────────────────────────────────────────
// Data shapes exactly as Supabase returns them (snake_case column names).
// They mirror the SQL in soma-connects/Lerzerv supabase/migrations; field
// defaults cover columns a given RPC doesn't return.
// ─────────────────────────────────────────────────────────────────────────────

@Serializable
data class CategoryDto(
    val id: String = "",
    val slug: String,
    val name: String,
    @SerialName("sort_order") val sortOrder: Int = 0,
)

/** Row from map_artisans() (0022) or search_artisans() (0005; no lat/lng/is_available). */
@Serializable
data class MapArtisanDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val bio: String? = null,
    val city: String? = null,
    @SerialName("years_experience") val yearsExperience: Int = 0,
    @SerialName("is_verified") val isVerified: Boolean = false,
    @SerialName("is_available") val isAvailable: Boolean = true,
    @SerialName("avg_rating") val avgRating: Double = 0.0,
    @SerialName("total_reviews") val totalReviews: Int = 0,
    @SerialName("completed_jobs") val completedJobs: Int = 0,
    @SerialName("distance_km") val distanceKm: Double = 0.0,
    val lat: Double? = null,
    val lng: Double? = null,
    val categories: List<String> = emptyList(),
    /** 0025: placed at this service area because the artisan gave no location of their own. */
    @SerialName("area_name") val areaName: String? = null,
    val approximate: Boolean = false,
)

@Serializable
data class SlugName(val slug: String = "", val name: String = "")

@Serializable
data class ReviewDto(
    val rating: Int,
    val comment: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    val reviewer: String = "Client",
)

/** get_artisan_public() jsonb. */
@Serializable
data class ArtisanPublicDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val bio: String? = null,
    @SerialName("is_verified") val isVerified: Boolean = false,
    @SerialName("avg_rating") val avgRating: Double = 0.0,
    @SerialName("total_reviews") val totalReviews: Int = 0,
    @SerialName("completed_jobs") val completedJobs: Int = 0,
    val categories: List<SlugName> = emptyList(),
    val reviews: List<ReviewDto> = emptyList(),
)

@Serializable
data class ProfileDto(
    val id: String,
    val email: String? = null,
    @SerialName("full_name") val fullName: String? = null,
    val phone: String? = null,
    val role: String? = null,
)

@Serializable
data class NameRef(@SerialName("display_name") val displayName: String = "")

@Serializable
data class TitleRef(val title: String = "")

/** A service_jobs row with the category and assigned artisan embedded. */
@Serializable
data class JobDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val status: String,
    @SerialName("scheduled_for") val scheduledFor: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("address_text") val addressText: String? = null,
    @SerialName("budget_note") val budgetNote: String? = null,
    @SerialName("quoted_amount") val quotedAmount: Double? = null,
    @SerialName("agreed_amount") val agreedAmount: Double? = null,
    @SerialName("assigned_artisan_id") val assignedArtisanId: String? = null,
    val category: SlugName? = null,
    val artisan: NameRef? = null,
    // 0023: booking a chosen artisan
    @SerialName("job_number") val jobNumber: Long? = null,
    @SerialName("requested_artisan_id") val requestedArtisanId: String? = null,
    val requested: NameRef? = null,
    @SerialName("offer_expires_at") val offerExpiresAt: String? = null,
    @SerialName("offer_accepted_at") val offerAcceptedAt: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
) {
    /** Sent to the chosen artisan, who hasn't answered yet. */
    val offerPending get() = status == "assigned" && offerExpiresAt != null && offerAcceptedAt == null
}

@Serializable
data class ConversationDto(
    val id: String,
    @SerialName("job_id") val jobId: String? = null,
    @SerialName("artisan_id") val artisanId: String? = null,
    @SerialName("last_message_at") val lastMessageAt: String = "",
    val artisan: NameRef? = null,
    val job: TitleRef? = null,
)

@Serializable
data class MessageDto(
    val id: String,
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("sender_id") val senderId: String? = null,
    val body: String,
    @SerialName("is_system") val isSystem: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val body: String? = null,
    val link: String? = null,
    val read: Boolean = false,
    @SerialName("created_at") val createdAt: String = "",
)

@Serializable
data class TicketDto(
    val id: String,
    val subject: String,
    val status: String,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("last_reply_at") val lastReplyAt: String? = null,
    @SerialName("job_id") val jobId: String? = null,
)

@Serializable
data class TicketMessageDto(
    val id: String,
    @SerialName("ticket_id") val ticketId: String,
    @SerialName("sender_role") val senderRole: String,
    val body: String,
    @SerialName("created_at") val createdAt: String = "",
)

/** A saved place (client_addresses, 0023). A blank [id] means "not saved yet". */
@Serializable
data class AddressDto(
    val id: String = "",
    val label: String,
    val street: String,
    val area: String,
    @SerialName("area_slug") val areaSlug: String,
    val note: String? = null,
    /** The pin from "use my current location" (exact; only the owner and, once booked, their artisan see it). */
    val lat: Double? = null,
    val lng: Double? = null,
)

/** What the app sends to book_artisan() (0023). [details] lands in service_jobs.details. */
data class Booking(
    val artisanId: String,
    val categorySlug: String,
    val title: String,
    val addressId: String,
    val description: String?,
    val scheduledFor: String?,
    val budgetNote: String?,
    val details: Map<String, String>,
)

@Serializable
data class StartCodeDto(@SerialName("job_id") val jobId: String, @SerialName("start_code") val startCode: String)

/** start_job(): started, or how many tries are left after a wrong code. */
@Serializable
data class StartResult(val started: Boolean, @SerialName("attempts_left") val attemptsLeft: Int? = null)

/** The signed-in person's own artisans row, if they are an artisan. */
@Serializable
data class MyArtisanDto(
    val id: String,
    @SerialName("display_name") val displayName: String,
    val status: String,
    @SerialName("is_available") val isAvailable: Boolean = false,
    @SerialName("service_radius_km") val serviceRadiusKm: Int = 5,
    @SerialName("avg_rating") val avgRating: Double = 0.0,
    @SerialName("is_verified") val isVerified: Boolean = false,
)

/** A row of my_artisan_jobs() (0023, 0027): what an artisan may see of a job. */
@Serializable
data class ArtisanJobDto(
    val id: String,
    @SerialName("job_number") val jobNumber: Long? = null,
    val title: String,
    val description: String? = null,
    val status: String,
    @SerialName("category_slug") val categorySlug: String? = null,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("area_name") val areaName: String? = null,
    @SerialName("address_text") val addressText: String? = null,
    @SerialName("scheduled_for") val scheduledFor: String? = null,
    @SerialName("budget_note") val budgetNote: String? = null,
    val details: JsonObject? = null,
    @SerialName("offer_expires_at") val offerExpiresAt: String? = null,
    @SerialName("offer_accepted_at") val offerAcceptedAt: String? = null,
    @SerialName("started_at") val startedAt: String? = null,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("agreed_amount") val agreedAmount: Double? = null,
    @SerialName("client_first_name") val clientFirstName: String? = null,
    @SerialName("conversation_id") val conversationId: String? = null,
    /** 0027: the area's centre, for offers (no street yet). */
    @SerialName("area_lat") val areaLat: Double? = null,
    @SerialName("area_lng") val areaLng: Double? = null,
    /** 0027: the client's pin, once the job is theirs. Null if the address has none. */
    val lat: Double? = null,
    val lng: Double? = null,
) {
    val offerPending get() = status == "assigned" && offerExpiresAt != null && offerAcceptedAt == null
    fun detail(key: String): String? = details?.get(key)?.jsonPrimitive?.contentOrNull
}
