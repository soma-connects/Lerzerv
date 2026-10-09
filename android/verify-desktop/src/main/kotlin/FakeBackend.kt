package com.lezerv.verify

import com.lezerv.app.data.GeoPoint
import com.lezerv.app.data.remote.AddressDto
import com.lezerv.app.data.remote.ArtisanJobDto
import com.lezerv.app.data.remote.ArtisanPublicDto
import com.lezerv.app.data.remote.Booking
import com.lezerv.app.data.remote.CategoryDto
import com.lezerv.app.data.remote.ConversationDto
import com.lezerv.app.data.remote.JobDto
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.MapArtisanDto
import com.lezerv.app.data.remote.MessageDto
import com.lezerv.app.data.remote.MyArtisanDto
import com.lezerv.app.data.remote.NameRef
import com.lezerv.app.data.remote.NotificationDto
import com.lezerv.app.data.remote.ProfileDto
import com.lezerv.app.data.remote.ReviewDto
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.SlugName
import com.lezerv.app.data.remote.StartResult
import com.lezerv.app.data.remote.TicketDto
import com.lezerv.app.data.remote.TicketMessageDto
import com.lezerv.app.data.remote.TitleRef
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.filter
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.time.Instant

/** The Lekki service area's centre (0025). */
val LEKKI_CENTRE = GeoPoint(6.445, 3.49)

/**
 * The shared "database" behind one or more [FakeBackend] sessions: a client's app and an
 * artisan's app can each have their own session over the same world, the way two phones
 * share one Supabase project. It follows the rules of migrations 0008–0027 closely enough
 * to drive the apps: offers, start codes, who sees which address, shared locations.
 */
class FakeWorld(var clock: () -> Long = { LIVE_NOW }) {
    val profiles = mutableMapOf(
        "user-1" to ProfileDto("user-1", null, "Amaka Obi", "2348035554417"),
        "art-user" to ProfileDto("art-user", "tunde@example.com", "Tunde Bakare", null),
    )
    val artisans = listOf(
        MapArtisanDto("7f3e", "Tunde Bakare", "Leaks and drains.", "Lagos", 9, true, true, 4.83, 156, 228, 0.9, 6.45, 3.48, listOf("plumbing")),
        // Signed up on the website, so no location: placed at the Lekki area centre (0025).
        MapArtisanDto("c1a0", "Chinwe Okafor", null, "Lagos", 6, true, true, 4.9, 212, 340, 2.0, 6.445, 3.49, listOf("cleaning"), areaName = "Lekki", approximate = true),
        MapArtisanDto("b9d2", "Bisi Laundromat", null, "Lagos", 4, true, false, 4.8, 205, 880, 2.0, 6.465, 3.47, listOf("laundry")),
    )
    /** Which user each artisan profile belongs to. */
    val artisanUser = mapOf("7f3e" to "art-user", "c1a0" to "art-user-2", "b9d2" to "art-user-3")
    val available = artisans.associate { it.id to it.isAvailable }.toMutableMap()
    val radius = mutableMapOf("7f3e" to 5)
    /** update_my_location (0027): each artisan's exact point and when it was shared. */
    val shared = mutableMapOf<String, Pair<GeoPoint, Long>>()
    /** Where the last map search looked from. */
    var searchedFrom: GeoPoint? = null

    /** A service_jobs row plus its job_private row. */
    data class Job(
        val id: String, val client: String, val title: String, val category: SlugName, var status: String,
        var artisan: String?, val requested: String?, val number: Long, val area: String, val fullAddress: String?,
        val code: String?, var offerExpires: Long?, var accepted: Boolean, var startedAt: Long? = null,
        /** job_private.lat/lng (0027): the address's pin, if it had one. */
        val pin: GeoPoint? = null,
        val description: String? = null, val details: Map<String, String> = emptyMap(), val created: String = "2026-10-05T09:00:00+00:00",
        var quoted: Double? = null, var agreed: Double? = null, var wrongCodes: Int = 0,
    ) {
        val offerPending get() = status == "assigned" && offerExpires != null && !accepted
        /** What the job row's address_text holds: the street once an artisan is on it for real. */
        val addressText get() = if (artisan != null && !offerPending) fullAddress ?: area else area
    }

