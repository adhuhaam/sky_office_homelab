package com.sky.office.gateway.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.sky.office.gateway.data.local.dao.SmsLogDao
import com.sky.office.gateway.data.local.entity.SmsLogEntity

@Database(
    entities = [SmsLogEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun smsLogDao(): SmsLogDao
}
