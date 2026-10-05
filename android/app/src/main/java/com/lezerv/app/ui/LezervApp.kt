package com.lezerv.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.SERVICE
import com.lezerv.app.data.artisan
import com.lezerv.app.data.fixed1
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Role
import com.lezerv.app.state.Tab
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.components.borderBottom
import com.lezerv.app.ui.components.borderTop
import com.lezerv.app.ui.components.tap
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.screens.ArtisanAccountScreen
import com.lezerv.app.ui.screens.ArtisanJobsScreen
import com.lezerv.app.ui.screens.ArtisanMapScreen
import com.lezerv.app.ui.screens.ArtisanNavigateScreen
import com.lezerv.app.ui.screens.AddCardScreen
import com.lezerv.app.ui.screens.AddressEditScreen
import com.lezerv.app.ui.screens.AddressPickerSheet
import com.lezerv.app.ui.screens.AddressesScreen
import com.lezerv.app.ui.screens.AuthFlow
import com.lezerv.app.ui.screens.BellButton
import com.lezerv.app.ui.screens.CancelSheet
import com.lezerv.app.ui.screens.DeleteAccountSheet
import com.lezerv.app.ui.screens.EditProfileScreen
import com.lezerv.app.ui.screens.HelpScreen
import com.lezerv.app.ui.screens.InviteScreen
import com.lezerv.app.ui.screens.LegalScreen
import com.lezerv.app.ui.screens.PaymentsScreen
import com.lezerv.app.ui.screens.ReceiptScreen
import com.lezerv.app.ui.screens.ReportScreen
import com.lezerv.app.ui.screens.SafetyScreen
import com.lezerv.app.ui.screens.ServicesScreen
import com.lezerv.app.ui.screens.SettingsScreen
import com.lezerv.app.ui.screens.BookScreen
import com.lezerv.app.ui.screens.DeclineSheet
import com.lezerv.app.ui.screens.NotificationsScreen
import com.lezerv.app.ui.screens.OfflineBanner
import com.lezerv.app.ui.screens.PaySheet
import com.lezerv.app.ui.screens.PayoutScreen
import com.lezerv.app.ui.screens.PrimeScreen
import com.lezerv.app.ui.screens.SplashScreen
import com.lezerv.app.ui.screens.VerifyScreen
import com.lezerv.app.ui.screens.ChatScreen
import com.lezerv.app.ui.screens.ClientAccountScreen
import com.lezerv.app.ui.screens.ClientJobsScreen
import com.lezerv.app.ui.screens.EarningsScreen
import com.lezerv.app.ui.screens.ExploreScreen
import com.lezerv.app.ui.screens.MessagesScreen
import com.lezerv.app.ui.screens.ProfileScreen
import com.lezerv.app.ui.screens.ReviewSheet
import com.lezerv.app.ui.screens.TrackScreen
import com.lezerv.app.ui.theme.LocalLzFonts
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.LzFonts
import com.lezerv.app.ui.theme.body
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label
import kotlinx.coroutines.delay

/**
 * Root of the Lezerv app. Platform code (MainActivity) supplies fonts and handles
 * system back by calling [LezervState.back].
 *
 * @param runTicker false for screenshot rendering, where time should stand still.
 */
@Composable
fun LezervApp(state: LezervState, fonts: LzFonts, modifier: Modifier = Modifier, runTicker: Boolean = true) {
    CompositionLocalProvider(LocalLzFonts provides fonts) {
        if (runTicker) LaunchedEffect(state) { while (true) { delay(100); state.tick() } }
        Box(modifier.fillMaxSize().background(Lz.Bg).blueprintGrid()) {
            Column(Modifier.fillMaxSize()) {
                TopBar(state)
                if (state.offline) OfflineBanner()
                Box(Modifier.weight(1f).fillMaxWidth()) { CurrentScreen(state) }
                if (state.top == null) NavBar(state)
            }
            if (state.reviewing) ReviewSheet(state)
            if (state.declining && state.requestOpen) DeclineSheet(state)
            if (state.paying) PaySheet(state)
            if (state.cancelling) CancelSheet(state)
            if (state.account.pickingAddress) AddressPickerSheet(state)
            if (state.account.deleting) DeleteAccountSheet(state)
            if (state.showPrime) PrimeScreen(state)
            if (state.account.authStep != null) AuthFlow(state) // above sheets, below toasts so errors show
            state.snack?.let { Snackbar(it, Modifier.align(Alignment.BottomStart).padding(start = 12.dp, end = 12.dp, bottom = if (state.top == null) 88.dp else 84.dp)) }
            if (state.showSplash) SplashScreen(state.splashProgress)
        }
    }
}

