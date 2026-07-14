package com.leo.smsgateway.ui.screen.login

import android.content.Context
import android.os.Build
import android.provider.Settings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.leo.smsgateway.BuildConfig
import com.leo.smsgateway.data.preferences.AppPreferences
import com.leo.smsgateway.data.remote.ApiService
import com.leo.smsgateway.data.remote.dto.RegisterRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

sealed class LoginUiState {
    data object Idle : LoginUiState()
    data object Loading : LoginUiState()
    data class Success(val gatewayId: String, val gatewayKey: String, val name: String) : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    @ApplicationContext private val context: Context,
    private val appPreferences: AppPreferences,
    private val apiService: ApiService,
) : ViewModel() {

    val isRegistered = appPreferences.isRegistered.distinctUntilChanged()

    private val _uiState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    val savedServerUrl = appPreferences.serverUrl
    val savedGatewayName = appPreferences.gatewayName

    fun register(serverUrl: String, gatewayName: String) {
        if (serverUrl.isBlank()) {
            _uiState.value = LoginUiState.Error("Server URL is required")
            return
        }
        if (gatewayName.isBlank()) {
            _uiState.value = LoginUiState.Error("Gateway name is required")
            return
        }

        _uiState.value = LoginUiState.Loading
        viewModelScope.launch {
            try {
                val url = serverUrl.trimEnd('/')
                val deviceId = Settings.Secure.getString(
                    context.contentResolver, Settings.Secure.ANDROID_ID
                ) ?: "unknown"

                val request = RegisterRequest(
                    name = gatewayName,
                    deviceId = deviceId,
                    deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                    androidVersion = Build.VERSION.RELEASE,
                    appVersion = BuildConfig.VERSION_NAME,
                )

                val response = apiService.register("$url/api/gateway/register", request)

                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.id > 0 && body.gatewayKey.isNotBlank()) {
                        val gid = body.id.toString()
                        appPreferences.saveRegistration(url, gid, body.gatewayKey, body.name)
                        _uiState.value = LoginUiState.Success(gid, body.gatewayKey, body.name)
                    } else {
                        _uiState.value = LoginUiState.Error("Empty or invalid response from server")
                    }
                } else {
                    val errorBody = response.errorBody()?.string() ?: "HTTP ${response.code()}"
                    _uiState.value = LoginUiState.Error("Registration failed: $errorBody")
                }
            } catch (e: Exception) {
                Timber.e(e, "Register error")
                _uiState.value = LoginUiState.Error(e.message ?: "Network error")
            }
        }
    }

    fun resetState() {
        _uiState.value = LoginUiState.Idle
    }
}
