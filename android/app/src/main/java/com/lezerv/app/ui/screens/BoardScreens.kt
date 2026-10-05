package com.lezerv.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.BANKS
import com.lezerv.app.data.DECLINE_REASONS
import com.lezerv.app.data.ID_TYPES
import com.lezerv.app.data.KYC_DOCS
import com.lezerv.app.data.ONBOARDING_STEPS
import com.lezerv.app.state.LezervState
import com.lezerv.app.state.Notice
import com.lezerv.app.state.Pushed
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.OutlineButton
import com.lezerv.app.ui.components.PrimaryWide
import com.lezerv.app.ui.components.Segments
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

// Screens and states from "Lezerv Board" (the early prototype), adapted to the v2 map-first app.

// ───────────────────────────── 1h · splash ─────────────────────────────

/** Dark-green splash, so the app never flashes black on launch. */
@Composable
fun SplashScreen(progress: Float) {
    val bgLine = Lz.Bg.copy(alpha = .09f)
    Column(
        Modifier.fillMaxSize().background(Lz.Accent900).drawBehind {
            val step = 24.dp.toPx(); val w = 1.dp.toPx()
            var x = -w; while (x < size.width) { drawRect(bgLine, Offset(x, 0f), size.copy(width = w)); x += step }
            var y = -w; while (y < size.height) { drawRect(bgLine, Offset(0f, y), size.copy(height = w)); y += step }
        }.padding(horizontal = 26.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(Modifier.fillMaxWidth()) {
            Txt("LAGOS", label(color = Lz.Accent300), Modifier.weight(1f))
            Txt("SHEET 00", label(color = Lz.Accent300))
        }
        Column(Modifier.fillMaxWidth().blueprint(Lz.Bg).border(1.dp, Lz.Bg.copy(alpha = .4f)).padding(horizontal = 20.dp, vertical = 30.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(Modifier.size(44.dp).border(1.dp, Lz.Bg), contentAlignment = Alignment.Center) { Box(Modifier.size(16.dp).background(Lz.Accent400)) }
                Txt("LEZERV", heading(72, tracking = .06f, color = Lz.Bg))
            }
            Txt("Verified help for your home.", body(16, 24, color = Lz.Accent200), Modifier.padding(top = 14.dp))
        }
        Column {
            Box(Modifier.fillMaxWidth().height(2.dp).background(Lz.Bg.copy(alpha = .25f))) {
                Box(Modifier.fillMaxWidth(progress).fillMaxHeight().background(Lz.Accent400))
            }
            Txt("LOADING · V0.1", label(color = Lz.Accent300), Modifier.padding(top = 8.dp))
        }
    }
}

// ───────────────────────────── 1i · notification priming ─────────────────────────────

/** Asked once, after the first booking, when there is a reason to allow push. PROPOSAL. */
@Composable
fun PrimeScreen(s: LezervState) {
    Column(Modifier.fillMaxSize().background(Lz.Bg).tap { }.verticalScroll(rememberScrollState()).padding(start = 22.dp, end = 22.dp, top = 30.dp, bottom = 20.dp)) {
        Box(Modifier.blueprint().size(64.dp).background(Lz.Accent100).border(1.dp, Lz.Accent), contentAlignment = Alignment.Center) { LzIcon("bell", 32, Lz.Accent800) }
        Txt("KNOW THE MOMENT THEY’RE ON THE WAY.", heading(52, 48), Modifier.padding(top = 22.dp, bottom = 12.dp))
        Txt("Artisans move fast. Turn on notifications so you don’t have to keep the app open.", body(16, 24, color = Lz.Neutral800))
        Column(Modifier.padding(top = 22.dp).borderTop(1.dp, Lz.Ink)) {
            listOf("navigation" to "Your artisan sets off to you", "key-round" to "They reach your gate and need the start code", "message-square" to "You get a new message").forEach { (ic, t) ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LzIcon(ic, 22, Lz.Accent700); Txt(t, body(15, 21))
                }
            }
        }
        Spacer(Modifier.height(28.dp))
        PrimaryWide("Allow notifications", "bell", { s.answerPrime(true) })
        Box(Modifier.padding(top = 10.dp).fillMaxWidth().heightIn(min = 48.dp).tap { s.answerPrime(false) }, contentAlignment = Alignment.CenterStart) {
            Txt("NOT NOW", body(14, weight = 700, tracking = .06f).copy(textDecoration = TextDecoration.Underline))
        }
        Txt("You can change this later in Account.", body(12, 16, color = Lz.Neutral700), Modifier.padding(top = 4.dp))
    }
}

// ───────────────────────────── bell + 1n · notifications inbox ─────────────────────────────

