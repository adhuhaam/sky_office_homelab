package com.sky.office.gateway.ui.screen.dashboard

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.telephony.TelephonyManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sky.office.gateway.data.preferences.GatewayPreferences
import com.sky.office.gateway.data.remote.GatewayApiService
import com.sky.office.gateway.service.ConnectionState
import com.sky.office.gateway.service.GatewaySmsService
import com.sky.office.gateway.service.ServiceStatus
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class DashboardUiState(
    val connectionState: ConnectionState = ConnectionState.DISCONNECTED,
    val isServiceRunning: Boolean = false,
    val gatewayName: String = "",
    val serverUrl: String = "",
    val gatewayId: String = "",
    val gatewayKey: String = "",
    val isDefault: Boolean = false,
    val nodeRole: String = "standby",
    val batteryLevel: Int = 0,
    val isCharging: Boolean = false,
    val simOperator: String = "Unknown",
    val simState: String = "Unknown",
    val pendingCount: Int = 0,
    val sentToday: Int = 0,
    val failedToday: Int = 0,
    val lastError: String? = null,
    val permissionsHint: Boolean = true,
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appPreferences: GatewayPreferences,
    private val apiService: GatewayApiService,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        collectServiceStatus()
        collectDeviceInfo()
        loadGatewayPrefs()
        pollConfig()
    }

    private fun collectServiceStatus() {
        viewModelScope.launch {
            ServiceStatus.connectionState.collect { v ->
                _uiState.update { it.copy(connectionState = v, lastError = ServiceStatus.lastError.value) }
            }
        }
        viewModelScope.launch {
            ServiceStatus.isRunning.collect { v -> _uiState.update { it.copy(isServiceRunning = v) } }
        }
        viewModelScope.launch {
            ServiceStatus.pendingCount.collect { v -> _uiState.update { it.copy(pendingCount = v) } }
        }
        viewModelScope.launch {
            ServiceStatus.sentToday.collect { v -> _uiState.update { it.copy(sentToday = v) } }
        }
        viewModelScope.launch {
            ServiceStatus.failedToday.collect { v -> _uiState.update { it.copy(failedToday = v) } }
        }
        viewModelScope.launch {
            ServiceStatus.lastError.collect { v ->
                _uiState.update { it.copy(lastError = v) }
            }
        }
    }

    private fun loadGatewayPrefs() {
        viewModelScope.launch {
            appPreferences.allPrefs.collect { p ->
                _uiState.update {
                    it.copy(
                        gatewayName = p.gatewayName,
                        serverUrl = p.serverUrl,
                        gatewayId = p.gatewayId,
                        gatewayKey = p.gatewayKey,
                    )
                }
            }
        }
    }

    private fun pollConfig() {
        viewModelScope.launch {
            while (isActive) {
                refreshConfig()
                delay(15_000)
            }
        }
    }

    fun refreshConfig() {
        viewModelScope.launch {
            try {
                val prefs = appPreferences.getPrefsSnapshot()
                if (!prefs.isRegistered || prefs.serverUrl.isBlank()) return@launch
                val url =
                    "${prefs.serverUrl}/api/gateway/config?gatewayId=${prefs.gatewayId}&gatewayKey=${prefs.gatewayKey}"
                val resp = apiService.getConfig(url)
                if (resp.isSuccessful) {
                    val body = resp.body()
                    if (body != null) {
                        _uiState.update {
                            it.copy(
                                isDefault = body.isDefault,
                                nodeRole = if (body.isDefault) "default" else (body.role.ifBlank { "standby" }),
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Timber.w(e, "Failed to refresh gateway config")
            }
        }
    }

    private fun collectDeviceInfo() {
        viewModelScope.launch {
            updateDeviceInfo()
            while (isActive) {
                delay(10_000)
                updateDeviceInfo()
            }
        }
    }

    private fun updateDeviceInfo() {
        val bat = readBattery()
        val sim = readSim()
        _uiState.update {
            it.copy(
                batteryLevel = bat.level,
                isCharging = bat.isCharging,
                simOperator = sim.operator,
                simState = sim.state,
            )
        }
    }

    private fun readBattery(): BatteryInfo {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.BATTERY_LEVEL, 0) ?: 0
        val scale = intent?.getIntExtra(BatteryManager.BATTERY_SCALE, 100) ?: 100
        val status = intent?.getIntExtra(BatteryManager.BATTERY_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN) ?: 0
        val pct = if (scale > 0) (level * 100 / scale) else 0
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
        return BatteryInfo(pct, charging)
    }

    private fun readSim(): SimInfo {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val operator = tm.networkOperatorName.ifBlank { "Unknown" }
            val state = when (tm.simState) {
                TelephonyManager.SIM_STATE_READY -> "Ready"
                TelephonyManager.SIM_STATE_ABSENT -> "Absent"
                TelephonyManager.SIM_STATE_PIN_REQUIRED -> "PIN required"
                TelephonyManager.SIM_STATE_PUK_REQUIRED -> "PUK required"
                TelephonyManager.SIM_STATE_NETWORK_LOCKED -> "Network locked"
                else -> "Unknown"
            }
            SimInfo(operator, state)
        } catch (e: SecurityException) {
            SimInfo("Permission denied", "Unknown")
        }
    }

    fun startService() = GatewaySmsService.start(context)

    fun stopService() = GatewaySmsService.stop(context)

    fun reconnect() {
        GatewaySmsService.stop(context)
        viewModelScope.launch {
            delay(500)
            GatewaySmsService.start(context)
            refreshConfig()
        }
    }

    private data class BatteryInfo(val level: Int, val isCharging: Boolean)
    private data class SimInfo(val operator: String, val state: String)
}
