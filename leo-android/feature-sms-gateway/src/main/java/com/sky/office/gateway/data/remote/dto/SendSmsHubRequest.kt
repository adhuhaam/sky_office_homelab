package com.sky.office.gateway.data.remote.dto

import com.google.gson.annotations.SerializedName

/** Payload from hub "SendSms" — matches server `{ queueId, recipient, message }`. */
data class SendSmsHubRequest(
    @SerializedName("queueId") val queueId: Int = 0,
    @SerializedName("recipient") val recipient: String = "",
    @SerializedName("message") val message: String = "",
)
