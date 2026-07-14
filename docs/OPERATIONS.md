# Operations

Day-to-day access, scripts, and troubleshooting for the self-hosted Sky Office stack.

## Access URLs

| Device / use | URL | Notes |
|--------------|-----|-------|
| PC on home Wi‑Fi | `https://192.168.18.150/` | Accept self-signed cert once |
| Phone browser (Tailscale) | `http://100.126.222.96/` | App must be on Tailscale |
| Mobile app API | `http://100.126.222.96` | `EXPO_PUBLIC_API_URL` |

**Do not use**

- `https://100.126.222.96` — no valid TLS on raw tailnet IP
- MagicDNS (`server.snowy-pride.ts.net`) — intentionally abandoned for Leo OS access

### Health checks

```bash
curl -k https://192.168.18.150/api/health
curl -s http://100.126.222.96/api/health
# Expected: {"status":"ok"}
```

## Server identity

| Item | Value |
|------|-------|
| Hostname | `server` |
| LAN IP | `192.168.18.150` |
| Tailscale IP | `100.126.222.96` |
| Tailnet | `leo.emp.services@gmail.com` |
| OS user | `adhuhaam` |

## Scripts (`apps/scripts/`)

Most need **sudo**.

| Script | Purpose |
|--------|---------|
| `go-live.sh` | **Primary** — stop CasaOS, ensure TLS, start stack, disable Tailscale Serve |
| `fix-tailscale-ssl.sh` | Recreate proxy/API-related pieces, reset Serve, verify URLs |
| `stop-casaos.sh` | Stop/disable CasaOS only |
| `setup-host.sh` | Legacy host nginx + Serve — superseded by Docker `leo-proxy` |

```bash
sudo bash /home/adhuhaam/apps/scripts/go-live.sh
sudo bash /home/adhuhaam/apps/scripts/fix-tailscale-ssl.sh
```

## Common docker commands

```bash
cd /home/adhuhaam/apps
docker compose ps
docker compose logs -f leo-api
docker compose up -d --build --force-recreate leo-api
docker compose up -d --force-recreate leo-proxy
```

## Why split HTTP / HTTPS?

- **LAN HTTPS:** PCs accept a one-time self-signed warning; HTTP on LAN redirects to HTTPS.
- **Tailscale HTTP:** Avoids cert errors on mobile browsers and React Native; WireGuard still encrypts the path.
- **Tailscale Serve:** Disabled (`tailscale serve reset`) — conflicts with Docker binding 80/443.

## Known failure modes (resolved historically)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_SSL_PROTOCOL_ERROR` on HTTPS Tailscale IP | Serve + Docker both on 443 / cert mismatch | Use HTTP on `100.x`; disable Serve |
| CasaOS `Not Found` on `/api/health` | CasaOS owned port 80 | `go-live.sh` / `stop-casaos.sh` |
| Cookies fail on HTTP | `COOKIE_SECURE` without `secure: "auto"` | Current session code uses `"auto"` |
| Mobile cleartext blocked | Android blocks HTTP | `usesCleartextTraffic: true` in mobile `app.json` |

## Security ops notes

- Do not publish Postgres ports to the host
- Do not expose LAN 443 or Tailscale 80 to the public internet without real TLS and hardening
- Secrets only in `api/.env` / `postgresql/.env`
- Self-signed TLS is for private LAN only

## Quick reference card

```
PC (Wi‑Fi):     https://192.168.18.150/
Phone (TS):     http://100.126.222.96/
Mobile API:     http://100.126.222.96

Go live:   sudo bash apps/scripts/go-live.sh
Fix TS:    sudo bash apps/scripts/fix-tailscale-ssl.sh
Deploy UI: cd leo-os && pnpm deploy:web
```

Deeper history: [memory_of_project.md](../memory_of_project.md).
