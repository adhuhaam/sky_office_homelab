# Leo OS Server — Quick Start

```bash
sudo bash /home/adhuhaam/apps/scripts/go-live.sh
```

## URLs

| Device | URL |
|--------|-----|
| PC on home Wi‑Fi | **https://192.168.18.150/** — accept self-signed cert once |
| Phone over Tailscale | **http://100.126.222.96/** |
| Mobile app API | **http://100.126.222.96** |

Traffic on the Tailscale IP is plain HTTP at the app layer but encrypted by Tailscale's wireguard tunnel.

## Verify

```bash
curl -k https://192.168.18.150/api/health
curl -s http://100.126.222.96/api/health
# {"status":"ok"}
```

## Architecture

```
PC:    https://192.168.18.150/  →  leo-proxy :443 (self-signed TLS)
Phone: http://100.126.222.96/    →  leo-proxy :80  (plain HTTP)
              ↓
        react-app → leo-api :8080 → postgres
```
