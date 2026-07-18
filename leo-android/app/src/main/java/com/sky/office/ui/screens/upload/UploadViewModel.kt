package com.sky.office.ui.screens.upload

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sky.office.data.api.NetworkResult
import com.sky.office.data.repository.PassportRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject

sealed class UploadUiState {
    object Idle : UploadUiState()
    object Uploading : UploadUiState()
    data class Success(val message: String) : UploadUiState()
    data class Error(val message: String) : UploadUiState()
}

@HiltViewModel
class UploadViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val passportRepository: PassportRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UploadUiState>(UploadUiState.Idle)
    val uiState: StateFlow<UploadUiState> = _uiState.asStateFlow()

    private val _selectedUri = MutableStateFlow<Uri?>(null)
    val selectedUri: StateFlow<Uri?> = _selectedUri.asStateFlow()

    fun onImageSelected(uri: Uri?) {
        _selectedUri.value = uri
        if (_uiState.value is UploadUiState.Success || _uiState.value is UploadUiState.Error) {
            _uiState.value = UploadUiState.Idle
        }
    }

    fun upload(fields: Map<String, String> = emptyMap()) {
        val uri = _selectedUri.value ?: return
        viewModelScope.launch {
            _uiState.value = UploadUiState.Uploading
            val file = withContext(Dispatchers.IO) { uriToFile(uri) }
            if (file == null) {
                _uiState.value = UploadUiState.Error("Could not read selected image")
                return@launch
            }
            when (val result = passportRepository.uploadPassport(file, fields)) {
                is NetworkResult.Success -> {
                    _uiState.value = UploadUiState.Success(result.data)
                    _selectedUri.value = null
                }
                is NetworkResult.Error -> _uiState.value = UploadUiState.Error(result.message)
                else -> {}
            }
        }
    }

    fun resetState() { _uiState.value = UploadUiState.Idle }

    private fun uriToFile(uri: Uri): File? = try {
        val inputStream = appContext.contentResolver.openInputStream(uri) ?: return null
        val ext = appContext.contentResolver.getType(uri)
            ?.substringAfterLast("/") ?: "jpg"
        val temp = File.createTempFile("upload_", ".$ext", appContext.cacheDir)
        temp.outputStream().use { out -> inputStream.copyTo(out) }
        temp
    } catch (_: Exception) { null }
}
