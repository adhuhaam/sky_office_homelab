package com.leo.smsgateway.data.remote.dto

import com.google.gson.annotations.SerializedName

data class RegisterResponse(
    @SerializedName("id") val id: Int = 0,
    @SerializedName("gatewayKey") val gatewayKey: String = "",
    @SerializedName("name") val name: String = "",
    @SerializedName("hubPath") val hubPath: String? = null,
    @SerializedName("heartbeatIntervalSeconds") val heartbeatIntervalSeconds: Int? = null,
)
