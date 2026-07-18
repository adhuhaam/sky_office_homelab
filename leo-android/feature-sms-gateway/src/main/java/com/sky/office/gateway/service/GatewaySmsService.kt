package com.sky.office.gateway.service

import android.app.Activity
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.sky.office.gateway.BuildConfig
import com.sky.office.gateway.GatewayConstants.CHANNEL_SERVICE
import com.sky.office.gateway.R
import com.sky.office.gateway.data.local.dao.SmsLogDao
import com.sky.office.gateway.data.local.entity.SmsLogEntity
import com.sky.office.gateway.data.preferences.GatewayPreferences
import com.sky.office.gateway.data.remote.GatewayApiService
import com.sky.office.gateway.data.remote.dto.HeartbeatHubDto
import com.sky.office.gateway.data.remote.dto.HeartbeatRequest
import com.sky.office.gateway.data.remote.dto.SendSmsHubRequest
import com.sky.office.gateway.data.remote.dto.SmsResultHubDto
import com.sky.office.gateway.data.remote.dto.SmsResultRequest
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.HubConnectionState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject

@AndroidEntryPoint
class GatewaySmsService : android.app.Service() {

    @Inject lateinit var appPreferences: GatewayPreferences
    @Inject lateinit var apiService: GatewayApiService
    @Inject lateinit var smsLogDao: SmsLogDao

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var hubConnection: HubConnection? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var serverUrl = ""
    private var gatewayId = ""
    private var gatewayKey = ""

    // Tracks pending BroadcastReceivers for SMS sent results keyed by messageId
    private val smsSentReceivers = ConcurrentHashMap<String, BroadcastReceiver>()

    // ──────────────────────────────────────────────────────────────────────────
    // Lifecycle
    // ──────────────────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        ServiceStatus.setRunning(true)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundCompat()

        serviceScope.launch {
            val prefs = appPreferences.getPrefsSnapshot()
            if (!prefs.isRegistered) {
                Timber.w("Gateway not registered — service stopping")
                stopSelf()
                return@launch
            }
            serverUrl = prefs.serverUrl
            gatewayId = prefs.gatewayId
            gatewayKey = prefs.gatewayKey

            connectSignalR()
            startHeartbeatLoop()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        ServiceStatus.reset()
        heartbeatJob?.cancel()
        reconnectJob?.cancel()
        disconnectHub()
        serviceScope.cancel()
        smsSentReceivers.forEach { (_, r) -> runCatching { unregisterReceiver(r) } }
        smsSentReceivers.clear()
    }

    override fun onBind(intent: Intent?) = null

    // ──────────────────────────────────────────────────────────────────────────
    // SignalR
    // ──────────────────────────────────────────────────────────────────────────

    private fun connectSignalR() {
        disconnectHub()
        ServiceStatus.setConnectionState(ConnectionState.CONNECTING)
        updateNotification(getString(R.string.notification_text_connecting))

        val hubUrl = "$serverUrl/hubs/sms-gateway?gatewayId=$gatewayId&gatewayKey=$gatewayKey"
        Timber.d("Connecting to SignalR: $hubUrl")

        val hub = HubConnectionBuilder.create(hubUrl).build()
        hubConnection = hub

        hub.on("SendSms", { request: SendSmsHubRequest ->
            Timber.d("SendSms event: ${request.queueId} → ${request.recipient}")
            serviceScope.launch { handleIncomingSms(request) }
        }, SendSmsHubRequest::class.java)

        hub.onClosed { error ->
            Timber.w("SignalR closed: ${error?.message}")
            ServiceStatus.setConnectionState(ConnectionState.DISCONNECTED)
            updateNotification(getString(R.string.notification_text_disconnected))
            scheduleReconnect()
        }

        hub.start()
            .subscribe(
                {
                    Timber.i("SignalR connected")
                    ServiceStatus.setConnectionState(ConnectionState.CONNECTED)
                    ServiceStatus.setLastError(null)
                    updateNotification(getString(R.string.notification_text_connected))
                },
                { error ->
                    Timber.e(error, "SignalR connect error")
                    ServiceStatus.setConnectionState(ConnectionState.DISCONNECTED)
                    ServiceStatus.setLastError(error.message)
                    updateNotification(getString(R.string.notification_text_disconnected))
                    scheduleReconnect()
                },
            )
    }

