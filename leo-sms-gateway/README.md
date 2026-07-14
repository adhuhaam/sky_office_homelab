# Leo SMS Gateway

An Android app that acts as an SMS relay gateway. It connects to a backend server via **SignalR** (`/hubs/sms-gateway`), receives `SendSms` events, sends SMS messages via `SmsManager`, and reports results back through the hub or a REST fallback.

---

## Architecture

| Layer | Technology |
|---|---|
| UI | Jetpack Compose + Material 3 |
| DI | Hilt |
| Networking | Retrofit 2 + OkHttp (cleartext allowed) |
| Real-time | Microsoft SignalR Java client (`com.microsoft.signalr:signalr:8.0.7`) |
| Database | Room (SMS log history) |
| Preferences | DataStore |
| Background | Foreground Service + WorkManager watchdog |

---

## Screens

| Screen | Description |
|---|---|
| **Login / Register** | Enter server URL + gateway name → POST `/api/gateway/register` → stores credentials |
| **Dashboard** | SignalR connection status, battery, SIM info, pending/sent/failed counts, Reconnect button |
| **Logs** | Scrollable list of all relayed SMS with status (pending / sent / failed) |
| **Settings** | Edit server URL, view gateway credentials, force restart, unregister |

---

## Opening in Android Studio

1. **Install Android Studio** Hedgehog 2023.1 or later.
2. Open Android Studio → **File → Open** → select the `leo-sms-gateway` folder.
3. Android Studio will automatically download **Gradle 8.7** and all dependencies on first sync.
4. Wait for the Gradle sync to complete (may take a few minutes on first run).

---

## Building an APK

### From Android Studio

1. **Build → Generate Signed Bundle / APK…**
2. Choose **APK**, create or select a keystore, choose `release` build variant.
3. The signed APK will be in `app/release/app-release.apk`.

### Debug APK (no signing required)

1. In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Or from terminal (after Gradle wrapper is set up):

```bash
cd leo-sms-gateway

# Generate Gradle wrapper (requires Gradle installed locally OR use Android Studio)
gradle wrapper --gradle-version 8.7

# Build debug APK
./gradlew assembleDebug
```

The debug APK will be at: `app/build/outputs/apk/debug/app-debug.apk`

---

## Server Integration

### Registration

```
POST {serverUrl}/api/gateway/register
Body: { "name": "...", "deviceId": "...", "deviceModel": "...", "androidVersion": "...", "appVersion": "..." }
Response: { "gatewayId": "...", "gatewayKey": "...", "name": "..." }
```

### SignalR Hub

```
Hub URL: {serverUrl}/hubs/sms-gateway?gatewayId={id}&gatewayKey={key}

Server → Client events:
  SendSms({ messageId, phoneNumber, message })

Client → Server methods:
  Heartbeat(gatewayId)           — every 30 seconds
  SmsCompleted(messageId)        — on successful send
  SmsFailed(messageId, error)    — on failed send
```

### REST Fallback (when hub is disconnected)

```
POST {serverUrl}/api/gateway/result
Body: { "messageId": "...", "gatewayId": "...", "status": "completed|failed", "error": null|"..." }

POST {serverUrl}/api/gateway/heartbeat
Body: { "gatewayId": "...", "timestamp": 1234567890 }
```

---

## Permissions Required (granted at runtime)

| Permission | Purpose |
|---|---|
| `SEND_SMS` | Relay SMS messages |
| `READ_PHONE_STATE` | Read SIM state and operator name |
| `POST_NOTIFICATIONS` | Show foreground service notification (Android 13+) |

---

## Build Config

| Setting | Value |
|---|---|
| `minSdk` | 26 (Android 8.0) |
| `targetSdk` | 34 (Android 14) |
| `applicationId` | `com.leo.smsgateway` |
| Kotlin | 2.0.0 |
| AGP | 8.5.2 |
| Compose BOM | 2024.09.00 |
| SignalR | 8.0.7 |

---

## Notes

- The app uses `usesCleartextTraffic="true"` and a permissive `network_security_config.xml` to support HTTP (non-HTTPS) backend servers on local networks.
- The WorkManager watchdog runs every 15 minutes to restart the foreground service if it was killed. The actual 30-second heartbeat runs as a coroutine inside the service itself.
- SMS logs are stored in a local Room database and accessible in the Logs screen.
