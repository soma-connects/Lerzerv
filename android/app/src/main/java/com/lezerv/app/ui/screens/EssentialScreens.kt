package com.lezerv.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.AREAS
import com.lezerv.app.data.CANCEL_REASONS
import com.lezerv.app.data.FAQS
import com.lezerv.app.data.LANGUAGES
import com.lezerv.app.data.PRIVACY
import com.lezerv.app.data.Pt
import com.lezerv.app.data.REPORT_REASONS
import com.lezerv.app.data.SAFETY_REASON
import com.lezerv.app.data.SUPPORT
import com.lezerv.app.data.TERMS
import com.lezerv.app.data.naira
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Pushed
import com.lezerv.app.state.Role
import com.lezerv.app.ui.components.CardNumberTransformation
import com.lezerv.app.ui.components.ChoiceChip
import com.lezerv.app.ui.components.ExpiryTransformation
import com.lezerv.app.ui.components.FormLabel
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.KvLine
import com.lezerv.app.ui.components.LzField
import com.lezerv.app.ui.components.OutlineButton
import com.lezerv.app.ui.components.PrimaryWide
import com.lezerv.app.ui.components.RadioRow
import com.lezerv.app.ui.components.SectionRule
import com.lezerv.app.ui.components.Secret
import com.lezerv.app.ui.components.SwitchRow
import com.lezerv.app.ui.components.Tag
import com.lezerv.app.ui.components.Txt
import com.lezerv.app.ui.components.blueprint
import com.lezerv.app.ui.components.borderBottom
import com.lezerv.app.ui.components.borderTop
import com.lezerv.app.ui.components.tap
import com.lezerv.app.ui.icons.LzIcon
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.body
import com.lezerv.app.ui.theme.heading
import com.lezerv.app.ui.theme.label

// Pages most on-demand service apps need that the designs didn't cover yet.
// They reuse the Industry look: square objects, ink rules, one green action per view.

// ───────────────────────────── shared layout ─────────────────────────────

/** Scrolling form body with a fixed action bar at the bottom. */
@Composable
private fun FormPage(bar: (@Composable () -> Unit)?, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp), content = content)
        if (bar != null) Box(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(1.dp, Lz.Ink).padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 12.dp)) { bar() }
    }
}

/** Bottom sheet over a scrim; tapping outside calls [onDismiss]. */
@Composable
private fun Sheet(onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxSize().background(Lz.Scrim).tap(onClick = onDismiss), contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(2.dp, Lz.Ink).tap { }.verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 20.dp)) {
            Box(Modifier.fillMaxWidth().padding(bottom = 10.dp), contentAlignment = Alignment.Center) { Box(Modifier.size(40.dp, 4.dp).background(Lz.Neutral500)) }
            content()
        }
    }
}

@Composable
private fun Note(text: String, icon: String = "info") {
    Row(Modifier.fillMaxWidth().background(Lz.Accent100).border(1.dp, Lz.Accent).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        LzIcon(icon, 16, Lz.Accent800)
        Txt(text, body(12, 17, color = Lz.Accent800))
    }
}

@Composable
private fun LinkRow(icon: String, title: String, sub: String? = null, onTap: () -> Unit, trailing: @Composable RowScope.() -> Unit = { LzIcon("chevron-right", 18) }) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = 60.dp).borderBottom(1.dp, Lz.Divider).tap(onClick = onTap).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        LzIcon(icon, 22, Lz.Accent)
        Column(Modifier.weight(1f)) {
            Txt(title, body(15, weight = 600))
            if (sub != null) Txt(sub, body(12, 17, color = Lz.Neutral700))
        }
        trailing()
    }
}

// ───────────────────────────── saved addresses ─────────────────────────────

