package com.sky.office.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sky.office.data.api.NetworkResult
import com.sky.office.data.api.UiState
import com.sky.office.data.model.PassportStats
import com.sky.office.data.model.TaskDto
import com.sky.office.data.repository.PassportRepository
import com.sky.office.data.repository.TaskRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardData(
    val stats: PassportStats?,
    val tasks: List<TaskDto>
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val passportRepository: PassportRepository,
    private val taskRepository: TaskRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<DashboardData>>(UiState.Loading)
    val uiState: StateFlow<UiState<DashboardData>> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            val statsDeferred = async { passportRepository.getStats() }
            val tasksDeferred = async { taskRepository.getTasks() }

            val stats = (statsDeferred.await() as? NetworkResult.Success)?.data
            val tasks = (tasksDeferred.await() as? NetworkResult.Success)?.data ?: emptyList()

            _uiState.value = UiState.Success(DashboardData(stats = stats, tasks = tasks))
        }
    }
}
