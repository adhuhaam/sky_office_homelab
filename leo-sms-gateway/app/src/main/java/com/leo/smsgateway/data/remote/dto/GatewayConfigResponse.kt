package com.leo.smsgateway.data.remote.dto

import com.google.gson.annotations.SerializedName

data class GatewayConfigResponse(
    @SerializedName("gatewayId") val gatewayId: Int = 0,
    @SerializedName("name") val name: String = "",
    @SerializedName("heartbeatIntervalSeconds") val heartbeatIntervalSeconds: Int = 30,
    @SerializedName("hubPath") val hubPath: String? = null,
    @SerializedName("maxRetries") val maxRetries: Int = 3,
    @SerializedName("isDefault") val isDefault: Boolean = false,
    @SerializedName("role") val role: String = "standby",
    @SerializedName("status") val status: String? = null,
    @SerializedName("lastHeartbeat") val lastHeartbeat: String? = null,
)
