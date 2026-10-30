package com.lezerv.app.data.remote

import kotlinx.coroutines.flow.Flow

/**
 * A message the database wrote for people (a `raise exception` in one of the RPCs, e.g.
 * "too many support requests â€” please wait a moment"). Safe to show as it is.
 */
class ServerMessage(message: String) : Exception(message)

/**
 * Everything the app asks of the backend, in one place.
 *
 * The rest of the app only knows this interface, not Supabase. That makes the backend
 * swappable and testable: SupabaseApi is the real one; tests use simulated responses.
 * Each function names the RPC or table it uses in soma-connects/Lerzerv.
 */
interface LezervApi {

    // â”€â”€ sign-in (Supabase Auth) â”€â”€
    /** Restores a saved session; returns the signed-in user's id, or null. */
    suspend fun restoreSession(): String?
    /** Texts a 6-digit code. [phone] is E.164, e.g. +2348035554417. */
    suspend fun sendPhoneCode(phone: String)
    suspend fun verifyPhoneCode(phone: String, code: String): String
    /** For people who already have a lezerv.com account (the website signs up by email). */
    suspend fun signInWithEmail(email: String, password: String): String
    suspend fun signOut()
    /** profiles row for the signed-in user. */
    suspend fun myProfile(): ProfileDto?
    suspend fun saveProfile(fullName: String, email: String?)

    // â”€â”€ browsing â”€â”€
    /** service_categories, in display order. */
    suspend fun categories(): List<CategoryDto>
    /** map_artisans() (0022); falls back to search_artisans() if 0022 isn't applied yet. */
    suspend fun artisansNear(lat: Double, lng: Double, radiusKm: Int): List<MapArtisanDto>
    /** get_artisan_public(): bio, stats and recent reviews. */
    /** get_artisan_public(): bio, stats and recent reviews. */
    suspend fun artisanProfile(id: String): ArtisanPublicDto?
    /** artisan_services_public() (0028): active services for clients, all for owning artisan. */
    suspend fun artisanServices(artisanId: String): List<ArtisanServiceDto>
    /** upsert_artisan_service() (0028): create or update a custom service offering. */
    suspend fun upsertArtisanService(
        serviceId: String?,
        categoryId: String,
        name: String,
        fromPriceKobo: Int,
        active: Boolean = true,
        sort: Int = 0
    ): ArtisanServiceDto
    /** delete_artisan_service() (0028): remove a custom service offering. */
    suspend fun deleteArtisanService(serviceId: String)

    // â”€â”€ saved addresses (client_addresses, 0023) â”€â”€
    suspend fun addresses(): List<AddressDto>
    /** Inserts when the id is blank, otherwise updates; returns the saved row. */
    suspend fun saveAddress(a: AddressDto): AddressDto
    suspend fun deleteAddress(id: String)

    // â”€â”€ jobs (service_jobs) â”€â”€
    suspend fun myJobs(): List<JobDto>
    /** book_artisan() (0023): offers the job to the chosen artisan, who has a short time to accept. */
    suspend fun bookArtisan(b: Booking): JobDto
    /** job_private (0023): start codes of the person's jobs, by job id. Only clients can read them. */
    suspend fun startCodes(): Map<String, String>
    suspend fun cancelJob(jobId: String, reason: String)
    /** expire_job_offers(): unanswered offers go back to the pool. Anyone may call it. */
    suspend fun expireOffers()
    /** submit_job_review(): client rates and reviews a completed job. */
    suspend fun submitReview(jobId: String, rating: Int, comment: String?, tags: List<String>)

