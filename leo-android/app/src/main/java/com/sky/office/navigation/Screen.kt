package com.sky.office.navigation

sealed class Screen(val route: String) {
    // Auth
    object Login : Screen("login")

    // Main shell
    object Main : Screen("main")

    /** SMS gateway node mode (embedded feature module). */
    object SmsGateway : Screen("sms_gateway")

    // Bottom-nav destinations
    object Dashboard : Screen("dashboard")
    object Master : Screen("master")
    object Upload : Screen("upload")
    object Billing : Screen("billing")
    object Expenses : Screen("expenses")
    object Salary : Screen("salary")
    object More : Screen("more")

    // Detail screens
    object PassportDetail : Screen("passport/{passportId}") {
        fun createRoute(id: Int) = "passport/$id"
    }

    // More sub-screens
    object Loa : Screen("loa")
    object Companies : Screen("companies")
    object Clients : Screen("clients")
    object Passwords : Screen("passwords")
    object AdminUsers : Screen("admin_users")
    object Profile : Screen("profile")
}
