package com.sky.office.gateway.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.sky.office.gateway.data.preferences.GatewayPreferences
import com.sky.office.gateway.service.GatewaySmsService
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject
    lateinit var appPreferences: GatewayPreferences

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON" -> {
                Timber.d("Boot/replace received — checking registration")
                val pendingResult = goAsync()
                scope.launch {
                    try {
                        val isRegistered = appPreferences.isRegistered.first()
                        if (isRegistered) {
                            Timber.i("Auto-starting GatewaySmsService after boot")
                            GatewaySmsService.start(context)
                        }
                    } finally {
                        pendingResult.finish()
                    }
                }
            }
        }
    }
}