    private fun disconnectHub() {
        runCatching {
            hubConnection?.stop()?.subscribe({}, {})
        }
        hubConnection = null
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = serviceScope.launch {
            delay(RECONNECT_DELAY_MS)
            if (isActive) {
                Timber.d("Attempting SignalR reconnect…")
                connectSignalR()
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Heartbeat
    // ──────────────────────────────────────────────────────────────────────────

    private fun startHeartbeatLoop() {
        heartbeatJob?.cancel()
        heartbeatJob = serviceScope.launch {
            while (isActive) {
                delay(HEARTBEAT_INTERVAL_MS)
                sendHeartbeat()
            }
        }
    }

    private suspend fun sendHeartbeat() {
        val hub = hubConnection
        val gid = gatewayId.toIntOrNull() ?: return
        try {
            if (hub?.connectionState == HubConnectionState.CONNECTED) {
                hub.send(
                    "Heartbeat",
                    HeartbeatHubDto(
                        queueLength = ServiceStatus.pendingCount.value,
                        connection = "signalr",
                        androidVersion = Build.VERSION.RELEASE,
                        deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                        appVersion = BuildConfig.VERSION_NAME,
                    ),
                )
            } else {
                apiService.heartbeat(
                    "$serverUrl/api/gateway/heartbeat",
                    HeartbeatRequest(
                        gatewayId = gid,
                        gatewayKey = gatewayKey,
                        queueLength = ServiceStatus.pendingCount.value,
                        connection = "rest",
                        androidVersion = Build.VERSION.RELEASE,
                        deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
                        appVersion = BuildConfig.VERSION_NAME,
                    ),
                )
            }
        } catch (e: Exception) {
            Timber.w(e, "Heartbeat failed")
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SMS Sending
    // ──────────────────────────────────────────────────────────────────────────

    private suspend fun handleIncomingSms(request: SendSmsHubRequest) {
        val messageId = request.queueId.toString()
        val phoneNumber = request.recipient
        val message = request.message
        if (request.queueId <= 0 || phoneNumber.isBlank()) {
            Timber.w("Received invalid SendSms payload")
            return
        }

        smsLogDao.insert(SmsLogEntity(messageId, phoneNumber, message, "pending"))
        ServiceStatus.setPendingCount(ServiceStatus.pendingCount.value + 1)

        dispatchSms(messageId, phoneNumber, message)
    }

    private fun dispatchSms(messageId: String, phoneNumber: String, message: String) {
        val sentAction = "${packageName}.SMS_SENT.$messageId"

        val sentPI = PendingIntent.getBroadcast(
            this,
            messageId.hashCode(),
            Intent(sentAction).putExtra(EXTRA_MESSAGE_ID, messageId).putExtra(EXTRA_PHONE, phoneNumber),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_ONE_SHOT,
        )

        val sentReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                val mid = intent.getStringExtra(EXTRA_MESSAGE_ID) ?: messageId
                val phone = intent.getStringExtra(EXTRA_PHONE) ?: phoneNumber
                smsSentReceivers.remove(mid)
                runCatching { unregisterReceiver(this) }
                serviceScope.launch {
                    if (resultCode == Activity.RESULT_OK) {
                        onSmsSent(mid, phone)
                    } else {
                        onSmsFailed(mid, phone, smsResultCodeToMessage(resultCode))
                    }
                }
            }
        }

        smsSentReceivers[messageId] = sentReceiver
        ContextCompat.registerReceiver(
            this, sentReceiver, IntentFilter(sentAction),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )

        try {
            val smsManager = getSmsManager()
            val parts = smsManager.divideMessage(message)
            if (parts.size == 1) {
                smsManager.sendTextMessage(phoneNumber, null, message, sentPI, null)
            } else {
                // Last-part PI triggers our callback; others are no-ops
                val sentPIs = ArrayList(parts.mapIndexed { i, _ ->
                    if (i == parts.lastIndex) sentPI else null
                })
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentPIs, null)
            }
        } catch (e: Exception) {
            Timber.e(e, "sendTextMessage threw")
            smsSentReceivers.remove(messageId)
            runCatching { unregisterReceiver(sentReceiver) }
            serviceScope.launch { onSmsFailed(messageId, phoneNumber, e.message ?: "Send error") }
        }
    }

    @Suppress("DEPRECATION")
    private fun getSmsManager(): SmsManager =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
            getSystemService(SmsManager::class.java)!!
        else
            SmsManager.getDefault()

    private suspend fun onSmsSent(messageId: String, phoneNumber: String) {
        Timber.i("SMS sent: $messageId → $phoneNumber")
        smsLogDao.updateStatus(messageId, "sent")
        ServiceStatus.decrementPending()
        ServiceStatus.incrementSent()
        reportResult(messageId, "completed", null)
    }

    private suspend fun onSmsFailed(messageId: String, phoneNumber: String, error: String) {
        Timber.w("SMS failed: $messageId → $error")
        smsLogDao.updateStatus(messageId, "failed", error)
        ServiceStatus.decrementPending()
        ServiceStatus.incrementFailed()
        reportResult(messageId, "failed", error)
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Result reporting (hub → REST fallback)
    // ──────────────────────────────────────────────────────────────────────────

    private suspend fun reportResult(messageId: String, status: String, error: String?) {
        val hub = hubConnection
        val queueId = messageId.toIntOrNull() ?: return
        val gid = gatewayId.toIntOrNull() ?: return
        try {
            if (hub?.connectionState == HubConnectionState.CONNECTED) {
                val dto = SmsResultHubDto(queueId, error ?: if (status == "completed") "ok" else null)
                if (status == "completed") {
                    hub.send("SmsCompleted", dto)
                } else {
                    hub.send("SmsFailed", dto)
                }
            } else {
                apiService.reportResult(
                    "$serverUrl/api/gateway/result",
                    SmsResultRequest(
                        gatewayId = gid,
                        gatewayKey = gatewayKey,
                        queueId = queueId,
                        success = status == "completed",
                        response = error,
                    ),
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to report SMS result for $messageId")
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Notification
    // ──────────────────────────────────────────────────────────────────────────

    private fun buildNotification(text: String): Notification {
        val tapIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_OPEN_GATEWAY, true)
        }
        val tapPI = tapIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE)
        }
        return NotificationCompat.Builder(this, CHANNEL_SERVICE)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(tapPI)
            .build()
    }

    private fun startForegroundCompat() {
        val notification = buildNotification(getString(R.string.notification_text_connecting))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Companion
    // ──────────────────────────────────────────────────────────────────────────

    companion object {
        const val EXTRA_OPEN_GATEWAY = "com.sky.office.OPEN_GATEWAY"
        private const val NOTIFICATION_ID = 1001
        private const val RECONNECT_DELAY_MS = 5_000L
        private const val HEARTBEAT_INTERVAL_MS = 30_000L
        private const val EXTRA_MESSAGE_ID = "messageId"
        private const val EXTRA_PHONE = "phoneNumber"

        val isRunning get() = ServiceStatus.isRunning.value

        fun start(context: Context) {
            val intent = Intent(context, GatewaySmsService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, GatewaySmsService::class.java))
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private fun smsResultCodeToMessage(code: Int) = when (code) {
        SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "Generic failure"
        SmsManager.RESULT_ERROR_NO_SERVICE -> "No service"
        SmsManager.RESULT_ERROR_NULL_PDU -> "Null PDU"
        SmsManager.RESULT_ERROR_RADIO_OFF -> "Radio off"
        else -> "Error code: $code"
    }
}
