package com.leo.admin.data.api

sealed class NetworkResult<out T> {
    data class Success<T>(val data: T) : NetworkResult<T>()
    data class Error(val message: String, val code: Int = 0) : NetworkResult<Nothing>()
    object Loading : NetworkResult<Nothing>()
}

// ─── Shared UI state ──────────────────────────────────────────────────────────

sealed class UiState<out T> {
    object Idle : UiState<Nothing>()
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
}
