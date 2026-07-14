# Admin Android — parity QA checklist

Use against Expo `leo-os/apps/mobile` before retiring Expo shipping.

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
- [ ] Theme / haptics polish vs Expo
- [ ] QR / visiting cards if still in Expo scope

## Ship gate
- [ ] Side-by-side smoke on same Tailscale API
- [ ] Stop distributing Expo APKs
- [ ] Docs already mark Expo as legacy (`SYSTEM-MAP`, `DEPLOYMENT`)
