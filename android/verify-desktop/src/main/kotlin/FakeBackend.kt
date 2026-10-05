package com.lezerv.verify

import com.lezerv.app.data.remote.ArtisanPublicDto
import com.lezerv.app.data.remote.CategoryDto
import com.lezerv.app.data.remote.ConversationDto
import com.lezerv.app.data.remote.JobDto
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.MapArtisanDto
import com.lezerv.app.data.remote.MessageDto
import com.lezerv.app.data.remote.NameRef
import com.lezerv.app.data.remote.NewJob
import com.lezerv.app.data.remote.NotificationDto
import com.lezerv.app.data.remote.ProfileDto
import com.lezerv.app.data.remote.ReviewDto
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.SlugName
import com.lezerv.app.data.remote.TicketDto
import com.lezerv.app.data.remote.TicketMessageDto
import com.lezerv.app.data.remote.TitleRef
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.filter

/**
 * An in-memory stand-in for the backend, for driving LiveSync the way a person would.
 * It answers like the real RPCs do (redacts contact details, links tickets to jobs…) and
 * records every call in [calls] so checks can see what the app asked for.
 */
class FakeBackend(var sessionUser: String? = null) : LezervApi {
    val calls = mutableListOf<String>()
    var profiles = mutableMapOf("user-1" to ProfileDto("user-1", null, "Amaka Obi", "2348035554417"))
    var failNext: Exception? = null
    var codeOk = "123456"
    /** Never answer the artisan list, to see the map's loading state. */
    var hangArtisans = false

    val artisans = listOf(
        MapArtisanDto("7f3e", "Tunde Bakare", "Leaks and drains.", "Lagos", 9, true, true, 4.83, 156, 228, 0.9, 6.45, 3.48, listOf("plumbing")),
        MapArtisanDto("c1a0", "Chinwe Okafor", null, "Lagos", 6, true, true, 4.9, 212, 340, 1.1, 6.44, 3.465, listOf("cleaning")),
        MapArtisanDto("b9d2", "Bisi Laundromat", null, "Lagos", 4, true, false, 4.8, 205, 880, 2.0, 6.465, 3.47, listOf("laundry")),
    )
    var jobs = mutableListOf(
        JobDto("j1", "Leak repair", null, "assigned", null, "2026-10-05T09:00:00+00:00", "12 Admiralty Way", null, 15000.0, null, "7f3e", SlugName("plumbing", "Plumbing"), NameRef("Tunde Bakare")),
        JobDto("j0", "Deep clean", null, "completed", null, "2026-09-12T10:00:00+00:00", null, null, null, 42000.0, "c1a0", SlugName("cleaning", "Cleaning"), NameRef("Chinwe Okafor")),
    )
    val conversations = mutableListOf(ConversationDto("conv1", "j1", "7f3e", "2026-10-05T09:12:00+00:00", NameRef("Tunde Bakare"), TitleRef("Leak repair")))
    val messages = mutableListOf(
        MessageDto("m1", "conv1", null, "You have been matched for this job.", true, "2026-10-05T09:10:00+00:00"),
        MessageDto("m2", "conv1", "art-user", "Is the leak under the sink?", false, "2026-10-05T09:12:00+00:00"),
    )
    val notifications = mutableListOf(NotificationDto("n1", "job_assigned", "Artisan assigned", "We matched an artisan to \"Leak repair\".", "/my-jobs", false, "2026-10-05T09:10:00+00:00"))
    val tickets = mutableListOf<TicketDto>()
    val ticketMessages = mutableListOf<TicketMessageDto>()

    // Realtime: checks push rows here to simulate other people acting.
    val messageFeed = MutableSharedFlow<MessageDto>(extraBufferCapacity = 16)
    val noticeFeed = MutableSharedFlow<NotificationDto>(extraBufferCapacity = 16)
    val ticketFeed = MutableSharedFlow<TicketMessageDto>(extraBufferCapacity = 16)

    private var seq = 100
    private fun next(p: String) = "$p${seq++}"
    private fun log(s: String) { calls += s; failNext?.let { failNext = null; throw it } }
    private fun me() = sessionUser ?: throw IllegalStateException("not signed in")

