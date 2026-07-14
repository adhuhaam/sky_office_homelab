package com.leo.admin.ui.screens.more

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.navigation.NavController
import com.leo.admin.data.api.NetworkResult
import com.leo.admin.data.model.AdminUserDto
import com.leo.admin.data.model.ClientDto
import com.leo.admin.data.model.CompanyDto
import com.leo.admin.data.model.LoaDto
import com.leo.admin.data.model.PasswordDto
import com.leo.admin.data.repository.AdminRepository
import com.leo.admin.data.repository.ClientRepository
import com.leo.admin.data.repository.CompanyRepository
import com.leo.admin.data.repository.LoaRepository
import com.leo.admin.data.repository.PasswordRepository
import com.leo.admin.navigation.Screen
import com.leo.admin.ui.components.EmptyView
import com.leo.admin.ui.components.ErrorView
import com.leo.admin.ui.components.LoadingView
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(navController: NavController) {
    val links = listOf(
        Triple("Letters of Appointment", Icons.Filled.Description, Screen.Loa.route),
        Triple("Companies", Icons.Filled.Business, Screen.Companies.route),
        Triple("Clients", Icons.Filled.People, Screen.Clients.route),
        Triple("Passwords", Icons.Filled.Lock, Screen.Passwords.route),
        Triple("Admin users", Icons.Filled.AdminPanelSettings, Screen.AdminUsers.route),
        Triple("Profile & settings", Icons.Filled.Person, Screen.Profile.route),
    )
    Scaffold(topBar = { TopAppBar(title = { Text("More") }) }) { pad ->
        LazyColumn(modifier = Modifier.padding(pad)) {
            items(links) { (label, icon, route) ->
                ListItem(
                    headlineContent = { Text(label) },
                    leadingContent = { Icon(icon, contentDescription = null) },
                    trailingContent = { Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null) },
                    modifier = Modifier.clickable { navController.navigate(route) }
                )
                HorizontalDivider()
            }
        }
    }
}

@HiltViewModel
class LoaVm @Inject constructor(private val repo: LoaRepository) : ViewModel() {
    private val _state = MutableStateFlow<NetworkResult<List<LoaDto>>>(NetworkResult.Loading)
    val state: StateFlow<NetworkResult<List<LoaDto>>> = _state.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch { _state.value = repo.getLoa() }
}

@Composable
fun LoaScreen(onBack: () -> Unit, vm: LoaVm = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    EntityListScaffold("LOA", onBack, state, vm::refresh) { item ->
        ListItem(
            headlineContent = { Text(item.title ?: item.documentNumber ?: "LOA #${item.id}") },
            supportingContent = { Text(listOfNotNull(item.company, item.client, item.status).joinToString(" · ")) }
        )
        HorizontalDivider()
    }
}

@HiltViewModel
class CompaniesVm @Inject constructor(private val repo: CompanyRepository) : ViewModel() {
    private val _state = MutableStateFlow<NetworkResult<List<CompanyDto>>>(NetworkResult.Loading)
    val state = _state.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch { _state.value = repo.getCompanies() }
}

@Composable
fun CompaniesScreen(onBack: () -> Unit, vm: CompaniesVm = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    EntityListScaffold("Companies", onBack, state, vm::refresh) { item ->
        ListItem(
            headlineContent = { Text(item.name ?: "Company #${item.id}") },
            supportingContent = { Text(item.registrationNumber ?: "") }
        )
        HorizontalDivider()
    }
}

@HiltViewModel
class ClientsVm @Inject constructor(private val repo: ClientRepository) : ViewModel() {
    private val _state = MutableStateFlow<NetworkResult<List<ClientDto>>>(NetworkResult.Loading)
    val state = _state.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch { _state.value = repo.getClients() }
}

@Composable
fun ClientsScreen(onBack: () -> Unit, vm: ClientsVm = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    EntityListScaffold("Clients", onBack, state, vm::refresh) { item ->
        ListItem(
            headlineContent = { Text(item.name ?: "Client #${item.id}") },
            supportingContent = { Text(item.email ?: item.phone ?: "") }
        )
        HorizontalDivider()
    }
}

@HiltViewModel
class PasswordsVm @Inject constructor(private val repo: PasswordRepository) : ViewModel() {
    private val _state = MutableStateFlow<NetworkResult<List<PasswordDto>>>(NetworkResult.Loading)
    val state = _state.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch { _state.value = repo.getPasswords() }
}

@Composable
fun PasswordsScreen(onBack: () -> Unit, vm: PasswordsVm = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    EntityListScaffold("Passwords", onBack, state, vm::refresh) { item ->
        ListItem(
            headlineContent = { Text(item.title ?: "Entry #${item.id}") },
            supportingContent = { Text(item.username ?: "••••") }
        )
        HorizontalDivider()
    }
}

@HiltViewModel
class AdminUsersVm @Inject constructor(private val repo: AdminRepository) : ViewModel() {
    private val _state = MutableStateFlow<NetworkResult<List<AdminUserDto>>>(NetworkResult.Loading)
    val state = _state.asStateFlow()
    init { refresh() }
    fun refresh() = viewModelScope.launch { _state.value = repo.getAdminUsers() }
}

@Composable
fun AdminUsersScreen(onBack: () -> Unit, vm: AdminUsersVm = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    EntityListScaffold("Admin users", onBack, state, vm::refresh) { item ->
        ListItem(
            headlineContent = { Text(item.name ?: item.email ?: "User #${item.id}") },
            supportingContent = { Text(item.role ?: "") }
        )
        HorizontalDivider()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> EntityListScaffold(
    title: String,
    onBack: () -> Unit,
    state: NetworkResult<List<T>>,
    onRetry: () -> Unit,
    row: @Composable (T) -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            when (state) {
                is NetworkResult.Loading -> LoadingView()
                is NetworkResult.Error -> ErrorView(state.message, onRetry)
                is NetworkResult.Success -> {
                    if (state.data.isEmpty()) EmptyView()
                    else LazyColumn { items(state.data) { row(it) } }
                }
            }
        }
    }
}
