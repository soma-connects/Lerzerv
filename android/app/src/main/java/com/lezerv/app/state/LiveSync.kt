package com.lezerv.app.state

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.lezerv.app.data.Review
import com.lezerv.app.data.SUPPORT
import com.lezerv.app.data.remote.ConversationDto
import com.lezerv.app.data.remote.JobDto
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.MessageDto
import com.lezerv.app.data.remote.NewJob
import com.lezerv.app.data.remote.NotificationDto
import com.lezerv.app.data.remote.REF_LAT
import com.lezerv.app.data.remote.REF_LNG
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.TicketDto
import com.lezerv.app.data.remote.TicketMessageDto
import com.lezerv.app.data.remote.timeLabel
import com.lezerv.app.data.remote.toArtisan
import com.lezerv.app.data.remote.toReview
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.ZoneId

/** How far around you the map looks for artisans. */
const val NEARBY_KM = 10

/**
 * The app's connection to the real backend (soma-connects/Lerzerv on Supabase).
 *
 * [LezervState] still holds everything the screens draw. LiveSync fills it from [api] and
 * sends the actions that need the server: signing in, posting a job, sending a message.
 * Without a LiveSync (demo mode) the app runs on sample data exactly as before.
 *
 * Coroutines: everything runs in [scope], the ViewModel's, on the main thread. A network
 * call *suspends*: the function pauses without blocking the thread, so the UI keeps
 * drawing while it waits, and state is only ever written from that one thread.
 *
 * Still demo-only when live: paying into escrow, live tracking and the artisan side. The
 * backend has no payments yet, so "Book" sends a job request that Lezerv confirms.
 */
