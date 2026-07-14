# Leo SMS Gateway

Android SIM SMS relay for Sky Office. Connects to ASP.NET via **REST + SignalR** (`/hubs/sms-gateway`). No Firebase.

**Full system docs:** [docs/SMS-GATEWAY.md](../docs/SMS-GATEWAY.md) · [docs/ANDROID-APPS.md](../docs/ANDROID-APPS.md)

---

## Stack

| Layer | Choice |
|-------|--------|
| UI | Jetpack Compose + Material 3 |
| DI | Hilt |
| Network | Retrofit + OkHttp (cleartext allowed) |
| Realtime | Microsoft SignalR Java client |
| Local DB | Room (outbound logs) |
| Background | Foreground Service + WorkManager + BOOT_COMPLETED |

**applicationId:** `com.leo.smsgateway` · minSdk 26 · targetSdk 34

---

## Screens

| Screen | Purpose |
|--------|---------|
| Login / Register | Server URL + name → `POST /api/gateway/register` |
| Dashboard | Connection, telemetry, queue counts |
| Logs | Local send history |
| Settings | URL, credentials, restart / unregister |

---

## Build on your PC

```bash
git clone git@github.com:adhuhaam/sky_office_homelab.git
# Android Studio → Open leo-sms-gateway/
./gradlew assembleDebug   # after wrapper exists
```

Install on a phone with an active SIM. Prefer Tailscale URL `http://100.126.222.96`.

---

## Server contract (aligned with API)

### Register

```
POST {server}/api/gateway/register
Body: { "name", "deviceId", "deviceModel", "androidVersion", "appVersion" }
Response: { "id", "name", "gatewayKey", "hubPath", "heartbeatIntervalSeconds" }
```

Store `id` as gatewayId and **gatewayKey** (shown once).

### Hub

```
{server}/hubs/sms-gateway?gatewayId={id}&gatewayKey={key}

Server → device:  SendSms({ queueId, recipient, message })
Device → server:  Heartbeat(dto), SmsCompleted({ queueId, response }), SmsFailed({ queueId, response })
```

### REST fallback

```
POST {server}/api/gateway/heartbeat
  { gatewayId, gatewayKey, batteryLevel?, … }

POST {server}/api/gateway/result
  { gatewayId, gatewayKey, queueId, success, response? }
```

---

## Permissions

`SEND_SMS` · `READ_PHONE_STATE` · `POST_NOTIFICATIONS` · `FOREGROUND_SERVICE*` · `RECEIVE_BOOT_COMPLETED` · `WAKE_LOCK` · `INTERNET` · `ACCESS_NETWORK_STATE`

OEM battery exemptions (Xiaomi / Samsung) are required for reliable heartbeats.

---

## Ops visibility

After register: web **SMS Gateways** (`/sms-gateways`) and **About System** SMS card should show the device when online.
