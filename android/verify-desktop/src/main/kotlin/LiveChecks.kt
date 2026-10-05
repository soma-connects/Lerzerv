package com.lezerv.verify

import com.lezerv.app.data.SUPPORT
import com.lezerv.app.data.remote.MessageDto
import com.lezerv.app.data.remote.NotificationDto
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.TicketMessageDto
import com.lezerv.app.data.remote.jobStatus
import com.lezerv.app.data.remote.timeLabel
import com.lezerv.app.state.AuthStep
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Route
import com.lezerv.app.state.Tab
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.TimeZone

/** 5 Oct 2026, 13:00 in Lagos. */
val LIVE_NOW: Long = OffsetDateTime.parse("2026-10-05T12:00:00Z").toInstant().toEpochMilli()

/**
 * A live-mode app on the fake backend. Dispatchers.Unconfined runs each coroutine right
 * away on the calling thread, and the fake never really waits, so every action has
 * finished by the time the call returns: the checks can look at the result straight after.
 */
fun liveApp(api: FakeBackend, clock: () -> Long = { LIVE_NOW }): LezervState =
    LezervState(demo = true, clock = clock, splash = false).also { it.connect(api, CoroutineScope(Dispatchers.Unconfined + SupervisorJob())) }

/** Drives LiveSync the way a person would, against [FakeBackend]. Run: gradle liveChecks */
fun main() {
    TimeZone.setDefault(TimeZone.getTimeZone("Africa/Lagos"))
    var n = 0
    fun check(name: String, ok: Boolean) { n++; println((if (ok) "PASS  " else "FAIL  ") + name); if (!ok) error("check failed: $name") }

    // ── first launch, no saved sign-in ──
    run {
        val api = FakeBackend()
        val s = liveApp(api)
        check("map shows the backend's artisans, not the samples", s.artisans.map { it.name } == listOf("Tunde Bakare", "Chinwe Okafor", "Bisi Laundromat") && s.artisan("a2") == null)
        check("artisans asked for within 10 km", "artisans 10" in api.calls)
        check("guest sees the welcome; nothing personal is loaded", s.account.authStep == AuthStep.Welcome && "jobs" !in api.calls)
        check("guest has no fake history", s.past.isEmpty() && s.notices.isEmpty() && s.threads.isEmpty())

        // phone sign-in, wrong code then right code, new person
        s.account.startPhone(); s.account.onPhoneInput("0812 345 6789"); s.account.sendCode()
        check("code requested for +234…, with the leading 0 dropped", api.calls.last() == "otp +2348123456789" && s.account.authStep == AuthStep.Code)
        s.account.onCodeInput("111111")
        check("wrong code: friendly message, boxes cleared", s.snack?.contains("doesn’t match") == true && s.account.code.isEmpty() && !s.account.signedIn)
        s.account.onCodeInput("123456")
        check("new person: asked for their name", s.account.authStep == AuthStep.Details && s.live?.userId == "user-new")
        s.account.authBack()
        check("leaving the name step signs out instead of staying half in", s.account.authStep == AuthStep.Phone && s.live?.userId == null && api.calls.last() == "signout")
        s.account.sendCode(); s.account.onCodeInput("123456"); s.account.name = "Ngozi Eze"; s.account.email = "ngozi@example.com"; s.account.saveDetails()
        check("details saved to the profile, then signed in", api.calls.contains("saveProfile Ngozi Eze ngozi@example.com") && s.account.signedIn && s.account.authStep == null && s.snack == "Welcome, Ngozi")
        check("phone kept from what they typed", s.account.phone == "8123456789")
    }

    // ── returning person: saved session ──
    val api = FakeBackend(sessionUser = "user-1")
    val s = liveApp(api)
    check("saved sign-in restored quietly", s.account.signedIn && s.account.authStep == null && s.account.name == "Amaka Obi" && s.snack == null)
    check("phone from the profile, shown masked", s.account.phone == "8035554417" && s.account.phoneMasked == "+234 803 ••• 4417")
    check("jobs, chats, tickets and notifications loaded", listOf("jobs", "conversations", "tickets", "notifications").all { it in api.calls })
    check("active and past jobs split by status", s.liveActive.map { it.id } == listOf("j1") && s.livePast.map { it.id } == listOf("j0"))
    check("status line shows the artisan's quote", jobStatus(s.liveActive.single()) == "Tunde Bakare proposed ₦15,000")
    val notice = s.notices.single()
    check("notification in the inbox, routed to Jobs, time in Lagos", notice.remoteId == "n1" && notice.route == Route.Jobs && !notice.read && notice.ago == "10:10")

    // reviews load with the profile
    s.push(Pushed.Profile("7f3e"))
    check("profile loads the artisan's real reviews", s.reviewsFor("7f3e")?.map { it.name } == listOf("Amaka", "Femi") && s.reviewsFor("7f3e")?.get(1)?.text == "No comment.")
    s.back()

    // ── book: send a request ──
    s.startBooking("7f3e"); s.option = 1; s.whenIdx = 1; s.slot = 2; s.note = "Kitchen sink drips."
    s.sendRequest()
    check("no address yet: asked to add one, nothing posted", s.top == Pushed.AddressEdit && api.calls.none { it.startsWith("postJob") })
    s.account.formStreet = "4 Bishop Aboyade Cole St"; s.account.formArea = "Ikate"; s.account.saveAddress()
    s.sendRequest()
    val post = api.calls.last { it.startsWith("postJob") }
    check("job posted with category, area and the chosen artisan", post.startsWith("postJob Unblock a drain | plumbing | lekki | Requested artisan: Tunde Bakare (7f3e)"))
    check("note, address and time passed on", "Kitchen sink drips." in post && "4 Bishop Aboyade Cole St, Ikate" in post && "2026-10-05T16:00+01:00" in post)
    check("then shown under Jobs as requested", s.tab == Tab.ClientJobs && s.top == null && s.liveActive.first().status == "open" && jobStatus(s.liveActive.first()).startsWith("Requested"))
    check("first request asks about notifications", s.showPrime)
    s.answerPrime(false)
    check("…and then confirms the request", s.snack == "Request sent. We’ll confirm Tunde and the price with you.")

    // ── chat ──
    val t = s.threads.single()
    check("Messages lists the conversation with its job", t.key == "conv1" && t.name == "Tunde Bakare" && t.ini == "TB" && t.preview == "Leak repair" && t.at == "10:12")
    s.openTab(Tab.Messages); s.openChat("conv1")
    check("chat loads its messages; system lines centred, theirs on the left", s.chatMessages.map { it.system to it.me } == listOf(true to false, false to false))
    check("title is the artisan, subtitle the job", s.threadName(s.chatWith) == "Tunde Bakare")
    s.draft = "Call me on 0803 555 4417"; s.send()
    check("sent through send_message; the server’s redaction shown and explained",
        api.calls.last() == "send conv1 Call me on 0803 555 4417" && s.chatMessages.takeLast(2).let { it[0].text == "Call me on [contact hidden]" && it[0].masked && it[0].me && it[1].system })
    val before = s.chatMessages.size
    api.messageFeed.tryEmit(MessageDto("m9", "conv1", "art-user", "On my way at 4.", false, "2026-10-05T11:30:00+00:00"))
    check("their reply arrives live", s.chatMessages.size == before + 1 && s.chatMessages.last().text == "On my way at 4." && s.chatMessages.last().at == "12:30")
    api.messageFeed.tryEmit(MessageDto("m9", "conv1", "art-user", "On my way at 4.", false, "2026-10-05T11:30:00+00:00"))
    check("the same row twice is shown once", s.chatMessages.size == before + 1)
    check("Messages preview follows the latest line", s.threads.first().preview == "On my way at 4.")
    s.updateOffline(true); s.draft = "See you soon"; s.send()
    check("offline: not sent, draft kept, told why", api.calls.last() != "send conv1 See you soon" && s.draft == "See you soon" && s.snack?.contains("offline") == true)
    s.updateOffline(false); s.draft = ""

    // ── support ──
    s.openTab(Tab.Messages); s.openChat(SUPPORT)
    check("support with no ticket: just the hint line", s.chatMessages.single().system)
    s.draft = "Hi"; s.send()
    check("server’s own words shown when it refuses", s.snack == "Please describe the issue in a few more words" && s.draft == "Hi")
    s.draft = "My receipt for the deep clean is missing."; s.send()
    check("first message opens a ticket", api.calls.last { it.startsWith("openTicket") } == "openTicket My receipt for the deep clean is missing. | null")
    check("…and the thread shows it, then follows the ticket", s.chatMessages.last().text == "My receipt for the deep clean is missing." && s.chatMessages.last().me)
    api.ticketFeed.tryEmit(TicketMessageDto("tm77", s.live!!.ticket!!.id, "agent", "Sent it to your email.", "2026-10-05T11:40:00+00:00"))
    check("agent reply arrives live, on their side", s.chatMessages.last().let { it.text == "Sent it to your email." && !it.me })
    s.draft = "Thanks!"; s.send()
    check("later messages reply on the same ticket", api.calls.last() == "reply ${s.live!!.ticket!!.id} Thanks!")
    check("support row in Messages", s.threads.last().let { it.support && it.preview == "Thanks!" })

    // ── report a problem ──
    val r = s.reportable
    check("Help offers a report for the assigned job", r == "“Leak repair”" to "j1")
    s.openTab(Tab.ClientAccount); s.push(Pushed.Help); s.startReport(r!!.first, 1, r.second); s.reportText = "Still dripping after the visit."; s.submitReport()
    check("report becomes a ticket linked to the job", api.calls.last().startsWith("openTicket ") && api.calls.last().endsWith("Still dripping after the visit. | j1") && s.top == Pushed.Help && s.snack == "Report sent. We reply in your support chat.")

    // ── notifications ──
    api.noticeFeed.tryEmit(NotificationDto("n2", "message", "New message", "Tunde: On my way", "/my-jobs", false, "2026-10-05T11:50:00+00:00"))
    check("new notification arrives live with a toast", s.notices.first().remoteId == "n2" && s.unread == 2 && s.snack == "New message")
    s.openNotice(s.notices.first())
    check("opening it marks it read on the server and opens Messages", api.calls.contains("read n2") && s.tab == Tab.Messages && s.unread == 1)
    s.markAllRead()
    check("mark all read is one call", api.calls.last() == "readAll" && s.unread == 0)

    // ── edit profile ──
    s.openTab(Tab.ClientAccount); s.push(Pushed.EditProfile); s.account.name = "Amaka Obi-Eze"; s.account.saveProfile()
    check("profile edits saved to the backend", api.calls.last() == "saveProfile Amaka Obi-Eze null" && s.top == null && s.snack == "Profile saved")

    // ── failures ──
    api.failNext = java.net.ConnectException("Connection refused")
    s.live!!.reload()
    check("network failure: says there's no connection", s.snack == "No connection. Couldn’t load artisans near you." && s.artisans.size == 3)
    s.openChat(SUPPORT)
    api.failNext = ServerMessage("too many support requests — please wait a moment before sending another")
    s.draft = "One more thing"; s.send()
    check("rate limit explained in the server's words, draft kept", s.snack!!.startsWith("Too many support requests") && s.draft == "One more thing")

    // ── sign out ──
    s.account.signOut()
    check("sign-out ends the session and clears everything personal", api.calls.last() == "signout" && s.live?.userId == null && s.liveActive.isEmpty() && s.threads.isEmpty() && s.notices.isEmpty() && s.messages.isEmpty())
    check("…but the map stays", s.artisans.size == 3 && s.account.authStep == AuthStep.Welcome)

    // ── email sign-in for a website account ──
    s.account.startEmail(); s.account.emailDraft = "amaka@example.com"; s.account.password = "wrongpass"; s.account.signInWithEmail()
    check("wrong password: clear message", s.snack == "That email and password don’t match a Lezerv account." && !s.account.signedIn)
    s.account.password = "secret12"; s.account.signInWithEmail()
    check("email sign-in works and loads their jobs", s.account.signedIn && s.account.name == "Amaka Obi-Eze" && s.liveActive.isNotEmpty() && s.account.password.isEmpty())

    // ── delete account ──
    s.account.deleteAccount()
    check("delete sends a request to support and signs out", api.calls.any { it.startsWith("openTicket Please delete my Lezerv account") } && !s.account.signedIn && s.snack!!.startsWith("Deletion requested"))

    // ── time labels ──
    val z = ZoneId.of("Africa/Lagos")
    check("time labels: today, yesterday, older, Postgres text form",
        timeLabel("2026-10-05T07:05:00.123456+00:00", LIVE_NOW, z) == "08:05" && timeLabel("2026-10-04T12:00:00+00:00", LIVE_NOW, z) == "Yesterday" &&
            timeLabel("2026-09-12T10:00:00+00:00", LIVE_NOW, z) == "12 Sep" && timeLabel("2026-10-05 07:05:00+00", LIVE_NOW, z) == "08:05" && timeLabel("garbage", LIVE_NOW, z) == "")

    println("\nAll $n live-mode checks passed.")
}
