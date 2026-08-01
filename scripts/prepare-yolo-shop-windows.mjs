#!/usr/bin/env node
/**
 * Prepare a YOLO fine-tune / eval scaffold from Sloane + Croydon + Brixton + Oxford.
 *
 * Includes:
 * - valid shop-window outfits (soft-style corpus)
 * - editorial / advert rows flagged `use_for_detection: true`
 *   (excluded from casual soft scoring, kept for Clothing/Shoes/Bags recall)
 *
 * Does NOT train (no Python on this machine). It writes:
 * - images + weak YOLO labels (role-band boxes from structured outfits)
 * - data.yaml
 * - train instructions
 *
 * Usage: node scripts/prepare-yolo-shop-windows.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outRoot = path.join(root, 'data', 'yolo_shop_windows');

/** Fashionpedia-aligned 4-class ids used by garment-yolo-n320.tflite */
const CLASS = { Clothing: 0, Shoes: 1, Bags: 2, Accessories: 3 };

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyImage(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

/**
 * Weak supervision: invent coarse vertical bands from outfit roles.
 * Good enough to bootstrap fine-tune / evaluate recall of shoes vs clothing —
 * not a substitute for hand-drawn boxes.
 */
function weakLabelsFromOutfit(outfit) {
  const lines = [];
  // YOLO label: class cx cy w h (normalized)
  if (outfit?.top || outfit?.outerwear) {
    // upper clothing band
    lines.push(`${CLASS.Clothing} 0.50 0.32 0.42 0.40`);
  }
  if (outfit?.bottom) {
    lines.push(`${CLASS.Clothing} 0.50 0.62 0.40 0.28`);
  }
  if (outfit?.top?.category === 'dress') {
    lines.push(`${CLASS.Clothing} 0.50 0.48 0.40 0.55`);
  }
  if (outfit?.footwear) {
    lines.push(`${CLASS.Shoes} 0.50 0.88 0.28 0.14`);
  }
  if (outfit?.accessory?.category === 'bag' || outfit?.accessory?.subcategory?.includes('bag')) {
    lines.push(`${CLASS.Bags} 0.78 0.55 0.18 0.22`);
  } else if (outfit?.accessory) {
    lines.push(`${CLASS.Accessories} 0.50 0.12 0.22 0.10`);
  }
  return [...new Set(lines)];
}

function load(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function includeForDetection(row) {
  if (row?.use_for_detection === true) return true;
  return row?.rules?.valid !== false;
}

const sloane = load('data/sloane_street_dataset/dataset.json');
const croydon = load('data/croydon_mall_dataset/dataset.json');
const brixton = load('data/brixton_high_street_dataset/dataset.json');
const oxfordPath = path.join(root, 'data', 'oxford_street_dataset', 'dataset.json');
const oxford = fs.existsSync(oxfordPath) ? load('data/oxford_street_dataset/dataset.json') : [];
const rows = [...sloane, ...croydon, ...brixton, ...oxford].filter(includeForDetection);

const imgTrain = path.join(outRoot, 'images', 'train');
const imgVal = path.join(outRoot, 'images', 'val');
const lblTrain = path.join(outRoot, 'labels', 'train');
const lblVal = path.join(outRoot, 'labels', 'val');
for (const d of [imgTrain, imgVal, lblTrain, lblVal]) ensureDir(d);

const sourceDirs = {
  sloane_street: path.join(root, 'data', 'sloane_street_dataset'),
  croydon_mall: path.join(root, 'data', 'croydon_mall_dataset'),
  brixton_high_street: path.join(root, 'data', 'brixton_high_street_dataset'),
  oxford_street: path.join(root, 'data', 'oxford_street_dataset'),
};

let i = 0;
let copied = 0;
for (const row of rows) {
  const srcDir = sourceDirs[row.source] || sourceDirs.sloane_street;
  const src = path.join(srcDir, row.image_path);
  const stem = `${row.id}`;
  const split = i % 5 === 0 ? 'val' : 'train';
  const imgDest = path.join(outRoot, 'images', split, `${stem}.jpg`);
  const lblDest = path.join(outRoot, 'labels', split, `${stem}.txt`);
  if (copyImage(src, imgDest)) {
    fs.writeFileSync(lblDest, `${weakLabelsFromOutfit(row.outfit).join('\n')}\n`);
    copied += 1;
  }
  i += 1;
}

const yaml = `path: ${outRoot.replace(/\\/g, '/')}
train: images/train
val: images/val
names:
  0: Clothing
  1: Shoes
  2: Bags
  3: Accessories
nc: 4
# Weak labels from shop-window outfit structure — refine with hand boxes before production train.
`;

fs.writeFileSync(path.join(outRoot, 'data.yaml'), yaml);

const readme = `# YOLO shop-window fine-tune scaffold

Prepared from **Sloane Street + Croydon + Brixton** (${copied} images).

Includes shop-window looks **plus** Brixton editorial/advert frames flagged for detection
(London Standard pages, sloggi lightbox) — those stay out of soft casual scoring.

## Important honesty
- Labels are **weak** (role-band boxes from outfit JSON), not hand-drawn.
- Still small for a production detector — use this to:
  1. Evaluate the current \`garment-yolo-n320.tflite\` recall on shoes/clothing/bags
  2. Seed a short fine-tune, then expand with more magazine ads + windows
- Fine-tuning requires **Python + Ultralytics** (not installed in this Windows env).

## Train (WSL / Linux / Mac with Python)

\`\`\`bash
pip install ultralytics
# start from Fashionpedia clothing weights if available, else yolov8n.pt
yolo detect train data=data/yolo_shop_windows/data.yaml model=yolov8n.pt imgsz=320 epochs=50 batch=8
yolo export model=runs/detect/train/weights/best.pt format=onnx imgsz=320 simplify=True
# then convert ONNX → TFLite (see docs/ON_DEVICE_YOLO.md) and replace assets/models/garment-yolo-n320.tflite
\`\`\`

## Eval without train
Run the current model on \`images/val\` and compare predicted Shoes/Clothing counts vs label files.

## Rebuild scaffold
\`\`\`bash
node scripts/prepare-yolo-shop-windows.mjs
\`\`\`
`;

fs.writeFileSync(path.join(outRoot, 'README.md'), readme);
console.log(`Prepared YOLO scaffold: ${copied} images → ${outRoot}`);
console.log('Next: install Python+ultralytics (WSL) and follow data/yolo_shop_windows/README.md');
