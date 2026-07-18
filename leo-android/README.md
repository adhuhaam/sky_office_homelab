# Sky Office (Android)

**One master app** — office admin + optional SMS gateway node in a single APK.

| Setting | Value |
|---------|-------|
| App name | **Sky Office** |
| Package / applicationId | `com.sky.office` |
| Path | `leo-android/` (project folder name; product identity is Sky Office) |
| UI | Kotlin + Jetpack Compose + Material 3 |
| Modules | `:app` (shell + office) · `:feature-sms-gateway` (SIM relay) |
| Session (office) | Bearer from `/api/auth/mobile-token` |
| SMS node | Gateway key + SignalR `/hubs/sms-gateway` |
| Default API | `http://100.126.222.96` (set in Profile) |

Canonical docs: [docs/ANDROID-APPS.md](../docs/ANDROID-APPS.md) · [docs/SMS-GATEWAY.md](../docs/SMS-GATEWAY.md) · [PARITY-QA.md](PARITY-QA.md)

## Modes (one icon)

| Mode | How to enter | Purpose |
|------|----------------|---------|
| **Office** | Login with staff credentials | Home, Master, Upload, Billing, Expenses, Salary, More |
| **SMS node** | Bottom tab **SMS** (or notification tap) | Register SIM phone, foreground SignalR relay, local logs |

## Build on your PC

Homelab server does **not** build this app.

```bash
git clone git@github.com:adhuhaam/sky_office_homelab.git
# Android Studio → Open leo-android/
# First sync may generate gradlew
./gradlew :app:assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk` · package `com.sky.office`
