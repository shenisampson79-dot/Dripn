# Builds — on-device YOLO (2026-07-24)

**Why:** Live Stylist on-device garment detection (`react-native-fast-tflite` + Fashionpedia YOLOv8n TFLite ~11.6 MB).

**Git:** StyleWise `f937f3d` / `de2b0a6` on `main`  
**Docs:** [ON_DEVICE_YOLO.md](../ON_DEVICE_YOLO.md)

## Preview (internal testing — use this first)

| Platform | Build page |
|----------|------------|
| iOS | https://expo.dev/accounts/ahmayatazah/projects/dripn/builds/f21a7458-2156-48fa-acfc-c7945e0558e6 |
| Android | https://expo.dev/accounts/ahmayatazah/projects/dripn/builds/415784e4-4f6c-4af9-8eed-4f6d8af66c9e |

## Production

| Platform | Build page |
|----------|------------|
| iOS | https://expo.dev/accounts/ahmayatazah/projects/dripn/builds/5680a8a4-c684-4bf1-b847-2d43681c0680 |
| Android | https://expo.dev/accounts/ahmayatazah/projects/dripn/builds/55e01a18-b8eb-4355-bb88-2ca6dc19608b |

## After install

1. Open app → Stylist Hub → **Live stylist** (or Scan → Live camera).
2. Banner / source should indicate **on-device** YOLO (not cloud-only).
3. Old binary + new JS OTA → still cloud Vision fallback until this binary is installed.

## If links expire / builds fail

Re-run from StyleWise:

```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Paste the new URLs into a new dated file under `docs/builds/` and update the index in [README.md](./README.md).
