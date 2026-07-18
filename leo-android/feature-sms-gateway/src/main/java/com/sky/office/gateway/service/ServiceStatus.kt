package com.sky.office.gateway.service

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * Singleton shared between GatewaySmsService and the UI layer.
 * ViewModels collect from these flows to update the Dashboard.
 */
object ServiceStatus {
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _isRunning = MutableStateFlow(false)
    val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount.asStateFlow()

    private val _sentToday = MutableStateFlow(0)
    val sentToday: StateFlow<Int> = _sentToday.asStateFlow()

    private val _failedToday = MutableStateFlow(0)
    val failedToday: StateFlow<Int> = _failedToday.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    fun setConnectionState(state: ConnectionState) { _connectionState.value = state }
    fun setRunning(running: Boolean) { _isRunning.value = running }
    fun setPendingCount(n: Int) { _pendingCount.value = n }
    fun incrementSent() { _sentToday.value++ }
    fun incrementFailed() { _failedToday.value++ }
    fun decrementPending() { if (_pendingCount.value > 0) _pendingCount.value-- }
    fun setLastError(msg: String?) { _lastError.value = msg }

    fun reset() {
        _connectionState.value = ConnectionState.DISCONNECTED
        _isRunning.value = false
        _pendingCount.value = 0
        _lastError.value = null
    }
}
