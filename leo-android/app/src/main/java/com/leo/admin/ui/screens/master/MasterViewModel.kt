package com.leo.admin.ui.screens.master

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.leo.admin.data.api.NetworkResult
import com.leo.admin.data.api.UiState
import com.leo.admin.data.model.PassportDto
import com.leo.admin.data.repository.PassportRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MasterViewModel @Inject constructor(
    private val passportRepository: PassportRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UiState<List<PassportDto>>>(UiState.Loading)
    val uiState: StateFlow<UiState<List<PassportDto>>> = _uiState.asStateFlow()

    private val _search = MutableStateFlow("")
    val search: StateFlow<String> = _search.asStateFlow()

    private var allPassports: List<PassportDto> = emptyList()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            when (val r = passportRepository.getPassports()) {
                is NetworkResult.Success -> {
                    allPassports = r.data
                    applyFilter()
                }
                is NetworkResult.Error -> _uiState.value = UiState.Error(r.message)
                else -> {}
            }
        }
    }

    fun onSearchChange(query: String) {
        _search.value = query
        applyFilter()
    }

    private fun applyFilter() {
        val q = _search.value.trim().lowercase()
        val filtered = if (q.isEmpty()) allPassports
        else allPassports.filter { p ->
            p.name?.lowercase()?.contains(q) == true ||
                p.passportNumber?.lowercase()?.contains(q) == true ||
                p.nationality?.lowercase()?.contains(q) == true ||
                p.status?.lowercase()?.contains(q) == true
        }
        _uiState.value = UiState.Success(filtered)
    }
}
