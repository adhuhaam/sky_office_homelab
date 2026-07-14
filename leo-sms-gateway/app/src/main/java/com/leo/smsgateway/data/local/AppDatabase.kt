package com.leo.smsgateway.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.leo.smsgateway.data.local.dao.SmsLogDao
import com.leo.smsgateway.data.local.entity.SmsLogEntity

@Database(
    entities = [SmsLogEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun smsLogDao(): SmsLogDao
}
