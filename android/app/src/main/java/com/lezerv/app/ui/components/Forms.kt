package com.lezerv.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.OffsetMapping
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.TransformedText
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.lezerv.app.ui.theme.Lz
import com.lezerv.app.ui.theme.body
import com.lezerv.app.ui.theme.label

/** Field label: small spaced caps above an input. */
@Composable
fun FormLabel(text: String, modifier: Modifier = Modifier) = Txt(text.uppercase(), label(color = Lz.Neutral700), modifier.padding(bottom = 6.dp))

/**
 * The Board's filled input: surface grey, hairline border. [prefix] draws fixed text
 * before the value (e.g. "+234"); [transformation] changes how the value looks without
 * changing what is stored.
 */
@Composable
fun LzField(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboard: KeyboardType = KeyboardType.Text,
    style: TextStyle = body(16),
    transformation: VisualTransformation = VisualTransformation.None,
    singleLine: Boolean = true,
    minHeight: Dp = 50.dp,
    prefix: String? = null,
    enabled: Boolean = true,
    capitalizeWords: Boolean = false,
) {
    Row(
        modifier.fillMaxWidth().heightIn(min = minHeight).background(if (enabled) Lz.Surface else Color.Transparent).border(1.dp, Lz.Divider),
        verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
    ) {
        if (prefix != null) Box(Modifier.heightIn(min = minHeight).border(1.dp, Lz.Divider).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
            Txt(prefix, style.copy(color = Lz.Neutral800))
        }
        BasicTextField(
            value, onChange,
            Modifier.weight(1f).padding(horizontal = 12.dp, vertical = if (singleLine) 0.dp else 12.dp),
            enabled = enabled, singleLine = singleLine, textStyle = style, cursorBrush = SolidColor(Lz.Accent),
            keyboardOptions = KeyboardOptions(keyboardType = keyboard, capitalization = if (capitalizeWords) KeyboardCapitalization.Words else KeyboardCapitalization.None),
            visualTransformation = transformation,
            decorationBox = { inner -> Box { if (value.isEmpty()) Txt(placeholder, style.copy(color = Lz.Neutral600)); inner() } },
        )
    }
}

/** Square on/off switch matching the artisan "Online" toggle. */
@Composable
fun LzSwitch(on: Boolean, onToggle: () -> Unit, name: String, enabled: Boolean = true) {
    Box(
        Modifier.size(52.dp, 30.dp).background(if (on) Lz.Accent else Color.Transparent).border(2.dp, if (on) Lz.Accent else if (enabled) Lz.Ink else Lz.Neutral500)
            .then(if (enabled) Modifier.tap(onClick = onToggle) else Modifier)
            .semantics { contentDescription = name; stateDescription = if (on) "On" else "Off"; role = Role.Switch }
            .padding(3.dp),
        contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart,
    ) { Box(Modifier.size(20.dp).background(if (on) Color.White else if (enabled) Lz.Ink else Lz.Neutral500)) }
}

/** Label + optional caption on the left, switch on the right. */
@Composable
fun SwitchRow(title: String, sub: String, on: Boolean, onToggle: () -> Unit, enabled: Boolean = true) {
    Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).borderBottom(1.dp, Lz.Divider).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Txt(title, body(15, weight = 600))
            Txt(sub, body(12, 17, color = Lz.Neutral700))
        }
        LzSwitch(on, onToggle, title, enabled)
    }
}

/** Shows "4111111111111111" as "4111 1111 1111 1111". The cursor mapping keeps editing natural. */
object CardNumberTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val raw = text.text
        val out = raw.chunked(4).joinToString(" ")
        val map = object : OffsetMapping {
            override fun originalToTransformed(offset: Int) = (offset + (offset - 1).coerceAtLeast(0) / 4).coerceAtMost(out.length)
            override fun transformedToOriginal(offset: Int) = (offset - offset / 5).coerceIn(0, raw.length)
        }
        return TransformedText(AnnotatedString(out), map)
    }
}

/** Shows "0827" as "08/27". */
object ExpiryTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val raw = text.text
        val out = if (raw.length > 2) raw.take(2) + "/" + raw.drop(2) else raw
        val map = object : OffsetMapping {
            override fun originalToTransformed(offset: Int) = (if (offset <= 2) offset else offset + 1).coerceAtMost(out.length)
            override fun transformedToOriginal(offset: Int) = (if (offset <= 2) offset else offset - 1).coerceIn(0, raw.length)
        }
        return TransformedText(AnnotatedString(out), map)
    }
}

/** Shows "8035554417" as "803 555 4417" (Nigerian mobile grouping). */
object PhoneTransformation : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val raw = text.text
        val out = listOf(raw.take(3), raw.drop(3).take(3), raw.drop(6)).filter { it.isNotEmpty() }.joinToString(" ")
        val map = object : OffsetMapping {
            override fun originalToTransformed(offset: Int) = (offset + (if (offset > 3) 1 else 0) + (if (offset > 6) 1 else 0)).coerceAtMost(out.length)
            override fun transformedToOriginal(offset: Int) = (offset - (if (offset > 3) 1 else 0) - (if (offset > 7) 1 else 0)).coerceIn(0, raw.length)
        }
        return TransformedText(AnnotatedString(out), map)
    }
}

val Secret: VisualTransformation = PasswordVisualTransformation('•')