@Composable
fun AddressesScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = { OutlineButton("Add an address", { a.editAddress(null) }, Modifier.fillMaxWidth(), icon = "plus") }) {
        if (a.addresses.isEmpty()) EmptyState("map-pin", "No saved addresses", "Save home or work once and booking takes one tap.", "Add an address") { a.editAddress(null) }
        Column {
            a.addresses.forEach { ad ->
                LinkRow(if (ad.label == "Work") "briefcase" else "home", ad.title, ad.sub, { a.editAddress(ad.id) }) {
                    if (ad.id == a.currentAddress?.id) Tag("Default", Lz.Accent100, Lz.Accent800, Lz.Accent)
                    LzIcon("chevron-right", 18)
                }
            }
        }
        Txt("Artisans see your street only after you book, and only for that job.", body(12, 17, color = Lz.Neutral700))
    }
}

@Composable
fun AddressEditScreen(s: LezervState) {
    val a = s.account
    val area = AREAS.first { it.first == a.formArea }.second
    FormPage(bar = { PrimaryWide("Save address", "check", { a.saveAddress() }, alpha = if (a.formStreet.trim().length >= 4) 1f else .5f) }) {
        Column {
            FormLabel("Label")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { listOf("Home", "Work", "Other").forEach { ChoiceChip(it, a.formLabel == it, { a.formLabel = it }) } }
        }
        Column { FormLabel("Street and house number"); LzField(a.formStreet, { a.formStreet = it.take(80) }, "12 Admiralty Way", capitalizeWords = true) }
        Column {
            FormLabel("Area")
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AREAS.forEach { (name, _) -> ChoiceChip(name, a.formArea == name, { a.formArea = name }) }
            }
        }
        Box(Modifier.blueprint().border(1.dp, Lz.Ink).padding(1.dp)) {
            MapInset(120.dp, Pt(area.first, area.second - 6), s.blueprintMap) { HomePin(area.first, area.second, stem = 8) }
            Box(Modifier.align(Alignment.BottomStart).padding(8.dp).background(Lz.Bg).border(1.dp, Lz.Ink).padding(horizontal = 8.dp, vertical = 3.dp)) {
                Txt("PIN FROM THE AREA · PROPOSAL: DRAG TO ADJUST", label(10, .05f))
            }
        }
        Column { FormLabel("Directions for the artisan (optional)"); LzField(a.formNote, { a.formNote = it.take(120) }, "Gate code, landmark, which floor", singleLine = false, minHeight = 76.dp) }
        if (a.editingAddressId != null) OutlineButton("Delete this address", { a.deleteAddress(a.editingAddressId!!) }, Modifier.fillMaxWidth(), icon = "trash-2", dashed = true)
    }
}

/** Opened from "Change" on the booking screen. */
@Composable
fun AddressPickerSheet(s: LezervState) {
    val a = s.account
    Sheet({ a.pickingAddress = false }) {
        Txt("WHERE SHOULD THEY COME?", heading(28, 30, weight = 700), Modifier.padding(bottom = 12.dp))
        a.addresses.forEach { ad -> RadioRow(ad.title, ad.id == a.currentAddress?.id, { a.chooseAddress(ad.id) }, { Txt(ad.area, body(12, color = Lz.Neutral700)) }) }
        OutlineButton("Add a new address", { a.editAddress(null) }, Modifier.padding(top = 14.dp).fillMaxWidth(), icon = "plus")
    }
}

// ───────────────────────────── payment methods ─────────────────────────────

