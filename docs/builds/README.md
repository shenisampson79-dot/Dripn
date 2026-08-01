# Native EAS builds

Use this folder when a change needs a **new app binary** (native code / models).  
**OTA / `eas update` alone is not enough** for those changes.

## OTA vs binary

| Change type | What to ship |
|-------------|--------------|
| JS / UI / most features | `eas update` (OTA) — reopen app |
| Native modules, TFLite/YOLO, camera plugins, Nitro, new permissions | **EAS Build** — install from links below |

## How to install a listed build

1. Open the platform link for **preview** (testing) or **production**.
2. Wait until status is **finished**.
3. Install:
   - **iOS:** TestFlight or the EAS install page for that build
   - **Android:** `.apk` / internal track from the build page
4. Delete the old app only if the new build won’t overlay cleanly (common for internal/preview).
5. Confirm in-app (e.g. Live stylist → on-device YOLO ready).

## Rebuild yourself (don’t wait for chat)

From `StyleWise`:

```bash
# Preview (internal testing)
eas build --platform ios --profile preview
eas build --platform android --profile preview

# Production
eas build --platform ios --profile production
eas build --platform android --profile production
```

When a build finishes, **add a new dated file** in this folder (copy `TEMPLATE.md`) with the Expo build URLs so you always have them.

## Index

| Date | Why new binary | File |
|------|----------------|------|
| 2026-07-30 | Fashionpedia YOLO restore + hybrid detection | [2026-07-30-fashionpedia-restore.md](./2026-07-30-fashionpedia-restore.md) |
| 2026-07-24 | On-device YOLO (TFLite + Nitro) | [2026-07-24-on-device-yolo.md](./2026-07-24-on-device-yolo.md) |
