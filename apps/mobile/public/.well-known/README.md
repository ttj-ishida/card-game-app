# `/.well-known/`

EAS Hosting serves `apps/mobile/public/` at the site root, so files here are
reachable at `https://<host>/.well-known/…`.

## `assetlinks.json` (Android App Links)

Needed so `https://<host>/join?code=…` opens the app directly instead of the browser.

Confirmed (2026-09-06): `eas deploy` does **not** auto-generate it —
`https://card-game-app.expo.app/.well-known/assetlinks.json` currently returns
the app HTML. So commit the file here:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.ttjishida.ragnarokmillennium",
      "sha256_cert_fingerprints": ["<SHA-256 of the EAS Android signing cert>"]
    }
  }
]
```

Get the fingerprint from the Expo dashboard (Project → Credentials → Android →
the build credential) or `eas credentials --platform android` → the keystore's
SHA-256. Then redeploy.

See `docs/progress/M4-EX-02.md` for the full checklist.
