package com.sky.office

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.sky.office.gateway.service.GatewaySmsService
import com.sky.office.gateway.worker.HeartbeatWorker
import com.sky.office.navigation.AppNavGraph
import com.sky.office.ui.theme.SkyOfficeTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private var openGatewayRequested by mutableStateOf(false)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openGatewayRequested =
            intent?.getBooleanExtra(GatewaySmsService.EXTRA_OPEN_GATEWAY, false) == true
        HeartbeatWorker.schedule(this)
        enableEdgeToEdge()
        setContent {
            SkyOfficeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    AppNavGraph(
                        openGatewayInitially = openGatewayRequested,
                        onGatewayOpened = { openGatewayRequested = false },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(GatewaySmsService.EXTRA_OPEN_GATEWAY, false)) {
            openGatewayRequested = true
        }
    }
}
