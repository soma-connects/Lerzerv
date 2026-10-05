package com.lezerv.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.lezerv.app.data.DEMO_OTP
import com.lezerv.app.state.AccountState
import com.lezerv.app.state.AuthStep
import com.lezerv.app.state.LezervState
import com.lezerv.app.ui.components.FormLabel
import com.lezerv.app.ui.components.IconBox
import com.lezerv.app.ui.components.LzField
import com.lezerv.app.ui.components.PhoneTransformation
import com.lezerv.app.ui.components.PrimaryWide
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

/**
 * Phone sign-in, full screen over the app. Guests can "look around first" and are only
 * asked to sign in when they pay (Board flow 1g). PROPOSAL: phone OTP via an SMS provider.
 */
@Composable
fun AuthFlow(s: LezervState) {
    val a = s.account
    val step = a.authStep ?: return
    Column(Modifier.fillMaxSize().background(Lz.Bg).tap { }) {
        if (step != AuthStep.Welcome) Row(Modifier.fillMaxWidth().padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBox("arrow-left", { a.authBack() }, iconSize = 24, border = null, modifier = Modifier.semantics { contentDescription = "Back" })
            Txt("STEP ${step.ordinal} OF 3", label(color = Lz.Neutral700), Modifier.padding(start = 4.dp))
        }
        // Scrolls when the keyboard is up, yet keeps the button at the bottom: the column is at
        // least as tall as the screen and SpaceBetween pushes the two groups apart.
        // (Spacer(weight) can't work here: a scrolling column has no fixed height to share out.)
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth()) {
            val minH = maxHeight
            Column(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = minH)
                    .padding(start = 22.dp, end = 22.dp, top = if (step == AuthStep.Welcome) 34.dp else 12.dp, bottom = 22.dp),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                when (step) {
                    AuthStep.Welcome -> Welcome(a)
                    AuthStep.Phone -> PhoneStep(a)
                    AuthStep.Code -> CodeStep(s, a)
                    AuthStep.Details -> DetailsStep(a)
                }
            }
        }
    }
}

/** "8035554417" → "803 555 4417". */
private fun formatPhone(d: String) = listOf(d.take(3), d.drop(3).take(3), d.drop(6)).filter { it.isNotEmpty() }.joinToString(" ")

