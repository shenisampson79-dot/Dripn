# On-device YOLO (Live Stylist)

## Why a new binary?

`react-native-fast-tflite` + `react-native-nitro-modules` are **native** dependencies.
`eas update` / OTA only ships JS — installs built **before** this change keep using cloud Vision.
Ship a new **EAS preview or production** binary to enable on-device detection.

**Build links (install pages):** see [`docs/builds/`](./builds/README.md) — especially [2026-07-24-on-device-yolo.md](./builds/2026-07-24-on-device-yolo.md).

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | `react-native-fast-tflite` 3.x (Expo config plugin, Core ML / NNAPI delegates) |
| Camera loop | Existing `expo-camera` ~1 fps (`LiveStylistScreen`) — Vision Camera not required |
| Model | `assets/models/garment-yolo-n320.tflite` (**Fashionpedia** production) |
| Size | **~11.6 MB** float32 (float16 export failed TFLite CPU prepare on Windows; float32 is the compatible ship) |
| Source weights | [kesimeg/yolov8n-clothing-detection](https://huggingface.co/kesimeg/yolov8n-clothing-detection) (YOLOv8n, Fashionpedia 4-class) |
| Backup | `garment-yolo-n320.fashionpedia.bak.tflite` (identical twin) |
| Experimental | `garment-yolo-n320.shopwindows.experimental.tflite` — Sloane/Croydon fine-tune; **do not ship** until shoes recall improves |

### Model policy

Ship Fashionpedia until a custom train beats it on **shoes recall** and overall mAP50.
Shop-window labels (~62 weak boxes) are for scoring signals + future fine-tunes, not a production swap.
Hybrid detection (`utils/outfitAutoAnalysisPipeline` + server `services/hybridDetection.js`) recovers missed shoes without retraining.
| Input | `1×320×320×3` float32 NHWC, 0–1, letterboxed |
| Output | `1×8×2100` → cx,cy,w,h + 4 class scores |

### Classes → wardrobe categories

| YOLO class | Mapped category |
| --- | --- |
| Clothing | tops / bottoms / dresses / outerwear (bbox geometry heuristic) |
| Shoes | shoes |
| Bags | bags |
| Accessories | accessories |

**Limits:** not a fine-grained taxonomy (no “oxford shirt” vs “tee”). Color is a coarse ROI average. Prefer cloud Vision still-scan for high-fidelity wardrobe ingest.

## Fallback

1. Native module missing (old binary / Expo Go) → cloud Vision JPEG.
2. Model load / inference error → cloud Vision.
3. Zero detections from YOLO → cloud Vision (better empty-frame UX).

When boxes exist, client posts `detections[]` only (no `imageBase64`) so the server styles without Vision spend.

## Re-export model (maintainers)

LiteRT/TFLite export via current Ultralytics is Linux/macOS-only. On Windows:

```bash
# portable tooling lives in .tools/ (gitignored)
python -m pip install ultralytics onnx onnx2tf tensorflow
yolo export model=clothing-yolov8n.pt format=onnx imgsz=320 simplify=True
python -m onnx2tf -i clothing-yolov8n.onnx -o tflite_out -osd -nuo
cp tflite_out/clothing-yolov8n_float32.tflite assets/models/garment-yolo-n320.tflite
```

On Linux/macOS you can try `yolo export format=litert imgsz=320` directly.

## Verify on device

1. Install the new preview/production EAS build (not Expo Go).
2. Open **Live stylist** → Start live.
3. Status should mention on-device YOLO; overlays update ~1 fps.
4. Network: live-frame requests should often omit large `imageBase64` when detections succeed.
5. On an old binary with this JS via OTA: banner says rebuild required; cloud path still works.