    override suspend fun restoreSession(): String? { log("restore"); return sessionUser }
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
        sessionUser = "user-1"; return "user-1"
    }
    override suspend fun signOut() { log("signout"); sessionUser = null }
    override suspend fun myProfile(): ProfileDto? { log("profile"); return profiles[me()] }
    override suspend fun saveProfile(fullName: String, email: String?) { log("saveProfile $fullName $email"); profiles[me()] = ProfileDto(me(), email, fullName, null) }

    override suspend fun categories(): List<CategoryDto> = emptyList()
    override suspend fun artisansNear(lat: Double, lng: Double, radiusKm: Int): List<MapArtisanDto> {
        log("artisans $radiusKm")
        if (hangArtisans) kotlinx.coroutines.awaitCancellation()
        return artisans
    }
    override suspend fun artisanProfile(id: String): ArtisanPublicDto? {
        log("artisan $id")
        val a = artisans.firstOrNull { it.id == id } ?: return null
        return ArtisanPublicDto(a.id, a.displayName, a.bio, a.isVerified, a.avgRating, a.totalReviews, a.completedJobs,
            reviews = listOf(ReviewDto(5, "On time and tidy.", "2026-09-12T10:22:00+00:00", "Amaka"), ReviewDto(4, null, "2026-08-30T10:22:00+00:00", "Femi")))
    }

    override suspend fun myJobs(): List<JobDto> { log("jobs"); me(); return jobs.toList() }
    override suspend fun postJob(job: NewJob): JobDto {
        log("postJob ${job.title} | ${job.categorySlug} | ${job.areaSlug} | ${job.description} | ${job.addressText} | ${job.scheduledFor} | ${job.budgetNote}")
        return JobDto(next("j"), job.title, job.description, "open", job.scheduledFor, "2026-10-05T10:00:00+00:00", job.addressText, job.budgetNote,
            category = SlugName(job.categorySlug, job.categorySlug.replaceFirstChar { it.uppercase() })).also { jobs.add(0, it) }
    }

    override suspend fun conversations(): List<ConversationDto> { log("conversations"); me(); return conversations.toList() }
    override suspend fun messages(conversationId: String): List<MessageDto> { log("messages $conversationId"); return messages.filter { it.conversationId == conversationId } }
    override suspend fun sendMessage(conversationId: String, body: String): MessageDto {
        log("send $conversationId $body")
        val redacted = body.replace(Regex("\\d[\\d ]{7,}\\d"), "[contact hidden]")
        return MessageDto(next("m"), conversationId, me(), redacted, false, "2026-10-05T09:13:00+00:00").also { messages += it }
    }
    override fun messageInserts(conversationId: String): Flow<MessageDto> = messageFeed.filter { it.conversationId == conversationId }

    override suspend fun notifications(): List<NotificationDto> { log("notifications"); me(); return notifications.toList() }
    override suspend fun markNotificationRead(id: String) = log("read $id")
    override suspend fun markAllNotificationsRead() = log("readAll")
    override fun notificationInserts(userId: String): Flow<NotificationDto> = noticeFeed

    override suspend fun tickets(): List<TicketDto> { log("tickets"); return tickets.toList() }
    override suspend fun ticketMessages(ticketId: String): List<TicketMessageDto> { log("ticketMessages $ticketId"); return ticketMessages.filter { it.ticketId == ticketId } }
    override suspend fun openTicket(subject: String, jobId: String?): TicketDto {
        log("openTicket $subject | $jobId")
        if (subject.trim().length < 5) throw ServerMessage("please describe the issue in a few more words")
        val t = TicketDto(next("t"), subject.take(200), "open", "2026-10-05T09:20:00+00:00", null, jobId)
        tickets.add(0, t)
        ticketMessages += TicketMessageDto(next("tm"), t.id, "user", subject.trim(), "2026-10-05T09:20:00+00:00")
        return t
    }
    override suspend fun replyToTicket(ticketId: String, body: String): TicketMessageDto {
        log("reply $ticketId $body")
        return TicketMessageDto(next("tm"), ticketId, "user", body, "2026-10-05T09:21:00+00:00").also { ticketMessages += it }
    }
    override fun ticketMessageInserts(ticketId: String): Flow<TicketMessageDto> = ticketFeed.filter { it.ticketId == ticketId }
}
