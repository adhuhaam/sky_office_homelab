package com.leo.admin.ui.screens.master

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.leo.admin.data.api.UiState
import com.leo.admin.data.model.PassportDto
import com.leo.admin.ui.components.ErrorView
import com.leo.admin.ui.components.LoadingView
import com.leo.admin.ui.components.StatusChip

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PassportDetailScreen(
    passportId: Int,
    onBack: () -> Unit,
    viewModel: PassportDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Passport Detail") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is UiState.Loading -> LoadingView(modifier = Modifier.padding(paddingValues))
            is UiState.Error -> ErrorView(
                message = state.message,
                onRetry = viewModel::load,
                modifier = Modifier.padding(paddingValues)
            )
            is UiState.Success -> PassportDetailContent(state.data, Modifier.padding(paddingValues))
            else -> Unit
        }
    }
}

@Composable
private fun PassportDetailContent(passport: PassportDto, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Header card
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(20.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            passport.name ?: "Unknown",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            passport.passportNumber ?: "—",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    StatusChip(passport.status)
                }
            }
        }

        // Personal info
        InfoCard(title = "Personal Information") {
            InfoRow("Nationality", passport.nationality)
            InfoRow("Gender", passport.gender)
            InfoRow("Date of Birth", passport.dateOfBirth)
            InfoRow("Place of Birth", passport.placeOfBirth)
            InfoRow("Phone", passport.phone)
        }

        // Document info
        InfoCard(title = "Document Details") {
            InfoRow("Issue Date", passport.issueDate)
            InfoRow("Expiry Date", passport.expiryDate)
            InfoRow("Company", passport.company)
            InfoRow("Client", passport.client)
        }

        passport.notes?.let {
            InfoCard(title = "Notes") {
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
        }

        InfoCard(title = "System") {
            InfoRow("Created", passport.createdAt)
            InfoRow("Updated", passport.updatedAt)
        }
    }
}

@Composable
private fun InfoCard(title: String, content: @Composable ColumnScope.() -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String?) {
    if (value.isNullOrBlank()) return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.4f)
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(0.6f)
        )
    }
}