    // â”€â”€ the artisan side â”€â”€
    /** The person's artisans row, or null if they aren't an artisan. */
    suspend fun myArtisan(): MyArtisanDto?
    /** set_artisan_availability(): online = clients can book you. */
    suspend fun setAvailability(online: Boolean)
    suspend fun setRadius(km: Int)
    /**
     * update_my_location() (0027): where the artisan is. The public map gets it rounded to
     * ~550 m. False when ignored as too soon after the last one (30 s).
     */
    suspend fun updateMyLocation(lat: Double, lng: Double): Boolean
    /** my_artisan_jobs(): offers and accepted work, without the client's start code. */
    suspend fun artisanJobs(): List<ArtisanJobDto>
    suspend fun acceptOffer(jobId: String)
    /** decline_assigned_job() (0020): the job goes back to the pool. */
    suspend fun declineJob(jobId: String, reason: String)
    /** mark_en_route() (0030): sets en_route_at and notifies client. */
    suspend fun markEnRoute(jobId: String)
    /** mark_arrived() (0030): sets arrived_at and notifies client. */
    suspend fun markArrived(jobId: String)
    /** record_job_location() (0030): records live GPS fix during active transit. */
    suspend fun recordJobLocation(jobId: String, lat: Double, lng: Double, heading: Double?, speed: Double?, accuracy: Double?)
    /** jobLocationUpdates() (0030): Realtime stream of telemetry fixes for [jobId]. */
    fun jobLocationUpdates(jobId: String): Flow<JobLocationDto>
    /** start_job() (0023): checks the code the client reads out. */
    suspend fun startJob(jobId: String, code: String): StartResult
    suspend fun completeJob(jobId: String)

    // â”€â”€ chat (conversations, messages, send_message) â”€â”€
    suspend fun conversations(): List<ConversationDto>
    suspend fun messages(conversationId: String): List<MessageDto>
    /** send_message(): the server hides phone numbers, emails and links. */
    suspend fun sendMessage(conversationId: String, body: String): MessageDto
    /** New messages in a conversation as they arrive (Realtime). */
    fun messageInserts(conversationId: String): Flow<MessageDto>

    // â”€â”€ notifications â”€â”€
    /** register_device() (0024): this phone gets the person's pushes. */
    suspend fun registerDevice(token: String, appVersion: String)
    /** unregister_device(): called before signing out, while still allowed to. */
    suspend fun unregisterDevice(token: String)
    suspend fun notifications(): List<NotificationDto>
    suspend fun markNotificationRead(id: String)
    suspend fun markAllNotificationsRead()
    fun notificationInserts(userId: String): Flow<NotificationDto>

    // â”€â”€ support (support_tickets) â”€â”€
    suspend fun tickets(): List<TicketDto>
    suspend fun ticketMessages(ticketId: String): List<TicketMessageDto>
    /** open_support_ticket() (0022), optionally about a job. */
    suspend fun openTicket(subject: String, jobId: String?): TicketDto
    /** reply_support_ticket(). */
    suspend fun replyToTicket(ticketId: String, body: String): TicketMessageDto
    fun ticketMessageInserts(ticketId: String): Flow<TicketMessageDto>

    // â”€â”€ payments & escrow (0032, Segments S7 & S8) â”€â”€
    /** payments-init edge function: initializes Paystack checkout session server-side. */
    suspend fun initializePayment(jobId: String): PaymentInitDto
    /** payment_methods: saved reusable card authorizations for the signed-in user. */
    suspend fun savedPaymentMethods(): List<PaymentMethodDto>
    /** Deletes a saved card payment method. */
    suspend fun deletePaymentMethod(id: String)
    /** my_earnings() RPC: available, in escrow and paid out balances for an artisan. */
    suspend fun myEarnings(): EarningsDto
    /** compute_cancellation_refund() RPC: calculate refund and cancellation fee. */
    suspend fun computeCancellationRefund(jobId: String): CancellationRefundDto
    /** Latest payment record for a given job. */
    suspend fun paymentForJob(jobId: String): PaymentDto?
    /** Realtime changes to public.payments for [jobId]. */
    fun paymentUpdates(jobId: String): Flow<PaymentDto>
}
