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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Data shapes exactly as Supabase returns them (snake_case column names).
// They mirror the SQL in soma-connects/Lerzerv supabase/migrations; field
// defaults cover columns a given RPC doesn't return.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

/** artisan_services row (0028) or artisan_services_public() result. */
@Serializable
data class ArtisanServiceDto(
    val id: String = "",
    @SerialName("category_id") val categoryId: String = "",
    val name: String = "",
    @SerialName("from_price_kobo") val fromPriceKobo: Int = 0,
    val active: Boolean = true,
    val sort: Int = 0,
    @SerialName("category_name") val categoryName: String? = null,
    @SerialName("category_slug") val categorySlug: String? = null,
    @SerialName("from_price_naira") val fromPriceNairaField: Double? = null,
) {
    val fromPriceNaira: Int get() = fromPriceNairaField?.toInt() ?: (fromPriceKobo / 100)
}

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
    @SerialName("job_number") val jobNumber: String? = null,
    @SerialName("requested_artisan_id") val requestedArtisanId: String? = null,
    val requested: NameRef? = null,
    @SerialName("offer_expires_at") val offerExpiresAt: String? = null,
    @SerialName("offer_accepted_at") val offerAcceptedAt: String? = null,
    @SerialName("en_route_at") val enRouteAt: String? = null,
    @SerialName("arrived_at") val arrivedAt: String? = null,
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
    /** 0029: the artisan's own service the client picked; the server takes its price. */
    val optionServiceId: String? = null,
    /** 0029: the price before Lezerv's fee, in kobo, when there is no [optionServiceId]. */
    val estimateKobo: Int? = null,
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
    @SerialName("job_number") val jobNumber: String? = null,
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
    @SerialName("en_route_at") val enRouteAt: String? = null,
    @SerialName("arrived_at") val arrivedAt: String? = null,
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
    /** 0029: the listed price the server set at booking (the artisan's own service price). */
    @SerialName("price_kobo") val priceKobo: Int? = null,
) {
    val offerPending get() = status == "assigned" && offerExpiresAt != null && offerAcceptedAt == null
    fun detail(key: String): String? = details?.get(key)?.jsonPrimitive?.contentOrNull
    /** 0029 keeps the time in scheduled_for (it drops a "when" detail); older jobs had the detail. */
    fun whenLabel(nowMs: Long, zone: java.time.ZoneId = java.time.ZoneId.systemDefault()): String =
        detail("when") ?: whenWanted(scheduledFor, nowMs, zone)
}

/** 0030: Real-time telemetry point recorded while an artisan is en route. */
@Serializable
data class JobLocationDto(
    val id: String = "",
    @SerialName("job_id") val jobId: String,
    @SerialName("artisan_id") val artisanId: String? = null,
    val lat: Double,
    val lng: Double,
    val heading: Double? = null,
    val speed: Double? = null,
    val accuracy: Double? = null,
    val at: String = "",
    @SerialName("created_at") val createdAt: String = "",
)


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Payments, Escrow & Earnings (0032, Segments S7 & S8)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Paystack checkout initialization returned by the payments-init Edge Function. */
@Serializable
data class PaymentInitDto(
    @SerialName("authorization_url") val authorizationUrl: String,
    @SerialName("access_code") val accessCode: String,
    val reference: String,
    @SerialName("amount_kobo") val amountKobo: Long,
    @SerialName("fee_kobo") val feeKobo: Long,
    @SerialName("base_amount_kobo") val baseAmountKobo: Long = 0L,
) {
    val totalNaira: Double get() = amountKobo / 100.0
    val feeNaira: Double get() = feeKobo / 100.0
    val baseNaira: Double get() = baseAmountKobo / 100.0
}

/** Tokenized card payment method stored in public.payment_methods (no PAN/CVV). */
@Serializable
data class PaymentMethodDto(
    val id: String,
    @SerialName("authorization_code") val authorizationCode: String = "",
    val last4: String,
    val brand: String,
    @SerialName("exp_month") val expMonth: String? = null,
    @SerialName("exp_year") val expYear: String? = null,
    val reusable: Boolean = true,
    @SerialName("created_at") val createdAt: String = "",
) {
    val expiry: String get() = if (expMonth != null && expYear != null) "$expMonth/${expYear.takeLast(2)}" else ""
}

/** Real-time earnings returned by public.my_earnings() RPC. */
@Serializable
data class EarningsDto(
    @SerialName("available_kobo") val availableKobo: Long = 0L,
    @SerialName("in_escrow_kobo") val inEscrowKobo: Long = 0L,
    @SerialName("paid_out_kobo") val paidOutKobo: Long = 0L,
    val currency: String = "NGN",
) {
    val availableNaira: Double get() = availableKobo / 100.0
    val inEscrowNaira: Double get() = inEscrowKobo / 100.0
    val paidOutNaira: Double get() = paidOutKobo / 100.0
}

/** Cancellation refund computation returned by public.compute_cancellation_refund() RPC. */
@Serializable
data class CancellationRefundDto(
    @SerialName("refundable_amount_kobo") val refundableAmountKobo: Long = 0L,
    @SerialName("cancellation_fee_kobo") val cancellationFeeKobo: Long = 0L,
    @SerialName("policy_reason") val policyReason: String = "",
) {
    val refundableNaira: Double get() = refundableAmountKobo / 100.0
    val cancellationFeeNaira: Double get() = cancellationFeeKobo / 100.0
}

/** A row in public.payments table tracking escrow and charges. */
@Serializable
data class PaymentDto(
    val id: String,
    @SerialName("job_id") val jobId: String,
    @SerialName("payer_id") val payerId: String,
    @SerialName("amount_kobo") val amountKobo: Long,
    @SerialName("fee_kobo") val feeKobo: Long = 0L,
    val status: String,
    @SerialName("paystack_reference") val paystackReference: String,
    val channel: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = "",
) {
    val isHeld get() = status == "held" || status == "released"
    val amountNaira get() = amountKobo / 100.0
}

/** 0034: Granular notification preferences for a user profile. */
@Serializable
data class NotificationPreferencesDto(
    @SerialName("notify_messages") val notifyMessages: Boolean = true,
    @SerialName("notify_jobs") val notifyJobs: Boolean = true,
    @SerialName("notify_promos") val notifyPromos: Boolean = true,
)

/** 0035: Trusted emergency contact stored on a user profile. */
@Serializable
data class TrustedContactDto(
    val name: String? = null,
    val phone: String? = null,
)
