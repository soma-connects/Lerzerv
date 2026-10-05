package com.lezerv.app.data.remote

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.MemorySessionManager
import io.github.jan.supabase.auth.OtpType
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.auth.providers.builtin.OTP
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.exception.PostgrestRestException
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.ktor.client.engine.HttpClientEngine
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Builds the Supabase client. [engine] lets tests answer HTTP calls themselves;
 * [persistSession] = false keeps tests from touching the device's saved login.
 */
fun createLezervClient(config: BackendConfig, engine: HttpClientEngine? = null, persistSession: Boolean = true): SupabaseClient =
    createSupabaseClient(config.url, config.anonKey) {
        if (engine != null) httpEngine = engine
        install(Auth) {
            if (!persistSession) {
                sessionManager = MemorySessionManager()
                autoLoadFromStorage = false
                alwaysAutoRefresh = false
                enableLifecycleCallbacks = false
            }
        }
        install(Postgrest)
        install(Realtime)
    }

/** The real backend: soma-connects/Lerzerv on Supabase. */
class SupabaseApi(private val client: SupabaseClient) : LezervApi {

    private val db get() = client.postgrest
    private fun uid(): String = client.auth.currentUserOrNull()?.id ?: error("Not signed in")

    // ───────────────────────────── sign-in ─────────────────────────────

    override suspend fun restoreSession(): String? {
        client.auth.awaitInitialization()
        return client.auth.currentUserOrNull()?.id
    }

    override suspend fun sendPhoneCode(phone: String) {
        client.auth.signInWith(OTP) { this.phone = phone }
    }

    override suspend fun verifyPhoneCode(phone: String, code: String): String {
        client.auth.verifyPhoneOtp(type = OtpType.Phone.SMS, phone = phone, token = code)
        return uid()
    }

    override suspend fun signInWithEmail(email: String, password: String): String {
        client.auth.signInWith(Email) { this.email = email; this.password = password }
        return uid()
    }

    override suspend fun signOut() = client.auth.signOut()

    override suspend fun myProfile(): ProfileDto? =
        db.from("profiles").select { filter { eq("id", uid()) } }.decodeSingleOrNull<ProfileDto>()

    override suspend fun saveProfile(fullName: String, email: String?) {
        val id = uid()
        if (myProfile() == null) {
            // Phone users created before migration 0022 have no profile row yet.
            db.from("profiles").insert(buildJsonObject { put("id", id); put("full_name", fullName); put("email", email) })
        } else {
            db.from("profiles").update({ set("full_name", fullName); set("email", email) }) { filter { eq("id", id) } }
        }
        client.auth.updateUser { data = buildJsonObject { put("full_name", fullName) } }
    }

    // ───────────────────────────── browsing ─────────────────────────────

    override suspend fun categories(): List<CategoryDto> =
        db.from("service_categories").select(Columns.list("id", "slug", "name", "sort_order")) {
            filter { eq("is_active", true) }
            order("sort_order", Order.ASCENDING)
        }.decodeList()

    override suspend fun artisansNear(lat: Double, lng: Double, radiusKm: Int): List<MapArtisanDto> {
        val args = buildJsonObject { put("p_lat", lat); put("p_lng", lng); put("p_radius_km", radiusKm) }
        return try {
            db.rpc("map_artisans", args).decodeList()
        } catch (e: PostgrestRestException) {
            // PGRST202 = function not found: migration 0022 isn't applied yet. search_artisans
            // has distances but no positions; the app places those pins approximately.
            if (e.code != "PGRST202" && e.code != "42883") throw e
            db.rpc("search_artisans", args).decodeList()
        }
    }

    override suspend fun artisanProfile(id: String): ArtisanPublicDto? {
        val result = db.rpc("get_artisan_public", buildJsonObject { put("p_artisan_id", id) })
        // The function returns SQL null for an unknown or unapproved artisan.
        return if (result.data.isBlank() || result.data.trim() == "null") null else result.decodeAs<ArtisanPublicDto>()
    }

    // ───────────────────────────── saved addresses ─────────────────────────────

    override suspend fun addresses(): List<AddressDto> =
        db.from("client_addresses").select(Columns.list(ADDRESS_COLUMNS)) { order("created_at", Order.ASCENDING) }.decodeList()

