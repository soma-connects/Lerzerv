package com.lezerv.app.android

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.lezerv.app.BuildConfig
import com.lezerv.app.R

/**
 * Firebase Cloud Messaging glue: setting Firebase up, the phone's token, the three
 * notification channels, and turning a push into a notification that opens the right screen.
 *
 * The backend sends data-only messages (supabase/functions/send-push), so the app always
 * builds the notification itself and controls its channel, tap target and expiry.
 */
object Push {
    const val EXTRA_TYPE = "lezerv.push.type"
    const val EXTRA_ID = "lezerv.push.id"

    /** True while MainActivity is on screen; Realtime already shows things then. */
    @Volatile var appVisible = false

    /** Where a rotated token goes while the app is running (MainActivity sets it). */
    @Volatile var onToken: ((String) -> Unit)? = null

    /** Firebase values come from local.properties (see README); without them push is off. */
    val configured: Boolean
        get() = listOf(BuildConfig.FIREBASE_PROJECT_ID, BuildConfig.FIREBASE_APP_ID, BuildConfig.FIREBASE_API_KEY, BuildConfig.FIREBASE_SENDER_ID).all { it.isNotBlank() }

    /** Called once from LezervApplication, before any activity or the messaging service runs. */
    fun setUp(context: Context) {
        createChannels(context)
        if (!configured || FirebaseApp.getApps(context).isNotEmpty()) return
        FirebaseApp.initializeApp(
            context,
            FirebaseOptions.Builder()
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .build(),
        )
    }

    /** The current token for this phone. The listener runs on the main thread. */
    fun requestToken(onToken: (String) -> Unit) {
        if (!configured) return
        FirebaseMessaging.getInstance().token.addOnSuccessListener { onToken(it) }
    }

    private val CHANNELS = setOf("requests", "jobs", "messages")

    /** People can mute each kind separately in Android's settings. Safe to call every launch. */
    private fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        nm.createNotificationChannels(
            listOf(
                NotificationChannel("requests", "Job requests", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "Clients booking you. You have seconds to accept." },
                NotificationChannel("jobs", "Your jobs", NotificationManager.IMPORTANCE_DEFAULT)
                    .apply { description = "Accepted, started, finished and cancelled jobs." },
                NotificationChannel("messages", "Messages", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "Chat with artisans, clients and Lezerv Support." },
            ),
        )
    }

    /** Shows one push. [data] is what send-push sent: type, title, body, notification_id, channel, ttl_seconds. */
    @SuppressLint("MissingPermission") // checked just below
    fun show(context: Context, data: Map<String, String>) {
        val type = data["type"] ?: return
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        val title = data["title"].orEmpty()
        val body = data["body"].orEmpty()
        val id = data["notification_id"].orEmpty()
        val channel = data["channel"]?.takeIf { it in CHANNELS } ?: "jobs"

        // Tapping opens the app (or brings it forward) with what the push is about.
        val open = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_TYPE, type)
            .putExtra(EXTRA_ID, id)
        val tap = PendingIntent.getActivity(context, id.hashCode(), open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        val notification = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_lezerv)
            .setColor(ContextCompat.getColor(context, R.color.lz_accent))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setPriority(if (channel == "jobs") NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_HIGH)
            .setCategory(if (channel == "messages") NotificationCompat.CATEGORY_MESSAGE else NotificationCompat.CATEGORY_EVENT)
            // A request disappears when its window closes, instead of tempting a tap that can only fail.
            .apply { data["ttl_seconds"]?.toLongOrNull()?.let { setTimeoutAfter(it * 1000) } }
            .build()
        NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
    }
}
