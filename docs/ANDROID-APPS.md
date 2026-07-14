# Android apps

Two separate Kotlin + Jetpack Compose apps. **Do not merge them** — different `applicationId`s and purposes.

| App | Path | Package | Role |
|-----|------|---------|------|
| **Leo Admin** | `leo-android/` | `com.leo.admin` | Field ops UI — Expo replacement |
| **SMS Gateway** | `leo-sms-gateway/` | `com.leo.smsgateway` | SIM SMS relay (foreground + SignalR) |

Canonical git remote: `git@github.com:adhuhaam/sky_office_homelab.git` (`origin`).

Expo (`leo-os/apps/mobile`) is **legacy reference** — do not ship new Expo APKs. Parity QA: `leo-android/PARITY-QA.md`.

SMS backend: [SMS-GATEWAY.md](SMS-GATEWAY.md).

---

## Local PC build (preferred)

Android is **not** built on the homelab server. Pull and build on a workstation with Android Studio.

```bash
git clone git@github.com:adhuhaam/sky_office_homelab.git
# or: git pull
```

### First-time Gradle wrapper

Repos ship `gradle/wrapper/gradle-wrapper.properties` but may lack `gradlew` / `gradle-wrapper.jar`. Android Studio generates them on first sync, or:

```bash
cd leo-android   # or leo-sms-gateway
gradle wrapper --gradle-version 8.7
./gradlew assembleDebug
```

### Leo Admin

1. Android Studio → Open `leo-android/`
2. Sync (AGP ~8.5, Gradle 8.7, Compose Material 3, Hilt)
3. Run on device/emulator with Tailscale or LAN reachability
4. **Profile** → set API base URL (default idea: `http://100.126.222.96`)
5. Login with the same credentials as the web PWA (`Authorization: Bearer` session)

**Stack:** Hilt · Navigation Compose · Retrofit · OkHttp · DataStore · `usesCleartextTraffic` + network security config for HTTP.

**Screens (waves):** Login · Dashboard · Master / passport detail · Upload · Billing · Expenses · Salary · More (LOA, companies, clients, passwords, admin users, profile). See `PARITY-QA.md`.

### SMS Gateway

1. Open `leo-sms-gateway/`
2. Build & install on a **phone with a working SIM**
3. Login: server URL + gateway display name → register
4. Grant SMS / notifications; disable battery optimization for the app
5. Dashboard should show SignalR **connected**; About System / SMS Gateways should show **online**

**Stack:** Hilt · SignalR Java client · Room logs · Foreground Service · WorkManager · BOOT_COMPLETED.

Permissions: `SEND_SMS`, `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE*`, `WAKE_LOCK`, `INTERNET`, `ACCESS_NETWORK_STATE`, `READ_PHONE_STATE`.

---

## API base URLs

| Network | URL |
|---------|-----|
| Tailscale | `http://100.126.222.96` |
| LAN | `http://192.168.x.x` or via `https://192.168.18.150` (cert caveats on Android) |

Prefer **HTTP Tailscale** for phones — cleartext is enabled intentionally (same reason as Expo). WireGuard encrypts the path.

---

## Live status in the web UI

Superuser → **About System** (`/about-system`):

- **Android admin** card — package, path, shipping mode, default API
- **SMS gateway** card — online/offline counts, queue, per-device heartbeat (from `GET /api/system/about` → `androidClients`)

Superuser → **SMS Gateways** (`/sms-gateways`) — manage queue, send test SMS, view logs.

---

## Auth (admin app)

1. `POST /api/auth/login` (or app’s login)
2. `GET /api/auth/mobile-token` → session id
3. Subsequent calls: `Authorization: Bearer <sessionId>`

Cookie `leo.sid` is for browsers; Android uses Bearer. See [AUTH.md](AUTH.md).

---

## Shipping policy

| Artifact | Policy |
|----------|--------|
| `leo-android` debug/release APK | Build on PC; distribute internally after parity QA |
| `leo-sms-gateway` APK | Build on PC; install on dedicated SIM phones |
| Expo APK | **Stopped** for new shipping |

After parity sign-off, archive/stop Expo distribution and keep `leo-os/apps/mobile` as reference only.

---

## Repo notes for contributors / agents

- Paths are siblings of `leo-os/`: `apps/leo-android`, `apps/leo-sms-gateway` under the homelab root `/home/adhuhaam/apps`
- Do not create a parallel `/src/SkyOffice.*` solution — .NET stays in `leo-os-dotnet/`
- Never commit `.apk`, keystores, `local.properties`, or `.gradle/` (see root `.gitignore`)
