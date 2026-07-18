package com.sky.office.gateway.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    data object Login : Screen("gw_login")
    data object Dashboard : Screen("gw_dashboard")
    data object Logs : Screen("gw_logs")
    data object Settings : Screen("gw_settings")
}

data class BottomNavItem(
    val screen: Screen,
    val label: String,
    val icon: ImageVector,
)

val bottomNavItems = listOf(
    BottomNavItem(Screen.Dashboard, "Dashboard", Icons.Default.Dashboard),
    BottomNavItem(Screen.Logs, "Logs", Icons.Default.List),
    BottomNavItem(Screen.Settings, "Settings", Icons.Default.Settings),
)