@Composable
fun PaymentsScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = { OutlineButton("Add a card", { a.startAddCard() }, Modifier.fillMaxWidth(), icon = "plus") }) {
        SectionRule("01", "Cards", gutter = 0.dp)
        Column {
            if (a.cards.isEmpty()) Txt("No cards yet. You can still pay by bank transfer or USSD.", body(14, 20, color = Lz.Neutral800))
            a.cards.forEach { c ->
                val isDefault = c.id == a.defaultCard?.id
                Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).borderBottom(1.dp, Lz.Divider), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LzIcon("credit-card", 22, Lz.Accent)
                    Column(Modifier.weight(1f)) {
                        Txt(c.label, body(15, weight = 600))
                        Txt("Expires ${c.expiry}", body(12, color = Lz.Neutral700))
                    }
                    if (isDefault) Tag("Default", Lz.Accent100, Lz.Accent800, Lz.Accent)
                    else Txt("MAKE DEFAULT", label(11, .08f, Lz.Accent700), Modifier.tap { a.makeDefault(c.id) }.padding(8.dp))
                    IconBox("x", { a.removeCard(c.id) }, size = 40, iconSize = 18, border = null, modifier = Modifier.semantics { contentDescription = "Remove ${c.label}" })
                }
            }
        }
        SectionRule("02", "Always available", gutter = 0.dp)
        Column {
            listOf("landmark" to ("Bank transfer" to "From any Nigerian bank app"), "hash" to ("USSD" to "Dial a code, no data needed")).forEach { (ic, t) ->
                Row(Modifier.fillMaxWidth().heightIn(min = 60.dp).borderBottom(1.dp, Lz.Divider), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LzIcon(ic, 22, Lz.Accent)
                    Column { Txt(t.first, body(15, weight = 600)); Txt(t.second, body(12, color = Lz.Neutral700)) }
                }
            }
        }
        Note("PROPOSAL: cards are saved by Paystack. Lezerv keeps only the brand and last 4 digits.", "lock")
    }
}

@Composable
fun AddCardScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = { PrimaryWide("Save card", "lock", { a.saveCard() }, alpha = if (a.cardValid) 1f else .5f) }) {
        Column {
            Row { FormLabel("Card number", Modifier.weight(1f)); if (a.cardNumber.isNotEmpty()) Txt(a.cardBrand.uppercase(), label(11, .08f, Lz.Accent700)) }
            LzField(a.cardNumber, a::onCardNumber, "0000 0000 0000 0000", keyboard = KeyboardType.Number, style = body(18, tracking = .08f), transformation = CardNumberTransformation)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) { FormLabel("Expiry"); LzField(a.cardExpiry, a::onCardExpiry, "MM/YY", keyboard = KeyboardType.Number, style = body(18), transformation = ExpiryTransformation) }
            Column(Modifier.weight(1f)) { FormLabel("CVV"); LzField(a.cardCvv, a::onCardCvv, "123", keyboard = KeyboardType.NumberPassword, style = body(18), transformation = Secret) }
        }
        Note("Your card is checked by Paystack with a small charge that is refunded straight away. PROPOSAL until Paystack keys are connected.", "shield-check")
    }
}

// ───────────────────────────── cancel booking ─────────────────────────────

@Composable
fun CancelSheet(s: LezervState) {
    val j = s.job ?: return
    val a = s.jobArtisan ?: return
    val fee = s.cancelFee
    Sheet({ s.back() }) {
        Txt("CANCEL THIS BOOKING?", heading(30, 30, weight = 700))
        Txt(if (fee == 0) "${a.first} hasn’t set off yet, so it’s free to cancel." else "${a.first} is already on the way. The call-out fee goes to them for their time.",
            body(13, 19, color = Lz.Neutral800), Modifier.padding(top = 6.dp, bottom = 12.dp))
        CANCEL_REASONS.forEachIndexed { i, r -> RadioRow(r, s.cancelReason == i, { s.cancelReason = i }, { }, 48.dp) }
        Column(Modifier.padding(top = 14.dp).borderTop(2.dp, Lz.Ink)) {
            KvLine("You paid", naira(j.total))
            KvLine("Call-out fee", if (fee == 0) "₦0" else "−${naira(fee)}")
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
                Txt("Refund", body(15, weight = 700), Modifier.weight(1f))
                Txt(naira(j.total - fee), heading(24, weight = 700, color = Lz.Accent700))
            }
        }
        Txt("Refunds go back the way you paid (${j.payMethod}) within 1–3 working days. PROPOSAL policy.", body(12, 17, color = Lz.Neutral700))
        Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlineButton("Keep booking", { s.back() }, Modifier.weight(1f))
            OutlineButton("Cancel booking", { s.confirmCancel() }, Modifier.weight(1.4f), dashed = true)
        }
    }
}

