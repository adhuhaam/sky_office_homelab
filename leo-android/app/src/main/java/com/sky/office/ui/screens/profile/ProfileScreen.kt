package com.sky.office.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.sky.office.data.local.TokenManager
import com.sky.office.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val tokens: TokenManager,
    private val auth: AuthRepository
) : ViewModel() {
    val baseUrl = tokens.baseUrlFlow.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "http://100.126.222.96")
    fun saveBaseUrl(url: String) = viewModelScope.launch { tokens.saveBaseUrl(url.trim().trimEnd('/')) }
    fun logout(onDone: () -> Unit) = viewModelScope.launch {
        auth.logout()
        onDone()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onBack: () -> Unit,
    onLogout: () -> Unit,
    vm: ProfileViewModel = hiltViewModel()
) {
    val baseUrl by vm.baseUrl.collectAsStateWithLifecycle()
    var editUrl by remember(baseUrl) { mutableStateOf(baseUrl) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Profile & settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { pad ->
        Column(
            Modifier.padding(pad).padding(16.dp).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("API base URL", style = MaterialTheme.typography.labelLarge)
            OutlinedTextField(
                value = editUrl,
                onValueChange = { editUrl = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("http://100.126.222.96") }
            )
            Button(onClick = { vm.saveBaseUrl(editUrl) }, modifier = Modifier.fillMaxWidth()) {
                Text("Save server URL")
            }
            Text(
                "Use LAN (https://192.168.18.150) or Tailscale HTTP. Cleartext is allowed for private networks.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            HorizontalDivider(Modifier = Modifier.padding(vertical = 8.dp))
            OutlinedButton(
                onClick = { vm.logout(onLogout) },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
            ) {
                Text("Log out")
            }
        }
    }
}
