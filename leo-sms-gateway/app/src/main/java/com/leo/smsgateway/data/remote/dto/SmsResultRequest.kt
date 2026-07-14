package com.leo.smsgateway.data.remote.dto

import com.google.gson.annotations.SerializedName

data class SmsResultRequest(
    @SerializedName("gatewayId") val gatewayId: Int,
    @SerializedName("gatewayKey") val gatewayKey: String,
    @SerializedName("queueId") val queueId: Int,
    @SerializedName("success") val success: Boolean,
    @SerializedName("response") val response: String? = null,
)
