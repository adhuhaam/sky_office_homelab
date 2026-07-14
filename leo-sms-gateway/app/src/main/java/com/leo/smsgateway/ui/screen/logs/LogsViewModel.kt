package com.leo.smsgateway.ui.screen.logs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.leo.smsgateway.data.local.dao.SmsLogDao
import com.leo.smsgateway.data.local.entity.SmsLogEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LogsUiState(
    val logs: List<SmsLogEntity> = emptyList(),
)

@HiltViewModel
class LogsViewModel @Inject constructor(
    private val smsLogDao: SmsLogDao,
) : ViewModel() {

    val uiState: StateFlow<LogsUiState> = smsLogDao.getRecentLogs(200)
        .map { LogsUiState(it) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), LogsUiState())

    fun clearLogs() {
        viewModelScope.launch { smsLogDao.clearAll() }
    }
}