/** Bell with unread count, top right on every main screen (Board 1a). */
@Composable
fun BellButton(s: LezervState, modifier: Modifier = Modifier, size: Int = 44, bg: Color = Color.Transparent, border: Color? = null) {
    val n = s.unread
    Box(
        modifier.size(size.dp).background(bg).then(if (border != null) Modifier.border(1.dp, border) else Modifier)
            .tap { s.push(Pushed.Notifications) }.semantics { contentDescription = if (n > 0) "Notifications, $n unread" else "Notifications" },
        contentAlignment = Alignment.Center,
    ) {
        LzIcon("bell", 24)
        if (n > 0) Box(
            Modifier.align(Alignment.TopEnd).offset((-3).dp, 5.dp).heightIn(min = 18.dp).widthIn(min = 18.dp).background(Lz.Accent800).padding(horizontal = 4.dp),
            contentAlignment = Alignment.Center,
        ) { Txt("$n", label(11, 0f, Lz.Bg)) }
    }
}

@Composable
fun NotificationsScreen(s: LezervState) {
    val list = s.myNotices
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (list.isEmpty()) {
            EmptyState("bell", "Nothing new", "Updates about your jobs and payments show up here.", "Back to the map") { s.back() }
            return@Column
        }
        if (s.unread > 0) Box(Modifier.align(Alignment.End).tap { s.markAllRead() }.padding(vertical = 4.dp)) {
            Txt("MARK ALL READ", label(12, .08f, Lz.Accent700))
        }
        list.forEach { NoticeCard(it) { s.openNotice(it) } }
        Txt("PROPOSAL: the same notices arrive as Android push (FCM) and open these screens as deep links.", body(12, 17, color = Lz.Neutral700))
    }
}

/** Styled like the Android push mock-ups on the Board (1n). */
@Composable
private fun NoticeCard(n: Notice, onTap: () -> Unit) {
    Column(Modifier.fillMaxWidth().blueprint().background(if (n.read) Color.Transparent else Lz.Bg).border(1.dp, if (n.read) Lz.Divider else Lz.Ink).tap(onClick = onTap).padding(horizontal = 14.dp, vertical = 12.dp)) {
        Row(Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(16.dp).border(1.dp, Lz.Ink), contentAlignment = Alignment.Center) { Box(Modifier.size(6.dp).background(if (n.read) Lz.Neutral500 else Lz.Accent)) }
            Txt("LEZERV", label(11, .08f, Lz.Neutral700))
            Txt("· ${n.ago}", body(11, color = Lz.Neutral700), Modifier.weight(1f))
            if (!n.read) Txt("NEW", label(10, .1f, Lz.Accent700))
        }
        Txt(n.title, body(15, 20, weight = 700))
        Txt(n.body, body(14, 20, color = Lz.Neutral800))
        Txt(n.action.uppercase(), label(12, .08f, Lz.Accent700), Modifier.padding(top = 10.dp))
    }
}

// ───────────────────────────── 1m · empty and error states ─────────────────────────────

/** Says what happened and offers exactly one next step. */
@Composable
fun EmptyState(icon: String, title: String, text: String, action: String, modifier: Modifier = Modifier, onAction: () -> Unit) {
    Column(modifier.fillMaxWidth().blueprint().border(1.dp, Lz.Divider).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        LzIcon(icon, 26, Lz.Accent700)
        Txt(title.uppercase(), heading(25, 25))
        Txt(text, body(13, 19, color = Lz.Neutral800))
        Row(
            Modifier.padding(top = 4.dp).fillMaxWidth().heightIn(min = 40.dp).border(1.dp, Lz.Ink).tap(onClick = onAction).padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Txt(action.uppercase(), heading(16, tracking = .05f), Modifier.weight(1f))
            LzIcon("arrow-right", 16)
        }
    }
}

// ───────────────────────────── 1l · offline ─────────────────────────────

@Composable
fun OfflineBanner() {
    Row(
        Modifier.fillMaxWidth().background(Lz.Accent100).borderTop(1.dp, Lz.Accent).borderBottom(1.dp, Lz.Accent).padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LzIcon("wifi-off", 20, Lz.Accent900)
        Column {
            Txt("You’re offline.", body(13, 18, weight = 700, color = Lz.Accent900))
            Txt("Showing saved info. Messages send when you reconnect.", body(13, 18, color = Lz.Accent900))
        }
    }
}

// ───────────────────────────── decline sheet ─────────────────────────────

