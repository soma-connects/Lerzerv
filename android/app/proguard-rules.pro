# Lezerv ProGuard / R8 Rules for Release Builds

# KotlinX Serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,allowobfuscation,allowshrinking class * {
    <fields>;
}

# Keep serializable data classes in com.lezerv.app.data.remote
-keep class com.lezerv.app.data.remote.** { *; }

# Supabase & Ktor Client
-keep class io.github.jan.supabase.** { *; }
-keep class io.ktor.** { *; }

# MapLibre Native SDK
-keep class org.maplibre.android.** { *; }
-dontwarn org.maplibre.android.**

# Android Architecture & Jetpack Compose
-keep class androidx.compose.** { *; }
-dontwarn androidx.compose.**
