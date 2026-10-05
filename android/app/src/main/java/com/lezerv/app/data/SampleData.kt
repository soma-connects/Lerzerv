package com.lezerv.app.data

import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * Sample data copied from the v2 prototype. Names, prices, map positions and the
 * start code are placeholders until the backend exists.
 *
 * Map coordinates are in "map units": the drawn Lekki map is 720 × 1040 and
 * [KM] units make one kilometre.
 */
const val UX = 360f   // the client's own position
const val UY = 520f
const val KM = 120f
val CLIENT_HOME = Pt(262f, 648f) // where the artisan drives to in the demo request
val REQUEST_PIN = Pt(263f, 642f) // home pin drawn on the artisan map (prototype: 249,604 top-left)
const val DEMO_START_CODE = "4827"

data class Pt(val x: Float, val y: Float)

data class Service(val key: String, val label: String, val icon: String)

val SERVICES = listOf(
    Service("all", "All", "layers"), Service("clean", "Cleaning", "sparkles"), Service("laundry", "Laundry", "shirt"),
    Service("repair", "Repairs", "wrench"), Service("cook", "Cooking", "chef-hat"), Service("plumb", "Plumbing", "droplets"),
    Service("elec", "Electrical", "zap"), Service("ac", "AC", "wind"), Service("gen", "Generator", "power"),
)
val SERVICE = SERVICES.associateBy { it.key }

data class Artisan(
    val id: String, val name: String, val ini: String, val svc: String,
    val x: Float, val y: Float,
    val rating: Double, val reviews: Int, val jobs: Int,
    val from: Int, val unit: String,
    val online: Boolean, val verified: Boolean, val laundry: Boolean = false,
    val bio: String,
) {
    val km: Double get() = hypot((x - UX).toDouble(), (y - UY).toDouble()) / KM
    val eta: Int get() = (km * 5 + 4).roundToInt()
    val first: String get() = name.substringBefore(' ')
    val service: Service get() = SERVICE.getValue(svc)
}

val ARTISANS = listOf(
    Artisan("a1", "Chinwe Okafor", "CO", "clean", 296f, 444f, 4.9, 212, 340, 15000, "per visit", true, true, bio = "Deep cleans, post-construction and move-in cleans. Brings her own supplies and works with one assistant on large homes."),
    Artisan("a2", "Tunde Bakare", "TB", "plumb", 452f, 470f, 4.8, 156, 228, 8000, "call-out", true, true, bio = "Leaks, blocked drains, water heaters and borehole pumps. Nine years in Lekki and Ikoyi estates."),
    Artisan("a3", "Mama Tolu Laundry", "MT", "laundry", 244f, 596f, 4.7, 390, 1210, 600, "per item", true, true, laundry = true, bio = "Wash, iron and fold. Free pickup and delivery within 4 km. Native wear and agbada handled separately."),
    Artisan("a4", "Emeka Nwosu", "EN", "elec", 436f, 612f, 4.9, 98, 150, 7000, "call-out", true, true, bio = "Wiring, sockets, inverters and prepaid meter faults."),
    Artisan("a5", "Ibrahim Musa", "IM", "ac", 526f, 384f, 4.6, 74, 96, 12000, "per unit", false, true, bio = "Split unit servicing, gas refill and installation."),
    Artisan("a6", "Kemi Adeyemi", "KA", "cook", 214f, 356f, 5.0, 41, 60, 25000, "per day", true, true, bio = "Nigerian and continental home cooking, weekly meal prep and small events."),
    Artisan("a7", "Segun Alade", "SA", "gen", 566f, 646f, 4.7, 133, 210, 10000, "call-out", true, true, bio = "Generator servicing, rewinding and changeover switches."),
    Artisan("a8", "Bisi Laundromat", "BL", "laundry", 404f, 300f, 4.8, 205, 880, 700, "per item", false, true, laundry = true, bio = "Dry cleaning and same-day express laundry."),
    Artisan("a9", "Yusuf Danjuma", "YD", "repair", 322f, 704f, 4.5, 60, 85, 6000, "call-out", true, false, bio = "Carpentry, door locks, furniture assembly and wall mounting."),
    Artisan("a10", "Ada Clean Co.", "AC", "clean", 612f, 504f, 4.8, 180, 300, 18000, "per visit", true, true, bio = "Team of three for large homes and offices."),
)

