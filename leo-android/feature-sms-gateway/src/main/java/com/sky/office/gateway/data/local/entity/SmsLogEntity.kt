package com.sky.office.gateway.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sms_logs")
data class SmsLogEntity(
    @PrimaryKey val messageId: String,
    val phoneNumber: String,
    val message: String,
    /** "pending" | "sent" | "failed" */
    val status: String,
    val error: String? = null,
    val timestamp: Long = System.currentTimeMillis(),
)
