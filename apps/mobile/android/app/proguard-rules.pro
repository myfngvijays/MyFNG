# R8 / ProGuard — keep only what RN, payments, and reflection actually need.
# Broad -keep on Kotlin / GMS / Firebase was capping Play obfuscation at ~29%.
# Library AARs already ship consumer ProGuard rules; those still apply.

-allowaccessmodification
-repackageclasses

# Crash reports: keep line numbers, hide real source file names
-keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod,*Annotation*
-renamesourcefileattribute SourceFile

# ---------- React Native (AAR consumer rules cover NativeModule / @DoNotStrip) ----------
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# ---------- react-native-reanimated ----------
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ---------- react-native-gesture-handler ----------
-keep class com.swmansion.gesturehandler.** { *; }

# ---------- Razorpay (official rules) ----------
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

# ---------- Google Maps (JS/native name lookup) ----------
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-dontwarn com.google.android.gms.maps.**
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ---------- OkHttp / Okio ----------
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ---------- Supabase (JS client; native helpers if present) ----------
-dontwarn io.github.jan.supabase.**

# ---------- Expo (module registry looks up class names) ----------
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# ---------- Microsoft Clarity ----------
-keep class com.microsoft.clarity.** { *; }
-dontwarn com.microsoft.clarity.**

# ---------- Kotlin (do not blanket-keep stdlib — R8 can shrink/obfuscate it) ----------
-dontwarn kotlin.**
-dontwarn kotlinx.**
-keep class kotlin.Metadata { *; }

# ---------- JVM-only classes (compile-time only, not on Android) ----------
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
