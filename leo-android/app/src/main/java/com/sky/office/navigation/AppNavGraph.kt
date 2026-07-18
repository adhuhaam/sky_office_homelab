package com.sky.office.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.sky.office.gateway.ui.navigation.GatewayNavGraph
import com.sky.office.ui.MainScreen
import com.sky.office.ui.screens.auth.LoginScreen
import com.sky.office.ui.screens.auth.LoginViewModel

@Composable
fun AppNavGraph(
    openGatewayInitially: Boolean = false,
    onGatewayOpened: () -> Unit = {},
) {
    val navController = rememberNavController()
    val loginViewModel: LoginViewModel = hiltViewModel()
    val isLoggedIn by loginViewModel.isLoggedIn.collectAsStateWithLifecycle()

    LaunchedEffect(isLoggedIn) {
        when (isLoggedIn) {
            true -> navController.navigate(Screen.Main.route) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
            false -> { /* stay on login */ }
            null -> Unit
        }
    }

    LaunchedEffect(openGatewayInitially, isLoggedIn) {
        if (openGatewayInitially && isLoggedIn == true) {
            navController.navigate(Screen.SmsGateway.route)
            onGatewayOpened()
        }
    }

    if (isLoggedIn == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                viewModel = hiltViewModel(),
                onNavigateToMain = {
                    navController.navigate(Screen.Main.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }
        composable(Screen.Main.route) {
            MainScreen(
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onOpenSmsGateway = {
                    navController.navigate(Screen.SmsGateway.route)
                }
            )
        }
        composable(Screen.SmsGateway.route) {
            GatewayNavGraph(
                onExitToOffice = {
                    navController.popBackStack()
                }
            )
        }
    }
}