fun artisan(id: String?): Artisan? = ARTISANS.firstOrNull { it.id == id }

/** Service options per category; each is priced at the artisan's "from" × [MULT]. */
val OPTIONS = mapOf(
    "clean" to listOf("Standard clean", "Deep clean", "Move-in or move-out"),
    "plumb" to listOf("Leak repair", "Unblock a drain", "Water heater fix"),
    "elec" to listOf("Fault finding", "Socket or switch", "Inverter install"),
    "ac" to listOf("AC service", "Gas refill", "New installation"),
    "cook" to listOf("Single meal", "Full day", "Weekly meal prep"),
    "gen" to listOf("Routine service", "Fault repair", "Changeover switch"),
    "repair" to listOf("Small fix", "Furniture assembly", "Door and lock"),
)
val MULT = listOf(1.0, 1.7, 2.6)

/** Rounds to the nearest ₦500, as the prototype does. */
fun optionPrice(a: Artisan, i: Int): Int = (a.from * MULT[i] / 500).roundToInt() * 500

val LAUNDRY_ITEMS = listOf("Shirts" to 600, "Trousers" to 700, "Bedsheets" to 1200, "Native wear" to 1500)
val PICKUP_WINDOWS = listOf("Today, 4–6 pm", "Tomorrow, 8–10 am", "Tomorrow, 12–2 pm")
val WHENS = listOf("Now" to "Arrives in ~{eta} min", "Later today" to "Pick a time", "Schedule" to "Another day")
val SLOTS = listOf("12:00", "14:00", "16:00", "18:00")
const val EXPRESS_FEE = 2000
const val SERVICE_FEE = 0.05

data class Review(val name: String, val stars: Int, val text: String, val ago: String)
val REVIEWS = listOf(
    Review("Amaka O.", 5, "Came on time and left the place clean.", "2 weeks ago"),
    Review("Femi A.", 4, "Good work. The price matched the estimate.", "1 month ago"),
)

val SERVICE_STEPS = listOf("Booked", "On the way", "Arrived", "Working", "Done")
val LAUNDRY_STEPS = listOf("Booked", "Rider coming", "Picked up", "Washing", "Delivering", "Delivered")

data class Zone(val x: Float, val y: Float, val r: Float, val label: String)
val DEMAND_ZONES = listOf(Zone(470f, 430f, 80f, "High demand"), Zone(230f, 330f, 60f, "Busy"), Zone(560f, 680f, 56f, "Busy"))

val WEEK = listOf("M" to 12400, "T" to 18600, "W" to 9200, "T" to 22800, "F" to 15600, "S" to 0)

val REVIEW_TAGS = listOf("On time", "Tidy", "Fair price", "Friendly", "Explained the work")

data class Scheduled(val day: String, val month: String, val title: String, val sub: String, val price: String)
val ARTISAN_SCHEDULE = listOf(
    Scheduled("06", "Oct", "Borehole pump check", "Mr Okeke · Ikoyi · 10:00", "₦12,000"),
    Scheduled("08", "Oct", "Install water heater", "Ngozi E. · Lekki · 14:00", "₦18,000"),
)

/** ₦ with thousands separators, e.g. ₦28,000 (prototype: toLocaleString('en-NG')). */
fun naira(n: Number): String {
    val v = Math.round(n.toDouble())
    val digits = kotlin.math.abs(v).toString().reversed().chunked(3).joinToString(",").reversed()
    return (if (v < 0) "−₦" else "₦") + digits
}

