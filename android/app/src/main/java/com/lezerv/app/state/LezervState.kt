package com.lezerv.app.state

import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.lezerv.app.data.ARTISANS
import com.lezerv.app.data.Artisan
import com.lezerv.app.data.DEMO_START_CODE
import com.lezerv.app.data.EXPRESS_FEE
import com.lezerv.app.data.LAUNDRY_ITEMS
import com.lezerv.app.data.OPTIONS
import com.lezerv.app.data.PICKUP_WINDOWS
import com.lezerv.app.data.SERVICE
import com.lezerv.app.data.SERVICE_FEE
import com.lezerv.app.data.SLOTS
import com.lezerv.app.data.UX
import com.lezerv.app.data.UY
import com.lezerv.app.data.maskContacts
import com.lezerv.app.data.naira
import com.lezerv.app.data.optionPrice
import com.lezerv.app.data.BANKS
import com.lezerv.app.data.DECLINE_REASONS
import com.lezerv.app.data.ID_TYPES
import com.lezerv.app.data.PAY_METHODS
import com.lezerv.app.data.SEED_NOTICES
import com.lezerv.app.data.SPLASH_MS
import com.lezerv.app.data.CANCEL_FEE
import com.lezerv.app.data.CANCEL_REASONS
import com.lezerv.app.data.REPORT_REASONS
import com.lezerv.app.data.SEED_MESSAGES
import com.lezerv.app.data.SEED_PAST
import com.lezerv.app.data.SUPPORT
import com.lezerv.app.data.REVIEWS
import com.lezerv.app.data.Review
import com.lezerv.app.data.remote.Booking
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.active
import com.lezerv.app.data.remote.backendSlug
import com.lezerv.app.data.remote.isoMillis
import com.lezerv.app.data.remote.initialsOf
import com.lezerv.app.data.remote.timeLabel
import kotlinx.coroutines.CoroutineScope
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.roundToInt

enum class Role { Client, Artisan }

/** Bottom-navigation destinations. Client and artisan each have four. */
enum class Tab(val label: String, val icon: String) {
    Explore("Explore", "map"), ClientJobs("Jobs", "briefcase"), Messages("Messages", "message-square"), ClientAccount("Account", "user"),
    ArtisanMap("Map", "map"), ArtisanJobs("Jobs", "briefcase"), Earnings("Earnings", "wallet"), ArtisanAccount("Account", "user");

    companion object {
        val client = listOf(Explore, ClientJobs, Messages, ClientAccount)
        val artisan = listOf(ArtisanMap, ArtisanJobs, Earnings, ArtisanAccount)
    }
}

/** Screens pushed on top of a tab. They get a back arrow and hide the navigation bar. */
sealed interface Pushed {
    data class Profile(val artisanId: String) : Pushed
    data object Book : Pushed
    data object Track : Pushed
    data object Chat : Pushed
    data object Navigate : Pushed
    data object Notifications : Pushed
    /** Artisan onboarding step 2 (ID + documents). [onboarding] = coming from "Become an artisan". */
    data class Verify(val onboarding: Boolean) : Pushed
    data object Payout : Pushed
    // account and support pages (general app essentials)
    data object Addresses : Pushed
    data object AddressEdit : Pushed
    data object Payments : Pushed
    data object AddCard : Pushed
    data class Receipt(val number: String) : Pushed
    data object Report : Pushed
    data object Help : Pushed
    data object Safety : Pushed
    data object Settings : Pushed
    data object EditProfile : Pushed
    data class Legal(val privacy: Boolean) : Pushed
    data object Invite : Pushed
    data object Services : Pushed
}

/**
 * Where a notification takes you when tapped: the mobile version of the Board's deep-link
 * map (1b). With push (FCM) these become lezerv.com links carried in the notification.
 */
sealed interface Route {
    data object Track : Route
    data object Review : Route
    data class Chat(val artisanId: String?) : Route
    data object ArtisanMap : Route
    data object Earnings : Route
    data object Payout : Route
    data class Receipt(val number: String) : Route
    /** Live mode: the Jobs tab, or the Messages list. */
    data object Jobs : Route
    data object Messages : Route
}

/** An entry in the notifications inbox (bell, top right). [remoteId] = its notifications row, when live. */
data class Notice(
    val id: Int, val role: Role, val title: String, val body: String, val ago: String,
    val route: Route, val action: String, val read: Boolean = false, val remoteId: String? = null,
)

enum class Sheet { Peek, List }

/**
 * One chat line. [pending] = written while offline (demo); sent on reconnect.
 * [system] = a centred line Lezerv writes into the thread (bookings, hidden details, payments).
 * [id] = the backend row, when live, so a message that arrives twice is shown once.
 */
data class Message(val me: Boolean, val text: String, val at: String, val masked: Boolean = false, val pending: Boolean = false, val system: Boolean = false, val id: String? = null)

/** A row in the Messages tab: an artisan chat or the support thread. */
data class ThreadRow(val key: String, val name: String, val ini: String, val preview: String, val at: String, val support: Boolean = false)

/** The client's live booking. [stage] indexes SERVICE_STEPS or LAUNDRY_STEPS; [t] is 0..1 progress along the route. */
data class ClientJob(
    val artisanId: String, val laundry: Boolean, val stage: Int, val t: Float,
    val total: Int, val title: String, val whenLabel: String, val express: Boolean,
    /** Support reference, e.g. J-0142. */
    val number: String = "", val payMethod: String = "",
    /** Price before Lezerv's 5% fee, and the fee itself, for the receipt. */
    val sub: Int = 0, val fee: Int = 0,
) {
    val lastStage get() = if (laundry) 5 else 4
    /** Stages where someone is driving: the artisan to you, or the laundry rider both ways. */
    val moving get() = if (laundry) stage == 1 || stage == 4 else stage == 1
}

