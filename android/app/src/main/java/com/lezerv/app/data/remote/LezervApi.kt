package com.lezerv.app.data.remote

import kotlinx.coroutines.flow.Flow

/**
 * A message the database wrote for people (a `raise exception` in one of the RPCs, e.g.
 * "too many support requests — please wait a moment"). Safe to show as it is.
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

    // ── sign-in (Supabase Auth) ──
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

    // ── browsing ──
    /** service_categories, in display order. */
    suspend fun categories(): List<CategoryDto>
    /** map_artisans() (0022); falls back to search_artisans() if 0022 isn't applied yet. */
    suspend fun artisansNear(lat: Double, lng: Double, radiusKm: Int): List<MapArtisanDto>
    /** get_artisan_public(): bio, stats and recent reviews. */
    suspend fun artisanProfile(id: String): ArtisanPublicDto?

    // ── jobs (service_jobs) ──
    suspend fun myJobs(): List<JobDto>
    /** create_service_job(): posts the job; Lezerv matches an artisan. */
    suspend fun postJob(job: NewJob): JobDto

    // ── chat (conversations, messages, send_message) ──
    suspend fun conversations(): List<ConversationDto>
    suspend fun messages(conversationId: String): List<MessageDto>
    /** send_message(): the server hides phone numbers, emails and links. */
    suspend fun sendMessage(conversationId: String, body: String): MessageDto
    /** New messages in a conversation as they arrive (Realtime). */
    fun messageInserts(conversationId: String): Flow<MessageDto>

    // ── notifications ──
    suspend fun notifications(): List<NotificationDto>
    suspend fun markNotificationRead(id: String)
    suspend fun markAllNotificationsRead()
    fun notificationInserts(userId: String): Flow<NotificationDto>

    // ── support (support_tickets) ──
    suspend fun tickets(): List<TicketDto>
    suspend fun ticketMessages(ticketId: String): List<TicketMessageDto>
    /** open_support_ticket() (0022), optionally about a job. */
    suspend fun openTicket(subject: String, jobId: String?): TicketDto
    /** reply_support_ticket(). */
    suspend fun replyToTicket(ticketId: String, body: String): TicketMessageDto
    fun ticketMessageInserts(ticketId: String): Flow<TicketMessageDto>
}
