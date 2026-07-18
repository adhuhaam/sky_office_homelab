package com.sky.office.gateway.data.remote.dto

import com.google.gson.annotations.SerializedName

data class HeartbeatRequest(
    @SerializedName("gatewayId") val gatewayId: Int,
    @SerializedName("gatewayKey") val gatewayKey: String,
    @SerializedName("batteryLevel") val batteryLevel: Int? = null,
    @SerializedName("signalStrength") val signalStrength: Int? = null,
    @SerializedName("networkType") val networkType: String? = null,
    @SerializedName("simOperator") val simOperator: String? = null,
    @SerializedName("phoneNumber") val phoneNumber: String? = null,
    @SerializedName("androidVersion") val androidVersion: String? = null,
    @SerializedName("deviceModel") val deviceModel: String? = null,
    @SerializedName("appVersion") val appVersion: String? = null,
    @SerializedName("tailscaleIp") val tailscaleIp: String? = null,
    @SerializedName("queueLength") val queueLength: Int? = null,
    @SerializedName("connection") val connection: String? = null,
)

/** Hub Heartbeat payload (same shape as REST, without gateway credentials in body). */
data class HeartbeatHubDto(
    @SerializedName("batteryLevel") val batteryLevel: Int? = null,
    @SerializedName("signalStrength") val signalStrength: Int? = null,
    @SerializedName("networkType") val networkType: String? = null,
    @SerializedName("simOperator") val simOperator: String? = null,
    @SerializedName("phoneNumber") val phoneNumber: String? = null,
    @SerializedName("androidVersion") val androidVersion: String? = null,
    @SerializedName("deviceModel") val deviceModel: String? = null,
    @SerializedName("appVersion") val appVersion: String? = null,
    @SerializedName("tailscaleIp") val tailscaleIp: String? = null,
    @SerializedName("queueLength") val queueLength: Int? = null,
    @SerializedName("connection") val connection: String? = null,
)

data class SmsResultHubDto(
    @SerializedName("queueId") val queueId: Int,
    @SerializedName("response") val response: String? = null,
)
