package com.lezerv.verify

import com.lezerv.app.data.remote.BackendConfig
import com.lezerv.app.data.remote.AddressDto
import com.lezerv.app.data.remote.Booking
import com.lezerv.app.data.remote.ServerMessage
import com.lezerv.app.data.remote.SupabaseApi
import com.lezerv.app.data.remote.createLezervClient
import com.lezerv.app.data.remote.mapPosition
import com.lezerv.app.data.remote.shortDate
import com.lezerv.app.data.remote.toArtisan
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.request.HttpRequestData
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.content.OutgoingContent
import io.ktor.http.headersOf
import kotlinx.coroutines.runBlocking

/**
 * Checks the app's Supabase layer against simulated responses shaped like the real
 * database's (migrations 0001–0022 in soma-connects/Lerzerv). No network involved.
 * Run: gradle backendChecks
 */
fun main() = runBlocking {
    val sent = mutableListOf<String>()
    var mapArtisansExists = false
    val json = headersOf(HttpHeaders.ContentType, "application/json")

    fun bodyOf(r: HttpRequestData): String = (r.body as? OutgoingContent.ByteArrayContent)?.bytes()?.decodeToString() ?: ""

    val engine = MockEngine { r ->
        val path = r.url.encodedPath
        sent += "${r.method.value} $path?${r.url.encodedQuery} ${bodyOf(r)}"
        when {
            path == "/auth/v1/otp" -> respond("{}", HttpStatusCode.OK, json)
            path == "/auth/v1/verify" -> respond(SESSION, HttpStatusCode.OK, json)
            path == "/auth/v1/user" -> respond(USER, HttpStatusCode.OK, json)
            path == "/rest/v1/service_categories" -> respond(
                """[{"id":"c1","slug":"cleaning","name":"Cleaning","sort_order":10},{"id":"c2","slug":"plumbing","name":"Plumbing","sort_order":20}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/map_artisans" && !mapArtisansExists -> respond(
                """{"code":"PGRST202","details":"Searched for the function public.map_artisans","hint":null,"message":"Could not find the function public.map_artisans(p_lat, p_lng, p_radius_km) in the schema cache"}""",
                HttpStatusCode.NotFound, json)
            path == "/rest/v1/rpc/map_artisans" -> respond(
                """[{"id":"7f3e","display_name":"Tunde Bakare","bio":"Leaks and drains.","city":"Lagos","avatar_url":null,"years_experience":9,"is_verified":true,"is_available":true,"avg_rating":4.83,"total_reviews":156,"completed_jobs":228,"distance_km":0.9,"lat":6.45,"lng":3.48,"categories":["plumbing"]}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/search_artisans" -> respond(
                """[{"id":"7f3e","display_name":"Tunde Bakare","bio":null,"city":"Lagos","avatar_url":null,"years_experience":9,"is_verified":true,"avg_rating":4.8,"total_reviews":156,"completed_jobs":228,"distance_km":0.9,"categories":["plumbing","borehole-water"]}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/get_artisan_public" && bodyOf(r).contains("missing") -> respond("null", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/get_artisan_public" -> respond(
                """{"id":"7f3e","display_name":"Tunde Bakare","bio":"Leaks.","city":"Lagos","avatar_url":null,"years_experience":9,"is_verified":true,"avg_rating":4.8,"total_reviews":2,"completed_jobs":228,"categories":[{"slug":"plumbing","name":"Plumbing"}],"reviews":[{"rating":5,"comment":"On time.","created_at":"2026-09-12T10:22:00+00:00","reviewer":"Amaka"}]}""", HttpStatusCode.OK, json)
            path == "/rest/v1/service_jobs" -> respond(
                """[{"id":"j1","title":"Leak repair","description":null,"status":"assigned","scheduled_for":null,"created_at":"2026-10-05T09:00:00+00:00","address_text":"12 Admiralty Way","budget_note":null,"quoted_amount":null,"agreed_amount":null,"assigned_artisan_id":"7f3e","category":{"slug":"plumbing","name":"Plumbing"},"artisan":{"display_name":"Tunde Bakare"}}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/book_artisan" -> respond(
                """{"id":"j2","client_id":"user-1","category_id":"c2","area_id":"a1","title":"Leak repair","description":null,"address_text":"Ikate","scheduled_for":null,"budget_note":"App estimate ₦15,750","status":"assigned","assigned_artisan_id":"7f3e","requested_artisan_id":"7f3e","offer_expires_at":"2026-10-05T09:05:30+00:00","offer_accepted_at":null,"job_number":1042,"details":{"estimate":"₦15,750"},"created_at":"2026-10-05T09:05:00+00:00","updated_at":"2026-10-05T09:05:00+00:00"}""", HttpStatusCode.OK, json)
            path == "/rest/v1/client_addresses" && r.method.value == "GET" -> respond(
                """[{"id":"addr1","label":"Home","street":"4 Bishop Aboyade Cole St","area":"Ikate","area_slug":"lekki","note":null}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/client_addresses" && r.method.value == "POST" -> respond(
                """[{"id":"addr2","label":"Work","street":"1 Ozumba Mbadiwe","area":"Ikoyi","area_slug":"ikoyi","note":"Reception"}]""", HttpStatusCode.Created, json)
            path == "/rest/v1/client_addresses" && r.method.value == "PATCH" -> respond(
                """[{"id":"addr1","label":"Home","street":"5 Bishop Aboyade Cole St","area":"Ikate","area_slug":"lekki","note":null}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/job_private" -> respond("""[{"job_id":"j2","start_code":"0427"}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/expire_job_offers" -> respond("1", HttpStatusCode.OK, json)
            path == "/rest/v1/artisans" && r.method.value == "GET" -> respond(
                """[{"id":"7f3e","display_name":"Tunde Bakare","status":"approved","is_available":true,"service_radius_km":7,"avg_rating":4.83,"is_verified":true}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/artisans" && r.method.value == "PATCH" -> respond("", HttpStatusCode.NoContent, json)
            path == "/rest/v1/rpc/set_artisan_availability" -> respond("", HttpStatusCode.NoContent, json)
            path == "/rest/v1/rpc/my_artisan_jobs" -> respond(
                """[{"id":"j2","job_number":1042,"title":"Leak repair","description":null,"status":"assigned","category_slug":"plumbing","category_name":"Plumbing","area_name":"Lekki","address_text":"Ikate","scheduled_for":null,"budget_note":"App estimate ₦15,750","details":{"estimate":"₦15,750","when":"Now"},"offer_expires_at":"2026-10-05T09:05:30+00:00","offer_accepted_at":null,"started_at":null,"completed_at":null,"created_at":"2026-10-05T09:05:00+00:00","quoted_amount":null,"agreed_amount":null,"client_first_name":"Amaka","conversation_id":null}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/accept_job_offer" -> respond(
                """{"code":"P0001","details":null,"hint":null,"message":"too late — this request has expired"}""", HttpStatusCode.BadRequest, json)
            path == "/rest/v1/rpc/register_device" || path == "/rest/v1/rpc/unregister_device" -> respond("", HttpStatusCode.NoContent, json)
            path == "/rest/v1/rpc/start_job" -> respond("""{"started": false, "attempts_left": 3}""", HttpStatusCode.OK, json)
            path == "/rest/v1/conversations" -> respond(
                """[{"id":"conv1","job_id":"j1","artisan_id":"7f3e","last_message_at":"2026-10-05T09:12:00+00:00","artisan":{"display_name":"Tunde Bakare"},"job":{"title":"Leak repair"}}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/messages" -> respond(
                """[{"id":"m1","conversation_id":"conv1","sender_id":null,"body":"You have been matched for this job.","is_system":true,"created_at":"2026-10-05T09:10:00+00:00"}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/send_message" -> respond(
                """{"id":"m2","conversation_id":"conv1","sender_id":"user-1","body":"Call me on [contact hidden]","is_system":false,"created_at":"2026-10-05T09:13:00+00:00"}""", HttpStatusCode.OK, json)
            path == "/rest/v1/notifications" && r.method.value == "PATCH" -> respond("", HttpStatusCode.NoContent, json)
            path == "/rest/v1/notifications" -> respond(
                """[{"id":"n1","user_id":"user-1","type":"job_assigned","title":"Artisan assigned","body":"We matched an artisan to \"Leak repair\".","link":"/my-jobs","read":false,"created_at":"2026-10-05T09:10:00+00:00"}]""", HttpStatusCode.OK, json)
            path == "/rest/v1/rpc/open_support_ticket" && bodyOf(r).contains("\"p_subject\":\"Hi\"") -> respond(
                """{"code":"P0001","details":null,"hint":null,"message":"please describe the issue in a few more words"}""", HttpStatusCode.BadRequest, json)
            path == "/rest/v1/rpc/open_support_ticket" -> respond(
                """{"id":"t1","user_id":"user-1","name":"Amaka Obi","email":null,"phone":"2348035554417","subject":"Work not finished: still dripping","topic":"job","source":"app","status":"open","transcript":[],"page_path":null,"last_reply_at":null,"created_at":"2026-10-05T09:20:00+00:00","updated_at":"2026-10-05T09:20:00+00:00","job_id":"j1"}""", HttpStatusCode.OK, json)
            else -> respond("""{"message":"unexpected $path"}""", HttpStatusCode.NotFound, json)
        }
    }

    val api = SupabaseApi(createLezervClient(BackendConfig("https://test.supabase.co", "anon-key"), engine, persistSession = false))
    fun check(name: String, ok: Boolean) { println((if (ok) "PASS  " else "FAIL  ") + name); if (!ok) error("check failed: $name") }

    // sign-in
    api.sendPhoneCode("+2348035554417")
    check("phone code requested from /auth/v1/otp", sent.last().startsWith("POST /auth/v1/otp") && sent.last().contains("2348035554417"))
    val uid = api.verifyPhoneCode("+2348035554417", "123456")
    check("verifying the code signs in", uid == "user-1")

    // browsing
    val cats = api.categories()
    check("categories parsed in order", cats.map { it.slug } == listOf("cleaning", "plumbing"))
    check("only active categories asked for", sent.last().contains("is_active=eq.true"))

    val fallback = api.artisansNear(6.4478, 3.4723, 10)
    check("without 0022, falls back to search_artisans", fallback.size == 1 && sent.last().contains("/rpc/search_artisans") && fallback[0].lat == null)
    val a1 = fallback[0].toArtisan()
    check("fallback artisan maps to the plumbing chip, shown approximately", a1.svc == "plumb" && a1.name == "Tunde Bakare" && a1.bio.contains("9 years"))
    val (fx, fy) = mapPosition(fallback[0])
    val fdist = kotlin.math.hypot((fx - 360f).toDouble(), (fy - 520f).toDouble()) / 120
    check("fallback pin sits at the reported distance (0.9 km)", kotlin.math.abs(fdist - 0.9) < 0.01)

    mapArtisansExists = true
    val near = api.artisansNear(6.4478, 3.4723, 10)
    check("with 0022, map_artisans gives rounded positions", near[0].lat == 6.45 && near[0].lng == 3.48 && sent.last().contains("\"p_radius_km\":10"))
    val a2 = near[0].toArtisan()
    check("rating rounded for display, verified kept", a2.rating == 4.8 && a2.verified && a2.online)

    val profile = api.artisanProfile("7f3e")
    check("get_artisan_public parsed with reviews", profile?.reviews?.single()?.reviewer == "Amaka" && shortDate(profile.reviews.single().createdAt) == "12 Sep")
    check("unknown artisan returns null, not a crash", api.artisanProfile("missing") == null)

    // jobs
    val jobs = api.myJobs()
    check("jobs filtered to me with category + artisan embedded", jobs.single().artisan?.displayName == "Tunde Bakare" &&
        sent.last().contains("client_id=eq.user-1") && (sent.last().contains("artisans%21assigned_artisan_id") || sent.last().contains("artisans!assigned_artisan_id")))
    check("jobs ask for the offer columns and name each artisan link",
        sent.last().contains("offer_expires_at") && (sent.last().contains("artisans%21requested_artisan_id") || sent.last().contains("artisans!requested_artisan_id")))

    // saved addresses
    check("addresses load", api.addresses().single().areaSlug == "lekki")
    val added = api.saveAddress(AddressDto(label = "Work", street = "1 Ozumba Mbadiwe", area = "Ikoyi", areaSlug = "ikoyi", note = "Reception"))
    check("a new address is inserted and the saved row returned", added.id == "addr2" && sent.last().startsWith("POST /rest/v1/client_addresses") && sent.last().contains("\"area_slug\":\"ikoyi\""))
    val edited = api.saveAddress(AddressDto("addr1", "Home", "5 Bishop Aboyade Cole St", "Ikate", "lekki"))
    check("an existing one is updated by id", edited.street.startsWith("5 ") && sent.last().startsWith("PATCH /rest/v1/client_addresses?") && sent.last().contains("id=eq.addr1"))

    // booking
    val booked = api.bookArtisan(Booking("7f3e", "plumbing", "Leak repair", "addr1", null, null, "App estimate ₦15,750", mapOf("estimate" to "₦15,750")))
    check("book_artisan gets the artisan, address and details; the offer comes back", booked.offerPending && booked.jobNumber == 1042L &&
        sent.last().contains("\"p_artisan_id\":\"7f3e\"") && sent.last().contains("\"p_address_id\":\"addr1\"") && sent.last().contains("\"p_details\":{\"estimate\":\"₦15,750\"}"))
    check("start codes are read from job_private", api.startCodes() == mapOf("j2" to "0427") && (sent.last().contains("select=job_id%2Cstart_code") || sent.last().contains("select=job_id,start_code")))
    api.expireOffers()
    check("expire_job_offers is a plain RPC call", sent.last().startsWith("POST /rest/v1/rpc/expire_job_offers"))

    // the artisan side
    val meA = api.myArtisan()
    check("an artisan's own profile is found by user id", meA?.isAvailable == true && meA.serviceRadiusKm == 7 && sent.last().contains("user_id=eq.user-1"))
    api.setAvailability(false)
    check("going offline calls set_artisan_availability", sent.last().startsWith("POST /rest/v1/rpc/set_artisan_availability") && sent.last().contains("\"p_available\":false"))
    api.setRadius(7)
    check("the radius is a PATCH on the artisan's own row", sent.last().startsWith("PATCH /rest/v1/artisans?") && sent.last().contains("\"service_radius_km\":7"))
    val offer = api.artisanJobs().single()
    check("my_artisan_jobs parsed, details readable", offer.offerPending && offer.clientFirstName == "Amaka" && offer.detail("when") == "Now" && offer.detail("estimate") == "₦15,750")
    val late = runCatching { api.acceptOffer("j2") }.exceptionOrNull()
    check("a late accept comes back in the server's words", late is ServerMessage && late.message == "too late — this request has expired")
    val start = api.startJob("j2", "1111")
    check("a wrong start code is a result, not an error", !start.started && start.attemptsLeft == 3 && sent.last().contains("\"p_code\":\"1111\""))

    // chat
    val conv = api.conversations().single()
    check("conversations parsed, with the artisan's id", conv.job?.title == "Leak repair" && conv.artisanId == "7f3e" && sent.last().contains("artisan_id"))
    check("system lines recognised", api.messages("conv1").single().isSystem)
    val m = api.sendMessage("conv1", "Call me on 0803 555 4417")
    check("send_message returns the server-redacted text", m.body.contains("[contact hidden]") && sent.last().contains("/rpc/send_message"))

    // notifications
    val n = api.notifications()
    check("notifications parsed", n.single().type == "job_assigned" && !n.single().read)
    api.markNotificationRead("n1")
    check("mark read is a PATCH on that row", sent.last().startsWith("PATCH /rest/v1/notifications?id=eq.n1") && sent.last().contains("\"read\":true"))
    api.markAllNotificationsRead()
    check("mark all read: one PATCH on my unread rows", sent.last().startsWith("PATCH /rest/v1/notifications?") && sent.last().contains("user_id=eq.user-1") && sent.last().contains("read=eq.false"))

    // push
    api.registerDevice("fcm-token-abc", "0.2.0")
    check("register_device gets the token, platform and app version", sent.last().startsWith("POST /rest/v1/rpc/register_device") &&
        sent.last().contains("\"p_token\":\"fcm-token-abc\"") && sent.last().contains("\"p_platform\":\"android\"") && sent.last().contains("\"p_app_version\":\"0.2.0\""))
    api.unregisterDevice("fcm-token-abc")
    check("unregister_device names the token", sent.last().startsWith("POST /rest/v1/rpc/unregister_device") && sent.last().contains("\"p_token\":\"fcm-token-abc\""))

    // support
    val t = api.openTicket("Work not finished: still dripping", "j1")
    check("open_support_ticket links the job", t.jobId == "j1" && sent.last().contains("\"p_job_id\":\"j1\""))
    val refused = runCatching { api.openTicket("Hi", null) }.exceptionOrNull()
    check("a database 'raise exception' (P0001) arrives as a readable ServerMessage", refused is ServerMessage && refused.message == "please describe the issue in a few more words")

    println("\nAll ${sent.size} requests looked as the backend expects.")
}

private const val USER = """{"id":"user-1","aud":"authenticated","role":"authenticated","email":null,"phone":"2348035554417","created_at":"2026-10-05T08:00:00Z","app_metadata":{"provider":"phone"},"user_metadata":{}}"""
private const val SESSION = """{"access_token":"test-token","token_type":"bearer","expires_in":3600,"expires_at":4102444800,"refresh_token":"r1","user":$USER}"""