@Composable
private fun CurrentScreen(s: LezervState) {
    when (val top = s.top) {
        is Pushed.Profile -> ProfileScreen(s, top.artisanId)
        Pushed.Book -> BookScreen(s)
        Pushed.Track -> TrackScreen(s)
        Pushed.Chat -> ChatScreen(s)
        Pushed.Navigate -> ArtisanNavigateScreen(s)
        Pushed.Notifications -> NotificationsScreen(s)
        is Pushed.Verify -> VerifyScreen(s, top.onboarding)
        Pushed.Payout -> PayoutScreen(s)
        Pushed.Addresses -> AddressesScreen(s)
        Pushed.AddressEdit -> AddressEditScreen(s)
        Pushed.Payments -> PaymentsScreen(s)
        Pushed.AddCard -> AddCardScreen(s)
        is Pushed.Receipt -> ReceiptScreen(s, top.number)
        Pushed.Report -> ReportScreen(s)
        Pushed.Help -> HelpScreen(s)
        Pushed.Safety -> SafetyScreen(s)
        Pushed.Settings -> SettingsScreen(s)
        Pushed.EditProfile -> EditProfileScreen(s)
        is Pushed.Legal -> LegalScreen(top.privacy)
        Pushed.Invite -> InviteScreen(s)
        Pushed.Services -> ServicesScreen(s)
        null -> when (s.tab) {
            Tab.Explore -> ExploreScreen(s)
            Tab.ClientJobs -> ClientJobsScreen(s)
            Tab.Messages -> MessagesScreen(s)
            Tab.ClientAccount -> ClientAccountScreen(s)
            Tab.ArtisanMap -> ArtisanMapScreen(s)
            Tab.ArtisanJobs -> ArtisanJobsScreen(s)
            Tab.Earnings -> EarningsScreen(s)
            Tab.ArtisanAccount -> ArtisanAccountScreen(s)
        }
    }
}

/** 24dp hairline grid at 5% ink, the "drafting paper" behind every screen. */
private fun Modifier.blueprintGrid() = drawBehind {
    val step = 24.dp.toPx()
    val w = 1.dp.toPx()
    var x = -w
    while (x < size.width) { drawRect(Lz.Grid, Offset(x, 0f), size.copy(width = w)); x += step }
    var y = -w
    while (y < size.height) { drawRect(Lz.Grid, Offset(0f, y), size.copy(height = w)); y += step }
}

// ───────────────────────────── top bars ─────────────────────────────

@Composable
private fun TopBar(s: LezervState) {
    val top = s.top
    if (top != null) {
        val (title, sub) = pushedTitle(s, top)
        Row(
            Modifier.fillMaxWidth().heightIn(min = 60.dp).background(Lz.Bg).borderBottom(2.dp, Lz.Ink).padding(start = 4.dp, end = 12.dp, top = 4.dp, bottom = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            IconBox("arrow-left", { s.back() }, iconSize = 24, border = null, modifier = Modifier.semantics { contentDescription = "Back" })
            Column(Modifier.weight(1f)) {
                Txt(title.uppercase(), heading(24, 26, tracking = .03f), ellipsis = true)
                Txt(sub, body(12, 16, color = Lz.Neutral700), ellipsis = true)
            }
        }
        return
    }
    val t = when (s.tab) {
        Tab.ClientJobs -> Triple("Your jobs", "Jobs", "briefcase")
        Tab.Messages -> Triple("Masked chat", "Messages", "message-square")
        Tab.ClientAccount -> Triple("Client", "Account", "user")
        Tab.ArtisanJobs -> Triple("Your work", "Jobs", "briefcase")
        Tab.Earnings -> Triple("Payouts", "Earnings", "wallet")
        Tab.ArtisanAccount -> Triple("Artisan", "Account", "user")
        Tab.Explore, Tab.ArtisanMap -> return // full-bleed map, no top bar
    }
    Row(
        Modifier.fillMaxWidth().background(Lz.Bg).borderBottom(2.dp, Lz.Ink).padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 12.dp),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column {
            Txt(t.first.uppercase(), label(color = Lz.Accent700))
            Txt(t.second.uppercase(), heading(40, 38, weight = 700))
        }
        BellButton(s, Modifier.offset(x = 10.dp, y = 6.dp))
    }
}

