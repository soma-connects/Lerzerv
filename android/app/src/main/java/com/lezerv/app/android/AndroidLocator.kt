package com.lezerv.app.android

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.lezerv.app.data.GeoFix
import com.lezerv.app.data.GeoPoint
import com.lezerv.app.state.Locator
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * The phone's location, through Android's own LocationManager.
 *
 * No Google Play services: it works the same on phones without them (Huawei, some Tecno and
 * Infinix models), and needs no extra library. "fused" (Android 12+) blends GPS, Wi-Fi and
 * cell towers like Google's version does; older phones fall back to GPS, then the network.
 *
 * Create it in onCreate: the permission dialog's result handler must be registered before
 * the activity starts.
 */
class AndroidLocator(private val activity: ComponentActivity) : Locator {
    private val manager = activity.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var pending: ((Boolean) -> Unit)? = null

    // Coarse (approximate) is enough for the map; Android 12+ lets people choose it.
    private val dialog = activity.registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { answers ->
        pending?.invoke(answers.values.any { it })
        pending = null
    }

    override fun allowed(): Boolean = PERMISSIONS.any { activity.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    override fun ask(done: (Boolean) -> Unit) {
        pending = done
        dialog.launch(PERMISSIONS)
    }

    @SuppressLint("MissingPermission") // allowed() is checked first; a permission revoked meanwhile throws, and is caught
    override suspend fun locate(): GeoFix? {
        if (!allowed()) return null
        val providers = PROVIDERS.filter { p -> runCatching { manager.isProviderEnabled(p) }.getOrDefault(false) }
        if (providers.isEmpty()) return null // location switched off in quick settings

        // A position from the last two minutes answers at once (another app may have just asked).
        val known = providers.mapNotNull { p -> runCatching { manager.getLastKnownLocation(p) }.getOrNull() }
        known.filter { System.currentTimeMillis() - it.time < FRESH_MS }.minByOrNull { it.accuracy }?.let { return it.toFix() }

        // Otherwise wait for a fresh one, but not forever (indoors, GPS can take a minute).
        // Before Android 12, GPS refuses an app that was only allowed an approximate location,
        // so each provider is tried in turn.
        val fresh = withTimeoutOrNull(WAIT_MS) {
            providers.firstNotNullOfOrNull { p ->
                try { current(p) } catch (e: CancellationException) { throw e } catch (_: Exception) { null }
            }
        }
        return (fresh ?: known.maxByOrNull { it.time })?.toFix()
    }

    @SuppressLint("MissingPermission")
    private suspend fun current(provider: String): Location? = suspendCancellableCoroutine { cont ->
        if (Build.VERSION.SDK_INT >= 30) {
            val cancel = CancellationSignal()
            cont.invokeOnCancellation { cancel.cancel() }
            manager.getCurrentLocation(provider, cancel, activity.mainExecutor) { loc -> if (cont.isActive) cont.resume(loc) }
        } else {
            // Before Android 11 every LocationListener method must be implemented, or a phone
            // that switches a provider off mid-request crashes with AbstractMethodError.
            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) { if (cont.isActive) cont.resume(location) }
                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(provider: String) {}
                override fun onProviderDisabled(provider: String) { if (cont.isActive) cont.resume(null) }
            }
            cont.invokeOnCancellation { manager.removeUpdates(listener) }
            @Suppress("DEPRECATION")
            manager.requestSingleUpdate(provider, listener, Looper.getMainLooper())
        }
    }

    private fun Location.toFix() = GeoFix(GeoPoint(latitude, longitude), accuracy)

    private companion object {
        val PERMISSIONS = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        /** Best first. "fused" exists from Android 12. */
        val PROVIDERS = listOf("fused", LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        const val FRESH_MS = 2 * 60_000L
        const val WAIT_MS = 10_000L
    }
}
