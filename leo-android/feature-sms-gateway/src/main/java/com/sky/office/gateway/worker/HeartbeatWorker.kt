package com.sky.office.gateway.worker

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.sky.office.gateway.data.preferences.GatewayPreferences
import com.sky.office.gateway.service.GatewaySmsService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * Periodic WorkManager watchdog (15-min minimum interval).
 * Restarts the foreground service if the gateway is registered but the service is not running.
 * The actual 30-second heartbeat runs inside [GatewaySmsService] via a coroutine loop.
 */
@HiltWorker
class HeartbeatWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted workerParams: WorkerParameters,
    private val appPreferences: GatewayPreferences,
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val prefs = appPreferences.getPrefsSnapshot()
        if (prefs.isRegistered && !GatewaySmsService.isRunning) {
            Timber.i("HeartbeatWorker: service not running — restarting")
            GatewaySmsService.start(applicationContext)
        }
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "leo_gateway_watchdog"

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