    val jobs = mutableListOf(
        Job("j1", "user-1", "Leak repair", SlugName("plumbing", "Plumbing"), "assigned", "7f3e", null, 1001, "Lekki Phase 1", "12 Admiralty Way, Lekki Phase 1", null, null, false, quoted = 15000.0),
        Job("j0", "user-1", "Deep clean", SlugName("cleaning", "Cleaning"), "completed", "c1a0", null, 1000, "Lekki Phase 1", null, null, null, false, created = "2026-09-12T10:00:00+00:00", agreed = 42000.0),
    )
    val conversations = mutableListOf(ConversationDto("conv1", "j1", "7f3e", "2026-10-05T09:12:00+00:00", NameRef("Tunde Bakare"), TitleRef("Leak repair")))
    val messages = mutableListOf(
        MessageDto("m1", "conv1", null, "You have been matched for this job.", true, "2026-10-05T09:10:00+00:00"),
        MessageDto("m2", "conv1", "art-user", "Is the leak under the sink?", false, "2026-10-05T09:12:00+00:00"),
    )
    val notifications = mutableMapOf("user-1" to mutableListOf(NotificationDto("n1", "job_assigned", "Artisan assigned", "We matched an artisan to \"Leak repair\".", "/my-jobs", false, "2026-10-05T09:10:00+00:00")))
    val addresses = mutableMapOf<String, MutableList<AddressDto>>()
    /** device_tokens: token → user. */
    val devices = mutableMapOf<String, String>()
    val tickets = mutableListOf<TicketDto>()
    val ticketMessages = mutableListOf<TicketMessageDto>()

    // Realtime
    val messageFeed = MutableSharedFlow<MessageDto>(extraBufferCapacity = 16)
    val ticketFeed = MutableSharedFlow<TicketMessageDto>(extraBufferCapacity = 16)
    private val noticeFeeds = mutableMapOf<String, MutableSharedFlow<NotificationDto>>()
    fun noticeFeed(uid: String) = noticeFeeds.getOrPut(uid) { MutableSharedFlow(extraBufferCapacity = 16) }

    private var seq = 100
    fun next(p: String) = "$p${seq++}"
    fun iso(ms: Long): String = Instant.ofEpochMilli(ms).toString()

    /** notify(): a row, and its realtime insert. */
    fun notify(uid: String, type: String, title: String, body: String) {
        val n = NotificationDto(next("n"), type, title, body, "/my-jobs", false, iso(clock()))
        notifications.getOrPut(uid) { mutableListOf() }.add(0, n)
        noticeFeed(uid).tryEmit(n)
    }

    fun artisanName(id: String?) = artisans.firstOrNull { it.id == id }?.displayName
}

/**
 * One signed-in session over a [FakeWorld], implementing the app's backend interface. It
 * records every call in [calls] so checks can see what the app asked for.
 */
class FakeBackend(var sessionUser: String? = null, val world: FakeWorld = FakeWorld()) : LezervApi {
    val calls = mutableListOf<String>()
    var failNext: Exception? = null
    var codeOk = "123456"
    /** Never answer the artisan list, to see the map's loading state. */
    var hangArtisans = false
    /** Hold "restore the saved sign-in" until completed, like a slow start-up. */
    var holdRestore: kotlinx.coroutines.CompletableDeferred<Unit>? = null

    // Shortcuts the checks use.
    val messageFeed get() = world.messageFeed
    val ticketFeed get() = world.ticketFeed
    val noticeFeed get() = world.noticeFeed(sessionUser ?: "")
    val jobs get() = world.jobs

    private fun log(s: String) { calls += s; failNext?.let { failNext = null; throw it } }
    private fun me() = sessionUser ?: throw IllegalStateException("not signed in")
    private fun myArtisanId() = world.artisanUser.entries.firstOrNull { it.value == sessionUser }?.key
    private fun first(name: String?) = name?.substringBefore(' ')

    override suspend fun restoreSession(): String? { log("restore"); holdRestore?.await(); return sessionUser }
    override suspend fun sendPhoneCode(phone: String) = log("otp $phone")
    override suspend fun verifyPhoneCode(phone: String, code: String): String {
        log("verify $phone $code")
        if (code != codeOk) throw IllegalArgumentException("Token has expired or is invalid")
        sessionUser = if (phone == "+2348035554417") "user-1" else "user-new"
        return sessionUser!!
    }
    override suspend fun signInWithEmail(email: String, password: String): String {
        log("email $email")
        if (password != "secret12") throw IllegalArgumentException("Invalid login credentials")
        sessionUser = if (email.startsWith("tunde")) "art-user" else "user-1"
        return sessionUser!!
    }
    override suspend fun signOut() { log("signout"); sessionUser = null }
    override suspend fun myProfile(): ProfileDto? { log("profile"); return world.profiles[me()] }
    override suspend fun saveProfile(fullName: String, email: String?) { log("saveProfile $fullName $email"); world.profiles[me()] = ProfileDto(me(), email, fullName, null) }

