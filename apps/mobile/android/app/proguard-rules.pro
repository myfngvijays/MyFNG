# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ---------- React Native ----------
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# ---------- react-native-reanimated ----------
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ---------- react-native-gesture-handler ----------
-keep class com.swmansion.gesturehandler.** { *; }

# ---------- Razorpay ----------
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/*
-keepclasseswithmembers class * {
    public void onPayment*(...);
}
-keep class proguard.annotation.Keep
-keep class proguard.annotation.KeepClassMembers
-keep @proguard.annotation.Keep class * { *; }
-keepclassmembers class * {
    @proguard.annotation.Keep *;
}

# ---------- Firebase / Google Play Services ----------
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ---------- Google Maps ----------
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.maps.**

# ---------- OkHttp / Okio (used by many RN libs) ----------
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ---------- Supabase / GoTrue (JS client; any native helpers) ----------
-dontwarn io.github.jan.supabase.**

# ---------- Expo ----------
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# ---------- Kotlin ----------
-keep class kotlin.** { *; }
-keep class kotlinx.** { *; }
-dontwarn kotlin.**
-dontwarn kotlinx.**

# ---------- Annotations / reflection ----------
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes SourceFile,LineNumberTable

# ---------- JVM-only classes (compile-time only, not available on Android) ----------
# KotlinPoet, JavaPoet and other code-gen libs reference javax.lang.model.* which
# only exists on the JVM. Safe to ignore on Android runtime.
-dontwarn javax.lang.model.**
-dontwarn javax.annotation.processing.**
-dontwarn javax.tools.**
-dontwarn com.squareup.kotlinpoet.**
-dontwarn com.squareup.javapoet.**

# Conscrypt / OpenJSSE optional deps (used by OkHttp if present)
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
-dontwarn org.bouncycastle.**

# Animal Sniffer (used by some Google libraries)
-dontwarn org.codehaus.mojo.animal_sniffer.**

# Keep any class annotated with @Keep
-keep,allowobfuscation @interface androidx.annotation.Keep
-keep @androidx.annotation.Keep class *
-keepclassmembers class * {
    @androidx.annotation.Keep *;
}
