# `/.well-known/`

EAS Hosting serves `apps/mobile/public/` at the site root, so files here are
reachable at `https://<host>/.well-known/…`.

## `assetlinks.json` (Android App Links)

Needed so `https://<host>/join/…` opens the app directly instead of the browser.

Two ways to provide it:

1. **Let Expo generate it.** With `android.intentFilters` (autoVerify) in
   `app.json` and the project linked, `eas deploy` can generate and serve
   `assetlinks.json` from the EAS Android credentials. Check
   `https://<host>/.well-known/assetlinks.json` after the first deploy — if it
   is there, do nothing else.

2. **Commit it here** if step 1 does not produce it:

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