// ───────────────────────────── receipt ─────────────────────────────

@Composable
fun ReceiptScreen(s: LezervState, number: String) {
    val p = s.pastJob(number) ?: return
    val a = s.artisan(p.artisanId) ?: return
    FormPage(bar = {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlineButton("Share", { s.shareText("Lezerv receipt ${p.number}: ${p.title} with ${a.name}, ${p.date}. Total ${naira(p.total)}.") }, Modifier.weight(1f), icon = "upload")
            PrimaryWide("Book again", "refresh-cw", { s.startBooking(a.id) }, Modifier.weight(1.6f))
        }
    }) {
        Column(Modifier.fillMaxWidth().blueprint().border(1.dp, Lz.Divider).padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Txt(p.number, heading(22), Modifier.weight(1f))
                if (p.cancelled) Tag("Cancelled", Lz.Neutral200, Lz.Neutral800, Lz.Neutral500) else Tag("Completed", Lz.Accent800, Lz.Bg, Lz.Accent800)
            }
            Txt(p.title.uppercase(), heading(34, 34, weight = 700), Modifier.padding(top = 8.dp))
            Txt("${a.name} · ${a.service.label} · ${p.date}", body(13, color = Lz.Neutral800))
        }
        Column {
            KvLine(p.title, naira(p.sub))
            KvLine("Lezerv service fee (5%)", naira(p.fee))
            Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp)) {
                Txt("Total", body(15, weight = 700), Modifier.weight(1f)); Txt(naira(p.total), heading(26, weight = 700))
            }
            KvLine("Paid with", p.method)
            if (p.cancelled) KvLine("Refunded", naira(p.refund)) else KvLine("Paid to ${a.first}", "${naira((p.sub * 0.8).toInt())} after 20%")
        }
        if (!p.cancelled) LinkRow("circle-alert", "Report a problem", "Work not finished, damage or a wrong charge", { s.startReport(p.number) })
        LinkRow("message-square", "Chat with ${a.first}", null, { s.openChat(a.id) })
    }
}

// ───────────────────────────── report a problem ─────────────────────────────

/** Diagonal hatch placeholder used for photos (as on the Board). */
private val Hatch = androidx.compose.ui.graphics.Brush.linearGradient(
    0f to Lz.Neutral200, .86f to Lz.Neutral200, .86f to Lz.Neutral300, 1f to Lz.Neutral300,
    start = androidx.compose.ui.geometry.Offset.Zero, end = androidx.compose.ui.geometry.Offset(10f, 10f), tileMode = androidx.compose.ui.graphics.TileMode.Repeated,
)

@Composable
fun ReportScreen(s: LezervState) {
    FormPage(bar = { PrimaryWide("Send report", "send", { s.submitReport() }, alpha = if (s.reportText.trim().length >= 10 && s.live?.busy != true) 1f else .5f) }) {
        Txt("Tell us what went wrong with ${s.reportJob}. " + if (s.isLive) "Our team looks into it and replies in your support chat." else "We pause the artisan’s payout while we look into it.", body(14, 20, color = Lz.Neutral800))
        Column {
            FormLabel("What happened")
            REPORT_REASONS.forEachIndexed { i, r -> RadioRow(r, s.reportReason == i, { s.reportReason = i }, { }, 48.dp) }
        }
        Column { FormLabel("Details"); LzField(s.reportText, { s.reportText = it.take(600) }, "What did you expect, and what happened instead?", singleLine = false, minHeight = 110.dp) }
        // Photo upload isn't connected yet (needs a storage bucket for reports), so live hides it.
        if (!s.isLive) Column {
            FormLabel("Photos (optional, up to 3)")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(s.reportPhotos) { Box(Modifier.size(72.dp).blueprint().background(Hatch), contentAlignment = Alignment.Center) { LzIcon("image", 20, Lz.Neutral700) } }
                if (s.reportPhotos < 3) Box(Modifier.size(72.dp).dashedBorder(Lz.Ink).tap { s.reportPhotos++ }.semantics { contentDescription = "Add photo" }, contentAlignment = Alignment.Center) { LzIcon("camera", 24) }
            }
        }
        if (s.reportReason == SAFETY_REASON) Note("If you are in danger now, call 112 first.", "circle-alert")
    }
}