    override suspend fun categories(): List<CategoryDto> = emptyList()
    override suspend fun artisansNear(lat: Double, lng: Double, radiusKm: Int): List<MapArtisanDto> {
        log("artisans $radiusKm")
        world.searchedFrom = GeoPoint(lat, lng)
        if (hangArtisans) kotlinx.coroutines.awaitCancellation()
        // Someone who shared a location is shown there, rounded to ~550 m like 0022 does.
        fun round(d: Double) = Math.round(d / 0.005) * 0.005
        return world.artisans.map { a ->
            val at = world.shared[a.id]?.first
            a.copy(isAvailable = world.available[a.id] == true).let {
                if (at == null) it else it.copy(lat = round(at.lat), lng = round(at.lng), areaName = null, approximate = false)
            }
        }
    }
    override suspend fun artisanProfile(id: String): ArtisanPublicDto? {
        log("artisan $id")
        val a = world.artisans.firstOrNull { it.id == id } ?: return null
        return ArtisanPublicDto(a.id, a.displayName, a.bio, a.isVerified, a.avgRating, a.totalReviews, a.completedJobs,
            reviews = listOf(ReviewDto(5, "On time and tidy.", "2026-09-12T10:22:00+00:00", "Amaka"), ReviewDto(4, null, "2026-08-30T10:22:00+00:00", "Femi")))
    }

    // ── addresses ──
    override suspend fun addresses(): List<AddressDto> { log("addresses"); return world.addresses[me()].orEmpty().toList() }
    override suspend fun saveAddress(a: AddressDto): AddressDto {
        log("saveAddress ${a.id.ifBlank { "new" }} ${a.label} | ${a.street} | ${a.area} | ${a.areaSlug} | ${a.note}" + (if (a.lat != null) " @ ${a.lat},${a.lng}" else ""))
        val list = world.addresses.getOrPut(me()) { mutableListOf() }
        if (a.id.isBlank()) return a.copy(id = world.next("addr-")).also { list += it }
        val i = list.indexOfFirst { it.id == a.id }.takeIf { it >= 0 } ?: throw IllegalStateException("no such address")
        list[i] = a
        return a
    }
    override suspend fun deleteAddress(id: String) { log("deleteAddress $id"); world.addresses[me()]?.removeAll { it.id == id } }

    // ── jobs (client) ──
    private fun FakeWorld.Job.toDto() = JobDto(
        id, title, description, status, null, created, addressText, null, quoted, agreed, artisan, category, world.artisanName(artisan)?.let(::NameRef),
        number, requested, world.artisanName(requested)?.let(::NameRef), offerExpires?.let(world::iso), if (accepted) world.iso(world.clock()) else null, startedAt?.let(world::iso),
    )

    override suspend fun myJobs(): List<JobDto> { log("jobs"); return world.jobs.filter { it.client == me() }.map { it.toDto() } }

    override suspend fun bookArtisan(b: Booking): JobDto {
        log("book ${b.artisanId} | ${b.categorySlug} | ${b.title} | ${b.addressId} | ${b.description} | ${b.scheduledFor} | ${b.budgetNote} | ${b.details}")
        val a = world.artisans.first { it.id == b.artisanId }
        if (world.available[a.id] != true) throw ServerMessage("${first(a.displayName)} isn't taking jobs right now — pick someone available")
        if (b.categorySlug !in a.categories) throw ServerMessage("${first(a.displayName)} doesn't offer that service")
        val ad = world.addresses[me()]?.firstOrNull { it.id == b.addressId } ?: throw ServerMessage("choose one of your saved addresses")
        val job = FakeWorld.Job(
            world.next("job-"), me(), b.title, SlugName(b.categorySlug, b.categorySlug.replaceFirstChar { it.uppercase() }), "assigned", a.id, a.id,
            1000L + world.jobs.size + 1, ad.area, "${ad.street}, ${ad.area}" + (ad.note?.let { " · $it" } ?: ""), "5309",
            world.clock() + 30_000, false, description = b.description, details = b.details,
            pin = if (ad.lat != null && ad.lng != null) GeoPoint(ad.lat, ad.lng) else null,
        )
        world.jobs.add(0, job)
        world.notify(world.artisanUser.getValue(a.id), "job_offer", "New request: ${b.title}", "${ad.area} · answer within 30 seconds")
        return job.toDto()
    }

