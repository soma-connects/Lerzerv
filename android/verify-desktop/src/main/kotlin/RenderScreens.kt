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
    fun state() = LezervState(demo = true, clock = { clock }, splash = false)
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
}
