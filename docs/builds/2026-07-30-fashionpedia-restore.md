# Builds — Fashionpedia YOLO restore + hybrid detection (2026-07-30)

**Why:** Ship restored Fashionpedia `garment-yolo-n320.tflite` (not the weak shop-window fine-tune), plus hybrid detection / dual-style scoring JS that needs a native binary for the model asset.

**Docs:** [ON_DEVICE_YOLO.md](../ON_DEVICE_YOLO.md)

## Preview (internal testing — use this first)

| Platform | Build page |
|----------|------------|
| iOS | https://expo.dev/accounts/ahmayatazah/projects/dripn/builds/5417453c-5ea6-4145-ab86-adf84b02a618 |
| Android | https://expo.dev/accounts/ahmayatazah/projects/dripn/builds/fabf6068-b63a-474a-b37a-86d4aaa28e7b |

## After install

1. Open app → **Live stylist**.
2. Confirm on-device YOLO (Fashionpedia), not cloud-only.
3. Shoes should recover more often via hybrid detection when YOLO misses them.

## Notes

- Shop-window fine-tune stays experimental under `data/yolo_shop_windows/export/`.
- Soft dual-style scoring (Sloane luxury × Croydon casual) is JS; the binary is mainly for the TFLite asset.
