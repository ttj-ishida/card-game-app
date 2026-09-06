# `/.well-known/`

EAS Hosting serves `apps/mobile/public/` at the site root, so files here are
reachable at `https://<host>/.well-known/…`.

## `assetlinks.json` (Android App Links)

`assetlinks.json` here makes `https://<host>/join?code=…` open the app directly.
`eas deploy` does not auto-generate it, so it is committed as a static file.

The SHA-256 in it is the EAS-managed Android signing cert for
`com.ttjishida.ragnarokmillennium` (`eas credentials --platform android`,
profile `preview` → Keystore → SHA256 Fingerprint). If the keystore is ever
rotated, update the fingerprint here and redeploy.

See `docs/progress/M4-EX-02.md` for the full checklist.