/** "Can't take this job?" with a reason, from the Board's bottom-sheet component. */
@Composable
fun DeclineSheet(s: LezervState) {
    Box(Modifier.fillMaxSize().background(Lz.Neutral800.copy(alpha = .55f)).tap { s.dismissDecline() }, contentAlignment = Alignment.BottomCenter) {
        Column(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(2.dp, Lz.Ink).tap { }.padding(start = 20.dp, end = 20.dp, top = 10.dp, bottom = 20.dp)) {
            Box(Modifier.fillMaxWidth().padding(bottom = 10.dp), contentAlignment = Alignment.Center) { Box(Modifier.size(40.dp, 4.dp).background(Lz.Neutral500)) }
            Txt("CAN’T TAKE THIS JOB?", heading(30, 30, weight = 700))
            Txt("The request goes to the next artisan nearby. Tell us why so we send you better ones.", body(13, 19, color = Lz.Neutral800), Modifier.padding(top = 6.dp, bottom = 14.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DECLINE_REASONS.forEachIndexed { i, r ->
                    val on = s.declineReason == i
                    Row(
                        Modifier.fillMaxWidth().heightIn(min = 48.dp).background(if (on) Lz.Accent100 else Color.Transparent).border(1.dp, if (on) Lz.Accent else Lz.Divider)
                            .tap { s.declineReason = i }.padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Txt(r, body(14, weight = 700), Modifier.weight(1f))
                        if (on) LzIcon("check", 18, Lz.Accent700)
                    }
                }
            }
            Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlineButton("Keep it", { s.dismissDecline() }, Modifier.weight(1f))
                OutlineButton("Decline request", { s.confirmDecline() }, Modifier.weight(1.6f), dashed = true)
            }
        }
    }
}

// ───────────────────────────── 1j · artisan verification ─────────────────────────────

/** Diagonal hatch used for photo placeholders on the Board. */
private val PhotoHatch = Brush.linearGradient(
    0f to Lz.Neutral200, .86f to Lz.Neutral200, .86f to Lz.Neutral300, 1f to Lz.Neutral300,
    start = Offset.Zero, end = Offset(10f, 10f), tileMode = TileMode.Repeated,
)