fun pad2(n: Int) = n.toString().padStart(2, '0')

/** Hides phone numbers, emails and links in chat so payment stays on Lezerv. */
fun maskContacts(t: String): String = t
    .replace(Regex("[\\w.+-]+@[\\w-]+\\.[\\w.]+"), "[email hidden]")
    .replace(Regex("(https?://|www\\.)\\S+", RegexOption.IGNORE_CASE), "[link hidden]")
    .replace(Regex("\\+?\\d[\\d\\s-]{6,}\\d"), "[number hidden]")

/** One decimal place, locale-independent (JS `toFixed(1)`); "%.1f" would print "2,5" on some phones. */
fun fixed1(d: Double): String {
    val r = Math.round(d * 10)
    return "${r / 10}.${kotlin.math.abs(r % 10)}"
}

// ───────────── from the Board (early prototype): launch, notifications, onboarding, payouts ─────────────

const val SPLASH_MS = 1400L

/** Inbox the demo starts with. New ones are added as bookings and jobs progress. */
val SEED_NOTICES = listOf(
    com.lezerv.app.state.Notice(1, com.lezerv.app.state.Role.Client, "Tunde: Is the leak under the sink?", "New message about your plumbing request", "09:12", com.lezerv.app.state.Route.Chat("a2"), "Reply"),
    com.lezerv.app.state.Notice(2, com.lezerv.app.state.Role.Client, "Payment released to Chinwe", "Deep clean · ₦28,000 · thanks for the review", "12 Sep", com.lezerv.app.state.Route.Chat("a1"), "Open chat", read = true),
    com.lezerv.app.state.Notice(3, com.lezerv.app.state.Role.Artisan, "You are approved", "Go online to start getting requests nearby.", "1h", com.lezerv.app.state.Route.ArtisanMap, "Go online"),
    com.lezerv.app.state.Notice(4, com.lezerv.app.state.Role.Artisan, "₦8,000 released", "Blocked shower drain · Femi A. confirmed", "Yesterday", com.lezerv.app.state.Route.Earnings, "View earnings", read = true),
)

/** ID type → required length (NIN 11 digits, voter's card VIN 19 chars, passport 9 chars). */
val ID_TYPES = listOf("NIN" to 11, "Voter’s card" to 19, "Passport" to 9)

data class KycDoc(val title: String, val hint: String, val icon: String)
val KYC_DOCS = listOf(
    KycDoc("Photo ID", "Front of the ID above", "file-text"),
    KycDoc("Proof of address", "Utility bill, last 3 months", "camera"),
    KycDoc("Passport photograph", "Face clearly visible", "user"),
)
val ONBOARDING_STEPS = listOf("Profile", "Verify", "Services", "Review")

/** Full name → short name used in labels like "GTBank ••4821". */
val BANKS = listOf(
    "Guaranty Trust Bank" to "GTBank", "Access Bank" to "Access", "Zenith Bank" to "Zenith", "First Bank" to "First Bank",
    "United Bank for Africa" to "UBA", "Opay" to "Opay", "Moniepoint" to "Moniepoint",
)

val DECLINE_REASONS = listOf("Too far from me", "Busy right now", "Not my kind of job", "Price too low")

// ───────────── from the first design (Lezerv App Deck) ─────────────

data class PayMethod(val title: String, val sub: String, val icon: String)
/** PROPOSAL: Paystack (card, bank transfer, USSD) once keys are connected. */
val PAY_METHODS = listOf(
    PayMethod("Bank transfer", "Pay from any Nigerian bank app", "landmark"),
    PayMethod("Card", "Verve, Mastercard, Visa", "credit-card"),
    PayMethod("USSD", "No data needed", "hash"),
)
const val PAID_THIS_MONTH = 112_000
const val AVAILABLE_BALANCE = 48_200
