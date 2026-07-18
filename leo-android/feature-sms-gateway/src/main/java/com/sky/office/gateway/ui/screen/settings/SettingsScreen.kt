package com.sky.office.gateway.ui.screen.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.sky.office.gateway.ui.theme.RedError

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onLoggedOut: () -> Unit,
    onExitToOffice: (() -> Unit)? = null,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val savedBanner by viewModel.savedBanner.collectAsState()
    var serverUrlEdit by remember(state.serverUrl) { mutableStateOf(state.serverUrl) }
    var showUnregisterDialog by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(savedBanner) {
        if (savedBanner) {
            snackbarHostState.showSnackbar("Server URL saved")
            viewModel.dismissSavedBanner()
        }
    }

    if (showUnregisterDialog) {
        AlertDialog(
            onDismissRequest = { showUnregisterDialog = false },
            title = { Text("Unregister Gateway") },
            text = { Text("This will stop the service and clear all credentials. Are you sure?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showUnregisterDialog = false
                        viewModel.unregister(onLoggedOut)
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = RedError),
                ) { Text("Unregister") }
            },
            dismissButton = {
                TextButton(onClick = { showUnregisterDialog = false }) { Text("Cancel") }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface),
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // Server URL
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Connection", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = serverUrlEdit,
                        onValueChange = { serverUrlEdit = it },
                        label = { Text("Server URL") },
                        leadingIcon = { Icon(Icons.Default.Dns, null) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { viewModel.saveServerUrl(serverUrlEdit) },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Save & Restart") }
                }
            }

            // Gateway info (read-only)
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Gateway Info", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(10.dp))
                    LabelValue("Name", state.gatewayName.ifBlank { "—" })
                    LabelValue("Gateway ID", state.gatewayId.ifBlank { "—" })
                    LabelValue("Gateway Key", if (state.gatewayKey.isNotBlank()) "••••••••" else "—")
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Default vs standby is chosen only in web SMS Gateways (superuser). This app never sets the global default.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "Tip: disable battery optimization for reliable heartbeats (Xiaomi / Samsung).",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            // Service controls
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Service", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary)
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { viewModel.forceRestart() },
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Force Restart Service") }
                }
            }

            if (onExitToOffice != null) {
                OutlinedButton(
                    onClick = onExitToOffice,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Back to Sky Office") }
            }

            // Danger zone
            Card(
                colors = CardDefaults.cardColors(containerColor = RedError.copy(alpha = 0.08f)),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Danger Zone", fontWeight = FontWeight.SemiBold, color = RedError)
                    Spacer(Modifier.height(10.dp))
                    OutlinedButton(
                        onClick = { showUnregisterDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = RedError),
                    ) { Text("Unregister & Reset") }
                }
            }
        }
    }
}

@Composable
private fun LabelValue(label: String, value: String) {
    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
    }
}
