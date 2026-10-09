package com.lezerv.app.state

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.lezerv.app.data.AREAS
import com.lezerv.app.data.GeoFix
import com.lezerv.app.data.GeoPoint
import com.lezerv.app.data.Review
import com.lezerv.app.data.SUPPORT
import com.lezerv.app.data.remote.AddressDto
import com.lezerv.app.data.remote.ArtisanJobDto
import com.lezerv.app.data.remote.Booking
import com.lezerv.app.data.remote.ConversationDto
import com.lezerv.app.data.remote.JobDto
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.MessageDto
import com.lezerv.app.data.remote.MyArtisanDto
import com.lezerv.app.data.remote.NotificationDto
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.TicketDto
import com.lezerv.app.data.remote.TicketMessageDto
import com.lezerv.app.data.remote.isoMillis
import com.lezerv.app.data.remote.timeLabel
import com.lezerv.app.data.remote.toArtisan
import com.lezerv.app.data.remote.toReview
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
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
 * Booking (0023): "Book" offers the job to the chosen artisan, who has a short window to
 * accept; their app shows it as an incoming request. Still demo-only when live: paying into
 * escrow, live tracking, earnings and payouts.
 *
 * Location (0027): the map looks around the phone's GPS once allowed (the client's position
 * is only ever a search point, never stored). An online artisan's phone reports where they
 * are when they go online and every [SHARE_MS] after, so clients nearby find them.
 */
