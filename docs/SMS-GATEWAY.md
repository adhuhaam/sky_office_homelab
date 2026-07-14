# SMS Gateway

Android SIM devices relay outbound SMS for Sky Office / LEO OS. There is no Firebase — gateways use LAN or Tailscale HTTP + SignalR.

## Architecture

```
Product code → INotificationService → sms_queue
       → SmsDispatchWorker → SignalR SmsGatewayHub → leo-sms-gateway APK → carrier SMS
```

| Piece | Location |
|-------|----------|
| Tables | `sms_gateways`, `sms_queue`, `sms_logs`, `notification_templates` |
| API | `leo-os-dotnet` · `/api/gateway/*` · `/api/sms/*` · hub `/hubs/sms-gateway` |
| Android | `apps/leo-sms-gateway` |
| Web ops | Superuser → **SMS Gateways** (`/sms-gateways`) |

## Configure a phone

1. Install `leo-sms-gateway` debug/release APK.
2. Set server URL to `http://100.126.222.96` (Tailscale) or `http://192.168.x.x` (LAN) — same binary.
3. Register with a display name; store the returned `gatewayKey`.
4. Grant SMS + notification permissions; disable OEM battery killers for the app.
5. Foreground service keeps SignalR up and heartbeats every ~30s.

## Send SMS

- Product hooks (already wired): LOA create → template `LoaCreated`; work-permit alerts → `PermitExpiring` (7-day cooldown per passport, emergency phone only).
- Manual: `POST /api/sms/send` `{ "recipient": "+960…", "message": "…" }` or web SMS Gateways page.
- Prefer templates: `POST /api/sms/send` with `templateCode`.

Business features must call `INotificationService` — never SMS from controllers beyond that facade (hooks above are thin adapters).

## Nginx / WebSocket

`react` and `leo-proxy` must forward `Upgrade` / `Connection` for `/hubs/`. Already configured under `react/nginx/default.conf` and `infra/nginx/leo-os-docker.conf`.

## Auth

| Caller | Auth |
|--------|------|
| Gateway device | `gatewayId` + `gatewayKey` (query for hub; body for REST) |
| Admin / superuser | Cookie or Bearer session |

## Ops checklist

- [ ] Gateway shows **online** on `/sms-gateways`
- [ ] Test SMS appears in queue → `Sending` → `Sent`
- [ ] Heartbeat updates battery / last seen
- [ ] Retry: offline gateway → Pending retries (30s / 2m) then Failed
