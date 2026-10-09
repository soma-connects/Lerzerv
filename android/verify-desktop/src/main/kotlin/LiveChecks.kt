package com.lezerv.verify

import com.lezerv.app.data.DECLINE_REASONS
import com.lezerv.app.data.GeoFix
import com.lezerv.app.data.GeoPoint
import com.lezerv.app.data.LEKKI_PHASE_1
import com.lezerv.app.data.SUPPORT
import com.lezerv.app.data.remote.MessageDto
import com.lezerv.app.data.remote.NotificationDto
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.TicketMessageDto
import com.lezerv.app.data.remote.jobStatus
import com.lezerv.app.data.remote.timeLabel
import com.lezerv.app.state.AuthStep
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.LiveSync
import com.lezerv.app.state.Locator
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Role
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
fun liveApp(api: FakeBackend, connectWith: String = "0.2.0-test", clock: () -> Long = { LIVE_NOW }): LezervState =
    LezervState(demo = true, clock = clock, splash = false).also { it.connect(api, CoroutineScope(Dispatchers.Unconfined + SupervisorJob()), connectWith) }

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
        check("an artisan with no location of their own says which area they serve", s.artisan("c1a0")?.distanceLabel == "Serves Lekki" && s.artisan("7f3e")?.distanceLabel?.endsWith("min") == true)
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
    check("status line shows the artisan's quote", jobStatus(s.liveActive.single(), LIVE_NOW) == "Tunde Bakare proposed ₦15,000")
    val notice = s.notices.single()
    check("notification in the inbox, routed to Jobs, time in Lagos", notice.remoteId == "n1" && notice.route == Route.Jobs && !notice.read && notice.ago == "10:10")

    // reviews load with the profile
    s.push(Pushed.Profile("7f3e"))
    check("profile loads the artisan's real reviews", s.reviewsFor("7f3e")?.map { it.name } == listOf("Amaka", "Femi") && s.reviewsFor("7f3e")?.get(1)?.text == "No comment.")
    s.back()

    // ── book the artisan you picked ──
    s.startBooking("7f3e"); s.option = 1; s.whenIdx = 1; s.slot = 2; s.note = "Kitchen sink drips."
    s.sendRequest()
    check("no address yet: asked to add one, nothing booked", s.top == Pushed.AddressEdit && api.calls.none { it.startsWith("book ") })
    s.account.formStreet = "4 Bishop Aboyade Cole St"; s.account.formArea = "Ikate"; s.account.formNote = "Blue gate"; s.account.saveAddress()
    check("the address is saved to the account, with its service area",
        api.calls.last() == "saveAddress new Home | 4 Bishop Aboyade Cole St | Ikate | lekki | Blue gate" && s.top == Pushed.Book && s.account.currentAddress?.id?.startsWith("addr-") == true)
    s.sendRequest()
    val booked = api.calls.last { it.startsWith("book ") }
    check("booked with the artisan, their category, the saved address and the time",
        booked.startsWith("book 7f3e | plumbing | Unblock a drain | addr-") && "2026-10-05T16:00+01:00" in booked && "Kitchen sink drips." in booked)
    check("the estimate and the time travel with it, for the artisan's request card", "estimate=₦" in booked && "when=Today 16:00" in booked)
    val pending = s.liveActive.first()
    check("Jobs shows the countdown while Tunde decides", s.tab == Tab.ClientJobs && pending.offerPending && jobStatus(pending, LIVE_NOW) == "Waiting for Tunde to accept · 30s")
    check("first request asks about notifications", s.showPrime)
    s.answerPrime(false)
    check("…and then confirms the request", s.snack == "Request sent. Waiting for Tunde to accept.")

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

    // ══ two phones, one backend: Amaka books, Tunde takes the job ══
    run {
        var now = LIVE_NOW
        val world = FakeWorld { now }
        val amakaApi = FakeBackend(sessionUser = "user-1", world = world)
        val tundeApi = FakeBackend(world = world)
        val amaka = liveApp(amakaApi) { now }
        val tunde = liveApp(tundeApi) { now }

        tunde.account.startEmail(); tunde.account.emailDraft = "tunde@example.com"; tunde.account.password = "secret12"; tunde.account.signInWithEmail()
        check("an approved artisan signs in and the app knows they're one", tunde.live!!.isArtisan && tunde.online && tunde.radiusKm == 5)
        check("…with a real switch to the artisan side in Account", tunde.live!!.me!!.displayName == "Tunde Bakare")
        tunde.switchRole(Role.Artisan)
        check("online and waiting, nothing incoming", tunde.tab == Tab.ArtisanMap && tunde.incoming == null)

        amaka.account.editAddress(null); amaka.account.formStreet = "4 Bishop Aboyade Cole St"; amaka.account.formArea = "Ikate"; amaka.account.saveAddress()
        amaka.startBooking("7f3e"); amaka.option = 0; amaka.sendRequest(); amaka.answerPrime(false)
        val req = tunde.incoming
        check("Tunde's map shows the request at once, from the realtime notification", req != null && req.title == "Leak repair" && req.tag == "Ikate")
        check("…with Amaka's first name, the area, when, and her estimate", req!!.sub == "Plumbing · Amaka · Ikate · Now" && req.pay?.second?.startsWith("₦") == true && req.endsAt == now + 30_000)
        check("…but not her street yet", tunde.live!!.artisanJobs.first().addressText == "Ikate")

        tunde.acceptIncoming()
        val tj = tunde.liveArtisanJob!!
        check("accepting opens the job screen with her street address", tunde.top == Pushed.Navigate && tj.addressText == "4 Bishop Aboyade Cole St, Ikate")
        check("Amaka hears about it straight away and sees her start code",
            amaka.snack == "Tunde accepted your request" && amaka.live!!.startCodes[amaka.liveActive.first().id] == "5309" && !amaka.liveActive.first().offerPending)
        check("…and her chat with Tunde opens", amaka.threads.any { it.name == "Tunde Bakare" && it.key != "conv1" })
        check("Tunde's chat title is the client's first name", tunde.threadName(tj.conversationId) == "Amaka")

        tunde.navigateTo(tj.addressText!!)
        check("Navigate hands the address to a maps app", tunde.snack == "Opens Google Maps at 4 Bishop Aboyade Cole St, Ikate")
        tunde.markArrived()
        tunde.code = "1111"; tunde.startJob()
        check("a wrong start code is refused with tries left", tunde.snack == "That code doesn’t match. 4 tries left." && tunde.liveArtisanJob!!.status == "assigned" && tunde.code.isEmpty())
        tunde.code = "5309"; tunde.startJob()
        check("the right code starts the job, and Amaka is told", tunde.liveArtisanJob!!.status == "in_progress" && amaka.snack == "Work has started")
        tunde.completeJob()
        check("mark complete keeps that job on screen as done, even with other jobs open", tunde.liveArtisanJob?.id == tj.id && tunde.live!!.justCompleted?.id == tj.id)
        tunde.finishArtisanJob()
        check("back to the map afterwards", tunde.top == null && tunde.tab == Tab.ArtisanMap && tunde.live!!.justCompleted == null)
        check("the finished job is in Tunde's completed list", tunde.live!!.artisanJobs.any { it.id == tj.id && it.status == "completed" })
        tunde.openArtisanJob("j1")
        check("opening another job from the list shows that job", tunde.top == Pushed.Navigate && tunde.liveArtisanJob?.id == "j1")
        tunde.back()

        // An offer nobody answers
        amaka.startBooking("7f3e"); amaka.option = 2; amaka.sendRequest()
        check("a second request reaches Tunde", tunde.incoming?.title == "Water heater fix")
        now += 31_000
        amaka.tick()
        val expired = amaka.live!!.jobs.first()
        check("when the countdown ends the server is asked to expire it", amakaApi.calls.contains("expireOffers") && expired.status == "open")
        check("…and Amaka's job says Tunde couldn't take it", jobStatus(expired, now) == "Tunde couldn’t take it · Lezerv is finding someone else")
        check("Tunde's card is gone", tunde.incoming == null)

        // Tunde says no
        amaka.startBooking("7f3e"); amaka.option = 0; amaka.sendRequest()
        tunde.declineRequest(); tunde.declineReason = 1; tunde.confirmDecline()
        check("declining sends the reason and clears the card",
            tundeApi.calls.any { it.startsWith("decline ") && it.endsWith(DECLINE_REASONS[1]) } && tunde.incoming == null && !tunde.declining)

        // Amaka changes her mind
        amaka.startBooking("7f3e"); amaka.option = 0; amaka.sendRequest()
        val waiting = amaka.liveActive.first { it.offerPending }
        amaka.live!!.cancel(waiting.id)
        check("cancelling a request withdraws it from Tunde", amaka.liveActive.none { it.id == waiting.id } && tunde.incoming == null)

        // Going offline
        tunde.toggleOnline()
        check("the online switch goes to the server", tundeApi.calls.last() == "available false" && !tunde.online)
        amaka.live!!.reload()
        amaka.startBooking("7f3e"); amaka.sendRequest()
        check("an offline artisan can't be booked, and the client is told why", amaka.snack == "Tunde isn't taking jobs right now — pick someone available")

        tunde.changeRadius(7)
        Thread.sleep(900) // the slider save waits for the drag to settle
        check("the coverage radius is saved once it settles", tundeApi.calls.count { it.startsWith("radius") } == 1 && tundeApi.calls.contains("radius 7"))
    }

    // ══ push notifications ══
    run {
        val world = FakeWorld()
        // A guest: Firebase gives the phone a token, but there's nobody to register it for yet.
        val guestApi = FakeBackend(world = world)
        val g = liveApp(guestApi)
        g.setPushToken("fcm-token-1")
        check("a guest's phone isn't registered for anyone", guestApi.calls.none { it.startsWith("register") })
        g.account.startEmail(); g.account.emailDraft = "amaka@example.com"; g.account.password = "secret12"; g.account.signInWithEmail()
        check("signing in registers the phone, with the app version", guestApi.calls.contains("register fcm-token-1 0.2.0-test") && world.devices["fcm-token-1"] == "user-1")
        g.setPushToken("fcm-token-2")
        check("when Google gives the phone a new token, it's registered too", world.devices["fcm-token-2"] == "user-1")
        g.account.signOut()
        val i = guestApi.calls.indexOf("unregister fcm-token-2")
        check("signing out unregisters the phone first, while it still can", i >= 0 && guestApi.calls.getOrNull(i + 1) == "signout" && "fcm-token-2" !in world.devices)

        // Tapping a notification while the app is still restoring the sign-in.
        val slowApi = FakeBackend(sessionUser = "user-1", world = world).apply { holdRestore = kotlinx.coroutines.CompletableDeferred() }
        val cold = liveApp(slowApi, connectWith = "0.2.0-test")
        cold.openFromPush("message", "n-x")
        check("a tap during start-up waits for the sign-in", cold.tab == Tab.Explore)
        slowApi.holdRestore!!.complete(Unit)
        check("…then opens what it's about", cold.tab == Tab.Messages && slowApi.calls.contains("read n-x"))
        cold.openFromPush("job_accepted", "n1")
        check("a push already in the inbox opens it and marks it read", cold.tab == Tab.ClientJobs && slowApi.calls.contains("read n1") && cold.notices.first { it.remoteId == "n1" }.read)
        cold.openFromPush("support_reply", null)
        check("support replies open the support chat", cold.top == Pushed.Chat && cold.chatWith == SUPPORT)

        // An artisan
        val tApi = FakeBackend(sessionUser = "art-user", world = world)
        val t = liveApp(tApi)
        t.openFromPush("job_offer", null)
        check("a request push takes an artisan to the requests map", t.role == Role.Artisan && t.tab == Tab.ArtisanMap)
        t.toggleOnline(); t.toggleOnline()
        check("going online is when an artisan is asked about notifications", t.online && t.showPrime)
        t.answerPrime(true); t.toggleOnline(); t.toggleOnline()
        check("…once", !t.showPrime)
        val allowed = liveApp(FakeBackend(sessionUser = "art-user", world = world)).apply { notificationsAllowed = { true } }
        allowed.toggleOnline(); allowed.toggleOnline()
        check("never if Android already allows them", !allowed.showPrime)
    }

    // ══ location (0027): the map follows the phone; artisans share where they are ══
    run {
        val ikoyi = GeoFix(GeoPoint(6.4541, 3.4339), 25f)
        val world = FakeWorld()
        val api = FakeBackend(sessionUser = "user-1", world = world)
        val s = liveApp(api)
        check("before any location: the map looks around Lekki Phase 1", s.origin == LEKKI_PHASE_1 && !s.originFromGps && world.searchedFrom == LEKKI_PHASE_1)
        val loc = FakeLocator(allowedNow = false, at = ikoyi)
        s.attachLocator(loc)
        check("opening the app doesn't ask for location out of the blue", loc.asked == 0 && !s.originFromGps)
        val searches = api.calls.count { it == "artisans 10" }
        s.recenter()
        check("tapping \"my location\" asks Android, then moves you to where the phone is", loc.asked == 1 && s.originFromGps && s.origin == ikoyi.point)
        check("…and the map reloads around you", world.searchedFrom == ikoyi.point && api.calls.count { it == "artisans 10" } == searches + 1)
        val tunde = s.artisan("7f3e")!!
        check("distances are now from you: Tunde in Lekki is ~5 km from Ikoyi", tunde.km in 4.5..5.8)
        check("the map is aimed back at you", s.aim.target == com.lezerv.app.data.Pt(com.lezerv.app.data.UX, com.lezerv.app.data.UY))
        loc.at = GeoFix(GeoPoint(6.4549, 3.4339), 10f) // ~90 m north
        s.onForeground()
        check("a small move doesn't reload the map", api.calls.count { it == "artisans 10" } == searches + 1 && s.origin == ikoyi.point)
        loc.at = null
        s.recenter()
        check("location switched off: told so when they asked", s.snack == "Couldn’t find you. Check that location is on.")
        s.toast("ok"); s.onForeground()
        check("…but not when it was only a quiet check", s.snack == "ok")

        val denied = liveApp(FakeBackend(world = world))
        val no = FakeLocator(allowedNow = false, grant = false, at = ikoyi)
        denied.attachLocator(no); denied.recenter()
        check("saying no keeps Lekki Phase 1 and says how to change it", !denied.originFromGps && denied.snack == LezervState.LOCATION_DENIED)

        val already = liveApp(FakeBackend(world = world))
        already.attachLocator(FakeLocator(allowedNow = true, at = ikoyi))
        check("if location was allowed before, the app uses it straight away, without asking", already.originFromGps && already.origin == ikoyi.point)

        val demo = LezervState(demo = true, splash = false)
        demo.attachLocator(FakeLocator(allowedNow = true, at = ikoyi)); demo.recenter()
        check("the demo stays in Lekki, where its sample artisans are", !demo.originFromGps && demo.origin == LEKKI_PHASE_1)
    }

    run {
        var now = LIVE_NOW
        val world = FakeWorld { now }
        val admiralty = GeoFix(GeoPoint(6.4491, 3.4738), 8f)
        val home = GeoFix(GeoPoint(6.43871, 3.46022), 12f)
        val amakaApi = FakeBackend(sessionUser = "user-1", world = world)
        val tundeApi = FakeBackend(sessionUser = "art-user", world = world)
        val amaka = liveApp(amakaApi) { now }
        val tunde = liveApp(tundeApi) { now }
        tunde.switchRole(Role.Artisan)
        check("an online artisan without location permission is asked by a hint, not a pop-up", tunde.online && !tunde.originFromGps && tundeApi.calls.none { it.startsWith("location") })
        val tLoc = FakeLocator(allowedNow = false, at = admiralty)
        tunde.attachLocator(tLoc)
        tunde.useMyLocation()
        check("allowing it shares where they are", tLoc.asked == 1 && tundeApi.calls.contains("location 6.4491,3.4738") && world.shared["7f3e"]?.first == admiralty.point)
        amaka.live!!.reload()
        val shown = kotlinx.coroutines.runBlocking { amakaApi.artisansNear(6.4478, 3.4723, 10) }.first { it.id == "7f3e" }
        check("clients see them there, rounded to ~550 m, no longer 'approximate'", shown.lat == 6.45 && shown.lng == 3.475 && !shown.approximate)
        val shares = tundeApi.calls.count { it.startsWith("location") }
        now += 60_000; tunde.tick()
        check("while online, no new share within 5 minutes", tundeApi.calls.count { it.startsWith("location") } == shares)
        now += LiveSync.SHARE_MS; tunde.tick()
        check("…then the phone shares again", tundeApi.calls.count { it.startsWith("location") } == shares + 1)
        tunde.toggleOnline() // offline
        now += LiveSync.SHARE_MS * 2; tunde.tick()
        check("offline: the phone stops sharing", tundeApi.calls.count { it.startsWith("location") } == shares + 1)
        tunde.toggleOnline() // online again
        check("going online shares straight away", tundeApi.calls.count { it.startsWith("location") } == shares + 2)

        // Amaka pins her address at her gate, then books Tunde.
        val aLoc = FakeLocator(allowedNow = true, at = home)
        amaka.attachLocator(aLoc)
        amaka.account.editAddress(null); amaka.account.formStreet = "4 Bishop Aboyade Cole St"; amaka.account.formArea = "Ikate"
        check("a new address has no pin; it's shown at its area's centre", amaka.account.formPin == null && amaka.formPos == amaka.plane.toMap(LEKKI_CENTRE))
        amaka.account.pinHere()
        check("\"I'm here\" pins it where the phone is, with how sure it was", amaka.account.formPin == home.point && amaka.account.formPinAccuracy == 12f && amaka.formPos == amaka.plane.toMap(home.point))
        amaka.account.saveAddress()
        check("the pin is saved with the address", amakaApi.calls.last() == "saveAddress new Home | 4 Bishop Aboyade Cole St | Ikate | lekki | null @ 6.43871,3.46022"
            && amaka.account.currentAddress?.point == home.point)
        amaka.startBooking("7f3e"); amaka.option = 0; amaka.sendRequest(); amaka.answerPrime(false)
        val offer = kotlinx.coroutines.runBlocking { tundeApi.artisanJobs() }.first()
        check("the offer gives Tunde the area's centre, not her pin", offer.lat == null && tunde.jobPin(offer)?.second == false && tunde.incomingPin == tunde.plane.toMap(LEKKI_CENTRE))
        tunde.acceptIncoming()
        val job = tunde.liveArtisanJob!!
        check("once accepted, he gets her exact pin for directions", job.lat == home.point.lat && job.lng == home.point.lng && tunde.jobPin(job) == (tunde.plane.toMap(home.point) to true))
        var opened: Pair<String, GeoPoint?>? = null
        tunde.openMaps = { a, at -> opened = a to at }
        tunde.navigateTo(job.addressText!!, GeoPoint(job.lat!!, job.lng!!))
        check("\"Navigate\" opens the maps app at the pin", opened?.second == home.point)
    }

    // ── time labels ──
    val z = ZoneId.of("Africa/Lagos")
    check("time labels: today, yesterday, older, Postgres text form",
        timeLabel("2026-10-05T07:05:00.123456+00:00", LIVE_NOW, z) == "08:05" && timeLabel("2026-10-04T12:00:00+00:00", LIVE_NOW, z) == "Yesterday" &&
            timeLabel("2026-09-12T10:00:00+00:00", LIVE_NOW, z) == "12 Sep" && timeLabel("2026-10-05 07:05:00+00", LIVE_NOW, z) == "08:05" && timeLabel("garbage", LIVE_NOW, z) == "")

    println("\nAll $n live-mode checks passed.")
}

/** A pretend phone location service: [grant] is the answer to Android's dialog, [at] where the phone is. */
class FakeLocator(var allowedNow: Boolean = false, var grant: Boolean = true, var at: GeoFix? = null) : Locator {
    var asked = 0
    override fun allowed() = allowedNow
    override fun ask(done: (Boolean) -> Unit) { asked++; allowedNow = grant; done(grant) }
    override suspend fun locate(): GeoFix? = at
}
