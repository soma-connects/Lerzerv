package com.lezerv.app.android

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.lezerv.app.BuildConfig
import com.lezerv.app.R
import com.lezerv.app.data.remote.BackendConfig
import com.lezerv.app.data.remote.SupabaseApi
import com.lezerv.app.data.remote.createLezervClient
import com.lezerv.app.state.LezervState
import com.lezerv.app.ui.LezervApp
import com.lezerv.app.ui.theme.LzFonts

/**
 * Holds the app state across configuration changes (rotation, dark-mode toggle…),
 * which would otherwise recreate the Activity and lose an in-progress booking.
 */
class MainViewModel : ViewModel() {
    private val backend = BackendConfig(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)

    val state: LezervState = if (backend.isSet) {
        // Live: real artisans, sign-in, jobs, chat and notifications. Starts as a guest,
        // or as whoever signed in last time. viewModelScope stops its work when the app closes.
        LezervState(demo = BuildConfig.DEMO_MODE).also { it.connect(SupabaseApi(createLezervClient(backend)), viewModelScope) }
    } else {
        // Sample data: the demo build starts signed in as the sample user (Settings → Log out
        // shows sign-in); a non-demo build starts as a guest who can look around first.
        LezervState(demo = BuildConfig.DEMO_MODE, signedIn = BuildConfig.DEMO_MODE)
    }
}

private val fonts = LzFonts(
    heading = FontFamily(
        Font(R.font.barlow_condensed_medium, FontWeight.Medium),
        Font(R.font.barlow_condensed_semibold, FontWeight.SemiBold),
        Font(R.font.barlow_condensed_bold, FontWeight.Bold),
    ),
    body = FontFamily(
        Font(R.font.archivo_regular, FontWeight.Normal),
        Font(R.font.archivo_medium, FontWeight.Medium),
        Font(R.font.archivo_semibold, FontWeight.SemiBold),
        Font(R.font.archivo_bold, FontWeight.Bold),
    ),
)

class MainActivity : ComponentActivity() {
    // Android 13+ asks the user before an app may post notifications.
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    private lateinit var connectivity: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private lateinit var appState: LezervState

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val state = androidx.lifecycle.ViewModelProvider(this)[MainViewModel::class.java].state
        appState = state
        state.requestNotificationPermission = {
            if (Build.VERSION.SDK_INT >= 33) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
        // Opens the dialer with the number filled in; the user presses call (no permission needed).
        state.dial = { number -> startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number"))) }
        // Google Maps (or any maps app) at the client's address, for real directions.
        state.openMaps = { address ->
            val geo = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode("$address, Lagos")))
            try { startActivity(geo) } catch (_: android.content.ActivityNotFoundException) { state.toast("Install a maps app for directions") }
        }
        // Android's share sheet: WhatsApp, SMS, email…
        state.share = { text ->
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            startActivity(Intent.createChooser(send, null))
        }
        watchNetwork(state)
        // Draw behind the system bars with dark icons on the light Lezerv ground.
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent {
            // System back: close sheets, pop pushed screens, then return to the home tab.
            BackHandler(enabled = state.canGoBack) { state.back() }
            // safeDrawingPadding keeps content clear of the status bar, gesture bar and keyboard.
            LezervApp(state, fonts, Modifier.safeDrawingPadding())
        }
    }

    /** Feeds real connectivity into the offline banner and the queued-message retry. */
    private fun watchNetwork(state: LezervState) {
        connectivity = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        fun online() = connectivity.getNetworkCapabilities(connectivity.activeNetwork)?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
        state.updateOffline(!online())
        val cb = object : ConnectivityManager.NetworkCallback() {
            // Callbacks arrive on a background thread; hop to the main thread before touching UI state.
            override fun onAvailable(network: Network) { runOnUiThread { state.updateOffline(false) } }
            override fun onLost(network: Network) { runOnUiThread { state.updateOffline(!online()) } }
        }
        connectivity.registerDefaultNetworkCallback(cb)
        networkCallback = cb
    }

    override fun onDestroy() {
        networkCallback?.let(connectivity::unregisterNetworkCallback)
        // The ViewModel outlives this Activity; don't leave it holding a launcher from a dead one.
        appState.requestNotificationPermission = null
        appState.dial = null
        appState.share = null
        appState.openMaps = null
        super.onDestroy()
    }
}
