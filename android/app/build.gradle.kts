import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization) // turns the backend's JSON into Kotlin classes (data/remote/Dtos.kt)
}

// Backend settings come from local.properties, which is never committed:
//   supabase.url=https://<project>.supabase.co
//   supabase.anonKey=<the project's anon public key>
// Without them the app runs on sample data only. (The anon key is public by design:
// row-level security on the database decides what each user may read and write.)
//
// Push notifications (optional) need four values from the Firebase console
// (Project settings → General → Your apps → the Android app):
//   firebase.projectId=…   firebase.appId=1:…:android:…   firebase.apiKey=…   firebase.senderId=…
// Without them the app works the same, just without pushes.
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use(::load)
}
fun localProp(key: String): String = localProps.getProperty(key, "").trim()

android {
    namespace = "com.lezerv.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lezerv.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"

        // Demo mode: sample data plus the prototype helpers (role switch in Account,
        // "Prototype · skip ahead", "Demo: fill 4827", Reset). Turn off once the backend
        // drives job stages and accounts.
        buildConfigField("boolean", "DEMO_MODE", "true")
        buildConfigField("String", "SUPABASE_URL", "\"${localProp("supabase.url")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProp("supabase.anonKey")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${localProp("firebase.projectId")}\"")
        buildConfigField("String", "FIREBASE_APP_ID", "\"${localProp("firebase.appId")}\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"${localProp("firebase.apiKey")}\"")
        buildConfigField("String", "FIREBASE_SENDER_ID", "\"${localProp("firebase.senderId")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    // Backend: Supabase (database, sign-in, realtime) over Ktor's OkHttp engine.
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.auth)
    implementation(libs.supabase.realtime)
    implementation(libs.ktor.client.okhttp)
    // Push notifications: Firebase Cloud Messaging (set up from local.properties, see above).
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
}
