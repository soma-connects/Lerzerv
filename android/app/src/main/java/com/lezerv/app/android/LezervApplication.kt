package com.lezerv.app.android

import android.app.Application
import com.lezerv.app.BuildConfig
import com.lezerv.app.data.remote.BackendConfig
import com.lezerv.app.data.remote.LezervApi
import com.lezerv.app.data.remote.SupabaseApi
import com.lezerv.app.data.remote.createLezervClient

/** Runs before any screen or service: sets up Firebase and the notification channels. */
class LezervApplication : Application() {
    companion object {
        var api: LezervApi? = null
    }

    override fun onCreate() {
        super.onCreate()
        Push.setUp(this)
        val backend = BackendConfig(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
        if (backend.isSet) {
            api = SupabaseApi(createLezervClient(backend))
        }
    }
}
