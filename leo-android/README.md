# Leo Admin (Android)

Native Kotlin + Jetpack Compose field app. Replaces Expo `leo-os/apps/mobile`.

Canonical docs: [docs/ANDROID-APPS.md](../docs/ANDROID-APPS.md) · [docs/SMS-GATEWAY.md](../docs/SMS-GATEWAY.md) · [PARITY-QA.md](PARITY-QA.md)

| Setting | Value |
|---------|-------|
| Package / applicationId | `com.leo.admin` |
| UI | Compose + Material 3 |
| DI | Hilt |
| Network | Retrofit + OkHttp (cleartext for LAN/Tailscale) |
| Session | Bearer from `/api/auth/mobile-token` (DataStore) |
| Default API idea | `http://100.126.222.96` (set in Profile) |

## Screens (parity waves)

| Wave | Features |
|------|----------|
| 0–1 | Login, session, dashboard, master list, passport detail |
| 2 | Upload (multipart OCR), LOA list |
| 3 | Companies, clients, passwords |
| 4 | Billing, expenses, salary lists |
| 5 | Admin users, profile (base URL + logout) |
| 6 | Expo polish (QR / haptics) + parity QA |

## Build on your PC

Homelab server does **not** build this app.

```bash
git clone git@github.com:adhuhaam/sky_office_homelab.git
# Android Studio → Open leo-android/
# First sync may generate gradlew
./gradlew assembleDebug
```

APK: `app/build/outputs/apk/debug/app-debug.apk`

## Do not confuse with SMS gateway

`leo-sms-gateway` (`com.leo.smsgateway`) is a separate APK for SIM relays.
