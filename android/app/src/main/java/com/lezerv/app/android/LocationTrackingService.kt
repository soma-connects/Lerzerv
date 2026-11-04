package com.lezerv.app.android

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.lezerv.app.BuildConfig
import com.lezerv.app.R
import com.lezerv.app.android.LezervApplication
import com.lezerv.app.android.MainActivity
import com.lezerv.app.data.remote.BackendConfig
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.SupabaseApi
import com.lezerv.app.data.remote.createLezervClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Segment S5b: Foreground Service for streaming artisan GPS coordinates during active en-route jobs.
 * Complies with Android 14/15/16 (API 34/35/36) FOREGROUND_SERVICE_LOCATION requirements:
 * - Declares foregroundServiceType="location"
 * - Maintains active ongoing low-priority notification
 * - Uses partial wake lock with fail-safe expiration
 * - Streams telemetry every 4 seconds to the backend via record_job_location RPC
 * - Automatically terminates when artisan arrives or job concludes
 */
class LocationTrackingService : Service(), LocationListener {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var locationManager: LocationManager
    private var wakeLock: PowerManager.WakeLock? = null

    private var activeJobId: String? = null
    private var clientName: String? = null
    private var destinationAddress: String? = null

    private val api: LezervApi?
        get() = apiOverride ?: LezervApplication.api ?: run {
            val backend = BackendConfig(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
            if (backend.isSet) SupabaseApi(createLezervClient(backend)).also { LezervApplication.api = it } else null
        }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_STOP_TRACKING) {
            stopTracking()
            return START_NOT_STICKY
        }

        activeJobId = intent?.getStringExtra(EXTRA_JOB_ID)
        clientName = intent?.getStringExtra(EXTRA_CLIENT_NAME) ?: "Client"
        destinationAddress = intent?.getStringExtra(EXTRA_DESTINATION) ?: "Destination"

        if (activeJobId.isNullOrEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }

        val fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) {
            stopSelf()
            return START_NOT_STICKY
        }

        acquireWakeLock()

        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }

        startLocationUpdates()
        return START_REDELIVER_INTENT
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        val provider = when {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            locationManager.isProviderEnabled("fused") -> "fused"
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> LocationManager.PASSIVE_PROVIDER
        }

        try {
            locationManager.requestLocationUpdates(
                provider,
                UPDATE_INTERVAL_MS,
                MIN_DISTANCE_M,
                this,
                Looper.getMainLooper()
            )
        } catch (_: SecurityException) {
            stopSelf()
        }
    }

    override fun onLocationChanged(loc: Location) {
        if (!loc.hasAccuracy() || loc.accuracy > MAX_ACCEPTABLE_ACCURACY_M) return

        val jobId = activeJobId ?: return
        val heading = if (loc.hasBearing()) loc.bearing.toDouble() else null
        val speed = if (loc.hasSpeed()) loc.speed.toDouble() else null
        val accuracy = loc.accuracy.toDouble()

        serviceScope.launch {
            try {
                api?.recordJobLocation(
                    jobId = jobId,
                    lat = loc.latitude,
                    lng = loc.longitude,
                    heading = heading,
                    speed = speed,
                    accuracy = accuracy
                )
            } catch (_: Exception) {
                // Ignore transient cellular drops; next GPS tick will re-attempt
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) { }

    override fun onProviderEnabled(provider: String) { }

    override fun onProviderDisabled(provider: String) { }

    private fun acquireWakeLock() {
        if (wakeLock == null) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Lezerv:LocationTrackingWakeLock").apply {
                setReferenceCounted(false)
                acquire(MAX_WAKELOCK_DURATION_MS)
            }
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
        wakeLock = null
    }

    private fun stopTracking() {
        try {
            locationManager.removeUpdates(this)
        } catch (_: Exception) { }
        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopTracking()
        serviceScope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Heading to $clientName")
            .setContentText("Sharing live location · $destinationAddress")
            .setSmallIcon(R.drawable.ic_stat_lezerv)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Live Job Navigation",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notifies when active job GPS streaming is running"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val ACTION_START_TRACKING = "com.lezerv.app.action.START_TRACKING"
        const val ACTION_STOP_TRACKING = "com.lezerv.app.action.STOP_TRACKING"
        const val EXTRA_JOB_ID = "extra_job_id"
        const val EXTRA_CLIENT_NAME = "extra_client_name"
        const val EXTRA_DESTINATION = "extra_destination"

        private const val NOTIFICATION_ID = 4001
        private const val CHANNEL_ID = "job_tracking_channel"
        private const val UPDATE_INTERVAL_MS = 4000L        // 4 seconds
        private const val MIN_DISTANCE_M = 3.0f             // 3 meters
        private const val MAX_ACCEPTABLE_ACCURACY_M = 35.0f   // Filter inaccurate tower fixes
        private const val MAX_WAKELOCK_DURATION_MS = 3 * 60 * 60 * 1000L // 3-hour fail-safe

        var apiOverride: LezervApi? = null

        fun start(context: Context, jobId: String, clientName: String, destination: String) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = ACTION_START_TRACKING
                putExtra(EXTRA_JOB_ID, jobId)
                putExtra(EXTRA_CLIENT_NAME, clientName)
                putExtra(EXTRA_DESTINATION, destination)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, LocationTrackingService::class.java).apply {
                action = ACTION_STOP_TRACKING
            }
            context.startService(intent)
        }
    }
}