    override suspend fun startCodes(): Map<String, String> {
        log("startCodes")
        return world.jobs.filter { it.client == me() && it.code != null }.associate { it.id to it.code!! }
    }

    override suspend fun cancelJob(jobId: String, reason: String) {
        log("cancel $jobId $reason")
        val j = world.jobs.first { it.id == jobId && it.client == me() }
        if (j.status !in setOf("open", "assigned")) throw ServerMessage("invalid transition cancelled from ${j.status}")
        j.status = "cancelled"
        j.artisan?.let { world.notify(world.artisanUser.getValue(it), "job_cancelled", "Request withdrawn", "${j.title} was cancelled by the client") }
    }

    override suspend fun expireOffers() {
        log("expireOffers")
        world.jobs.filter { it.offerPending && it.offerExpires!! <= world.clock() }.forEach { j ->
            val who = j.artisan
            j.status = "open"; j.artisan = null; j.offerExpires = null
            world.notify(j.client, "job_offer_expired", "${first(world.artisanName(who))} didn't answer in time", "${j.title} — we are finding someone else for you")
            who?.let { world.notify(world.artisanUser.getValue(it), "job_offer_missed", "You missed a request", "${j.title} went to other artisans.") }
        }
    }

    // ── the artisan side ──
    override suspend fun myArtisan(): MyArtisanDto? {
        log("myArtisan")
        val id = myArtisanId() ?: return null
        val a = world.artisans.first { it.id == id }
        return MyArtisanDto(id, a.displayName, "approved", world.available[id] == true, world.radius[id] ?: 5, a.avgRating, a.isVerified)
    }
    override suspend fun setAvailability(online: Boolean) { log("available $online"); world.available[myArtisanId()!!] = online }
    override suspend fun setRadius(km: Int) { log("radius $km"); world.radius[myArtisanId()!!] = km }

    override suspend fun updateMyLocation(lat: Double, lng: Double): Boolean {
        log("location $lat,$lng")
        val id = myArtisanId() ?: throw ServerMessage("only artisans share their location")
        if (world.shared[id]?.let { world.clock() - it.second < 30_000 } == true) return false
        world.shared[id] = GeoPoint(lat, lng) to world.clock()
        return true
    }

    override suspend fun artisanJobs(): List<ArtisanJobDto> {
        log("artisanJobs")
        val mine = myArtisanId() ?: return emptyList()
        return world.jobs.filter { it.artisan == mine && it.status in setOf("assigned", "in_progress", "completed") }.map { j ->
            ArtisanJobDto(
                j.id, j.number, j.title, j.description, j.status, j.category.slug, j.category.name, j.area, j.addressText, null, null,
                buildJsonObject { j.details.forEach { (k, v) -> put(k, JsonPrimitive(v)) } },
                j.offerExpires?.let(world::iso), if (j.accepted) world.iso(world.clock()) else null, j.startedAt?.let(world::iso), null,
                j.created, j.agreed, first(world.profiles[j.client]?.fullName), world.conversations.firstOrNull { it.jobId == j.id }?.id,
                // 0027: the area's centre always; the client's pin once the job is theirs.
                LEKKI_CENTRE.lat, LEKKI_CENTRE.lng,
                j.pin?.lat?.takeIf { !j.offerPending && j.status != "completed" }, j.pin?.lng?.takeIf { !j.offerPending && j.status != "completed" },
            )
        }
    }

    private fun myJob(jobId: String, verb: String): FakeWorld.Job {
        val j = world.jobs.firstOrNull { it.id == jobId } ?: throw ServerMessage("job not found")
        if (j.artisan == null || j.artisan != myArtisanId()) throw ServerMessage("only the artisan on this job can $verb it")
        return j
    }

    override suspend fun acceptOffer(jobId: String) {
        log("accept $jobId")
        val j = myJob(jobId, "accept")
        if (!j.offerPending) throw ServerMessage("this request is no longer waiting for you")
        if (j.offerExpires!! < world.clock()) throw ServerMessage("too late — this request has expired")
        j.accepted = true
        val name = world.artisanName(j.artisan)!!
        val conv = ConversationDto(world.next("conv-"), j.id, j.artisan, world.iso(world.clock()), NameRef(name), TitleRef(j.title))
        world.conversations.add(0, conv)
        world.messages += MessageDto(world.next("m"), conv.id, null, "${first(name)} accepted your request. Chat here to agree the time and price.", true, world.iso(world.clock()))
        world.notify(j.client, "job_accepted", "${first(name)} accepted your request", "${j.title} · your start code is in the app")
    }

