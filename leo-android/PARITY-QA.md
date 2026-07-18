# Sky Office Android — QA checklist

Product: **Sky Office** (`com.sky.office`) — the only Android client.

## Wave 0–1
- [ ] Login / logout / session restore on cold start
- [ ] Profile shows user; base URL editable (LAN + Tailscale)
- [ ] Dashboard stats + tasks load
- [ ] Master list search + passport detail

## Wave 2
- [ ] Upload image → OCR creates passport
- [ ] LOA list loads for role

## Wave 3–4
- [ ] Companies / clients / passwords lists
- [ ] Billing / expenses / salary lists
- [ ] Role gate hides Tabs the user should not see

## Wave 5–6
- [ ] Admin users (superuser/admin)
- [ ] Theme / haptics polish
- [ ] QR / visiting cards if still required

## SMS node mode
- [ ] Bottom tab **SMS** opens register/dashboard
- [ ] Register → SignalR connected; About System shows online
- [ ] Test SMS from web → Sent; local logs update
- [ ] Switching away from SMS tab leaves the relay service running
- [ ] Boot / notification tap opens the SMS tab

## Ship gate
- [ ] Smoke against Tailscale API (`http://100.126.222.96`)
- [ ] Only `com.sky.office` APK is distributed
