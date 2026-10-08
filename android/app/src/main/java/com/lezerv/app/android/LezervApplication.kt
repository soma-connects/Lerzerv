package com.lezerv.app.android

import android.app.Application

/** Runs before any screen or service: sets up Firebase and the notification channels. */
class LezervApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Push.setUp(this)
    }
}
