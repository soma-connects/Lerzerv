package com.lezerv.app.state

import com.lezerv.app.data.GeoFix

/**
 * The phone's location service, as the app needs it. MainActivity provides Android's;
 * tests provide a pretend one. Keeping it behind this interface means the state code
 * never touches Android, so it runs (and is tested) on the desktop too.
 */
interface Locator {
    /** Whether Android lets the app read the location right now. */
    fun allowed(): Boolean
    /** Shows Android's "allow location?" dialog; [done] gets the answer. */
    fun ask(done: (Boolean) -> Unit)
    /** Where the phone is, or null when location is switched off or no fix came in time. */
    suspend fun locate(): GeoFix?
}