@Composable
fun VerifyScreen(s: LezervState, onboarding: Boolean) {
    Column(Modifier.fillMaxSize()) {
        // four-step progress, this is step 2
        Row(Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            ONBOARDING_STEPS.forEachIndexed { i, l ->
                val done = i < 2
                Column(Modifier.weight(1f)) {
                    Box(Modifier.fillMaxWidth().height(3.dp).background(if (done) Lz.Accent800 else Lz.Neutral300))
                    Txt("0${i + 1} ${l.uppercase()}", label(10, color = if (done) Lz.Ink else Lz.Neutral700), Modifier.padding(top = 6.dp))
                }
            }
        }
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Column {
                FieldLabel("ID type")
                Segments(ID_TYPES.indices.toList(), { it == s.idType }, { s.idType = it; s.idNumber = "" }) { i, fg ->
                    Txt(ID_TYPES[i].first.uppercase(), heading(17, tracking = .05f, color = fg))
                }
            }
            Column {
                FieldLabel("${ID_TYPES[s.idType].first} number")
                val digitsOnly = s.idType == 0
                InputBox(
                    s.idNumber, { v -> s.idNumber = v.filter { if (digitsOnly) it.isDigit() else it.isLetterOrDigit() }.uppercase().take(s.idDigits) },
                    placeholder = "${s.idDigits} ${if (digitsOnly) "digits" else "characters"}", keyboard = if (digitsOnly) KeyboardType.Number else KeyboardType.Ascii,
                    style = body(16, tracking = .08f),
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FieldLabel("Documents")
                KYC_DOCS.forEachIndexed { i, d ->
                    val up = s.docsUploaded[i]
                    Row(
                        Modifier.fillMaxWidth().blueprint().background(if (up) Lz.Accent100 else Color.Transparent)
                            .then(if (up) Modifier.border(1.dp, Lz.Accent) else Modifier.dashedBorder(Lz.Ink))
                            .tap { s.toggleDoc(i) }.padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(Modifier.size(52.dp).background(PhotoHatch), contentAlignment = Alignment.Center) { LzIcon(d.icon, 22, Lz.Neutral700) }
                        Column(Modifier.weight(1f)) {
                            Txt(d.title.uppercase(), heading(20, 22, tracking = .03f))
                            Txt(if (up) "Uploaded · tap to replace" else d.hint, body(12, 16, color = Lz.Neutral700))
                        }
                        LzIcon(if (up) "circle-check" else if (i == 2) "camera" else "upload", 22, Lz.Accent700)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LzIcon("lock", 16, Lz.Neutral700)
                Txt("Stored privately. Only Lezerv’s verification team can open them.", body(12, 17, color = Lz.Neutral700))
            }
        }
        Row(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(1.dp, Lz.Ink).padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            IconBox("arrow-left", { s.back() }, size = 54, iconSize = 22, modifier = Modifier.semantics { contentDescription = "Back" })
            PrimaryWide(if (onboarding) "Continue" else "Save", onClick = { s.submitVerification(onboarding) }, modifier = Modifier.weight(1f), alpha = if (s.verifyReady) 1f else .5f)
        }
    }
}

// ───────────────────────────── 1k · payout account ─────────────────────────────

/** PROPOSAL: needs backend work for the BVN check and account-name match. */
@Composable
fun PayoutScreen(s: LezervState) {
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Txt("Lezerv pays you here after each completed job, minus 20% commission.", body(15, 22, color = Lz.Neutral800))
            Column {
                FieldLabel("Bank")
                Row(
                    Modifier.fillMaxWidth().height(50.dp).border(1.dp, Lz.Ink).tap { s.bankListOpen = !s.bankListOpen }.padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Txt(s.payoutBank, body(16), Modifier.weight(1f))
                    LzIcon(if (s.bankListOpen) "x" else "chevron-right", 20)
                }
                if (s.bankListOpen) Column(Modifier.border(1.dp, Lz.Ink)) {
                    BANKS.forEach { (full, _) ->
                        val on = full == s.payoutBank
                        Row(
                            Modifier.fillMaxWidth().heightIn(min = 46.dp).background(if (on) Lz.Accent100 else Color.Transparent).borderBottom(1.dp, Lz.Divider)
                                .tap { s.payoutBank = full; s.bankListOpen = false }.padding(horizontal = 12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) { Txt(full, body(15), Modifier.weight(1f)); if (on) LzIcon("check", 18, Lz.Accent700) }
                    }
                }
            }
            Column {
                FieldLabel("Account number")
                InputBox(s.payoutAccount, { v -> s.payoutAccount = v.filter(Char::isDigit).take(10) }, "10 digits", KeyboardType.Number, body(18, tracking = .14f))
            }
            val name = s.accountName
            if (name != null) Row(
                Modifier.fillMaxWidth().blueprint().background(Lz.Accent100).border(1.dp, Lz.Accent).padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                LzIcon("badge-check", 22, Lz.Accent700)
                Column { Txt("ACCOUNT NAME", label(color = Lz.Accent800)); Txt(name, heading(24), Modifier.padding(top = 3.dp)) }
            }
            Column {
                FieldLabel("BVN")
                InputBox(s.bvn, { v -> s.bvn = v.filter(Char::isDigit).take(11) }, "11 digits", KeyboardType.NumberPassword, body(18, tracking = .2f), secret = true)
                Txt("Used once to confirm it is you. Lezerv never shows it again.", body(12, 17, color = Lz.Neutral700), Modifier.padding(top = 6.dp))
            }
        }
        Box(Modifier.fillMaxWidth().background(Lz.Bg).borderTop(1.dp, Lz.Ink).padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 12.dp)) {
            PrimaryWide("Verify and save", "shield-check", { s.savePayout() }, alpha = if (s.payoutReady) 1f else .5f)
        }
    }
}

// ───────────────────────────── form bits ─────────────────────────────

@Composable
private fun FieldLabel(text: String) = Txt(text.uppercase(), label(color = Lz.Neutral700), Modifier.padding(bottom = 6.dp))

/** Filled input from the Board: surface grey, hairline border, 50dp tall. */
@Composable
private fun InputBox(value: String, onChange: (String) -> Unit, placeholder: String, keyboard: KeyboardType, style: TextStyle, secret: Boolean = false, height: Dp = 50.dp) {
    BasicTextField(
        value, onChange,
        Modifier.fillMaxWidth().height(height).background(Lz.Surface).border(1.dp, Lz.Divider).padding(horizontal = 12.dp),
        singleLine = true, textStyle = style, cursorBrush = SolidColor(Lz.Accent),
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        visualTransformation = if (secret) PasswordVisualTransformation('•') else androidx.compose.ui.text.input.VisualTransformation.None,
        decorationBox = { inner -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.CenterStart) { if (value.isEmpty()) Txt(placeholder, style.copy(color = Lz.Neutral600, letterSpacing = style.letterSpacing)); inner() } },
    )
}

internal fun Modifier.dashedBorder(color: Color) = drawBehind {
    val w = 1.dp.toPx()
    drawRect(color, topLeft = Offset(w / 2, w / 2), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w),
        style = Stroke(w, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 3.dp.toPx()))))
}
