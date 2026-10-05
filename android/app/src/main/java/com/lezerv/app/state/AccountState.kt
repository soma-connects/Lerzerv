package com.lezerv.app.state

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.lezerv.app.data.AREAS
import com.lezerv.app.data.DEMO_OTP

/** Steps of the phone sign-in flow, shown full screen over the app. */
enum class AuthStep { Welcome, Phone, Code, Details }

data class Address(val id: Int, val label: String, val street: String, val area: String, val note: String, val x: Float, val y: Float) {
    val title get() = "$label · $street"
    val sub get() = "$area, Lagos" + if (note.isNotBlank()) " · $note" else ""
}

/** Only the last 4 digits are kept. PROPOSAL: Paystack tokenises the card; the app never stores the number. */
data class SavedCard(val id: Int, val brand: String, val last4: String, val expiry: String) {
    val label get() = "$brand ••$last4"
}

data class ServicePrice(val name: String, val price: Int, val on: Boolean)

/**
 * Everything about the person using the app: sign-in, profile, addresses, cards, settings,
 * safety contacts and (for artisans) their service list.
 *
 * Split out of [LezervState] so each class stays about one thing. It talks back to the app
 * through [app] when it needs navigation or a toast.
 */
class AccountState(private val app: LezervState, signedIn: Boolean) {

    // ───────────── sign-in (phone + SMS code) ─────────────
    var signedIn by mutableStateOf(signedIn); private set
    var authStep by mutableStateOf<AuthStep?>(null); private set
    /** What to do once signed in, e.g. reopen the payment sheet the guest was trying to use. */
    private var afterAuth: (() -> Unit)? = null
    private var authFromGate = false

    var phoneDraft by mutableStateOf("")
    var code by mutableStateOf("")
    var codeSentAt by mutableLongStateOf(0L); private set

