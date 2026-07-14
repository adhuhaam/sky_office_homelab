# Leo Admin (Android)

Native Kotlin + Jetpack Compose replacement for the Expo app at `leo-os/apps/mobile`.

| Setting | Value |
|---------|-------|
| Package | `com.leo.admin` |
| UI | Compose + Material 3 |
| DI | Hilt |
| Network | Retrofit + OkHttp (cleartext for LAN/Tailscale) |
| Default API | Configurable in Profile (Tailscale `http://100.126.222.96`) |

## Screens (parity waves)

- Wave 0–1: Login, session, dashboard stats/tasks, master list, passport detail
- Wave 2: Upload (multipart OCR), LOA list
- Wave 3: Companies, clients, passwords
- Wave 4: Billing, expenses, salary lists
- Wave 5: Admin users, profile (base URL + logout)
- Wave 6: Remaining Expo polish (QR / haptics) still pending device QA

## Open in Android Studio

1. Open `apps/leo-android`
2. Sync Gradle (AGP 8.5 / Gradle 8.7)
3. Run on device or emulator with network to the API

```bash
# After wrapper is generated (Android Studio or gradle wrapper):
./gradlew assembleDebug
```

Expo remains at `leo-os/apps/mobile` until parity QA is signed off.
