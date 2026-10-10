import java.util.Properties
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

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
//
// The real map's look and data (optional): a MapLibre style URL. The default is OpenFreeMap's
// free "positron" style (OpenStreetMap data, no key). MapTiler, Stadia etc. work the same:
//   map.styleUrl=https://…/style.json
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use(::load)
}
fun localProp(key: String): String = localProps.getProperty(key, "").trim()

android {
    namespace = "com.lezerv.app"
    // Google Play requires new apps to target Android 16 (API 36) from 31 Aug 2026.
    compileSdk = 36

    defaultConfig {
        applicationId = "com.lezerv.app"
        minSdk = 26
        targetSdk = 36
        // Every upload to Play needs a higher versionCode; versionName is what people see.
        versionCode = 10
        versionName = "1.0.0"

        buildConfigField("String", "SUPABASE_URL", "\"${localProp("supabase.url")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProp("supabase.anonKey")}\"")
        buildConfigField("String", "FIREBASE_PROJECT_ID", "\"${localProp("firebase.projectId")}\"")
        buildConfigField("String", "FIREBASE_APP_ID", "\"${localProp("firebase.appId")}\"")
        buildConfigField("String", "FIREBASE_API_KEY", "\"${localProp("firebase.apiKey")}\"")
        buildConfigField("String", "FIREBASE_SENDER_ID", "\"${localProp("firebase.senderId")}\"")
        buildConfigField("String", "MAP_STYLE_URL", "\"${localProp("map.styleUrl").ifEmpty { "https://tiles.openfreemap.org/styles/positron" }}\"")
    }

    // The upload key that signs release builds for Google Play (see RELEASE.md). Its file
    // and passwords live in local.properties, never in git:
    //   release.storeFile=/path/to/lezerv-upload.jks
    //   release.storePassword=…   release.keyAlias=lezerv-upload   release.keyPassword=…
    signingConfigs {
        if (localProp("release.storeFile").isNotEmpty()) create("release") {
            storeFile = file(localProp("release.storeFile"))
            storePassword = localProp("release.storePassword")
            keyAlias = localProp("release.keyAlias")
            keyPassword = localProp("release.keyPassword")
        }
    }

    buildTypes {
        // Demo mode: the prototype helpers (role switch and Reset in Account, "Prototype ·
        // skip ahead", "Demo: fill 4827"), and sample data when no backend is set.
        // On for development builds, off for the store.
        debug {
            buildConfigField("boolean", "DEMO_MODE", "true")
        }
        release {
            buildConfigField("boolean", "DEMO_MODE", "false")
            // Shrinking stays off for the first release: Supabase, Ktor and MapLibre would
            // need keep rules, and an untested rule can break the app only in release.
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
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
    implementation(libs.androidx.lifecycle.runtime.compose) // LocalLifecycleOwner, for the map
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
    // The real map: MapLibre Native (open source) drawing OpenStreetMap data.
    implementation(libs.maplibre)
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}