// ───────────────────────────── help centre ─────────────────────────────

@Composable
fun HelpScreen(s: LezervState) {
    var open by remember { mutableIntStateOf(-1) }
    FormPage(bar = null) {
        PrimaryWide("Chat with Lezerv Support", "message-square", { s.openChat(SUPPORT) })
        val recent = s.reportable
        if (s.role == Role.Client && recent != null) LinkRow("circle-alert", "Report a problem with ${recent.first}", if (s.isLive) "Our team reviews it and replies in support chat" else "Pauses the payout while we check", { s.startReport(recent.first, jobId = recent.second) })
        SectionRule("01", "Common questions", gutter = 0.dp)
        Column {
            FAQS.forEachIndexed { i, f ->
                Column(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).tap { open = if (open == i) -1 else i }.padding(vertical = 14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Txt(f.q, body(15, 21, weight = 600), Modifier.weight(1f))
                        LzIcon(if (open == i) "minus" else "plus", 18)
                    }
                    if (open == i) Txt(f.a, body(14, 21, color = Lz.Neutral800), Modifier.padding(top = 8.dp))
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Txt("TERMS", label(12, .08f, Lz.Accent700), Modifier.tap { s.push(Pushed.Legal(privacy = false)) })
            Txt("PRIVACY", label(12, .08f, Lz.Accent700), Modifier.tap { s.push(Pushed.Legal(privacy = true)) })
        }
    }
}

// ───────────────────────────── safety centre ─────────────────────────────

@Composable
fun SafetyScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = null) {
        Column(Modifier.fillMaxWidth().background(Lz.Ink).padding(16.dp)) {
            Txt("IN DANGER RIGHT NOW?", heading(28, 30, weight = 700, color = Lz.Bg))
            Txt("Call the emergency services first, then tell us.", body(14, 20, color = Lz.Bg.copy(alpha = .8f)), Modifier.padding(top = 4.dp, bottom = 14.dp))
            Row(
                Modifier.fillMaxWidth().heightIn(min = 54.dp).background(Lz.Bg).tap { s.callEmergency() }.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) { Txt("CALL 112", heading(22, tracking = .05f), Modifier.weight(1f)); LzIcon("phone", 22) }
        }
        SwitchRow("Share live jobs with a trusted contact", "While an artisan is at your home, ${a.trustedContact.substringBefore(" ·")} gets a link to the job and the artisan’s name.", a.shareLiveJobs, { a.shareLiveJobs = !a.shareLiveJobs })
        LinkRow("users", "Trusted contact", a.trustedContact, { s.toast("PROPOSAL: pick a contact from your phone") })
        SectionRule("01", "How Lezerv keeps you safe", gutter = 0.dp)
        Column {
            listOf(
                "badge-check" to "Every artisan’s ID and address are checked before they can work.",
                "key-round" to "The start code means only the artisan you booked can begin the job.",
                "eye-off" to "Calls and chat hide your number. Exact address only after booking.",
                "lock" to "Your money stays with Lezerv until you confirm the job is done.",
            ).forEach { (ic, t) ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LzIcon(ic, 22, Lz.Accent700); Txt(t, body(14, 20))
                }
            }
        }
        val about = s.job?.number ?: s.past.firstOrNull()?.number
        if (about != null) OutlineButton("Report a safety concern", { s.startReport(about, SAFETY_REASON) }, Modifier.fillMaxWidth(), icon = "shield-check")
    }
}