private fun pushedTitle(s: LezervState, p: Pushed): Pair<String, String> = when (p) {
    is Pushed.Profile -> artisan(p.artisanId)?.let { it.name to "${SERVICE.getValue(it.svc).label} · ${fixed1(it.km)} km away" } ?: ("" to "")
    Pushed.Book -> artisan(s.bookArtisan)?.let { (if (it.laundry) "Laundry pickup" else "Book ${it.first}") to "${it.name} · ${SERVICE.getValue(it.svc).label}" } ?: ("" to "")
    Pushed.Track -> s.job?.let { j -> (if (j.laundry) "Laundry order" else "Live job") to "${j.title} · ${s.jobArtisan?.name}" } ?: ("Job" to "")
    Pushed.Chat -> when {
        s.chatWith == com.lezerv.app.data.SUPPORT -> "Lezerv Support" to "Usually replies within a few hours"
        s.role == Role.Client -> artisan(s.chatWith)?.name.orEmpty() to "Contact details are hidden"
        else -> "Amaka O." to "Contact details are hidden"
    }
    Pushed.Navigate -> "Job · Leaking sink" to "Amaka O. · Lekki Phase 1"
    Pushed.Notifications -> "Notifications" to if (s.unread > 0) "${s.unread} unread" else "All caught up"
    is Pushed.Verify -> (if (p.onboarding) "Become an artisan" else "Verification") to (if (p.onboarding) "Step 2 of 4 · Verification" else "ID and documents")
    Pushed.Payout -> "Payout account" to "Where your earnings are paid"
    Pushed.Addresses -> "Saved addresses" to "Where artisans come to you"
    Pushed.AddressEdit -> (if (s.account.editingAddressId == null) "New address" else "Edit address") to "Shared with the artisan only after you book"
    Pushed.Payments -> "Payment methods" to "Cards, bank transfer and USSD"
    Pushed.AddCard -> "Add a card" to "Visa, Mastercard or Verve"
    is Pushed.Receipt -> "Receipt" to p.number
    Pushed.Report -> "Report a problem" to s.reportJob
    Pushed.Help -> "Help" to "Answers and support"
    Pushed.Safety -> "Safety" to "Tools for you and your home"
    Pushed.Settings -> "Settings" to "Notifications, language, account"
    Pushed.EditProfile -> "Edit profile" to "Name, phone and email"
    is Pushed.Legal -> (if (p.privacy) "Privacy policy" else "Terms of service") to "Draft for review"
    Pushed.Invite -> "Invite friends" to "Share Lezerv"
    Pushed.Services -> "Services and prices" to "What clients can book you for"
}

// ───────────────────────────── bottom navigation ─────────────────────────────

/** Material 3 NavigationBar structure, restyled: square indicator, 2dp ink rule on top. */
@Composable
private fun NavBar(s: LezervState) {
    val tabs = if (s.role == Role.Client) Tab.client else Tab.artisan
    Row(Modifier.fillMaxWidth().height(76.dp).background(Lz.Bg).borderTop(2.dp, Lz.Ink)) {
        tabs.forEach { t ->
            val on = s.tab == t
            val dot = t == Tab.ClientJobs && s.job != null && !on
            Column(
                Modifier.weight(1f).fillMaxWidth().height(76.dp).tap { s.openTab(t) }.semantics { contentDescription = t.label },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
            ) {
                Box(
                    Modifier.size(60.dp, 32.dp).background(if (on) Lz.Accent100 else Color.Transparent).border(1.dp, if (on) Lz.Accent else Color.Transparent),
                    contentAlignment = Alignment.Center,
                ) {
                    LzIcon(t.icon, 22, if (on) Lz.Accent800 else Lz.Ink)
                    if (dot) Box(Modifier.align(Alignment.TopEnd).offset((-14).dp, 3.dp).size(8.dp).background(Lz.Accent).border(1.5.dp, Lz.Bg))
                }
                Txt(t.label, body(12, weight = if (on) 700 else 500, tracking = .02f))
            }
        }
    }
}

@Composable
private fun Snackbar(text: String, modifier: Modifier) {
    Row(
        modifier.fillMaxWidth().shadow(12.dp).background(Lz.Ink).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LzIcon("circle-check", 20, Lz.Accent300)
        Txt(text, body(14, 20, color = Color.White), Modifier.width(0.dp).weight(1f))
    }
}