class LiveSync(
    private val app: LezervState,
    private val api: LezervApi,
    private val scope: CoroutineScope,
    private val zone: ZoneId = ZoneId.systemDefault(),
) {
    /** The signed-in Supabase user, or null. */
    var userId by mutableStateOf<String?>(null); private set
    /** True until the first artisan list arrives, so the map says "finding" rather than "nobody". */
    var loadingArtisans by mutableStateOf(true); private set
    /** An action is waiting on the server; its button dims and ignores taps meanwhile. */
    var busy by mutableStateOf(false); private set

    var jobs by mutableStateOf(emptyList<JobDto>()); private set
    var conversations by mutableStateOf(emptyList<ConversationDto>()); private set
    /** The support ticket the support chat writes to: the latest one still open. */
    var ticket by mutableStateOf<TicketDto?>(null); private set
    /** Recent reviews per artisan id, loaded when their profile opens. */
    var reviews by mutableStateOf(mapOf<String, List<Review>>()); private set

    // Realtime subscriptions. Cancelling the coroutine leaves the channel (see SupabaseApi.inserts).
    private var chatWatch: Job? = null
    private var noticeWatch: Job? = null

    // ═════════════════════════════ start-up ═════════════════════════════

    /** Loads the map and, if this phone has a saved sign-in, the person's own things. */
    fun start() {
        scope.launch { loadArtisans() }
        scope.launch {
            val id = attempt("restore your sign-in", quiet = true) { api.restoreSession() }
            if (id != null) signedIn(id, restored = true)
        }
    }

    /** "Try again" on the empty map. */
    fun reload() { scope.launch { loadArtisans() } }

    suspend fun loadArtisans() {
        loadingArtisans = true
        try {
            attempt("load artisans near you") { api.artisansNear(REF_LAT, REF_LNG, NEARBY_KM) }
                ?.let { list -> app.replaceArtisans(list.map { it.toArtisan() }) }
        } finally {
            loadingArtisans = false
        }
    }

    // ═════════════════════════════ sign-in ═════════════════════════════

    /** [phone] is the 10 digits after +234. */
    fun sendCode(phone: String) = act("send the code") {
        api.sendPhoneCode("+234$phone")
        app.account.onCodeSent()
    }

    fun verifyCode(phone: String, code: String) = act(
        "check the code",
        onFail = { app.account.code = "" },
        message = { e -> if (e.isNetwork()) null else "That code doesn’t match or has expired. Check the SMS, or resend it." },
    ) {
        signedIn(api.verifyPhoneCode("+234$phone", code), restored = false)
    }

    fun signInWithEmail(email: String, password: String) = act(
        "sign you in",
        message = { e -> if (e.isNetwork()) null else "That email and password don’t match a Lezerv account." },
    ) {
        signedIn(api.signInWithEmail(email, password), restored = false)
    }

    /** New accounts: name (and optional email) after the code checks out. */
    fun saveDetails(name: String, email: String?) = act("save your details") {
        api.saveProfile(name, email)
        app.account.finishAuth()
    }

    /** Edit profile. */
    fun saveProfile(name: String, email: String?) = act("save your profile") {
        api.saveProfile(name, email)
        app.account.onProfileSaved()
    }

    /** Left the "what should we call you" step: don't stay half signed in. */
    fun cancelSignIn() = signOut()

    fun signOut() {
        chatWatch?.cancel(); noticeWatch?.cancel()
        userId = null; jobs = emptyList(); conversations = emptyList(); ticket = null
        scope.launch { attempt("sign out", quiet = true) { api.signOut() } }
    }

    /** No deletion endpoint yet, so the request goes to support, who must act within 30 days. */
    fun requestDeletion(then: () -> Unit) = act("send the request") {
        api.openTicket("Please delete my Lezerv account and personal data.", null)
        then()
    }

    private suspend fun signedIn(id: String, restored: Boolean) {
        userId = id
        val p = attempt("load your profile", quiet = true) { api.myProfile() }
        app.account.onLiveSignIn(p?.fullName.orEmpty(), p?.email.orEmpty(), p?.phone?.let(::localPhone), restored)
        watchNotices(id)
        refresh()
    }

    /** Re-reads the person's jobs, chats, support ticket and notifications, side by side. */
    suspend fun refresh() = coroutineScope {
        launch { attempt("load your jobs") { api.myJobs() }?.let { jobs = it } }
        launch { attempt("load your messages") { api.conversations() }?.let { conversations = it } }
        launch { attempt("load support", quiet = true) { api.tickets() }?.let { ticket = it.firstOrNull { t -> t.status in OPEN_TICKET } } }
        launch { attempt("load notifications") { api.notifications() }?.let { list -> app.replaceNotices(list.map(::toNotice)) } }
    }

    // ═════════════════════════════ artisans + jobs ═════════════════════════════

    fun loadReviews(artisanId: String) {
        if (artisanId in reviews) return
        scope.launch {
            val p = attempt("load reviews", quiet = true) { api.artisanProfile(artisanId) } ?: return@launch
            reviews = reviews + (artisanId to p.reviews.map { it.toReview() })
        }
    }

    /** "Send request": posts the job. Until booking a named artisan exists (migration B), the team assigns them. */
    fun requestJob(job: NewJob, artisanName: String) = act("send your request") {
        val created = api.postJob(job)
        jobs = attempt("load your jobs", quiet = true) { api.myJobs() } ?: (listOf(created) + jobs)
        app.onRequestSent(artisanName)
    }

    fun conversationFor(jobId: String) = conversations.firstOrNull { it.jobId == jobId }

    fun conversation(id: String?) = conversations.firstOrNull { it.id == id }

    // ═════════════════════════════ chat + support ═════════════════════════════

    /** Shows a backend conversation and follows new messages until another chat opens. */
    fun openConversation(id: String) = follow(id, { api.messages(id).map { toMessage(it) } }) { api.messageInserts(id).map { toMessage(it) } }

    fun openSupport() {
        val t = ticket ?: return // no ticket yet: the first message opens one
        follow(SUPPORT, { api.ticketMessages(t.id).map { toMessage(it) } }) { api.ticketMessageInserts(t.id).map { toMessage(it) } }
    }

    fun send(key: String, text: String) {
        if (app.offline) { app.draft = text; app.toast("You’re offline. Send it when you’re back online."); return }
        act("send your message", onFail = { if (app.draft.isEmpty()) app.draft = text }) {
            if (key != SUPPORT) {
                val m = toMessage(api.sendMessage(key, text))
                val hidden = m.text != text // the server hides phone numbers, emails and links
                app.addToThread(key, m.copy(masked = hidden))
                if (hidden) app.systemLine(key, "We hid contact details from your message. Keep chat and payment on Lezerv.")
                return@act
            }
            val t = ticket
            if (t != null) app.addToThread(SUPPORT, toMessage(api.replyToTicket(t.id, text)))
            else { ticket = api.openTicket(text, null); openSupport() } // the ticket's first message is this text
        }
    }

    /** Report a problem: a ticket linked to the job, so the team sees both sides. */
    fun report(jobId: String?, reason: String, text: String, then: () -> Unit) = act("send the report") {
        ticket = api.openTicket("$reason: $text", jobId)
        then()
    }

    private fun follow(key: String, load: suspend () -> List<Message>, inserts: () -> Flow<Message>) {
        chatWatch?.cancel()
        chatWatch = scope.launch {
            // Listen first, then load: a message sent in between arrives either way, and
            // addToThread skips the duplicate by id.
            launch { listen { inserts().collect { app.addToThread(key, it) } } }
            attempt("load the conversation") { load() }?.let { app.mergeThread(key, it) }
        }
    }

    // ═════════════════════════════ notifications ═════════════════════════════

    fun markRead(remoteId: String) { scope.launch { attempt("update notifications", quiet = true) { api.markNotificationRead(remoteId) } } }

    fun markAllRead() { scope.launch { attempt("update notifications", quiet = true) { api.markAllNotificationsRead() } } }

    private fun watchNotices(uid: String) {
        noticeWatch?.cancel()
        noticeWatch = scope.launch {
            listen {
                api.notificationInserts(uid).collect { n ->
                    app.addNotice(toNotice(n))
                    app.toast(n.title)
                    // Whatever the notification is about has changed; fetch it fresh.
                    launch { attempt("load your jobs", quiet = true) { api.myJobs() }?.let { jobs = it } }
                    launch { attempt("load your messages", quiet = true) { api.conversations() }?.let { conversations = it } }
                }
            }
        }
    }

    private fun toNotice(n: NotificationDto): Notice {
        val (route, action) = when (n.type) {
            "message" -> Route.Messages to "Open messages"
            "support_reply" -> Route.Chat(SUPPORT) to "Open support chat"
            else -> Route.Jobs to "View your jobs"
        }
        return Notice(app.newNoticeId(), Role.Client, n.title, n.body.orEmpty(), timeLabel(n.createdAt, app.now, zone), route, action, n.read, remoteId = n.id)
    }

    // ═════════════════════════════ helpers ═════════════════════════════

    private fun toMessage(m: MessageDto) = Message(m.senderId != null && m.senderId == userId, m.body, timeLabel(m.createdAt, app.now, zone), system = m.isSystem, id = m.id)

    private fun toMessage(m: TicketMessageDto) = Message(m.senderRole == "user", m.body, timeLabel(m.createdAt, app.now, zone), id = m.id)

    /**
     * A user action. One at a time: [busy] is set while it runs and a second tap is ignored
     * (no double-posted jobs). Failures become a toast; [onFail] can undo local changes.
     */
    private fun act(doing: String, onFail: () -> Unit = {}, message: ((Exception) -> String?)? = null, block: suspend () -> Unit) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                if (attempt(doing, message = message) { block() } == null) onFail()
            } finally {
                busy = false
            }
        }
    }

    /**
     * Runs one backend call. A failure becomes a toast that says what didn't work, and the
     * result is null, so callers read as the happy path. Cancellation isn't a failure (it
     * means sign-out or a newer request took over), so it's passed on, not reported.
     */
    private suspend fun <T> attempt(doing: String, quiet: Boolean = false, message: ((Exception) -> String?)? = null, call: suspend () -> T): T? = try {
        call()
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        if (!quiet) app.toast(message?.invoke(e) ?: friendly(e, doing))
        null
    }

    /** Realtime streams end quietly if the connection drops; the next refresh catches up. */
    private suspend fun listen(block: suspend () -> Unit) {
        try { block() } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    private fun friendly(e: Exception, doing: String): String = when {
        e is ServerMessage -> e.message.orEmpty().replaceFirstChar { it.uppercase() }
        app.offline || e.isNetwork() -> "No connection. Couldn’t $doing."
        else -> "Couldn’t $doing. Please try again."
    }

    companion object {
        val OPEN_TICKET = setOf("open", "pending")

        /** "2348035554417" or "+234 803…" → "8035554417", the form the app keeps. */
        fun localPhone(p: String): String? = p.filter(Char::isDigit).removePrefix("234").takeLast(10).takeIf { it.length == 10 }
    }
}

/** No connection, DNS failure or timeout, however deeply the HTTP library wrapped it. */
internal fun Throwable.isNetwork(): Boolean = generateSequence(this) { it.cause }.any {
    it is java.io.IOException || it::class.simpleName.orEmpty().let { n -> n == "HttpRequestException" || "Timeout" in n }
}
