# Add project specific ProGuard rules here.

# Keep SignalR classes
-keep class com.microsoft.signalr.** { *; }
-keep interface com.microsoft.signalr.** { *; }
-dontwarn com.microsoft.signalr.**

# Keep Retrofit models
-keepclassmembers class com.leo.smsgateway.data.remote.dto.** { *; }

# Keep Gson models
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# OkHttp / Okio
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Netty (used by SignalR)
-dontwarn io.netty.**
-keep class io.netty.** { *; }

# Keep Room entities
-keep class com.leo.smsgateway.data.local.entity.** { *; }

# Hilt
-keep class dagger.hilt.** { *; }
-keepclasseswithmembers class * {
    @dagger.hilt.android.AndroidEntryPoint <methods>;
}

# Keep enum values
-keepclassmembers enum * { *; }
