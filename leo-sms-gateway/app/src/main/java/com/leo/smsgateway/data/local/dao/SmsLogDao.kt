package com.leo.smsgateway.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.leo.smsgateway.data.local.entity.SmsLogEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SmsLogDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(log: SmsLogEntity)

    @Query("UPDATE sms_logs SET status = :status, error = :error WHERE messageId = :messageId")
    suspend fun updateStatus(messageId: String, status: String, error: String? = null)

    @Query("SELECT * FROM sms_logs ORDER BY timestamp DESC")
    fun getAllLogs(): Flow<List<SmsLogEntity>>

    @Query("SELECT * FROM sms_logs ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentLogs(limit: Int = 100): Flow<List<SmsLogEntity>>

    @Query("SELECT COUNT(*) FROM sms_logs WHERE status = 'pending'")
    fun getPendingCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM sms_logs WHERE status = 'sent' AND timestamp > :sinceMillis")
    fun getSentCount(sinceMillis: Long): Flow<Int>

    @Query("SELECT COUNT(*) FROM sms_logs WHERE status = 'failed' AND timestamp > :sinceMillis")
    fun getFailedCount(sinceMillis: Long): Flow<Int>

    @Query("DELETE FROM sms_logs WHERE timestamp < :beforeMillis")
    suspend fun deleteOlderThan(beforeMillis: Long)

    @Query("DELETE FROM sms_logs")
    suspend fun clearAll()
}