@Composable
private fun Welcome(a: AccountState) {
    Column {
        Box(Modifier.blueprint().size(56.dp).background(Lz.Accent), contentAlignment = Alignment.Center) { Txt("L", heading(38, weight = 700, color = Lz.Bg)) }
        Txt("HELP FOR YOUR HOME, RIGHT ON THE MAP.", heading(52, 48), Modifier.padding(top = 24.dp, bottom = 12.dp))
        Txt("Find verified artisans near you, pay safely and watch them arrive.", body(16, 24, color = Lz.Neutral800))
        Column(Modifier.padding(top = 22.dp).borderTop(1.dp, Lz.Ink)) {
            listOf("badge-check" to "Every artisan is ID-checked", "lock" to "Your money is held until the job is done", "navigation" to "Live tracking and a start code").forEach { (ic, t) ->
                Row(Modifier.fillMaxWidth().borderBottom(1.dp, Lz.Divider).padding(vertical = 13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    LzIcon(ic, 22, Lz.Accent700); Txt(t, body(15, 21))
                }
            }
        }
    }
    Column(Modifier.padding(top = 28.dp)) {
        PrimaryWide("Continue with phone", "phone", { a.startPhone() })
        Box(Modifier.padding(top = 10.dp).fillMaxWidth().heightIn(min = 48.dp).tap { a.browseAsGuest() }, contentAlignment = Alignment.CenterStart) {
            Txt("LOOK AROUND FIRST", body(14, weight = 700, tracking = .06f).copy(textDecoration = TextDecoration.Underline))
        }
        Txt("By continuing you agree to Lezerv’s Terms and Privacy policy.", body(12, 16, color = Lz.Neutral700))
    }
}

@Composable
private fun PhoneStep(a: AccountState) {
    Column {
        Txt("YOUR PHONE NUMBER", heading(44, 42), Modifier.padding(bottom = 10.dp))
        Txt("We’ll text you a 6-digit code. Artisans never see your number.", body(15, 22, color = Lz.Neutral800), Modifier.padding(bottom = 22.dp))
        FormLabel("Mobile number")
        LzField(a.phoneDraft, a::onPhoneInput, "803 555 4417", keyboard = KeyboardType.Phone, style = body(18, tracking = .06f), prefix = "+234", transformation = PhoneTransformation)
        Txt("PROPOSAL: codes are sent by SMS through a provider such as Termii.", body(12, 17, color = Lz.Neutral700), Modifier.padding(top = 8.dp))
    }
    Column(Modifier.padding(top = 28.dp)) {
        PrimaryWide("Send code", "send", { a.sendCode() }, alpha = if (a.phoneValid) 1f else .5f)
    }
}

@Composable
private fun CodeStep(s: LezervState, a: AccountState) {
    Column {
        Txt("ENTER THE CODE", heading(44, 42), Modifier.padding(bottom = 10.dp))
        Row(Modifier.padding(bottom = 22.dp)) {
            Txt("Sent to +234 ${formatPhone(a.phoneDraft)}  ", body(15, 22, color = Lz.Neutral800))
            Txt("Change", body(15, 22, weight = 700, color = Lz.Accent700), Modifier.tap { a.startPhone() })
    }
        // One hidden text field drives six boxes, so paste and SMS autofill still work.
        BasicTextField(
            a.code, a::onCodeInput,
            Modifier.fillMaxWidth().semantics { contentDescription = "6-digit code" },
            singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            decorationBox = { inner ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(6) { i ->
                        val ch = a.code.getOrNull(i)
                        val active = i == a.code.length
                        Box(Modifier.weight(1f).height(60.dp).border(if (active) 2.dp else 1.dp, if (active) Lz.Accent else Lz.Ink), contentAlignment = Alignment.Center) {
                            Txt(ch?.toString() ?: "", heading(32, weight = 700))
                        }
                    }
                }
                Box(Modifier.size(1.dp).alpha(0f)) { inner() }
            },
        )
        Row(Modifier.padding(top = 12.dp).fillMaxWidth()) {
            val wait = a.resendIn
            Txt(if (wait > 0) "Resend code in ${wait}s" else "Resend code", body(13, weight = if (wait > 0) 400 else 700, color = if (wait > 0) Lz.Neutral700 else Lz.Accent700),
                Modifier.weight(1f).then(if (wait == 0) Modifier.tap { a.resendCode() } else Modifier))
            if (s.demo) Txt("Demo: fill $DEMO_OTP", body(13, weight = 700, color = Lz.Accent700), Modifier.tap { a.onCodeInput(DEMO_OTP) })
    }
    }
    Column(Modifier.padding(top = 28.dp)) {
        PrimaryWide("Verify", "check", { a.verifyCode() }, alpha = if (a.code.length == 6) 1f else .5f)
    }
}

@Composable
private fun DetailsStep(a: AccountState) {
    Column {
        Txt("WHAT SHOULD WE CALL YOU?", heading(44, 42), Modifier.padding(bottom = 10.dp))
        Txt("Artisans see your first name only.", body(15, 22, color = Lz.Neutral800), Modifier.padding(bottom = 22.dp))
        FormLabel("Full name")
        LzField(a.name, { a.name = it.take(60) }, "Amaka Obi", capitalizeWords = true)
        FormLabel("Email (optional, for receipts)", Modifier.padding(top = 18.dp))
        LzField(a.email, { a.email = it.trim().take(80) }, "you@example.com", keyboard = KeyboardType.Email)
    }
    Column(Modifier.padding(top = 28.dp)) {
        PrimaryWide("Finish", "arrow-right", { a.saveDetails() }, alpha = if (a.detailsValid) 1f else .5f)
    }
}
