package com.leo.admin.ui.screens.master

import androidx.lifecycle.SavedStateHandle
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
class PassportDetailViewModel @Inject constructor(
    private val passportRepository: PassportRepository,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val passportId: Int = checkNotNull(savedStateHandle["passportId"])

    private val _uiState = MutableStateFlow<UiState<PassportDto>>(UiState.Loading)
    val uiState: StateFlow<UiState<PassportDto>> = _uiState.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            when (val r = passportRepository.getPassport(passportId)) {
                is NetworkResult.Success -> _uiState.value = UiState.Success(r.data)
                is NetworkResult.Error -> _uiState.value = UiState.Error(r.message)
                else -> {}
            }
        }
    }
}
