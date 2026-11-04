# R8 rules for release builds (isMinifyEnabled in app/build.gradle.kts).
#
# A missing rule only shows up in the release build, at the moment the code runs, so after
# changing this file install the release APK on a phone and walk through RELEASE.md section 3.
# kotlinx.serialization, Compose and AndroidX ship their own rules inside their jars.

-keepattributes *Annotation*, InnerClasses, Signature
-dontnote kotlinx.serialization.**

# Backend DTOs: Supabase decodes these by their @SerialName fields.
-keep class com.lezerv.app.data.remote.** { *; }

# Supabase: its plugins and response classes are created and decoded at run time.
-keep class io.github.jan.supabase.** { *; }

# Ktor finds its HTTP engine at run time; keep the one we ship.
-keep class io.ktor.client.engine.okhttp.** { *; }

# MapLibre: the native map library calls back into these classes from C++.
-keep class org.maplibre.android.** { *; }
-dontwarn org.maplibre.android.**