    override suspend fun saveAddress(a: AddressDto): AddressDto = saying {
        if (a.id.isBlank()) {
            db.from("client_addresses").insert(buildJsonObject {
                put("label", a.label); put("street", a.street); put("area", a.area); put("area_slug", a.areaSlug); put("note", a.note)
            }) { select(Columns.list(ADDRESS_COLUMNS)) }.decodeSingle()
        } else {
            db.from("client_addresses").update({
                set("label", a.label); set("street", a.street); set("area", a.area); set("area_slug", a.areaSlug); set("note", a.note)
            }) { select(Columns.list(ADDRESS_COLUMNS)); filter { eq("id", a.id) } }.decodeSingle()
        }
    }

    override suspend fun deleteAddress(id: String) {
        db.from("client_addresses").delete { filter { eq("id", id) } }
    }

    // ───────────────────────────── jobs ─────────────────────────────

    override suspend fun myJobs(): List<JobDto> =
        db.from("service_jobs").select(Columns.raw(JOB_COLUMNS)) {
            filter { eq("client_id", uid()) }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun bookArtisan(b: Booking): JobDto = saying {
        db.rpc("book_artisan", buildJsonObject {
            put("p_artisan_id", b.artisanId)
            put("p_category_slug", b.categorySlug)
            put("p_title", b.title)
            put("p_address_id", b.addressId)
            put("p_description", b.description)
            put("p_scheduled_for", b.scheduledFor)
            put("p_budget_note", b.budgetNote)
            put("p_details", buildJsonObject { b.details.forEach { (k, v) -> put(k, v) } })
        })
    }.decodeAs()

    override suspend fun startCodes(): Map<String, String> =
        db.from("job_private").select(Columns.list("job_id", "start_code")).decodeList<StartCodeDto>().associate { it.jobId to it.startCode }

    override suspend fun cancelJob(jobId: String, reason: String) {
        saying { db.rpc("update_service_job_status", buildJsonObject { put("p_job_id", jobId); put("p_status", "cancelled"); put("p_reason", reason) }) }
    }

    override suspend fun expireOffers() {
        db.rpc("expire_job_offers")
    }

    // ───────────────────────────── the artisan side ─────────────────────────────

    override suspend fun myArtisan(): MyArtisanDto? =
        db.from("artisans").select(Columns.list("id", "display_name", "status", "is_available", "service_radius_km", "avg_rating", "is_verified")) {
            filter { eq("user_id", uid()) }
        }.decodeSingleOrNull()

    override suspend fun setAvailability(online: Boolean) {
        db.rpc("set_artisan_availability", buildJsonObject { put("p_available", online) })
    }

    override suspend fun setRadius(km: Int) {
        // Owners may update this column (0005 column grants).
        db.from("artisans").update({ set("service_radius_km", km) }) { filter { eq("user_id", uid()) } }
    }

    override suspend fun artisanJobs(): List<ArtisanJobDto> = db.rpc("my_artisan_jobs").decodeList()

    override suspend fun acceptOffer(jobId: String) {
        saying { db.rpc("accept_job_offer", buildJsonObject { put("p_job_id", jobId) }) }
    }

    override suspend fun declineJob(jobId: String, reason: String) {
        saying { db.rpc("decline_assigned_job", buildJsonObject { put("p_job_id", jobId); put("p_reason", reason) }) }
    }

    override suspend fun startJob(jobId: String, code: String): StartResult =
        saying { db.rpc("start_job", buildJsonObject { put("p_job_id", jobId); put("p_code", code) }) }.decodeAs()

    override suspend fun completeJob(jobId: String) {
        saying { db.rpc("update_service_job_status", buildJsonObject { put("p_job_id", jobId); put("p_status", "completed") }) }
    }

    // ───────────────────────────── chat ─────────────────────────────

    override suspend fun conversations(): List<ConversationDto> =
        db.from("conversations").select(Columns.raw("id,job_id,artisan_id,last_message_at,artisan:artisans(display_name),job:service_jobs(title)")) {
            order("last_message_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun messages(conversationId: String): List<MessageDto> =
        db.from("messages").select { filter { eq("conversation_id", conversationId) }; order("created_at", Order.ASCENDING) }.decodeList()

    override suspend fun sendMessage(conversationId: String, body: String): MessageDto =
        saying { db.rpc("send_message", buildJsonObject { put("p_conversation_id", conversationId); put("p_body", body) }) }.decodeAs()

    override fun messageInserts(conversationId: String): Flow<MessageDto> =
        inserts("messages-$conversationId", "messages", "conversation_id", conversationId)

    // ───────────────────────────── notifications ─────────────────────────────

    override suspend fun notifications(): List<NotificationDto> =
        db.from("notifications").select { order("created_at", Order.DESCENDING); limit(50) }.decodeList()

    override suspend fun markNotificationRead(id: String) {
        db.from("notifications").update({ set("read", true) }) { filter { eq("id", id) } }
    }

    override suspend fun markAllNotificationsRead() {
        db.from("notifications").update({ set("read", true) }) { filter { eq("user_id", uid()); eq("read", false) } }
    }

    override fun notificationInserts(userId: String): Flow<NotificationDto> =
        inserts("notifications-$userId", "notifications", "user_id", userId)

    // ───────────────────────────── support ─────────────────────────────

    override suspend fun tickets(): List<TicketDto> =
        db.from("support_tickets").select(Columns.raw("id,subject,status,created_at,last_reply_at,job_id")) {
            filter { eq("user_id", uid()) }
            order("created_at", Order.DESCENDING)
        }.decodeList()

    override suspend fun ticketMessages(ticketId: String): List<TicketMessageDto> =
        db.from("support_ticket_messages").select { filter { eq("ticket_id", ticketId) }; order("created_at", Order.ASCENDING) }.decodeList()

    override suspend fun openTicket(subject: String, jobId: String?): TicketDto =
        saying { db.rpc("open_support_ticket", buildJsonObject { put("p_subject", subject); put("p_job_id", jobId); put("p_topic", if (jobId != null) "job" else "app") }) }.decodeAs()

    override suspend fun replyToTicket(ticketId: String, body: String): TicketMessageDto =
        saying { db.rpc("reply_support_ticket", buildJsonObject { put("p_ticket_id", ticketId); put("p_body", body) }) }.decodeAs()

    override fun ticketMessageInserts(ticketId: String): Flow<TicketMessageDto> =
        inserts("ticket-$ticketId", "support_ticket_messages", "ticket_id", ticketId)

    /**
     * Runs an RPC whose `raise exception` texts are written for people. Postgres reports
     * those with code P0001; they become a [ServerMessage] the app can show as it is.
     */
    private suspend fun <T> saying(call: suspend () -> T): T = try {
        call()
    } catch (e: PostgrestRestException) {
        if (e.code == "P0001") throw ServerMessage(e.error) else throw e
    }

    // ───────────────────────────── realtime ─────────────────────────────

    /**
     * New rows in [table] where [column] = [value], as a Flow. Subscribes when collected and
     * leaves the channel when the collector stops (e.g. the chat screen closes).
     * Row-level security still applies: you only receive rows you're allowed to read.
     */
    private inline fun <reified T : Any> inserts(name: String, table: String, column: String, value: String): Flow<T> = flow {
        val channel = client.channel(name)
        val changes = channel.postgresChangeFlow<PostgresAction.Insert>(schema = "public") {
            this.table = table
            filter(column, FilterOperator.EQ, value)
        }
        channel.subscribe()
        try {
            emitAll(changes.map { it.decodeRecord<T>() })
        } finally {
            withContext(NonCancellable) { client.realtime.removeChannel(channel) }
        }
    }

    companion object {
        /** service_jobs columns the app shows, with the category and assigned artisan embedded. */
        const val JOB_COLUMNS = "id,title,description,status,scheduled_for,created_at,address_text,budget_note," +
            "quoted_amount,agreed_amount,assigned_artisan_id," +
            "job_number,requested_artisan_id,offer_expires_at,offer_accepted_at,started_at," +
            // service_jobs links to artisans three ways now (0020, 0023), so each embed names its link.
            "category:service_categories(slug,name),artisan:artisans!assigned_artisan_id(display_name)," +
            "requested:artisans!requested_artisan_id(display_name)"
        val ADDRESS_COLUMNS = listOf("id", "label", "street", "area", "area_slug", "note")
    }
}
