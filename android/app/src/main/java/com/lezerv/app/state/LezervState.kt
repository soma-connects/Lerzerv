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
import com.lezerv.app.data.artisan
import com.lezerv.app.data.maskContacts
import com.lezerv.app.data.naira
import com.lezerv.app.data.optionPrice
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
}

enum class Sheet { Peek, List }

data class Message(val me: Boolean, val text: String, val at: String, val masked: Boolean = false)

/** The client's live booking. [stage] indexes SERVICE_STEPS or LAUNDRY_STEPS; [t] is 0..1 progress along the route. */
data class ClientJob(
    val artisanId: String, val laundry: Boolean, val stage: Int, val t: Float,
    val total: Int, val title: String, val whenLabel: String, val express: Boolean,
) {
    val lastStage get() = if (laundry) 5 else 4
    /** Stages where someone is driving: the artisan to you, or the laundry rider both ways. */
    val moving get() = if (laundry) stage == 1 || stage == 4 else stage == 1
}

/** The artisan's accepted request. Stage 0 driving, 1 arrived (enter code), 2 working, 3 done. */
data class ArtisanJob(val stage: Int, val t: Float, val startedAt: Long = 0L)

data class PastJob(val artisanId: String, val title: String, val date: String, val total: Int)
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
class LezervState(val demo: Boolean = true, private val clock: () -> Long = { System.currentTimeMillis() }) {

    // ── navigation ──
    var role by mutableStateOf(Role.Client); private set
    var tab by mutableStateOf(Tab.Explore)
    var stack by mutableStateOf(listOf<Pushed>()); private set
    val top: Pushed? get() = stack.lastOrNull()

    // ── explore ──
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
    var past by mutableStateOf(listOf(PastJob("a1", "Deep clean", "12 Sep", 28000), PastJob("a4", "Socket repair", "28 Aug", 7350))); private set

    // ── review sheet ──
    var reviewing by mutableStateOf(false); private set
    var stars by mutableIntStateOf(5)
    var reviewTags by mutableStateOf(listOf("On time"))

    // ── chat ──
    var messages by mutableStateOf(
        mapOf(
            "a2" to listOf(Message(false, "Hello, I saw your request. Is the leak under the sink or from the tap?", "09:12")),
            "a1" to listOf(Message(false, "Thank you for the review, Amaka.", "12 Sep")),
        ),
    ); private set
    var chatWith by mutableStateOf<String?>(null); private set
    var draft by mutableStateOf("")

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
        job?.let { j ->
            val advancing = if (j.laundry) j.stage == 0 || j.stage == 1 || j.stage == 4 else j.stage == 0 || j.stage == 1
            if (advancing) {
                var p = j.t + if (j.stage == 0) 0.035f else 0.009f
                var s = j.stage
                if (p >= 1f) { p = 0f; s++ }
                job = j.copy(t = p, stage = s)
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
            requestOpen = false
            toast("Request expired. Next one will come shortly.")
        }
        if (snack != null && t >= snackUntil) snack = null
    }

    fun toast(m: String) { snack = m; snackUntil = clock() + 3200 }

    // ───────────────────────────── navigation ─────────────────────────────

    fun push(p: Pushed) { stack = stack + p }

    /** True while system back should stay inside the app; false lets Android close it. */
    val canGoBack: Boolean get() = reviewing || stack.isNotEmpty() || selected != null || sheet == Sheet.List || tab != homeTab

    /** Android system back. Returns false when there is nothing left to go back from (exit). */
    fun back(): Boolean = when {
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
        nextRequestAt = 0L
        role = r; tab = if (r == Role.Client) Tab.Explore else Tab.ArtisanMap
        stack = emptyList(); selected = null; panX = null; panY = null; requestOpen = false
    }

    // ───────────────────────────── explore ─────────────────────────────