class LiveSync(
    private val app: LezervState,
    private val api: LezervApi,
    private val scope: CoroutineScope,
    /** Sent with the push token, so the team can tell which app versions are out there. */
    private val appVersion: String = "",
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
    /** Start codes of the client's jobs, by job id. Only the client can read them (0023). */
    var startCodes by mutableStateOf(mapOf<String, String>()); private set

    // ── the artisan side ──
    /** The person's own artisan profile, if they have one. */
    var me by mutableStateOf<MyArtisanDto?>(null); private set
    /** Offers waiting for them, and work they accepted. */
    var artisanJobs by mutableStateOf(emptyList<ArtisanJobDto>()); private set
    /** Jobs they tapped "I've arrived" on. Kept on the phone until live tracking exists. */
    var arrived by mutableStateOf(setOf<String>()); private set
    /** The job they just finished, for the "Job complete" screen. */
    var justCompleted by mutableStateOf<ArtisanJobDto?>(null); private set

    val isArtisan get() = me?.status == "approved"
    /** The offer to show on the artisan's map: the newest one still inside its window. */
    fun currentOffer(nowMs: Long) = artisanJobs.firstOrNull { it.offerPending && (isoMillis(it.offerExpiresAt) ?: 0L) > nowMs }
    /** The job the artisan opened (from their list, or by accepting it). */
    var focusedJob by mutableStateOf<String?>(null); private set
    /** Accepted work that isn't finished yet: the one they opened, else the newest. */
    val activeJob get() = artisanJobs.filter { (it.status == "assigned" && !it.offerPending) || it.status == "in_progress" }
        .let { open -> open.firstOrNull { it.id == focusedJob } ?: open.firstOrNull() }

    fun focus(jobId: String) { focusedJob = jobId }

    /** This phone's Firebase token, once the platform has one. */
    var pushToken: String? = null; private set
    /** A notification tapped before the saved sign-in was back: opened once it is. */
    private var pendingPush: Pair<String, String?>? = null

    /** When each ended countdown last asked the server to expire it (at most every few seconds). */
    private val expiring = mutableMapOf<String, Long>()
    private var lastPoll = 0L
    private var radiusSave: Job? = null
    /** A location request is running (GPS can take seconds); a second one waits for it. */
    private var locating = false
    /** When an online artisan's phone last tried to share its position. */
    private var lastShare = 0L

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

    /** Artisans around wherever "you" are (app.origin), placed on the map around that point. */
    suspend fun loadArtisans() {
        loadingArtisans = true
        try {
            val at = app.origin
            attempt("load artisans near you") { api.artisansNear(at.lat, at.lng, NEARBY_KM) }
                // A newer location may have arrived while this loaded; its own load will follow.
                ?.takeIf { at == app.origin }
                ?.let { list -> app.plane.let { plane -> app.replaceArtisans(list.map { it.toArtisan(plane) }) } }
        } finally {
            loadingArtisans = false
        }
    }

    // ═════════════════════════════ location ═════════════════════════════

    /**
     * Asks the phone where it is. If that moved "you", the map reloads around the new spot;
     * an online artisan also shares it. [quietly]: no message if location is off.
     */
    fun locate(quietly: Boolean) {
        val l = app.locator ?: return
        if (locating) return
        locating = true
        scope.launch {
            try {
                val fix = fix(l)
                if (fix == null) {
                    if (!quietly) app.toast("Couldn’t find you. Check that location is on.")
                    return@launch
                }
                if (app.onLocated(fix.point)) loadArtisans()
                if (isArtisan && me?.isAvailable == true) share(fix)
            } finally {
                locating = false
            }
        }
    }

    /** "Use my current location" on the address form. */
    fun pinHere() {
        val l = app.locator ?: return
        scope.launch {
            val fix = fix(l)
            if (fix == null) app.toast("Couldn’t find you. Check that location is on.") else app.account.onPinned(fix)
        }
    }

    /** A position, or null. A permission taken away in Settings meanwhile is just "no position". */
    private suspend fun fix(l: Locator): GeoFix? = try {
        l.locate()
    } catch (e: CancellationException) {
        throw e
    } catch (_: Exception) {
        null
    }

    private suspend fun share(fix: GeoFix) {
        lastShare = app.now // whatever prompted it, the next one is due SHARE_MS from now
        attempt("share your location", quiet = true) { api.updateMyLocation(fix.point.lat, fix.point.lng) }
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
        val token = pushToken
        pendingPush = null
        chatWatch?.cancel(); noticeWatch?.cancel(); radiusSave?.cancel()
        userId = null; jobs = emptyList(); conversations = emptyList(); ticket = null; startCodes = emptyMap()
        me = null; artisanJobs = emptyList(); arrived = emptySet(); justCompleted = null; expiring.clear()
        scope.launch {
            // Unregister first: once signed out, the server can't tell whose phone this is.
            if (token != null) attempt("turn off notifications", quiet = true) { api.unregisterDevice(token) }
            attempt("sign out", quiet = true) { api.signOut() }
        }
    }

    // ═════════════════════════════ push ═════════════════════════════

    /** The platform has a token for this phone (new install, or Google rotated it). */
    fun setPushToken(token: String) {
        if (token == pushToken) return
        pushToken = token
        if (userId != null) scope.launch { registerPush() }
    }

    private suspend fun registerPush() {
        val token = pushToken ?: return
        attempt("turn on notifications", quiet = true) { api.registerDevice(token, appVersion) }
    }

    /** A notification was tapped. Before the saved sign-in is back, wait for it. */
    fun openFromPush(type: String, notificationId: String?) {
        if (userId == null) { pendingPush = type to notificationId; return }
        app.openPushRoute(type, notificationId)
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
        registerPush()
        refresh()
        pendingPush?.let { (type, nid) -> pendingPush = null; app.openPushRoute(type, nid) }
    }

    /** Re-reads everything of the person's, side by side. */
    suspend fun refresh() = coroutineScope {
        launch { attempt("load your jobs") { api.myJobs() }?.let { jobs = it } }
        launch { attempt("load your start codes", quiet = true) { api.startCodes() }?.let { startCodes = it } }
        launch { attempt("load your addresses") { api.addresses() }?.let { list -> app.account.setAddresses(list.map(::toAddress)) } }
        launch {
            me = attempt("load your artisan profile", quiet = true) { api.myArtisan() }
            me?.let { app.onArtisanProfile(it.isAvailable, it.serviceRadiusKm) }
            refreshArtisanJobs()
        }
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

    // ═════════════════════════════ saved addresses ═════════════════════════════

    fun saveAddress(a: AddressDto) = act("save the address") {
        app.account.onAddressSaved(toAddress(api.saveAddress(a)))
    }

    fun deleteAddress(id: String) = act("remove the address") {
        api.deleteAddress(id)
        app.account.onAddressDeleted(id)
    }

    // ═════════════════════════════ booking (client) ═════════════════════════════

    /** "Book": the chosen artisan gets the request and a short time to accept it. */
    fun book(b: Booking, artisanFirst: String) = act("send your request") {
        api.bookArtisan(b)
        refreshJobs()
        app.onRequestSent(artisanFirst)
    }

    fun cancel(jobId: String) = act("cancel the request") {
        api.cancelJob(jobId, "Cancelled in the app")
        refreshJobs()
        app.toast("Request cancelled")
    }

    private suspend fun refreshJobs() = coroutineScope {
        launch { attempt("load your jobs", quiet = true) { api.myJobs() }?.let { jobs = it } }
        launch { attempt("load your start codes", quiet = true) { api.startCodes() }?.let { startCodes = it } }
    }

    // ═════════════════════════════ the artisan side ═════════════════════════════

    /** Online = clients can book you (set_artisan_availability). */
    fun setOnline(on: Boolean) = act(if (on) "go online" else "go offline") {
        api.setAvailability(on)
        me = me?.copy(isAvailable = on)
        app.onArtisanProfile(on, me?.serviceRadiusKm ?: app.radiusKm)
        if (on) {
            refreshArtisanJobs(); app.onWentOnline()
            // Clients find you by where you are. Without permission, the map asks (a hint card).
            if (app.locator?.allowed() == true) locate(quietly = true)
        }
    }

    /** The radius slider sends many values while dragged; only the one it settles on is saved. */
    fun setRadius(km: Int) {
        radiusSave?.cancel()
        radiusSave = scope.launch {
            delay(600)
            attempt("save your radius") { api.setRadius(km) }?.let { me = me?.copy(serviceRadiusKm = km) }
        }
    }

    fun accept(jobId: String) = act("accept the request") {
        api.acceptOffer(jobId)
        focusedJob = jobId
        refreshArtisanJobs()
        app.onOfferAccepted()
    }

    fun decline(jobId: String, reason: String) = act("decline the request") {
        api.declineJob(jobId, reason)
        refreshArtisanJobs()
        app.toast("Declined · ${reason.lowercase()}. The job goes to other artisans.")
    }

    fun markArrived(jobId: String) { arrived = arrived + jobId }

    fun start(jobId: String, code: String) = act("start the job") {
        val r = api.startJob(jobId, code)
        if (r.started) {
            refreshArtisanJobs()
            app.onLiveJobStarted()
        } else {
            app.code = ""
            app.toast(if (r.attemptsLeft == 0) "Too many wrong codes. Contact Lezerv support to start this job." else "That code doesn’t match. ${r.attemptsLeft} tries left.")
        }
    }

    fun complete(jobId: String) = act("mark the job complete") {
        val job = artisanJobs.firstOrNull { it.id == jobId }
        api.completeJob(jobId)
        refreshArtisanJobs()
        justCompleted = job
    }

    fun clearCompleted() { justCompleted = null; focusedJob = null }

    fun refreshArtisan() { scope.launch { refreshArtisanJobs() } }

    private suspend fun refreshArtisanJobs() {
        if (me == null) return
        attempt("load your requests", quiet = true) { api.artisanJobs() }?.let { artisanJobs = it }
    }

    /**
     * Called every 100 ms (LezervState.tick). Ends countdowns that ran out, by asking the
     * server to expire them (it checks the real time), and while an artisan is online looks
     * for new offers every [POLL_MS] in case a realtime message was missed.
     */
    fun tick(nowMs: Long) {
        if (userId == null) return
        val ended = (jobs.filter { it.offerPending }.map { it.id to it.offerExpiresAt } +
            artisanJobs.filter { it.offerPending }.map { it.id to it.offerExpiresAt })
            .filter { (id, at) -> (isoMillis(at) ?: Long.MAX_VALUE) <= nowMs && nowMs - (expiring[id] ?: 0L) > RETRY_MS }
        if (ended.isNotEmpty()) {
            ended.forEach { (id, _) -> expiring[id] = nowMs }
            scope.launch {
                attempt("update your requests", quiet = true) { api.expireOffers() }
                refreshJobs()
                refreshArtisanJobs()
            }
        }
        if (isArtisan && me?.isAvailable == true && nowMs - lastPoll > POLL_MS) {
            lastPoll = nowMs
            scope.launch { refreshArtisanJobs() }
        }
        // Online artisans move about; keep their position fresh while the app is open.
        if (isArtisan && me?.isAvailable == true && app.locator?.allowed() == true && nowMs - lastShare > SHARE_MS) {
            lastShare = nowMs
            locate(quietly = true)
        }
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
                    // A new request shows as the request card; a toast would sit on its buttons.
                    if (n.type != "job_offer") app.toast(n.title)
                    // Whatever the notification is about has changed; fetch it fresh.
                    launch { refreshJobs() }
                    launch { attempt("load your messages", quiet = true) { api.conversations() }?.let { conversations = it } }
                    launch { refreshArtisanJobs() }
                }
            }
        }
    }

    private fun toNotice(n: NotificationDto): Notice {
        val (route, action) = routeFor(n.type)
        return Notice(app.newNoticeId(), Role.Client, n.title, n.body.orEmpty(), timeLabel(n.createdAt, app.now, zone), route, action, n.read, remoteId = n.id)
    }

    // ═════════════════════════════ helpers ═════════════════════════════

    private fun toAddress(a: AddressDto): Address {
        val (x, y) = (AREAS.firstOrNull { it.first == a.area } ?: AREAS.first()).second
        val pin = if (a.lat != null && a.lng != null) GeoPoint(a.lat, a.lng) else null
        return Address(a.id, a.label, a.street, a.area, a.note.orEmpty(), x, y, pin)
    }

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

        /** Where a notification of [type] leads, and its button: the same from the inbox or a push. */
        fun routeFor(type: String): Pair<Route, String> = when (type) {
            "message" -> Route.Messages to "Open messages"
            "support_reply" -> Route.Chat(SUPPORT) to "Open support chat"
            "job_offer", "job_offer_missed", "job_posted" -> Route.ArtisanMap to "Open requests"
            else -> Route.Jobs to "View your jobs"
        }
        /** How often an online artisan's app checks for offers, besides realtime. */
        const val POLL_MS = 15_000L
        /** How often an online artisan's phone shares where it is (the server ignores more than one per 30 s). */
        const val SHARE_MS = 5 * 60_000L
        /** How soon to ask again when the server says an offer hasn't expired yet (clock skew). */
        const val RETRY_MS = 5_000L

        /** "2348035554417" or "+234 803…" → "8035554417", the form the app keeps. */
        fun localPhone(p: String): String? = p.filter(Char::isDigit).removePrefix("234").takeLast(10).takeIf { it.length == 10 }
    }
}

/** No connection, DNS failure or timeout, however deeply the HTTP library wrapped it. */
internal fun Throwable.isNetwork(): Boolean = generateSequence(this) { it.cause }.any {
    it is java.io.IOException || it::class.simpleName.orEmpty().let { n -> n == "HttpRequestException" || "Timeout" in n }
}