    override suspend fun declineJob(jobId: String, reason: String) {
        log("decline $jobId $reason")
        val j = myJob(jobId, "decline")
        if (j.status != "assigned" || j.agreed != null) throw ServerMessage("this job is already under way — talk to the client or our team instead")
        j.status = "open"; j.artisan = null; j.offerExpires = null; j.accepted = false
        world.notify(j.client, "job_declined", "Your artisan is not available", "${j.title} — we are finding someone else for you")
    }

    override suspend fun startJob(jobId: String, code: String): StartResult {
        log("start $jobId $code")
        val j = myJob(jobId, "start")
        if (j.offerPending) throw ServerMessage("accept the request first")
        if (j.wrongCodes >= 5) throw ServerMessage("too many wrong codes — contact Lezerv support to start this job")
        if (j.code != null && code != j.code) { j.wrongCodes++; return StartResult(false, 5 - j.wrongCodes) }
        j.status = "in_progress"; j.startedAt = world.clock()
        world.notify(j.client, "job_started", "Work has started", j.title)
        return StartResult(true)
    }

    override suspend fun completeJob(jobId: String) {
        log("complete $jobId")
        val j = myJob(jobId, "complete")
        if (j.status != "in_progress") throw ServerMessage("invalid transition completed from ${j.status}")
        j.status = "completed"
    }

    // ── chat ──
    override suspend fun conversations(): List<ConversationDto> {
        log("conversations")
        val uid = me()
        return world.conversations.filter { c -> world.jobs.any { it.id == c.jobId && (it.client == uid || world.artisanUser[it.artisan] == uid) } }
    }
    override suspend fun messages(conversationId: String): List<MessageDto> { log("messages $conversationId"); return world.messages.filter { it.conversationId == conversationId } }
    override suspend fun sendMessage(conversationId: String, body: String): MessageDto {
        log("send $conversationId $body")
        val redacted = body.replace(Regex("\\d[\\d ]{7,}\\d"), "[contact hidden]")
        return MessageDto(world.next("m"), conversationId, me(), redacted, false, "2026-10-05T09:13:00+00:00").also { world.messages += it }
    }
    override fun messageInserts(conversationId: String): Flow<MessageDto> = world.messageFeed.filter { it.conversationId == conversationId }

    // ── push ──
    override suspend fun registerDevice(token: String, appVersion: String) { log("register $token $appVersion"); world.devices[token] = me() }
    override suspend fun unregisterDevice(token: String) { log("unregister $token"); if (world.devices[token] == me()) world.devices.remove(token) }

    // ── notifications ──
    override suspend fun notifications(): List<NotificationDto> { log("notifications"); return world.notifications[me()].orEmpty().toList() }
    override suspend fun markNotificationRead(id: String) = log("read $id")
    override suspend fun markAllNotificationsRead() = log("readAll")
    override fun notificationInserts(userId: String): Flow<NotificationDto> = world.noticeFeed(userId)

    // ── support ──
    override suspend fun tickets(): List<TicketDto> { log("tickets"); return world.tickets.toList() }
    override suspend fun ticketMessages(ticketId: String): List<TicketMessageDto> { log("ticketMessages $ticketId"); return world.ticketMessages.filter { it.ticketId == ticketId } }
    override suspend fun openTicket(subject: String, jobId: String?): TicketDto {
        log("openTicket $subject | $jobId")
        if (subject.trim().length < 5) throw ServerMessage("please describe the issue in a few more words")
        val t = TicketDto(world.next("t"), subject.take(200), "open", "2026-10-05T09:20:00+00:00", null, jobId)
        world.tickets.add(0, t)
        world.ticketMessages += TicketMessageDto(world.next("tm"), t.id, "user", subject.trim(), "2026-10-05T09:20:00+00:00")
        return t
    }
    override suspend fun replyToTicket(ticketId: String, body: String): TicketMessageDto {
        log("reply $ticketId $body")
        return TicketMessageDto(world.next("tm"), ticketId, "user", body, "2026-10-05T09:21:00+00:00").also { world.ticketMessages += it }
    }
    override fun ticketMessageInserts(ticketId: String): Flow<TicketMessageDto> = world.ticketFeed.filter { it.ticketId == ticketId }
}
