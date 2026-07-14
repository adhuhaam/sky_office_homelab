package com.leo.smsgateway.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = TealPrimary,
    onPrimary = OnTeal,
    primaryContainer = TealContainer,
    onPrimaryContainer = OnTeal,
    background = NavyDark,
    onBackground = OnSurfaceDark,
    surface = NavyMid,
    onSurface = OnSurfaceDark,
    surfaceVariant = NavyLight,
    onSurfaceVariant = OnSurfaceDark,
    error = RedError,
)

@Composable
fun LeoSmsGatewayTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = AppTypography,
        content = content,
    )
}