// ───────────────────────────── settings ─────────────────────────────

@Composable
fun SettingsScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = null) {
        SectionRule("01", "Notifications", gutter = 0.dp)
        Column {
            SwitchRow("Job updates", "Bookings, arrivals, payments. Always on so you don’t miss an artisan.", true, { }, enabled = false)
            SwitchRow("Messages", "When an artisan or support writes to you", a.notifyMessages, { a.notifyMessages = !a.notifyMessages })
            SwitchRow("Offers and news", "Discounts and new services. A few a month at most.", a.notifyOffers, { a.notifyOffers = !a.notifyOffers })
        }
        SectionRule("02", "Language", gutter = 0.dp)
        @OptIn(ExperimentalLayoutApi::class)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            LANGUAGES.forEach { l -> ChoiceChip(l, a.language == l, { a.language = l; if (l != "English") s.toast("PROPOSAL: $l translations aren’t written yet") }) }
        }
        SectionRule("03", "Account", gutter = 0.dp)
        Column {
            LinkRow("user", "Edit profile", "${a.name.ifBlank { "No name yet" }} · ${a.phoneMasked}", { s.push(Pushed.EditProfile) })
            LinkRow("file-text", "Terms of service", null, { s.push(Pushed.Legal(privacy = false)) })
            LinkRow("shield-check", "Privacy policy", null, { s.push(Pushed.Legal(privacy = true)) })
            LinkRow("info", "About Lezerv", "Version 0.1.0", { s.toast("Lezerv 0.1.0 · Lagos") })
        }
        OutlineButton("Log out", { a.signOut() }, Modifier.fillMaxWidth(), icon = "log-out")
        Txt("DELETE MY ACCOUNT", label(12, .08f, Lz.Neutral700), Modifier.tap { a.deleting = true }.padding(vertical = 8.dp))
    }
}

/** Account deletion, required in-app by Google Play for apps with accounts. */
@Composable
fun DeleteAccountSheet(s: LezervState) {
    val a = s.account
    Sheet({ a.deleting = false }) {
        Txt("DELETE YOUR ACCOUNT?", heading(30, 30, weight = 700))
        Column(Modifier.padding(top = 10.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                if (s.isLive) "We send the request to our team; your profile and history are removed within 30 days." else "Your profile, saved addresses and cards are removed within 30 days.",
                "Receipts we must keep by law are kept, without your contact details.",
                if (s.job != null) "Your live booking is cancelled and refunded first." else "Any open support tickets are closed.",
                "This can’t be undone. You can sign up again with the same number.",
            ).forEach { Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { Box(Modifier.padding(top = 7.dp).size(6.dp).background(Lz.Accent)); Txt(it, body(14, 20)) } }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlineButton("Keep account", { a.deleting = false }, Modifier.weight(1f))
            OutlineButton("Delete account", { a.deleteAccount() }, Modifier.weight(1.4f), dashed = true)
        }
    }
}

@Composable
fun EditProfileScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = { PrimaryWide("Save", "check", { a.saveProfile() }, alpha = if (a.detailsValid && s.live?.busy != true) 1f else .5f) }) {
        Column { FormLabel("Full name"); LzField(a.name, { a.name = it.take(60) }, "First and last name", capitalizeWords = true) }
        Column {
            Row { FormLabel("Phone", Modifier.weight(1f)); if (a.phone.length == 10) Txt("VERIFIED", label(11, .08f, Lz.Accent700)) }
            LzField(a.phoneMasked, { }, "", enabled = false)
            Txt("To change your number we’ll text a code to the new one.", body(12, 17, color = Lz.Neutral700), Modifier.padding(top = 6.dp))
        }
        Column { FormLabel("Email (for receipts)"); LzField(a.email, { a.email = it.trim().take(80) }, "you@example.com", keyboard = KeyboardType.Email) }
    }
}

