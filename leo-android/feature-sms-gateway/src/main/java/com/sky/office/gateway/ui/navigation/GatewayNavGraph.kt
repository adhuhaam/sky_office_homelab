package com.sky.office.gateway.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.sky.office.gateway.ui.screen.dashboard.DashboardScreen
import com.sky.office.gateway.ui.screen.login.LoginScreen
import com.sky.office.gateway.ui.screen.login.LoginViewModel
import com.sky.office.gateway.ui.screen.logs.LogsScreen
import com.sky.office.gateway.ui.screen.settings.SettingsScreen

private object RootRoute {
    const val LOGIN = "gw_root_login"
    const val MAIN = "gw_root_main"
}

@Composable
fun GatewayNavGraph(
    onExitToOffice: () -> Unit = {},
) {
    val rootNav = rememberNavController()
    val loginVm: LoginViewModel = hiltViewModel()
    val isRegistered by loginVm.isRegistered.collectAsState(initial = false)

    NavHost(
        navController = rootNav,
        startDestination = if (isRegistered) RootRoute.MAIN else RootRoute.LOGIN,
    ) {
        composable(RootRoute.LOGIN) {
            LoginScreen(
                onRegistered = {
                    rootNav.navigate(RootRoute.MAIN) {
                        popUpTo(RootRoute.LOGIN) { inclusive = true }
                    }
                },
                onExitToOffice = onExitToOffice,
            )
        }

        composable(RootRoute.MAIN) {
            MainScaffold(
                onLoggedOut = {
                    rootNav.navigate(RootRoute.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onExitToOffice = onExitToOffice,
            )
        }
    }
}

@Composable
private fun MainScaffold(
    onLoggedOut: () -> Unit,
    onExitToOffice: () -> Unit,
) {
    val innerNav = rememberNavController()

    Scaffold(
        bottomBar = {
            val navBackStackEntry by innerNav.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination
            NavigationBar {
                bottomNavItems.forEach { item ->
                    NavigationBarItem(
                        selected = currentDestination?.hierarchy?.any { it.route == item.screen.route } == true,
                        onClick = {
                            innerNav.navigate(item.screen.route) {
                                popUpTo(innerNav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = innerNav,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(Screen.Dashboard.route) { DashboardScreen() }
            composable(Screen.Logs.route) { LogsScreen() }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    onLoggedOut = onLoggedOut,
                    onExitToOffice = onExitToOffice,
                )
            }
        }
    }
}
