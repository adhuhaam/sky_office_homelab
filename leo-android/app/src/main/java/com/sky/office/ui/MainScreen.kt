package com.sky.office.ui

import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.NavType
import com.sky.office.navigation.Screen
import com.sky.office.ui.screens.auth.LoginViewModel
import com.sky.office.ui.screens.billing.BillingScreen
import com.sky.office.ui.screens.dashboard.DashboardScreen
import com.sky.office.ui.screens.expenses.ExpensesScreen
import com.sky.office.ui.screens.master.MasterScreen
import com.sky.office.ui.screens.master.PassportDetailScreen
import com.sky.office.ui.screens.more.*
import com.sky.office.ui.screens.profile.ProfileScreen
import com.sky.office.ui.screens.salary.SalaryScreen
import com.sky.office.ui.screens.upload.UploadScreen

data class BottomNavItem(
    val route: String,
    val icon: ImageVector,
    val label: String
)

@Composable
fun MainScreen(
    onLogout: () -> Unit,
    onOpenSmsGateway: () -> Unit = {},
) {
    val navController = rememberNavController()
    val loginViewModel: LoginViewModel = hiltViewModel()
    val userRole by loginViewModel.userRole.collectAsStateWithLifecycle()

    val allNavItems = listOf(
        BottomNavItem(Screen.Dashboard.route, Icons.Filled.Home, "Home"),
        BottomNavItem(Screen.Master.route, Icons.Filled.ManageSearch, "Master"),
        BottomNavItem(Screen.Upload.route, Icons.Filled.CloudUpload, "Upload"),
        BottomNavItem(Screen.Billing.route, Icons.Filled.Receipt, "Billing"),
        BottomNavItem(Screen.Expenses.route, Icons.Filled.AccountBalance, "Expenses"),
        BottomNavItem(Screen.Salary.route, Icons.Filled.Payments, "Salary"),
        BottomNavItem(Screen.More.route, Icons.Filled.MoreHoriz, "More"),
    )

    // Role-gate Expenses / Salary / Billing by staff role
    val navItems = remember(userRole) {
        val staff = setOf("superuser", "admin", "company", "client", "agent", "employee")
        val financeRoles = setOf("superuser", "admin", "company", "client", "employee")
        val expenseRoles = setOf("superuser", "admin")
        allNavItems.filter { item ->
            when (item.route) {
                Screen.Expenses.route -> userRole in expenseRoles
                Screen.Salary.route -> userRole in financeRoles
                Screen.Billing.route -> userRole in financeRoles
                Screen.Upload.route -> userRole in setOf("superuser", "admin", "company")
                else -> userRole == null || userRole in staff
            }
        }
    }

    val currentBackStack by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStack?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar(tonalElevation = 3.dp) {
                navItems.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = {
                            Text(
                                item.label,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.labelSmall
                            )
                        },
                        selected = currentRoute == item.route,
                        onClick = {
                            navController.navigate(item.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(
                bottom = paddingValues.calculateBottomPadding(),
                start = paddingValues.calculateStartPadding(LayoutDirection.Ltr),
                end = paddingValues.calculateEndPadding(LayoutDirection.Ltr)
            )
        ) {
            composable(Screen.Dashboard.route) {
                DashboardScreen()
            }
            composable(Screen.Master.route) {
                MasterScreen(navController = navController)
            }
            composable(
                route = Screen.PassportDetail.route,
                arguments = listOf(navArgument("passportId") { type = NavType.IntType })
            ) { backStack ->
                val id = backStack.arguments?.getInt("passportId") ?: return@composable
                PassportDetailScreen(passportId = id, onBack = { navController.popBackStack() })
            }
            composable(Screen.Upload.route) {
                UploadScreen()
            }
            composable(Screen.Billing.route) {
                BillingScreen()
            }
            composable(Screen.Expenses.route) {
                ExpensesScreen()
            }
            composable(Screen.Salary.route) {
                SalaryScreen()
            }
            composable(Screen.More.route) {
                MoreScreen(
                    navController = navController,
                    onOpenSmsGateway = onOpenSmsGateway,
                )
            }
            composable(Screen.Loa.route) {
                LoaScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.Companies.route) {
                CompaniesScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.Clients.route) {
                ClientsScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.Passwords.route) {
                PasswordsScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.AdminUsers.route) {
                AdminUsersScreen(onBack = { navController.popBackStack() })
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    onBack = { navController.popBackStack() },
                    onLogout = onLogout
                )
            }
        }
    }
}
