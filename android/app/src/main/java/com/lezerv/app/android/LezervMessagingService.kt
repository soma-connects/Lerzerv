package com.lezerv.app.android

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives pushes from Firebase, even when the app is closed (Android starts this service).
 * Declared in AndroidManifest.xml.
 */
class LezervMessagingService : FirebaseMessagingService() {

    /** Google gave this phone a new token. If the app isn't running, it picks it up on next launch. */
    override fun onNewToken(token: String) {
        Push.onToken?.invoke(token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // On screen, Realtime has already shown it (request card, toast, inbox).
        if (Push.appVisible) return
        Push.show(this, message.data)
    }
}