// ───────────────────────────── terms / privacy ─────────────────────────────

@Composable
fun LegalScreen(privacy: Boolean) {
    FormPage(bar = null) {
        Note("DRAFT. This text is a starting point and must be reviewed by a Nigerian lawyer before launch.", "circle-alert")
        (if (privacy) PRIVACY else TERMS).forEachIndexed { i, (h, t) ->
            Column {
                Txt("0${i + 1}  ${h.uppercase()}", heading(20, 24), Modifier.padding(bottom = 6.dp))
                Txt(t, body(14, 21, color = Lz.Neutral800))
            }
        }
        Txt("Last updated 5 Oct 2026", body(12, color = Lz.Neutral700))
    }
}

// ───────────────────────────── invite friends ─────────────────────────────

/** PROPOSAL: the reward amounts are a business decision; ₦1,000 each is a placeholder. */
@Composable
fun InviteScreen(s: LezervState) {
    val code = s.account.referralCode
    val clipboard = LocalClipboardManager.current
    val msg = "Get help at home from verified artisans on Lezerv. Use my code $code for ₦1,000 off your first job."
    FormPage(bar = { PrimaryWide("Share invite", "upload", { s.shareText(msg) }) }) {
        Txt("GIVE ₦1,000, GET ₦1,000", heading(40, 38, weight = 700))
        Txt("Friends get ₦1,000 off their first job. You get ₦1,000 credit when it’s done.", body(15, 22, color = Lz.Neutral800))
        Row(Modifier.fillMaxWidth().blueprint().border(1.dp, Lz.Ink).padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f).padding(vertical = 12.dp)) { Txt("YOUR CODE", label(color = Lz.Neutral700)); Txt(code, heading(36, tracking = .08f, weight = 700)) }
            Box(Modifier.width(1.dp).heightIn(min = 72.dp).background(Lz.Divider))
            Column(Modifier.tap { clipboard.setText(AnnotatedString(code)); s.toast("Code copied") }.padding(horizontal = 18.dp, vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                LzIcon("copy", 22); Txt("COPY", label(10, .1f), Modifier.padding(top = 4.dp))
            }
        }
        Column {
            listOf("Share your code with a friend", "They book their first job with it", "When the job is done, you both get ₦1,000").forEachIndexed { i, t ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Txt("0${i + 1}", heading(22, color = Lz.Accent700)); Txt(t, body(14, 20))
                }
            }
        }
        Txt("PROPOSAL: amounts and limits to be set by Lezerv.", body(12, 17, color = Lz.Neutral700))
    }
}

// ───────────────────────────── artisan: services and prices ─────────────────────────────

@Composable
fun ServicesScreen(s: LezervState) {
    val a = s.account
    FormPage(bar = { PrimaryWide("Save prices", "check", { a.saveServices() }) }) {
        Txt("Turn on what you do and set a starting price. You confirm the final price with the client before work starts.", body(14, 20, color = Lz.Neutral800))
        Column {
            a.services.forEachIndexed { i, sv ->
                Column(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Txt(sv.name, body(15, weight = 600, color = if (sv.on) Lz.Ink else Lz.Neutral600), Modifier.weight(1f))
                        com.lezerv.app.ui.components.LzSwitch(sv.on, { a.toggleService(i) }, sv.name)
                    }
                    if (sv.on) Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        IconBox("minus", { a.changePrice(i, -500) }, 40, 18, modifier = Modifier.semantics { contentDescription = "Lower ${sv.name} price" })
                        Txt(naira(sv.price), heading(26, weight = 700), Modifier.weight(1f))
                        Txt("you get ${naira((sv.price * 0.8).toInt())}", body(12, color = Lz.Neutral700))
                        IconBox("plus", { a.changePrice(i, 500) }, 40, 18, bg = Lz.Ink, fg = Color.White, modifier = Modifier.semantics { contentDescription = "Raise ${sv.name} price" })
                    }
                }
            }
        }
    }
}
