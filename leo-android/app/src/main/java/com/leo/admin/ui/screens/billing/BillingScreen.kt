package com.leo.admin.ui.screens.billing

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.*
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.leo.admin.data.api.NetworkResult
import com.leo.admin.data.model.BillingDto
import com.leo.admin.data.repository.BillingRepository
import com.leo.admin.ui.components.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class BillingViewModel @Inject constructor(private val repo: BillingRepository) : ViewModel() {
    private val _state = MutableStateFlow<NetworkResult<List<BillingDto>>>(NetworkResult.Loading)
    val state = _state.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch { _state.value = repo.getBillingDocuments() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BillingScreen(vm: BillingViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    Scaffold(topBar = { TopAppBar(title = { Text("Billing") }) }) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (val s = state) {
                is NetworkResult.Loading -> LoadingView()
                is NetworkResult.Error -> ErrorView(s.message, vm::refresh)
                is NetworkResult.Success -> if (s.data.isEmpty()) EmptyView() else LazyColumn {
                    items(s.data) { item ->
                        ListItem(
                            headlineContent = { Text(item.documentNumber ?: "Doc #${item.id}") },
                            supportingContent = {
                                Text(listOfNotNull(item.client, item.status, item.amount?.toString()).joinToString(" · "))
                            }
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