    val visibleArtisans by derivedStateOf {
        val q = query.trim().lowercase()
        ARTISANS.filter { (category == "all" || it.svc == category) && (q.isEmpty() || it.name.lowercase().contains(q) || it.service.label.lowercase().contains(q)) }
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

    /** PROPOSAL: escrow. Payment is held by Lezerv until the client confirms the job is done. */
    fun pay() {
        val a = artisan(bookArtisan) ?: return
        val b = bookTotal()
        val title = if (a.laundry) "Laundry · ${laundryCounts.sum()} items" else OPTIONS.getValue(a.svc)[option]
        val whenLabel = if (a.laundry) PICKUP_WINDOWS[pickupWindow] else if (whenIdx == 0) "Now" else SLOTS[slot]
        job = ClientJob(a.id, a.laundry, 0, 0f, b.total, title, whenLabel, express)
        stack = listOf(Pushed.Track); tab = Tab.ClientJobs; selected = null
        toast("${naira(b.total)} paid into Lezerv escrow")
    }

    /** Moves the job to its next stage (client "Confirm the job is done", or demo skip). */
    fun advance() {
        val j = job ?: return
        if (j.stage >= j.lastStage) return
        job = j.copy(stage = j.stage + 1, t = 0f)
    }

    fun openReview() { reviewing = true; stars = 5; reviewTags = listOf("On time") }

    fun toggleTag(t: String) { reviewTags = if (t in reviewTags) reviewTags - t else reviewTags + t }

    fun submitReview() {
        val j = job ?: return
        val a = artisan(j.artisanId) ?: return
        reviewing = false; job = null
        past = listOf(PastJob(a.id, j.title, "Today", j.total)) + past
        stack = emptyList(); tab = Tab.ClientJobs
        toast("Payment released to ${a.first}. Thanks for the review.")
    }

    // ───────────────────────────── chat ─────────────────────────────

    fun openChat(artisanId: String?) { chatWith = artisanId; draft = ""; push(Pushed.Chat) }

    private val chatKey get() = if (role == Role.Artisan) "client" else chatWith.orEmpty()
    val chatMessages: List<Message> get() = messages[chatKey].orEmpty()

    fun send() {
        val t = draft.trim()
        if (t.isEmpty()) return
        val m = maskContacts(t)
        messages = messages + (chatKey to (messages[chatKey].orEmpty() + Message(true, m, "Now", m != t)))
        draft = ""
        if (m != t) toast("Contact details are hidden to keep payment on Lezerv")
    }

    // ───────────────────────────── artisan ─────────────────────────────

    fun toggleOnline() {
        online = !online
        nextRequestAt = if (online) clock() + 2500 else 0L
        requestOpen = false
    }

    fun declineRequest() {
        nextRequestAt = clock() + 6000; requestOpen = false
        toast("Declined. Your acceptance rate is 94%.")
    }

    fun acceptRequest() { requestOpen = false; artisanJob = ArtisanJob(0, 0f); code = ""; stack = listOf(Pushed.Navigate) }

    val codeOk get() = code == DEMO_START_CODE

    fun startJob() {
        val a = artisanJob ?: return
        if (codeOk) artisanJob = a.copy(stage = 2, startedAt = clock()) else toast("Enter the 4-digit code from the client")
    }

    fun completeJob() {
        val a = artisanJob ?: return
        artisanJob = a.copy(stage = 3)
        earnedToday += 6400
        artisanPast = listOf(ArtisanPast("Leaking kitchen sink", "Amaka O. · Lekki Phase 1 · Today", 6400)) + artisanPast
    }

    fun finishArtisanJob() {
        nextRequestAt = 0L
        artisanJob = null; stack = emptyList(); tab = Tab.ArtisanMap; code = ""
        toast("₦6,400 added to escrow. Released when Amaka confirms.")
    }

    fun withdraw() = toast("₦48,200 on its way to GTBank ••4821")

    /** Demo-only: put everything back to the start. */
    fun reset() {
        val fresh = LezervState(demo, clock)
        role = fresh.role; tab = fresh.tab; stack = fresh.stack; category = fresh.category; query = ""; selected = null; sheet = Sheet.Peek
        panX = null; panY = null; blueprintMap = true; job = null; past = fresh.past; reviewing = false; messages = fresh.messages
        chatWith = null; draft = ""; snack = null; online = false; requestOpen = false; nextRequestAt = 0L; artisanJob = null
        code = ""; earnedToday = fresh.earnedToday; radiusKm = fresh.radiusKm; artisanPast = fresh.artisanPast
    }

    // ── helpers for screens ──
    val jobArtisan: Artisan? get() = artisan(job?.artisanId)
    fun serviceLabel(a: Artisan) = SERVICE.getValue(a.svc).label
    val clientPos get() = com.lezerv.app.data.Pt(UX, UY)
    val allArtisans get() = ARTISANS
}