/** A request on the artisan's map, with [endsAt] the end of its window. [pay] = label to amount. */
data class Incoming(val id: String, val title: String, val sub: String, val tag: String, val endsAt: Long, val pay: Pair<String, String>?)

/** The prototype's sample request. */
val DEMO_INCOMING = Incoming("demo", "Leaking kitchen sink", "Plumbing · Amaka O. · Lekki Phase 1 · Now", "0.9 km · 4 min", 0L, "Call-out, you receive" to "₦6,400")

/** The artisan's accepted request. Stage 0 driving, 1 arrived (enter code), 2 working, 3 done. */
data class ArtisanJob(val stage: Int, val t: Float, val startedAt: Long = 0L)

/** A finished or cancelled job; everything its receipt needs. [refund] > 0 means money went back. */
data class PastJob(
    val artisanId: String, val title: String, val date: String, val total: Int, val number: String = "",
    val sub: Int = 0, val fee: Int = 0, val method: String = "Card", val cancelled: Boolean = false, val refund: Int = 0,
)
data class ArtisanPast(val title: String, val sub: String, val pay: Int)

data class BookTotal(val sub: Int, val extra: Int, val fee: Int) {
    val total get() = sub + extra + fee
}

/**
 * All app state in one place, ported from the prototype's `INIT()` + `Component`.
 *
 * Every field is Compose snapshot state, so any composable that reads one recomposes
 * when it changes, the same idea as React's setState → re-render.
 * The backend isn't built yet, so actions update this local state and sample data.
 *
 * @param clock injectable for tests/previews.
 */
