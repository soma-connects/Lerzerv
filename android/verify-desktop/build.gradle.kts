plugins {
    kotlin("jvm") version "2.1.20"
    id("org.jetbrains.kotlin.plugin.compose") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
}

kotlin { jvmToolchain(21) }

// Compile the Android app's shared UI sources directly: everything under
// app/src/main/java/com/lezerv/app except the Android-only entry points.
sourceSets {
    main {
        kotlin {
            srcDir("../app/src/main/java")
            exclude("com/lezerv/app/android/**")
        }
    }
}

// Compose Multiplatform 1.5.12 is the newest release whose desktop artifacts all live on
// Maven Central (later ones pull androidx jars from Google's Maven). Only foundation/ui
// APIs are used by the app, and those are stable between 1.6 and current Android Compose.
val composeVersion = "1.5.12"
val supabaseVersion = "3.1.4"
dependencies {
    implementation("org.jetbrains.compose.foundation:foundation-desktop:$composeVersion")
    implementation("org.jetbrains.compose.ui:ui-desktop:$composeVersion")
    implementation("org.jetbrains.compose.runtime:runtime-desktop:$composeVersion")
    // Backend: same libraries as the Android app (all on Maven Central).
    implementation("io.github.jan-tennert.supabase:postgrest-kt-jvm:$supabaseVersion")
    implementation("io.github.jan-tennert.supabase:auth-kt-jvm:$supabaseVersion")
    implementation("io.github.jan-tennert.supabase:realtime-kt-jvm:$supabaseVersion")
    implementation("io.ktor:ktor-client-okhttp:3.1.2")
    implementation("io.ktor:ktor-client-mock:3.1.2") // simulated Supabase responses for the checks
    runtimeOnly("org.jetbrains.skiko:skiko-awt-runtime-linux-x64:0.7.85")
}

tasks.register<JavaExec>("renderScreens") {
    group = "verification"
    description = "Renders every Lezerv screen to build/screens/*.png"
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.lezerv.verify.RenderScreensKt")
    args(layout.buildDirectory.dir("screens").get().asFile.absolutePath, file("../app/src/main/res/font").absolutePath)
    systemProperty("java.awt.headless", "true")
}

tasks.register<JavaExec>("liveChecks") {
    group = "verification"
    description = "Drives the app in live mode against an in-memory fake backend"
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.lezerv.verify.LiveChecksKt")
}

tasks.register<JavaExec>("backendChecks") {
    group = "verification"
    description = "Checks the Supabase data layer against simulated backend responses"
    classpath = sourceSets["main"].runtimeClasspath
    mainClass.set("com.lezerv.verify.BackendChecksKt")
}
