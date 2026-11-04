package com.lezerv.app.state

/**
 * Features that are built in the app but switched off when it talks to the real backend
 * (live mode), because something they need isn't ready yet. The demo build always shows
 * everything. Turn one on only once what its comment asks for is done and tested.
 */
object LiveFeatures {
    /** Paystack checkout, escrow, saved cards and the artisan payout account. Needs a Paystack
     *  account, the payments-init / paystack-webhook / bank-resolve functions deployed, and
     *  the payment review's fixes (amount check on the webhook, one payment per job, refunds). */
    const val payments = false

    /** Following the artisan on the map during a job (LocationTrackingService, job_locations).
     *  Needs a privacy-safe design (no exact position for clients), the privacy policy
     *  updated, and Google Play's foreground-service declaration. 0033 switched it off in
     *  the database. The Android service (LocationTrackingService, with its manifest entry and
     *  FOREGROUND_SERVICE_LOCATION permission) was taken out of the app until then: find it in
     *  git history on branch app/production-integration. */
    const val liveTracking = false

    /** Referral codes and rewards. Needs my_referral_code / apply_referral_code. */
    const val referrals = false

    /** Per-person notification switches. Needs my_notification_preferences /
     *  update_notification_preferences; until then the server sends every job update. */
    const val notificationPreferences = false

    /** Trusted contact and "share trip" links. Needs update_trusted_contact /
     *  create_share_trip_link. */
    const val trustedContact = false

    /** Signing up as an artisan inside the app (ID check form). Needs upsert_artisan_profile's
     *  real parameters and document upload; until then artisans apply on lezerv.com. */
    const val artisanSignUp = false

    /** Deleting the account at once through the delete-account function. Needs the function
     *  deployed and the review's fixes (fail closed on any error, never delete the caller
     *  instead of the target, purge job photos). Until then the app sends a deletion request
     *  to the team, like lezerv.com/delete-account, and the account goes within 30 days. */
    const val accountDeletionFunction = false
}

/** Where artisans apply while [LiveFeatures.artisanSignUp] is off. */
const val ARTISAN_SIGN_UP_URL = "https://www.lezerv.com/become-artisan"
