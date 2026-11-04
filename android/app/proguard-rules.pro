# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Keep serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

# Keep data classes used with Supabase / kotlinx.serialization
-keep class com.lezerv.app.data.remote.** { *; }

# MapLibre
-keep class org.maplibre.android.** { *; }

# Ktor OkHttp Engine
-keep class io.ktor.client.engine.okhttp.** { *; }