class LezervState(
    val demo: Boolean = true,
    private val clock: () -> Long = { System.currentTimeMillis() },
    splash: Boolean = true,
    signedIn: Boolean = false,
) {
    /** Sign-in, profile, addresses, cards, settings: see AccountState. */
    val account = AccountState(this, signedIn)

    /** The real backend, once [connect]ed (MainViewModel does it when one is configured). Null = sample data. */
    var live: LiveSync? = null; private set
    val isLive get() = live != null

    /** Switches from sample data to the backend: the map empties, then fills with real artisans. */
    fun connect(api: LezervApi, scope: CoroutineScope) {
        if (live != null) return
        replaceArtisans(emptyList())
        live = LiveSync(this, api, scope).also { it.start() }
    }

    /** Platform hooks set by MainActivity (dial a number, open the share sheet). Null in previews. */
    var dial: ((String) -> Unit)? = null
    var share: ((String) -> Unit)? = null
    /** Opens a maps app (Google Maps) at an address. */
    var openMaps: ((String) -> Unit)? = null

    // ── launch ──
    /** Branded splash (Board 1h), shown for [SPLASH_MS] at cold start. */
    var showSplash by mutableStateOf(splash); private set
    private val splashEndsAt = clock() + SPLASH_MS
    val splashProgress get() = (1f - (splashEndsAt - now).toFloat() / SPLASH_MS).coerceIn(0f, 1f)

    /** Notification priming (Board 1i): asked once, after the first booking gives a reason. */
    var showPrime by mutableStateOf(false); private set
    var primed by mutableStateOf(false); private set
    /** Set by MainActivity to show Android's own permission dialog; null on desktop previews. */
    var requestNotificationPermission: (() -> Unit)? = null
    private var afterPrimeToast: String? = null

    // ── navigation ──
    var role by mutableStateOf(Role.Client); private set
    var tab by mutableStateOf(Tab.Explore)
    var stack by mutableStateOf(listOf<Pushed>()); private set
    val top: Pushed? get() = stack.lastOrNull()

    // ── explore ──
    /** Everyone on the map: sample artisans, or the backend's once LiveSync loads them. */
    var artisans by mutableStateOf(ARTISANS); private set
    fun artisan(id: String?): Artisan? = artisans.firstOrNull { it.id == id }
    fun replaceArtisans(list: List<Artisan>) { artisans = list; if (selected != null && artisan(selected) == null) selected = null }
    var category by mutableStateOf("all")
    var query by mutableStateOf("")
    var selected by mutableStateOf<String?>(null)
    var sheet by mutableStateOf(Sheet.Peek)
    /** Map pan offset, in map units. null = centre on the user for the current viewport. */
    var panX by mutableStateOf<Float?>(null)
    var panY by mutableStateOf<Float?>(null)
    var dragging by mutableStateOf(false)
    var blueprintMap by mutableStateOf(true)

    // ── booking form ──
    var bookArtisan by mutableStateOf<String?>(null); private set
    var option by mutableIntStateOf(0)
    var whenIdx by mutableIntStateOf(0)
    var slot by mutableIntStateOf(1)
    var note by mutableStateOf("")
    var laundryCounts by mutableStateOf(listOf(5, 3, 1, 0))
    var pickupWindow by mutableIntStateOf(0)
    var express by mutableStateOf(false)

    // ── client job + history ──
    var job by mutableStateOf<ClientJob?>(null); private set
    // History belongs to the signed-in demo user; a guest starts empty.
    var past by mutableStateOf(if (signedIn) SEED_PAST else emptyList()); private set

    // ── cancel booking ──
    var cancelling by mutableStateOf(false); private set
    var cancelReason by mutableIntStateOf(0)

    // ── report a problem ──
    var reportJob by mutableStateOf(""); private set
    /** The service_jobs id behind [reportJob], when live. */
    private var reportJobId: String? = null
    var reportReason by mutableIntStateOf(0)
    var reportText by mutableStateOf("")
    var reportPhotos by mutableIntStateOf(0)
    private var nextTicket = 2041
    private var nextJobNo = 142

    // ── pay-into-escrow sheet (first design, slide 8) ──
    var paying by mutableStateOf(false); private set
    var payMethod by mutableIntStateOf(0)

    // ── review sheet ──
    var reviewing by mutableStateOf(false); private set
    var stars by mutableIntStateOf(5)
    var reviewTags by mutableStateOf(listOf("On time"))
    var reviewComment by mutableStateOf("")

    // ── chat ──
    var messages by mutableStateOf(if (signedIn) SEED_MESSAGES else emptyMap()); private set
    var chatWith by mutableStateOf<String?>(null); private set
    var draft by mutableStateOf("")

    // ── connectivity ──
    /** True while the phone has no network (MainActivity watches this), or the demo toggle is on. */
    var offline by mutableStateOf(false); private set

    // ── notifications inbox ──
    var notices by mutableStateOf(if (signedIn) SEED_NOTICES else emptyList()); private set
    private var nextNoticeId = 100
    /** Live, every notification is the signed-in person's own, whichever side of the app is showing. */
    val myNotices get() = notices.filter { it.role == role || it.remoteId != null }
    val unread get() = myNotices.count { !it.read }

    // ── artisan verification (onboarding step 2) ──
    var idType by mutableIntStateOf(0)
    var idNumber by mutableStateOf("")
    /** Photo ID, proof of address, passport photo. Real build: camera/picker → private bucket. */
    var docsUploaded by mutableStateOf(listOf(true, false, false)); private set

    // ── payout account ──
    var payoutBank by mutableStateOf("Guaranty Trust Bank")
    var payoutAccount by mutableStateOf("0123454821")
    /** False for a brand-new artisan: Earnings then asks them to add an account first. */
    var payoutSaved by mutableStateOf(true); private set
    var bvn by mutableStateOf("")
    var bankListOpen by mutableStateOf(false)

    // ── decline sheet ──
    var declining by mutableStateOf(false); private set
    var declineReason by mutableIntStateOf(0)

    // ── snackbar ──
    var snack by mutableStateOf<String?>(null); private set
    private var snackUntil = 0L

    // ── artisan ──
    var online by mutableStateOf(false); private set
    var requestOpen by mutableStateOf(false); private set
    var requestEndsAt by mutableLongStateOf(0L); private set
    private var nextRequestAt = 0L
    var artisanJob by mutableStateOf<ArtisanJob?>(null); private set
    var code by mutableStateOf("")
    var earnedToday by mutableIntStateOf(6400); private set
    var radiusKm by mutableIntStateOf(5)
    var artisanPast by mutableStateOf(listOf(ArtisanPast("Blocked shower drain", "Femi A. · Ikate · Yesterday", 8000), ArtisanPast("Water heater fix", "Ngozi E. · Lekki · Wed", 12000))); private set

    /** Ticks every 100 ms; drives countdowns and "minutes on job" text. */
    var now by mutableLongStateOf(clock()); private set

    // ───────────────────────────── ticking ─────────────────────────────

    /** Advances simulated movement and timers. Called every 100 ms by the UI. */
    fun tick() {
        val t = clock()
        now = t
        if (showSplash && t >= splashEndsAt) showSplash = false
        job?.let { j ->
            val advancing = if (j.laundry) j.stage == 0 || j.stage == 1 || j.stage == 4 else j.stage == 0 || j.stage == 1
            if (advancing) {
                var p = j.t + if (j.stage == 0) 0.035f else 0.009f
                var s = j.stage
                if (p >= 1f) { p = 0f; s++ }
                job = j.copy(t = p, stage = s)
                if (s != j.stage) onStage(j.copy(stage = s))
            }
        }
        artisanJob?.let { a -> if (a.stage == 0) artisanJob = if (a.t + 0.01f >= 1f) a.copy(stage = 1, t = 1f) else a.copy(t = a.t + 0.01f) }
        if (role == Role.Artisan && online && !requestOpen && artisanJob == null && nextRequestAt != 0L && t > nextRequestAt) {
            nextRequestAt = 0L
            requestOpen = true
            requestEndsAt = t + 30_000
        }
        if (requestOpen && t >= requestEndsAt) {
            nextRequestAt = t + 6000
            requestOpen = false; declining = false
            toast("Request expired. Next one will come shortly.")
        }
        if (snack != null && t >= snackUntil) snack = null
        live?.tick(t)
    }

    fun toast(m: String) { snack = m; snackUntil = clock() + 3200 }

    // ───────────────────────────── navigation ─────────────────────────────

    fun push(p: Pushed) {
        stack = stack + p
        if (p is Pushed.Profile) live?.loadReviews(p.artisanId)
    }

    /** True while system back should stay inside the app; false lets Android close it. */
    val canGoBack: Boolean get() = account.authStep != null || cancelling || account.pickingAddress || account.deleting || paying || showPrime || declining || bankListOpen || reviewing || stack.isNotEmpty() || selected != null || sheet == Sheet.List || tab != homeTab

    /** Android system back. Returns false when there is nothing left to go back from (exit). */
    fun back(): Boolean = when {
        account.authStep != null -> { account.authBack(); true }
        cancelling -> { cancelling = false; true }
        account.pickingAddress -> { account.pickingAddress = false; true }
        account.deleting -> { account.deleting = false; true }
        paying -> { paying = false; true }
        showPrime -> { answerPrime(false); true }
        declining -> { declining = false; true }
        bankListOpen -> { bankListOpen = false; true }
        reviewing -> { reviewing = false; true }
        stack.isNotEmpty() -> { stack = stack.dropLast(1); true }
        selected != null -> { selected = null; true }
        sheet == Sheet.List -> { sheet = Sheet.Peek; true }
        tab != homeTab -> { tab = homeTab; true }
        else -> false
    }

    val homeTab get() = if (role == Role.Client) Tab.Explore else Tab.ArtisanMap

    fun openTab(t: Tab) { tab = t; stack = emptyList(); selected = null }

    fun switchRole(r: Role) {
        if (r == Role.Artisan) live?.refreshArtisan()
        nextRequestAt = 0L
        role = r; tab = if (r == Role.Client) Tab.Explore else Tab.ArtisanMap
        stack = emptyList(); selected = null; panX = null; panY = null; requestOpen = false
    }

    // ───────────────────────────── explore ─────────────────────────────

    val visibleArtisans by derivedStateOf {
        val q = query.trim().lowercase()
        artisans.filter { (category == "all" || it.svc == category) && (q.isEmpty() || it.name.lowercase().contains(q) || it.service.label.lowercase().contains(q)) }
            .sortedBy { it.km }
    }

    /** Tap on a pin or list row: select it and pan the map so it sits above the sheet. */
    fun pick(id: String, viewportW: Float) {
        val a = artisan(id) ?: return
        selected = id; sheet = Sheet.Peek
        panX = viewportW / 2 - a.x
        panY = 230f - a.y
    }

    fun recenter() { panX = null; panY = null }

    fun pickCategory(k: String) { category = k; selected = null }

    fun toggleSheet() { selected = null; sheet = if (sheet == Sheet.List) Sheet.Peek else Sheet.List }

    // ───────────────────────────── booking ─────────────────────────────

    fun startBooking(id: String) {
        bookArtisan = id; option = 0; whenIdx = 0; slot = 1; note = ""
        laundryCounts = listOf(5, 3, 1, 0); pickupWindow = 0; express = false
        push(Pushed.Book)
    }

    fun bookTotal(): BookTotal {
        val a = artisan(bookArtisan) ?: return BookTotal(0, 0, 0)
        val sub: Int
        var extra = 0
        if (a.laundry) {
            sub = laundryCounts.withIndex().sumOf { (i, n) -> n * LAUNDRY_ITEMS[i].second }
            extra = if (express) EXPRESS_FEE else 0
        } else sub = optionPrice(a, option)
        return BookTotal(sub, extra, ((sub + extra) * SERVICE_FEE).roundToInt())
    }

    fun changeCount(i: Int, d: Int) { laundryCounts = laundryCounts.toMutableList().also { it[i] = (it[i] + d).coerceAtLeast(0) } }

    /** Opens the "Pay into escrow" sheet to pick bank transfer, card or USSD. */
    /** Guests can look around freely; paying is the moment we ask them to sign in (Board 1g). */
    fun openPay() = account.requireSignIn { payMethod = if (account.defaultCard != null) 1 else 0; paying = true }
    fun closePay() { paying = false }

    /**
     * Live mode's "Send request" (no payments on the backend yet): posts the job with what
     * the form says, naming the chosen artisan so the team can assign them.
     */
    fun sendRequest() = account.requireSignIn {
        val live = live ?: return@requireSignIn
        val a = artisan(bookArtisan) ?: return@requireSignIn
        val ad = account.currentAddress
        if (ad == null) { toast("Add where the artisan should come"); account.editAddress(null); return@requireSignIn }
        val title = if (a.laundry) "Laundry · ${laundryCounts.sum()} items" else OPTIONS.getValue(a.svc)[option]
        val estimate = naira(bookTotal().total)
        val items = LAUNDRY_ITEMS.indices.filter { laundryCounts[it] > 0 }.joinToString(", ") { "${laundryCounts[it]} × ${LAUNDRY_ITEMS[it].first.lowercase()}" }
        val details = buildMap {
            put("estimate", estimate)
            put("when", if (a.laundry) PICKUP_WINDOWS[pickupWindow] else whenLabel())
            if (a.laundry) { put("items", items); put("return", if (express) "Express, 24 hours" else "Standard, 48 hours") }
        }
        live.book(
            Booking(
                artisanId = a.id, categorySlug = a.slug ?: backendSlug(a.svc), title = title, addressId = ad.id,
                description = listOfNotNull(if (a.laundry) "$items · pickup ${PICKUP_WINDOWS[pickupWindow]}" else null, note.trim().takeIf { it.isNotEmpty() })
                    .joinToString("\n").ifBlank { null },
                scheduledFor = scheduledFor(a), budgetNote = "App estimate $estimate", details = details,
            ),
            a.first,
        )
    }

    /** "Now", "Today 16:00" or "Tomorrow 16:00", as the artisan's request card shows it. */
    private fun whenLabel() = when (whenIdx) { 0 -> "Now"; 1 -> "Today ${SLOTS[slot]}"; else -> "Tomorrow ${SLOTS[slot]}" }

    /** "Later today" / "Schedule" + a time slot → an ISO timestamp; "Now" and laundry → none. */
    private fun scheduledFor(a: Artisan, zone: ZoneId = ZoneId.systemDefault()): String? {
        if (a.laundry || whenIdx == 0) return null
        val day = Instant.ofEpochMilli(clock()).atZone(zone).toLocalDate().plusDays(if (whenIdx == 2) 1 else 0)
        return day.atTime(LocalTime.parse(SLOTS[slot])).atZone(zone).toOffsetDateTime().toString()
    }

    /** The request is in: show it under Jobs, and (first time) ask about notifications. */
    internal fun onRequestSent(artisanFirst: String) {
        stack = emptyList(); tab = Tab.ClientJobs; selected = null
        val msg = "Request sent. Waiting for $artisanFirst to accept."
        if (!primed) { showPrime = true; afterPrimeToast = msg } else toast(msg)
    }

    /** What the artisan takes home from a booking: the price before Lezerv's 5% fee, minus 20%. */
    fun artisanTakeHome(b: BookTotal) = ((b.sub + b.extra) * 0.8).roundToInt()

    /** PROPOSAL: escrow. Payment is held by Lezerv until the client confirms the job is done. */
    fun pay() {
        paying = false
        val a = artisan(bookArtisan) ?: return
        val b = bookTotal()
        val title = if (a.laundry) "Laundry · ${laundryCounts.sum()} items" else OPTIONS.getValue(a.svc)[option]
        val whenLabel = if (a.laundry) PICKUP_WINDOWS[pickupWindow] else if (whenIdx == 0) "Now" else SLOTS[slot]
        job = ClientJob(a.id, a.laundry, 0, 0f, b.total, title, whenLabel, express, "J-0${nextJobNo++}", payMethodLabel, b.sub + b.extra, b.fee)
        system(a.id, "You booked ${a.first} for ${title.lowercase()}. ${naira(b.total)} is held by Lezerv until you confirm the job is done.")
        stack = listOf(Pushed.Track); tab = Tab.ClientJobs; selected = null
        notify(Role.Client, "Booked · ${a.first} has your job", "$title · ${naira(b.total)} held in escrow", Route.Track, "Track job")
        val paid = "${naira(b.total)} paid into Lezerv escrow"
        // First booking: ask about notifications, and keep the receipt toast until that's answered.
        if (!primed) { showPrime = true; afterPrimeToast = paid } else toast(paid)
    }

    /** Moves the job to its next stage (client "Confirm the job is done", or demo skip). */
    fun advance() {
        val j = job ?: return
        if (j.stage >= j.lastStage) return
        job = j.copy(stage = j.stage + 1, t = 0f).also(::onStage)
    }

    fun openReview() { reviewing = true; stars = 5; reviewTags = listOf("On time"); reviewComment = "" }

    fun toggleTag(t: String) { reviewTags = if (t in reviewTags) reviewTags - t else reviewTags + t }

    fun submitReview() {
        val j = job ?: return
        val a = artisan(j.artisanId) ?: return
        reviewing = false; job = null
        past = listOf(PastJob(a.id, j.title, "Today", j.total, j.number, j.sub, j.fee, j.payMethod)) + past
        system(a.id, "Payment released to ${a.first}. You rated ${stars}★.")
        stack = emptyList(); tab = Tab.ClientJobs
        toast("Payment released to ${a.first}. Thanks for the review.")
    }

    // ───────────────────────────── chat ─────────────────────────────

    /** Opens a thread: an artisan id (demo), a backend conversation id (live) or [SUPPORT]. */
    fun openChat(key: String?) {
        val live = live
        if (live != null && key == SUPPORT && !account.signedIn) { account.requireSignIn { openChat(key) }; return }
        chatWith = key; draft = ""
        if (live != null && key != null) { if (key == SUPPORT) live.openSupport() else live.openConversation(key) }
        if (key == SUPPORT && messages[SUPPORT].isNullOrEmpty())
            system(SUPPORT, "Lezerv Support usually replies within a few hours. Include your job number if it’s about a job.")
        push(Pushed.Chat)
    }

    /** Who a thread is with, for the chat's title bar. */
    fun threadName(key: String?): String = when {
        key == SUPPORT -> "Lezerv Support"
        role == Role.Artisan -> live?.artisanJobs?.firstOrNull { it.conversationId == key }?.clientFirstName ?: "Client"
        else -> live?.conversation(key)?.artisan?.displayName ?: artisan(key)?.name.orEmpty()
    }

    /** The Messages list: backend conversations when live, otherwise every thread in [messages]. */
    val threads: List<ThreadRow> get() {
        val support = messages[SUPPORT]?.lastOrNull()?.let { ThreadRow(SUPPORT, "Lezerv Support", "LZ", it.text, it.at, support = true) }
            ?: live?.ticket?.let { ThreadRow(SUPPORT, "Lezerv Support", "LZ", it.subject, timeLabel(it.lastReplyAt ?: it.createdAt, now, ZoneId.systemDefault()), support = true) }
        val live = live ?: return messages.keys.filter { it != "client" && it != SUPPORT }.mapNotNull { k ->
            val a = artisan(k) ?: return@mapNotNull null
            val last = messages.getValue(k).last()
            ThreadRow(k, a.name, a.ini, (if (last.me) "You: " else "") + last.text, last.at)
        } + listOfNotNull(support)
        return live.conversations.map { c ->
            val name = c.artisan?.displayName ?: "Artisan"
            val last = messages[c.id]?.lastOrNull()
            ThreadRow(c.id, name, initialsOf(name), last?.let { (if (it.me) "You: " else "") + it.text } ?: c.job?.title.orEmpty(),
                last?.at ?: timeLabel(c.lastMessageAt, now, ZoneId.systemDefault()))
        } + listOfNotNull(support)
    }

    /** Which thread the chat screen shows: support, the artisan's one client, or the chosen artisan. */
    private val chatKey get() = when {
        chatWith == SUPPORT -> SUPPORT
        role == Role.Artisan && !isLive -> "client"
        else -> chatWith.orEmpty()
    }
    val chatMessages: List<Message> get() = messages[chatKey].orEmpty()

    fun send() {
        val t = draft.trim()
        if (t.isEmpty()) return
        val live = live
        if (live != null && chatKey != "client") { draft = ""; live.send(chatKey, t); return }
        val m = maskContacts(t)
        messages = messages + (chatKey to (messages[chatKey].orEmpty() + Message(true, m, "Now", m != t, pending = offline)))
        draft = ""
        if (m != t) system(chatKey, "We hid contact details from your message. Keep chat and payment on Lezerv.")
        if (offline) toast("You’re offline. It sends when you reconnect.")
    }

    // ───────────────────────────── artisan ─────────────────────────────

    fun toggleOnline() {
        live?.let { it.setOnline(!online); return }
        online = !online
        nextRequestAt = if (online) clock() + 2500 else 0L
        requestOpen = false
    }

    /** The request card on the artisan's map: the demo's, or a real offer when live. */
    val incoming: Incoming? get() {
        val live = live ?: return if (requestOpen) DEMO_INCOMING.copy(endsAt = requestEndsAt) else null
        val o = live.currentOffer(now) ?: return null
        return Incoming(
            o.id, o.title,
            listOfNotNull(o.categoryName, o.clientFirstName, o.areaName, o.detail("when")).joinToString(" · "),
            o.areaName.orEmpty(), isoMillis(o.offerExpiresAt) ?: now,
            o.detail("estimate")?.let { "Client’s estimate · price agreed in chat" to it },
        )
    }

    fun acceptIncoming() {
        val live = live ?: return acceptRequest()
        incoming?.let { live.accept(it.id) }
    }

    /** Live: they accepted; the job screen takes over (and the street address is now theirs to see). */
    internal fun onOfferAccepted() { declining = false; code = ""; stack = listOf(Pushed.Navigate) }

    /** Online status and radius as the backend has them. */
    internal fun onArtisanProfile(isOnline: Boolean, radius: Int) { online = isOnline; radiusKm = radius }

    fun changeRadius(km: Int) { radiusKm = km; live?.setRadius(km) }

    /** Decline opens the reason sheet (Board "Can't take this job?"); [confirmDecline] sends it. */
    fun declineRequest() { declineReason = 0; declining = true }

    fun confirmDecline() {
        live?.let { l ->
            declining = false
            incoming?.let { l.decline(it.id, DECLINE_REASONS[declineReason]) }
            return
        }
        declining = false
        nextRequestAt = clock() + 6000; requestOpen = false
        toast("Declined · ${DECLINE_REASONS[declineReason].lowercase()}. Your acceptance rate is 94%.")
    }

    fun acceptRequest() { system("client", "You accepted Amaka’s request. Keep chat and payment on Lezerv."); requestOpen = false; declining = false; artisanJob = ArtisanJob(0, 0f); code = ""; stack = listOf(Pushed.Navigate) }

    val codeOk get() = code == DEMO_START_CODE

    /** Live: the job the artisan just finished (until "Back to map"), else their current one. */
    val liveArtisanJob get() = live?.let { it.justCompleted ?: it.activeJob }

    /** Live: open one of the artisan's jobs from their list. */
    fun openArtisanJob(jobId: String) { live?.focus(jobId); push(Pushed.Navigate) }

    fun markArrived() { liveArtisanJob?.let { live?.markArrived(it.id) } }

    internal fun onLiveJobStarted() { code = ""; toast("Job started. The client has been told.") }

    fun startJob() {
        live?.let { l -> liveArtisanJob?.let { if (code.length == 4) l.start(it.id, code) else toast("Enter the 4-digit code from the client") }; return }
        val a = artisanJob ?: return
        if (codeOk) artisanJob = a.copy(stage = 2, startedAt = clock()) else toast("Enter the 4-digit code from the client")
    }

    fun completeJob() {
        live?.let { l -> l.activeJob?.let { l.complete(it.id) }; return }
        val a = artisanJob ?: return
        artisanJob = a.copy(stage = 3)
        earnedToday += 6400
        artisanPast = listOf(ArtisanPast("Leaking kitchen sink", "Amaka O. · Lekki Phase 1 · Today", 6400)) + artisanPast
        notify(Role.Artisan, "₦6,400 held in escrow", "Leaking kitchen sink · released when Amaka confirms", Route.Earnings, "View earnings")
    }

    fun finishArtisanJob() {
        live?.clearCompleted()
        nextRequestAt = 0L
        artisanJob = null; stack = emptyList(); tab = Tab.ArtisanMap; code = ""
        toast("₦6,400 added to escrow. Released when Amaka confirms.")
    }

    fun withdraw() {
        if (!payoutSaved) { push(Pushed.Payout); return }
        toast("₦48,200 on its way to $payoutLabel")
    }

    val payoutLabel get() = if (!payoutSaved) "Not added yet" else "${BANKS.firstOrNull { it.first == payoutBank }?.second ?: payoutBank} ••${payoutAccount.takeLast(4)}"

    /** Demo-only: put everything back to the start. */
    /**
     * Puts the app back to the start. [withHistory] = false is used by sign-out, so nothing
     * personal (jobs, chats, notifications) is left for the next person on this phone.
     */
    fun reset(withHistory: Boolean = true) {
        val fresh = LezervState(demo, clock, splash = false, signedIn = withHistory)
        role = fresh.role; tab = fresh.tab; stack = fresh.stack; category = fresh.category; query = ""; selected = null; sheet = Sheet.Peek
        panX = null; panY = null; blueprintMap = true; job = null; past = fresh.past; reviewing = false; messages = fresh.messages
        chatWith = null; draft = ""; snack = null; online = false; requestOpen = false; nextRequestAt = 0L; artisanJob = null
        code = ""; earnedToday = fresh.earnedToday; radiusKm = fresh.radiusKm; artisanPast = fresh.artisanPast
        showPrime = false; primed = false; notices = fresh.notices; declining = false; offline = false
        paying = false; nextJobNo = 142; reviewComment = ""; payoutSaved = true; cancelling = false; reportJob = ""
        idType = 0; idNumber = ""; docsUploaded = fresh.docsUploaded; payoutBank = fresh.payoutBank; payoutAccount = fresh.payoutAccount; bvn = ""
    }

    /** "Bank transfer", "Visa ••2291" or "USSD": what the receipt says you paid with. */
    val payMethodLabel get() = if (payMethod == 1) account.defaultCard?.label ?: "Card" else PAY_METHODS[payMethod].title

    // ───────────────────────────── cancel booking ─────────────────────────────

    /** Cancelling is allowed until the artisan arrives (or the laundry is picked up). */
    val canCancel get() = job?.let { it.stage <= 1 } == true

    /** PROPOSAL policy: free while confirming; once they're on the way the call-out fee is kept. */
    val cancelFee: Int get() = job?.let { if (it.stage == 0) 0 else CANCEL_FEE.coerceAtMost(it.total) } ?: 0

    fun openCancel() { if (canCancel) { cancelReason = 0; cancelling = true } }

    fun confirmCancel() {
        val j = job ?: return
        val a = jobArtisan ?: return
        val refund = j.total - cancelFee
        cancelling = false; job = null
        past = listOf(PastJob(a.id, j.title, "Today", j.total, j.number, j.sub, j.fee, j.payMethod, cancelled = true, refund = refund)) + past
        system(a.id, "Booking ${j.number} cancelled: ${CANCEL_REASONS[cancelReason].lowercase()}. ${naira(refund)} is going back to you.")
        notify(Role.Client, "Booking cancelled · ${naira(refund)} refunded", "${j.title} · ${j.number}. Refunds reach you in 1–3 working days.", Route.Receipt(j.number), "View receipt")
        stack = emptyList(); tab = Tab.ClientJobs
        toast("Cancelled. ${naira(refund)} refund on its way.")
    }

    fun pastJob(number: String) = past.firstOrNull { it.number == number }

    // ───────────────────────────── report a problem ─────────────────────────────

    /** Opens the report form for a job; [reason] pre-selects one (e.g. safety). [jobId] = its backend row, when live. */
    fun startReport(number: String, reason: Int = 0, jobId: String? = null) {
        reportJob = number; reportJobId = jobId; reportReason = reason; reportText = ""; reportPhotos = 0
        push(Pushed.Report)
    }

    /** The job "Report a problem" in Help points at: the live booking or the latest finished one. */
    val reportable: Pair<String, String?>? get() {
        val live = live ?: return (job?.number ?: past.firstOrNull { !it.cancelled }?.number)?.let { it to null }
        return live.jobs.firstOrNull { it.status != "open" && it.status != "cancelled" && !it.offerPending }?.let { "“${it.title}”" to it.id }
    }

    /** PROPOSAL: creates a support ticket and pauses the artisan's payout until it's resolved. */
    fun submitReport() {
        if (reportText.trim().length < 10) { toast("Tell us a bit more (at least a sentence)"); return }
        live?.let { l ->
            l.report(reportJobId, REPORT_REASONS[reportReason], reportText.trim()) {
                if (top == Pushed.Report) stack = stack.dropLast(1)
                toast("Report sent. We reply in your support chat.")
            }
            return
        }
        val ticket = "LZ-${nextTicket++}"
        val reason = REPORT_REASONS[reportReason]
        system(SUPPORT, "Ticket $ticket opened for $reportJob: $reason. “${reportText.trim()}”" + if (reportPhotos > 0) " · $reportPhotos photo${if (reportPhotos > 1) "s" else ""}" else "")
        system(SUPPORT, "Thanks. We’ve paused the payout on $reportJob while we look into it. An agent replies here within 24 hours.")
        notify(role, "We’re looking into $reportJob", "Ticket $ticket · $reason", Route.Chat(SUPPORT), "Open support chat")
        stack = stack.dropLast(1)
        toast("Report sent · ticket $ticket")
    }

    fun callEmergency() = dial?.invoke("112") ?: toast("Calling 112")

    fun shareText(text: String) = share?.invoke(text) ?: toast("Share sheet opens here")

    fun navigateTo(address: String) = openMaps?.invoke(address) ?: toast("Opens Google Maps at $address")

    // ───────────────────────────── notifications ─────────────────────────────

    /** Adds a centred Lezerv line to a chat thread. */
    private fun system(key: String, text: String) {
        messages = messages + (key to (messages[key].orEmpty() + Message(false, text, "Now", system = true)))
    }

    internal fun systemLine(key: String, text: String) = system(key, text)

    /** A message from the backend; skipped if that row is already shown (it can arrive twice). */
    internal fun addToThread(key: String, m: Message) {
        val list = messages[key].orEmpty()
        if (m.id != null && list.any { it.id == m.id }) return
        messages = messages + (key to list + m)
    }

    /** A freshly loaded thread replaces what was there, keeping anything newer that arrived meanwhile. */
    internal fun mergeThread(key: String, loaded: List<Message>) {
        val ids = loaded.mapNotNull { it.id }.toSet()
        messages = messages + (key to loaded + messages[key].orEmpty().filter { it.id != null && it.id !in ids })
    }

    /**
     * The one thing the client must do right now, if any: shown as a "Needs your reply" card
     * on the map. Derived from the job, so it can never disagree with the tracking screen.
     */
    val needsReply: Pair<String, String>? get() {
        val j = job ?: return null
        val a = jobArtisan ?: return null
        return when {
            j.stage == j.lastStage -> "Rate ${a.first} and release ${naira(j.total)}" to "${j.title} is done. Payment stays in escrow until you confirm."
            !j.laundry && j.stage == 2 -> "${a.first} is at your gate" to "Share your start code so the job can begin."
            else -> null
        }
    }

    private fun notify(r: Role, title: String, body: String, route: Route, action: String) {
        notices = listOf(Notice(nextNoticeId++, r, title, body, "now", route, action)) + notices
    }

    internal fun newNoticeId() = nextNoticeId++

    /** The backend's notifications replace the previous copy; ones made on the phone stay. */
    internal fun replaceNotices(list: List<Notice>) { notices = list + notices.filter { it.remoteId == null } }

    internal fun addNotice(n: Notice) { if (notices.none { it.remoteId != null && it.remoteId == n.remoteId }) notices = listOf(n) + notices }

    /** Client job milestones that would arrive as push notifications. */
    private fun onStage(j: ClientJob) {
        val a = artisan(j.artisanId) ?: return
        when {
            !j.laundry && j.stage == 2 -> notify(Role.Client, "${a.first} is at your gate", "Share your start code to begin the job.", Route.Track, "Show code")
            j.laundry && j.stage == 2 -> notify(Role.Client, "Laundry picked up", "${j.title} counted and tagged.", Route.Track, "Track order")
            j.stage == j.lastStage -> notify(Role.Client, "Job done · rate ${a.first}", "${j.title} · release ${naira(j.total)} from escrow", Route.Review, "Rate and release")
        }
    }

    /** Tap on a notice: mark it read and go where it points (deep link). */
    fun openNotice(n: Notice) {
        notices = notices.map { if (it.id == n.id) it.copy(read = true) else it }
        if (!n.read && n.remoteId != null) live?.markRead(n.remoteId)
        when (val r = n.route) {
            Route.Track -> if (job != null) stack = listOf(Pushed.Track).also { tab = Tab.ClientJobs } else openTab(Tab.ClientJobs)
            Route.Review -> if (job != null) { stack = listOf(Pushed.Track); tab = Tab.ClientJobs; openReview() } else openTab(Tab.ClientJobs)
            is Route.Chat -> { stack = emptyList(); tab = if (role == Role.Client) Tab.Messages else Tab.ArtisanAccount; openChat(r.artisanId) }
            Route.ArtisanMap -> if (role == Role.Artisan) openTab(Tab.ArtisanMap) else if (live?.isArtisan == true) switchRole(Role.Artisan) else openTab(Tab.ClientJobs)
            Route.Earnings -> openTab(Tab.Earnings)
            Route.Payout -> { stack = emptyList(); tab = Tab.ArtisanAccount; push(Pushed.Payout) }
            is Route.Receipt -> { stack = emptyList(); tab = Tab.ClientJobs; push(Pushed.Receipt(r.number)) }
            Route.Jobs -> openTab(Tab.ClientJobs)
            Route.Messages -> openTab(Tab.Messages)
        }
    }

    fun markAllRead() {
        if (notices.any { it.remoteId != null && !it.read }) live?.markAllRead()
        notices = notices.map { if (it.role == role || it.remoteId != null) it.copy(read = true) else it }
    }

    /** Priming answer. "Allow" hands over to Android's own permission dialog (API 33+). */
    fun answerPrime(allow: Boolean) {
        showPrime = false; primed = true
        afterPrimeToast?.let(::toast); afterPrimeToast = null
        if (allow) requestNotificationPermission?.invoke()
    }

    // ───────────────────────────── connectivity ─────────────────────────────

    /** Going back online sends anything written while offline (Board 1l). */
    fun updateOffline(off: Boolean) {
        if (off == offline) return
        offline = off
        if (!off) {
            val waiting = messages.values.sumOf { l -> l.count { it.pending } }
            if (waiting > 0) {
                messages = messages.mapValues { (_, l) -> l.map { it.copy(pending = false) } }
                toast("Back online · $waiting message${if (waiting > 1) "s" else ""} sent")
            }
        }
    }

    // ───────────────────────────── verification + payout ─────────────────────────────

    fun toggleDoc(i: Int) { docsUploaded = docsUploaded.toMutableList().also { it[i] = !it[i] } }

    val idDigits get() = ID_TYPES[idType].second
    val verifyReady get() = idNumber.length == idDigits && docsUploaded.all { it }

    /** PROPOSAL: documents go to a private bucket and the team reviews them. */
    fun submitVerification(onboarding: Boolean) {
        if (!verifyReady) { toast(if (idNumber.length != idDigits) "Enter your ${idDigits}-character ${ID_TYPES[idType].first}" else "Add all three documents"); return }
        if (onboarding && demo) {
            switchRole(Role.Artisan)
            payoutSaved = false; payoutAccount = "" // a new artisan has no bank details yet
            notify(Role.Artisan, "Documents received", "We’ll review them within 24 hours. Set up payouts meanwhile.", Route.Payout, "Add payout account")
            toast("Sent for review. Welcome to Lezerv.")
        } else {
            stack = stack.dropLast(1)
            toast(if (onboarding) "Sent for review" else "Verification details updated")
        }
    }

    /** PROPOSAL: name match via a bank lookup (e.g. Paystack resolve) and BVN check, backend side. */
    val accountName: String? get() = if (payoutAccount.length == 10) "TUNDE BAKARE" else null
    val payoutReady get() = accountName != null && bvn.length == 11

    fun savePayout() {
        if (!payoutReady) { toast(if (accountName == null) "Account number is 10 digits" else "BVN is 11 digits"); return }
        bvn = ""; payoutSaved = true; stack = stack.dropLast(1)
        toast("Payouts go to $payoutLabel")
    }

    /** Demo toggle for the offline state. */
    fun toggleOfflineDemo() = updateOffline(!offline)

    fun dismissDecline() { declining = false }

    init {
        // A fresh install shows the welcome after the splash; guests can still look around.
        if (!signedIn) account.showWelcome()
    }

    // ── helpers for screens ──
    val jobArtisan: Artisan? get() = artisan(job?.artisanId)
    /** Reviews on a profile: sample ones, or the backend's (null while they load). */
    fun reviewsFor(artisanId: String): List<Review>? = live?.let { it.reviews[artisanId] } ?: if (isLive) null else REVIEWS
    /** Live jobs still happening / finished, for the Jobs tab. */
    val liveActive get() = live?.jobs.orEmpty().filter { it.active }
    val livePast get() = live?.jobs.orEmpty().filterNot { it.active }
    fun serviceLabel(a: Artisan) = SERVICE.getValue(a.svc).label
    val clientPos get() = com.lezerv.app.data.Pt(UX, UY)
}
