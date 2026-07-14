package com.leo.admin.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.leo.admin.data.api.NetworkResult
import com.leo.admin.data.api.UiState
import com.leo.admin.data.local.TokenManager
import com.leo.admin.data.model.UserDto
import com.leo.admin.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class LoginUiState {
    object Idle : LoginUiState()
    object Loading : LoginUiState()
    object Success : LoginUiState()
    data class Error(val message: String) : LoginUiState()
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager
) : ViewModel() {

    private val _loginState = MutableStateFlow<LoginUiState>(LoginUiState.Idle)
    val loginState: StateFlow<LoginUiState> = _loginState.asStateFlow()

    /** null = still reading DataStore; true/false = determined */
    val isLoggedIn: StateFlow<Boolean?> = tokenManager.tokenFlow
        .map { token -> if (token.isEmpty()) false else true }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    /** Exposed so MainScreen can do role-gating without a separate VM */
    private val _userRole = MutableStateFlow<String?>(null)
    val userRole: StateFlow<String?> = _userRole.asStateFlow()

    private val _profileState = MutableStateFlow<UiState<UserDto>>(UiState.Idle)
    val profileState: StateFlow<UiState<UserDto>> = _profileState.asStateFlow()

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _loginState.value = LoginUiState.Loading
            when (val result = authRepository.login(email, password)) {
                is NetworkResult.Success -> {
                    fetchMe()
                    _loginState.value = LoginUiState.Success
                }
                is NetworkResult.Error -> _loginState.value = LoginUiState.Error(result.message)
                else -> {}
            }
        }
    }

    fun fetchMe() {
        viewModelScope.launch {
            when (val result = authRepository.getMe()) {
                is NetworkResult.Success -> {
                    _userRole.value = result.data.role
                    _profileState.value = UiState.Success(result.data)
                }
                else -> {}
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _loginState.value = LoginUiState.Idle
            _userRole.value = null
        }
    }
}
