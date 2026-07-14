package com.leo.smsgateway

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.leo.smsgateway.ui.navigation.AppNavGraph
import com.leo.smsgateway.ui.theme.LeoSmsGatewayTheme
import com.leo.smsgateway.worker.HeartbeatWorker
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        HeartbeatWorker.schedule(this)
        setContent {
            LeoSmsGatewayTheme {
                AppNavGraph()
            }
        }
    }
}
