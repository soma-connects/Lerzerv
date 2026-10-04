plugins {
    kotlin("jvm") version "2.0.21"
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21"
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
dependencies {
    implementation("org.jetbrains.compose.foundation:foundation-desktop:$composeVersion")
    implementation("org.jetbrains.compose.ui:ui-desktop:$composeVersion")
    implementation("org.jetbrains.compose.runtime:runtime-desktop:$composeVersion")
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