    // ───────────── profile ─────────────
    var name by mutableStateOf(if (signedIn) "Amaka Obi" else "")
    var email by mutableStateOf(if (signedIn) "amaka@example.com" else "")
    var phone by mutableStateOf(if (signedIn) "8035554417" else ""); private set
    val firstName get() = name.substringBefore(' ').ifBlank { "there" }
    val initials get() = name.split(' ').filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }.ifBlank { "?" }
    val phoneMasked get() = if (phone.length == 10) "+234 ${phone.take(3)} ••• ${phone.takeLast(4)}" else "Add your phone"

    // ───────────── addresses ─────────────
    // Sample data belongs to the signed-in demo user only; a guest starts with nothing saved.
    var addresses by mutableStateOf(if (signedIn) listOf(Address(1, "Home", "12 Admiralty Way", "Lekki Phase 1", "Gate code at security", 360f, 530f)) else emptyList()); private set
    var addressId by mutableIntStateOf(1); private set
    val currentAddress: Address? get() = addresses.firstOrNull { it.id == addressId } ?: addresses.firstOrNull()
    var pickingAddress by mutableStateOf(false)
    private var nextAddressId = 2
    // edit form
    var editingAddressId by mutableStateOf<Int?>(null); private set
    var formLabel by mutableStateOf("Home")
    var formStreet by mutableStateOf("")
    var formArea by mutableStateOf(AREAS.first().first)
    var formNote by mutableStateOf("")

    // ───────────── payment cards ─────────────
    var cards by mutableStateOf(if (signedIn) listOf(SavedCard(1, "Visa", "2291", "08/27")) else emptyList()); private set
    var defaultCardId by mutableIntStateOf(1); private set
    val defaultCard: SavedCard? get() = cards.firstOrNull { it.id == defaultCardId } ?: cards.firstOrNull()
    private var nextCardId = 2
    var cardNumber by mutableStateOf("")
    var cardExpiry by mutableStateOf("")
    var cardCvv by mutableStateOf("")

    // ───────────── settings ─────────────
    var notifyMessages by mutableStateOf(true)
    var notifyOffers by mutableStateOf(false)
    var language by mutableStateOf("English")
    var deleting by mutableStateOf(false)

    // ───────────── safety ─────────────
    var shareLiveJobs by mutableStateOf(true)
    var trustedContact by mutableStateOf("Chidi Obi · brother")

    // ───────────── artisan services ─────────────
    var services by mutableStateOf(listOf(ServicePrice("Leak repair", 8000, true), ServicePrice("Unblock a drain", 13500, true), ServicePrice("Water heater fix", 21000, true), ServicePrice("Borehole pump", 15000, false)))
        private set

    // ═════════════════════════════ sign-in flow ═════════════════════════════

    /** Shown once after the splash on a fresh install. */
    fun showWelcome() { if (!signedIn) { authStep = AuthStep.Welcome; authFromGate = false } }

    /** A guest tried something that needs an account; sign in, then carry on with [then]. */
    fun requireSignIn(then: () -> Unit) {
        if (signedIn) { then(); return }
        afterAuth = then; authFromGate = true
        authStep = AuthStep.Phone
    }

    fun browseAsGuest() { authStep = null; afterAuth = null }

    fun startPhone() { authStep = AuthStep.Phone }

    /** Nigerian mobile numbers are 10 digits after +234 (the leading 0 is dropped). */
    fun onPhoneInput(v: String) { phoneDraft = v.filter(Char::isDigit).removePrefix("234").removePrefix("0").take(10) }

    val phoneValid get() = phoneDraft.length == 10 && phoneDraft.first() in "789"

    /** PROPOSAL: send the code by SMS through a provider such as Termii. */
    fun sendCode() {
        if (!phoneValid) { app.toast("Enter a 10-digit mobile number, e.g. 803 555 4417"); return }
        code = ""; codeSentAt = app.now; authStep = AuthStep.Code
    }

    val resendIn: Int get() = (30 - ((app.now - codeSentAt) / 1000).toInt()).coerceAtLeast(0)

    fun resendCode() { if (resendIn == 0) { codeSentAt = app.now; app.toast("New code sent") } }

    fun onCodeInput(v: String) {
        code = v.filter(Char::isDigit).take(6)
        if (code.length == 6) verifyCode()
    }

    fun verifyCode() {
        if (code != DEMO_OTP) { app.toast("That code doesn’t match. Check the SMS and try again."); return }
        phone = phoneDraft
        if (name.isBlank()) authStep = AuthStep.Details else finishAuth()
    }

    val detailsValid get() = name.trim().split(' ').count { it.length > 1 } >= 2 && (email.isBlank() || EMAIL.matches(email.trim()))

    fun saveDetails() {
        if (!detailsValid) { app.toast(if (email.isNotBlank() && !EMAIL.matches(email.trim())) "Check the email address" else "Add your first and last name"); return }
        name = name.trim(); email = email.trim()
        finishAuth()
    }

    private fun finishAuth() {
        signedIn = true; authStep = null
        app.toast("Welcome, $firstName")
        afterAuth?.invoke(); afterAuth = null
    }

    /** System back inside the sign-in flow. */
    fun authBack() {
        authStep = when (authStep) {
            AuthStep.Code -> AuthStep.Phone
            AuthStep.Phone -> if (authFromGate) { afterAuth = null; null } else AuthStep.Welcome
            AuthStep.Details -> AuthStep.Code
            else -> null
        }
    }

    /** Signing out clears everything personal, so the next person on this phone sees none of it. */
    fun signOut() {
        signedIn = false; name = ""; email = ""; phone = ""; phoneDraft = ""; code = ""
        addresses = emptyList(); cards = emptyList(); trustedContact = "Not set"
        app.reset(withHistory = false)
        authStep = AuthStep.Welcome; authFromGate = false
    }

    /** Google Play requires apps with accounts to offer deletion inside the app. PROPOSAL: backend job deletes data within 30 days. */
    fun deleteAccount() {
        deleting = false
        signOut()
        app.toast("Your account is scheduled for deletion")
    }

    /** Demo only: sign back in as the sample user with their saved details. */
    fun loadDemoUser() {
        val d = AccountState(app, signedIn = true)
        signedIn = true; authStep = null; afterAuth = null
        name = d.name; email = d.email; phone = d.phone
        addresses = d.addresses; addressId = d.addressId; cards = d.cards; defaultCardId = d.defaultCardId; trustedContact = d.trustedContact
    }

    // ═════════════════════════════ profile ═════════════════════════════

    fun saveProfile() {
        if (!detailsValid) { app.toast("Add your first and last name, and a valid email or none"); return }
        name = name.trim(); email = email.trim()
        app.back(); app.toast("Profile saved")
    }

    // ═════════════════════════════ addresses ═════════════════════════════

    fun chooseAddress(id: Int) { addressId = id; pickingAddress = false }

    /** Opens the address form for a new address ([id] null) or an existing one. */
    fun editAddress(id: Int?) {
        val a = addresses.firstOrNull { it.id == id }
        editingAddressId = a?.id
        formLabel = a?.label ?: if (addresses.none { it.label == "Home" }) "Home" else "Work"
        formStreet = a?.street.orEmpty(); formArea = a?.area ?: AREAS.first().first; formNote = a?.note.orEmpty()
        pickingAddress = false
        app.push(Pushed.AddressEdit)
    }

    fun saveAddress() {
        if (formStreet.trim().length < 4) { app.toast("Add the street and house number"); return }
        val (ax, ay) = AREAS.first { it.first == formArea }.second
        val id = editingAddressId ?: nextAddressId++
        val a = Address(id, formLabel, formStreet.trim(), formArea, formNote.trim(), ax, ay)
        addresses = if (editingAddressId == null) addresses + a else addresses.map { if (it.id == id) a else it }
        addressId = id
        app.back(); app.toast("${a.label} address saved")
    }

    fun deleteAddress(id: Int) {
        addresses = addresses.filterNot { it.id == id }
        if (addressId == id) addressId = addresses.firstOrNull()?.id ?: 0
        app.back(); app.toast("Address removed")
    }

    // ═════════════════════════════ cards ═════════════════════════════

    fun startAddCard() { cardNumber = ""; cardExpiry = ""; cardCvv = ""; app.push(Pushed.AddCard) }

    fun onCardNumber(v: String) { cardNumber = v.filter(Char::isDigit).take(19) }
    fun onCardExpiry(v: String) { cardExpiry = v.filter(Char::isDigit).take(4) }
    fun onCardCvv(v: String) { cardCvv = v.filter(Char::isDigit).take(4) }

    val cardBrand: String get() = when {
        cardNumber.startsWith("4") -> "Visa"
        cardNumber.take(2).toIntOrNull() in 51..55 || cardNumber.take(4).toIntOrNull() in 2221..2720 -> "Mastercard"
        cardNumber.startsWith("5060") || cardNumber.startsWith("5061") || cardNumber.startsWith("6500") -> "Verve"
        else -> "Card"
    }

    private val expiryValid get() = cardExpiry.length == 4 && cardExpiry.take(2).toInt() in 1..12
    val cardValid get() = cardNumber.length in 16..19 && luhn(cardNumber) && expiryValid && cardCvv.length >= 3

    fun saveCard() {
        when {
            !(cardNumber.length in 16..19 && luhn(cardNumber)) -> { app.toast("Check the card number"); return }
            !expiryValid -> { app.toast("Expiry is MM/YY"); return }
            cardCvv.length < 3 -> { app.toast("CVV is the 3 digits on the back"); return }
        }
        val c = SavedCard(nextCardId++, cardBrand, cardNumber.takeLast(4), cardExpiry.take(2) + "/" + cardExpiry.drop(2))
        cards = cards + c; defaultCardId = c.id
        cardNumber = ""; cardCvv = ""; cardExpiry = "" // never keep the full number around
        app.back(); app.toast("${c.label} added")
    }

    fun makeDefault(id: Int) { defaultCardId = id }
    fun removeCard(id: Int) { cards = cards.filterNot { it.id == id }; if (defaultCardId == id) defaultCardId = cards.firstOrNull()?.id ?: 0 }

    // ═════════════════════════════ artisan services ═════════════════════════════

    fun toggleService(i: Int) { services = services.toMutableList().also { it[i] = it[i].copy(on = !it[i].on) } }
    fun changePrice(i: Int, d: Int) { services = services.toMutableList().also { it[i] = it[i].copy(price = (it[i].price + d).coerceIn(1000, 500_000)) } }
    fun saveServices() {
        if (services.none { it.on }) { app.toast("Keep at least one service on"); return }
        app.back(); app.toast("Prices updated. Clients see them as starting prices.")
    }

    // ═════════════════════════════ referral ═════════════════════════════

    val referralCode get() = (firstName.uppercase().take(5) + phone.takeLast(4)).ifBlank { "LEZERV" }

    companion object {
        private val EMAIL = Regex("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")

        /** Luhn checksum: catches most mistyped card numbers before they reach the payment provider. */
        fun luhn(digits: String): Boolean {
            var sum = 0
            digits.reversed().forEachIndexed { i, ch ->
                var d = ch - '0'
                if (i % 2 == 1) { d *= 2; if (d > 9) d -= 9 }
                sum += d
            }
            return sum % 10 == 0
        }
    }
}
