package com.leo.smsgateway.data.remote.dto

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    @SerializedName("name") val name: String,
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceModel") val deviceModel: String,
    @SerializedName("androidVersion") val androidVersion: String,
    @SerializedName("appVersion") val appVersion: String,
)
