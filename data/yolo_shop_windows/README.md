# YOLO shop-window fine-tune scaffold

Prepared from **Sloane Street + Croydon + Brixton** (514 images).

Includes shop-window looks **plus** Brixton editorial/advert frames flagged for detection
(London Standard pages, sloggi lightbox) — those stay out of soft casual scoring.

## Important honesty
- Labels are **weak** (role-band boxes from outfit JSON), not hand-drawn.
- Still small for a production detector — use this to:
  1. Evaluate the current `garment-yolo-n320.tflite` recall on shoes/clothing/bags
  2. Seed a short fine-tune, then expand with more magazine ads + windows
- Fine-tuning requires **Python + Ultralytics** (not installed in this Windows env).

## Train (WSL / Linux / Mac with Python)

```bash
pip install ultralytics
# start from Fashionpedia clothing weights if available, else yolov8n.pt
yolo detect train data=data/yolo_shop_windows/data.yaml model=yolov8n.pt imgsz=320 epochs=50 batch=8
yolo export model=runs/detect/train/weights/best.pt format=onnx imgsz=320 simplify=True
# then convert ONNX → TFLite (see docs/ON_DEVICE_YOLO.md) and replace assets/models/garment-yolo-n320.tflite
```

## Eval without train
Run the current model on `images/val` and compare predicted Shoes/Clothing counts vs label files.

## Rebuild scaffold
```bash
node scripts/prepare-yolo-shop-windows.mjs
```
