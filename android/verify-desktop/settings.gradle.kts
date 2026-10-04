// Stand-alone Gradle build that compiles the app's shared Compose UI for the desktop JVM
// and renders every screen to PNG. It exists so the UI can be compiled and eyeballed
// without the Android SDK. Android Studio users can ignore this folder.
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}
dependencyResolutionManagement {
    repositories {
        // POM-only resolution: Compose's Gradle module metadata redirects a few modules to
        // androidx copies on Google's Maven, while the POMs point at Maven Central "-jvm" copies.
        mavenCentral { metadataSources { mavenPom(); artifact() } }
    }
}
rootProject.name = "lezerv-verify-desktop"
