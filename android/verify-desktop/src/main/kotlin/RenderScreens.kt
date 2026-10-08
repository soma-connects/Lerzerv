package com.lezerv.verify

import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.platform.Font
import androidx.compose.ui.unit.Density
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Role
import com.lezerv.app.state.Sheet
import com.lezerv.app.state.Tab
import com.lezerv.app.ui.LezervApp
import com.lezerv.app.ui.theme.LzFonts
import org.jetbrains.skia.EncodedImageFormat
import java.io.File

/**
 * Renders each Lezerv screen to PNG at the prototype's phone size (392×774 dp content
 * area at 2×), driving LezervState through the same taps a tester would make.
 * Usage: gradle renderScreens  → PNGs in build/screens
 */
fun main(args: Array<String>) {
    val out = File(args[0]).apply { mkdirs() }
    val fontDir = File(args[1])
    fun f(name: String, w: Int) = Font(File(fontDir, name), FontWeight(w))
    val fonts = LzFonts(
        heading = FontFamily(f("barlow_condensed_medium.ttf", 500), f("barlow_condensed_semibold.ttf", 600), f("barlow_condensed_bold.ttf", 700)),
        body = FontFamily(f("archivo_regular.ttf", 400), f("archivo_medium.ttf", 500), f("archivo_semibold.ttf", 600), f("archivo_bold.ttf", 700)),
    )

    var clock = 1_000_000L
    fun state() = LezervState(demo = true, clock = { clock }, splash = false, signedIn = true)
    fun shot(name: String, s: LezervState) {
        val scene = ImageComposeScene(392 * 2, 774 * 2, Density(2f)) { LezervApp(s, fonts, runTicker = false) }
        repeat(3) { scene.render(it * 500_000_000L) } // let LaunchedEffects and layout settle
        val png = scene.render(2_000_000_000L).encodeToData(EncodedImageFormat.PNG)!!.bytes
        File(out, "$name.png").writeBytes(png)
        scene.close()
        println("rendered $name")
    }
    fun ticks(s: LezervState, n: Int) = repeat(n) { clock += 100; s.tick() }

    shot("01-explore", state())
    state().apply { pick("a2", 392f) }.let { shot("02-explore-selected", it) }
    state().apply { sheet = Sheet.List }.let { shot("03-explore-list", it) }
    state().apply { category = "laundry" }.let { shot("04-explore-laundry", it) }
    state().apply { push(Pushed.Profile("a2")) }.let { shot("05-profile", it) }
    state().apply { startBooking("a2"); whenIdx = 1 }.let { shot("06-book-service", it) }
    state().apply { startBooking("a3"); express = true }.let { shot("07-book-laundry", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30 + 50) }.let { shot("08-track-driving", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30); advance() }.let { shot("09-track-arrived", it) }
    state().apply { startBooking("a3"); pay(); answerPrime(false); ticks(this, 30 + 112); ticks(this, 1) }.let { shot("10-track-laundry", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30 + 50); openTab(Tab.ClientJobs) }.let { shot("11-client-jobs", it) }
    state().apply { openTab(Tab.Messages) }.let { shot("12-messages", it) }
    state().apply { openChat("a2"); draft = "Call me on 0803 555 4417"; send() }.let { shot("13-chat-masked", it) }
    state().apply { openTab(Tab.ClientAccount) }.let { shot("14-client-account", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30); repeat(3) { advance() }; openReview() }.let { shot("15-review", it) }

    state().apply { switchRole(Role.Artisan) }.let { shot("20-artisan-offline", it) }
    state().apply { switchRole(Role.Artisan); toggleOnline(); ticks(this, 30) ; ticks(this, 80) }.let { shot("21-artisan-request", it) }
    state().apply { switchRole(Role.Artisan); toggleOnline(); ticks(this, 30); acceptRequest(); ticks(this, 50) }.let { shot("22-artisan-driving", it) }
    state().apply { switchRole(Role.Artisan); toggleOnline(); ticks(this, 30); acceptRequest(); ticks(this, 105); code = "48" }.let { shot("23-artisan-code", it) }
    state().apply { switchRole(Role.Artisan); toggleOnline(); ticks(this, 30); acceptRequest(); ticks(this, 105); code = "4827"; startJob(); completeJob() }.let { shot("24-artisan-done", it) }
    state().apply { switchRole(Role.Artisan); openTab(Tab.ArtisanJobs) }.let { shot("25-artisan-jobs", it) }
    state().apply { switchRole(Role.Artisan); openTab(Tab.Earnings) }.let { shot("26-earnings", it) }
    state().apply { switchRole(Role.Artisan); openTab(Tab.ArtisanAccount); radiusKm = 7 }.let { shot("27-artisan-account", it) }
    state().apply { switchRole(Role.Artisan); radiusKm = 7; toggleOnline(); ticks(this, 5) }.let { shot("28-artisan-online", it) }

    // Board additions
    LezervState(demo = true, clock = { clock }).apply { clock += 600; tick() }.let { shot("30-splash", it) }
    state().apply { startBooking("a2"); pay() }.let { shot("31-prime", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30 + 112); openTab(Tab.ClientJobs); push(Pushed.Notifications) }.let { shot("32-notifications", it) }
    state().apply { openTab(Tab.ClientJobs) }.let { shot("33-jobs-empty", it) }
    state().apply { query = "zzz" ; sheet = Sheet.List }.let { shot("34-explore-empty", it) }
    state().apply { openChat("a2"); toggleOfflineDemo(); draft = "Are you still coming at 4?"; send(); ticks(this, 40) }.let { shot("35-chat-offline", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Verify(onboarding = true)); idNumber = "1234567" }.let { shot("36-verify", it) }
    state().apply { switchRole(Role.Artisan); openTab(Tab.ArtisanAccount); push(Pushed.Payout); bvn = "12345" }.let { shot("37-payout", it) }
    state().apply { switchRole(Role.Artisan); toggleOnline(); ticks(this, 30); declineRequest(); declineReason = 0 }.let { shot("38-decline", it) }
    state().apply { switchRole(Role.Artisan); openTab(Tab.ArtisanAccount) }.let { shot("39-artisan-account", it) }

    // First-design (deck) additions
    state().apply { startBooking("a2"); openPay(); payMethod = 1 }.let { shot("40-pay-sheet", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30 + 112); openTab(Tab.Explore) }.let { shot("41-needs-reply", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 40); openTab(Tab.Messages); openChat("a2"); draft = "Call me on 0803 555 4417"; send() }.let { shot("42-chat-system", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 30); repeat(3) { advance() }; openReview(); reviewComment = "Fixed the trap and seals in 40 minutes." ; ticks(this, 40) }.let { shot("43-review-comment", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Verify(onboarding = true)); idNumber = "12345678901"; toggleDoc(1); toggleDoc(2); submitVerification(true); ticks(this, 40); openTab(Tab.Earnings) }.let { shot("44-earnings-new", it) }

    // General app essentials
    fun guest() = LezervState(demo = true, clock = { clock }, splash = false, signedIn = false)
    guest().let { shot("50-welcome", it) }
    guest().apply { account.startPhone(); account.onPhoneInput("0803555441") }.let { shot("51-phone", it) }
    guest().apply { account.startPhone(); account.onPhoneInput("08035554417"); account.sendCode(); account.code = "1234"; clock += 12_000; tick() }.let { shot("52-code", it) }
    guest().apply { account.startPhone(); account.onPhoneInput("08035554417"); account.sendCode(); account.onCodeInput("123456"); account.name = "Amaka Obi" }.let { shot("53-details", it) }
    guest().apply { account.browseAsGuest(); openTab(Tab.ClientAccount) }.let { shot("54-guest-account", it) }
    state().apply { openTab(Tab.ClientAccount) }.let { shot("55-account", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Addresses) }.let { shot("56-addresses", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Addresses); account.editAddress(null); account.formStreet = "4 Bishop Aboyade Cole St"; account.formArea = "Ikate" }.let { shot("57-address-edit", it) }
    state().apply { startBooking("a2"); account.pickingAddress = true }.let { shot("58-address-picker", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Payments) }.let { shot("59-payments", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Payments); account.startAddCard(); account.onCardNumber("5399831234567891"); account.onCardExpiry("0928"); account.onCardCvv("123") }.let { shot("60-add-card", it) }
    state().apply { startBooking("a2"); pay(); answerPrime(false); ticks(this, 40); openCancel() }.let { shot("61-cancel", it) }
    state().apply { openTab(Tab.ClientJobs); push(Pushed.Receipt("J-0141")) }.let { shot("62-receipt", it) }
    state().apply { openTab(Tab.ClientJobs); push(Pushed.Receipt("J-0141")); startReport("J-0141", 1); reportText = "Water marks on the parquet in the sitting room."; reportPhotos = 2 }.let { shot("63-report", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Help) }.let { shot("64-help", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Safety) }.let { shot("65-safety", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Settings) }.let { shot("66-settings", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Settings); account.deleting = true }.let { shot("67-delete", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Legal(privacy = true)) }.let { shot("68-privacy", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.Invite) }.let { shot("69-invite", it) }
    state().apply { switchRole(Role.Artisan); openTab(Tab.ArtisanAccount); push(Pushed.Services) }.let { shot("70-services", it) }
    state().apply { openTab(Tab.ClientJobs); push(Pushed.Receipt("J-0141")); startReport("J-0141"); reportText = "The sink still drips after the visit."; submitReport(); openTab(Tab.Messages); openChat("support") }.let { shot("71-support-chat", it) }
    state().apply { openTab(Tab.ClientAccount); push(Pushed.EditProfile) }.let { shot("72-edit-profile", it) }

    // Live mode on the in-memory fake backend (same data as LiveChecks), times in Lagos.
    java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone("Africa/Lagos"))
    fun live(signedIn: Boolean = true) = liveApp(FakeBackend(sessionUser = if (signedIn) "user-1" else null))
    fun LezervState.withAddress() = apply { account.editAddress(null); account.formStreet = "4 Bishop Aboyade Cole St"; account.formArea = "Ikate"; account.saveAddress() }
    liveApp(FakeBackend().apply { hangArtisans = true }).apply { account.browseAsGuest(); sheet = Sheet.List }.let { shot("80-live-loading", it) }
    live().let { shot("81-live-explore", it) }
    live(signedIn = false).let { shot("82-live-welcome", it) }
    live(signedIn = false).apply { account.startEmail(); account.emailDraft = "amaka@example.com"; account.password = "secret12" }.let { shot("83-live-email", it) }
    live().apply { push(Pushed.Profile("7f3e")) }.let { shot("84-live-profile", it) }
    live().withAddress().apply { startBooking("7f3e"); option = 1 }.let { shot("85-live-book", it) }
    live().withAddress().apply { startBooking("7f3e"); option = 1; sendRequest(); answerPrime(false) }.let { shot("86-live-jobs", it) }
    live().apply { openTab(Tab.Messages) }.let { shot("87-live-messages", it) }
    live().apply { openTab(Tab.Messages); openChat("conv1"); draft = "Call me on 0803 555 4417"; send() }.let { shot("88-live-chat", it) }
    live().apply { openTab(Tab.Messages); openChat(com.lezerv.app.data.SUPPORT); draft = "My receipt for the deep clean is missing."; send() }.let { shot("89-live-support", it) }
    live().apply { openTab(Tab.ClientJobs); push(Pushed.Notifications) }.let { shot("90-live-notifications", it) }
    live().apply { openTab(Tab.ClientAccount); push(Pushed.Help) }.let { shot("91-live-help", it) }
    live().apply { openTab(Tab.ClientAccount); push(Pushed.Help); reportable?.let { startReport(it.first, 1, it.second) }; reportText = "Still dripping after the visit." }.let { shot("92-live-report", it) }

    // Live booking across two phones on one fake backend: Amaka books, Tunde answers.
    fun twoPhones(): Pair<LezervState, LezervState> {
        val world = FakeWorld()
        val amaka = liveApp(FakeBackend("user-1", world)).withAddress()
        val tunde = liveApp(FakeBackend("art-user", world)).apply { switchRole(Role.Artisan) }
        amaka.startBooking("7f3e"); amaka.option = 1; amaka.whenIdx = 1; amaka.slot = 2; amaka.note = "Kitchen sink drips under the cabinet."
        amaka.sendRequest(); amaka.answerPrime(false)
        return amaka to tunde
    }
    twoPhones().second.let { shot("93-live-artisan-offer", it) }
    twoPhones().let { (a, t) -> t.acceptIncoming(); a.openTab(Tab.ClientJobs); shot("94-live-jobs-accepted", a); shot("95-live-artisan-job", t) }
    twoPhones().second.apply { acceptIncoming(); markArrived(); code = "53" }.let { shot("96-live-artisan-code", it) }
    twoPhones().second.apply { acceptIncoming(); openTab(Tab.ArtisanJobs) }.let { shot("97-live-artisan-jobs", it) }
    twoPhones().second.apply { openTab(Tab.ArtisanAccount) }.let { shot("98-live-artisan-account", it) }
    twoPhones().first.apply { openTab(Tab.ClientAccount) }.let { shot("99-live-client-account", it) }
    twoPhones().second.apply { toggleOnline(); toggleOnline() }.let { shot("100-live-artisan-prime", it) }

    // Behaviour checks for the new rules (fail loudly if a rule breaks)
    fun check(name: String, ok: Boolean) { println((if (ok) "PASS  " else "FAIL  ") + name); if (!ok) error("check failed: $name") }
    guest().apply {
        account.browseAsGuest(); startBooking("a2"); openPay()
        check("guest paying is asked to sign in", account.authStep == com.lezerv.app.state.AuthStep.Phone && !paying)
        account.onPhoneInput("+2348035554417"); check("+234 prefix stripped to 10 digits", account.phoneDraft == "8035554417")
        account.sendCode(); account.onCodeInput("000000"); check("wrong code rejected", account.authStep == com.lezerv.app.state.AuthStep.Code)
        account.onCodeInput("123456"); check("new user asked for name", account.authStep == com.lezerv.app.state.AuthStep.Details)
        account.name = "Amaka"; check("single name not accepted", !account.detailsValid)
        account.name = "Amaka Obi"; account.saveDetails(); check("after sign-in the pay sheet opens", account.signedIn && paying)
    }
    state().apply {
        startBooking("a2"); pay(); answerPrime(false)
        check("free cancel while confirming", canCancel && cancelFee == 0)
        ticks(this, 30); check("fee once on the way", job!!.stage == 1 && cancelFee == 1000)
        val total = job!!.total; openCancel(); confirmCancel()
        check("cancel refunds total minus fee", job == null && past.first().cancelled && past.first().refund == total - 1000)
    }
    state().apply {
        startBooking("a2"); pay(); answerPrime(false); ticks(this, 30); advance()
        check("no cancel after arrival", !canCancel)
    }
    state().apply {
        account.onCardNumber("4111 1111 1111 1111"); account.onCardExpiry("12/29"); account.onCardCvv("123")
        check("valid Visa passes Luhn", account.cardValid && account.cardBrand == "Visa")
        account.onCardNumber("4111111111111112"); check("one wrong digit fails Luhn", !account.cardValid)
        account.onCardNumber("4111111111111111"); account.onCardExpiry("1329"); check("month 13 rejected", !account.cardValid)
    }
    state().apply {
        account.signOut(); check("sign out returns to welcome", !account.signedIn && account.authStep == com.lezerv.app.state.AuthStep.Welcome)
        check("sign out clears personal history", past.isEmpty() && messages.isEmpty() && notices.isEmpty() && account.addresses.isEmpty() && account.cards.isEmpty())
        reset(); account.loadDemoUser(); check("demo reset restores the sample user", account.signedIn && past.isNotEmpty() && account.addresses.isNotEmpty())
    }
}
