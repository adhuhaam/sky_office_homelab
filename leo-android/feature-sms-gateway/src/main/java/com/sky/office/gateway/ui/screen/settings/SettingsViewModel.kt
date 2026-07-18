package com.sky.office.gateway.ui.screen.settings

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sky.office.gateway.data.preferences.GatewayPreferences
import com.sky.office.gateway.service.GatewaySmsService
import com.sky.office.gateway.worker.HeartbeatWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val serverUrl: String = "",
    val gatewayId: String = "",
    val gatewayKey: String = "",
    val gatewayName: String = "",
    val isSaved: Boolean = false,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appPreferences: GatewayPreferences,
) : ViewModel() {

    val uiState: StateFlow<SettingsUiState> = appPreferences.allPrefs
        .map {
            SettingsUiState(
                serverUrl = it.serverUrl,
                gatewayId = it.gatewayId,
                gatewayKey = it.gatewayKey,
                gatewayName = it.gatewayName,
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SettingsUiState())

    private val _savedBanner = MutableStateFlow(false)
    val savedBanner: StateFlow<Boolean> = _savedBanner.asStateFlow()

    fun saveServerUrl(url: String) {
        viewModelScope.launch {
            appPreferences.updateServerUrl(url)
            _savedBanner.value = true
        }
    }

    fun forceRestart() {
        GatewaySmsService.stop(context)
        viewModelScope.launch {
            kotlinx.coroutines.delay(300)
            GatewaySmsService.start(context)
        }
    }

    fun unregister(onDone: () -> Unit) {
        viewModelScope.launch {
            GatewaySmsService.stop(context)
            HeartbeatWorker.cancel(context)
            appPreferences.clearRegistration()
            onDone()
        }
    }

    fun dismissSavedBanner() {
        _savedBanner.value = false
    }
}
