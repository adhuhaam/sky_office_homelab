package com.leo.smsgateway.di

import android.content.Context
import androidx.room.Room
import com.leo.smsgateway.data.local.AppDatabase
import com.leo.smsgateway.data.local.dao.SmsLogDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "leo_sms_gateway.db")
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    fun provideSmsLogDao(db: AppDatabase): SmsLogDao = db.smsLogDao()
}
