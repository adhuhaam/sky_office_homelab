# Android — Sky Office

**One product, one APK:** **Sky Office** (`com.sky.office`) — Kotlin + Jetpack Compose.

| App | Path | Package | Role |
|-----|------|---------|------|
| **Sky Office** | `leo-android/` | `com.sky.office` | Office admin + optional SMS gateway node |

Canonical git remote: `git@github.com:adhuhaam/sky_office_homelab.git` (`origin`).

Feature QA: `leo-android/PARITY-QA.md`. SMS backend: [SMS-GATEWAY.md](SMS-GATEWAY.md).

---

## Local PC build (preferred)

Android is **not** built on the homelab server. Pull and build on a workstation with Android Studio.

```bash
git clone git@github.com:adhuhaam/sky_office_homelab.git
cd leo-android
# Android Studio sync, or:
gradle wrapper --gradle-version 8.7   # if gradlew missing
./gradlew :app:assembleDebug
```

### Sky Office

1. Android Studio → Open `leo-android/`
2. Sync (AGP ~8.5, Gradle 8.7, Compose Material 3, Hilt)
3. Run on device/emulator with Tailscale or LAN reachability
4. **Profile** → set API base URL (default idea: `http://100.126.222.96`)
5. Login with the same credentials as the web PWA (`Authorization: Bearer` session)
6. Optional: bottom tab **SMS** on a SIM phone to register as a relay

**Stack:** Hilt · Navigation Compose · Retrofit · OkHttp · DataStore · Room (gateway logs) · SignalR · WorkManager · `usesCleartextTraffic` for LAN/Tailscale HTTP.

**Gradle modules:**

| Module | Responsibility |
|--------|----------------|
| `:app` | Shell, auth, office screens, app identity `com.sky.office` |
| `:feature-sms-gateway` | Gateway register, SignalR service, logs, settings |

---

## API base URLs

| Network | URL |
|---------|-----|
| Tailscale | `http://100.126.222.96` |
| LAN | `http://192.168.x.x` or via `https://192.168.18.150` (cert caveats on Android) |

Prefer **HTTP Tailscale** for phones — cleartext is enabled intentionally. WireGuard encrypts the path.

---

## Auth (office mode)

1. `POST /api/auth/login`
2. `GET /api/auth/mobile-token` → session id
3. Subsequent calls: `Authorization: Bearer <sessionId>`

Cookie `leo.sid` is for browsers; Android uses Bearer. See [AUTH.md](AUTH.md).

SMS node mode uses **gateway key** auth (`POST /api/gateway/register`) — independent of office login.

---

## Shipping policy

| Artifact | Policy |
|----------|--------|
| `com.sky.office` debug/release APK | **Only** Android client — build on PC |

---

## Repo notes

- Paths under homelab root `/home/adhuhaam/apps`
- Do not create a parallel `/src/SkyOffice.*` solution — .NET stays in `leo-os-dotnet/`
- Never commit `.apk`, keystores, `local.properties`, or `.gradle/`
