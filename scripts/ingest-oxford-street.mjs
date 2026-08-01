#!/usr/bin/env node
/**
 * Ingest Oxford Street shop-window HEICs → numbered JPGs + dataset scaffold.
 *
 * Same layout as Sloane / Croydon / Brixton:
 *   data/oxford_street_dataset/images/001.jpg …
 *   data/oxford_street_dataset/dataset.json
 *   data/oxford_street_dataset/clean_queue.json
 *
 * HEIC → JPEG via heic-convert. Rows start as pending labels
 * (valid:false for soft scoring; use_for_detection:true for YOLO scaffold).
 *
 * Usage: node scripts/ingest-oxford-street.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const convert = require('heic-convert');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outRoot = path.join(root, 'data', 'oxford_street_dataset');
const rawRoot = path.join(outRoot, '_raw');
const imgDir = path.join(outRoot, 'images');

const CONCURRENCY = 4;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function listHeic(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listHeic(full));
    else if (/\.heic$/i.test(ent.name)) out.push(full);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function pad(n) {
  return String(n).padStart(3, '0');
}

function stubRow(i, imagePath, sourceFile) {
  const id = `oxford_${pad(i)}`;
  return {
    id,
    source: 'oxford_street',
    image_path: imagePath,
    source_file: path.basename(sourceFile),
    brand: null,
    price_tier: 'high_street',
    outfit: {
      top: { category: 'top', subcategory: 'unknown', color: null },
      bottom: { category: 'trousers', subcategory: 'unknown', color: null },
      outerwear: null,
      footwear: null,
      accessory: null,
    },
    style: { primary: 'casual', secondary: ['high_street', 'shop_window'] },
    colour_palette: [],
    features: { layering: 'unknown', contrast: 'unknown', silhouette: 'unknown' },
    style_tags: ['oxford_street', 'pending_label'],
    notes: 'Pending human / vision label — Oxford Street shop window',
    confidence: 0.2,
    score_hint: { base_score: 50, boost: false },
    rules: { valid: false, violations: ['pending_human_label'] },
    use_for_detection: true,
    label_status: 'pending',
  };
}

async function convertOne(src, dest) {
  const input = fs.readFileSync(src);
  const output = await convert({
    buffer: input,
    format: 'JPEG',
    quality: 0.88,
  });
  fs.writeFileSync(dest, Buffer.from(output));
}

async function mapPool(items, limit, fn) {
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

async function main() {
  ensureDir(imgDir);
  if (!fs.existsSync(rawRoot)) {
    console.error(`Missing raw extract at ${rawRoot}`);
    console.error('Unzip the Google Drive archive into that folder first.');
    process.exit(1);
  }

  const heics = listHeic(rawRoot);
  console.log(`Found ${heics.length} HEIC files`);
  if (heics.length === 0) process.exit(1);

  const rows = [];
  let done = 0;
  const t0 = Date.now();

  await mapPool(heics, CONCURRENCY, async (src, i) => {
    const n = i + 1;
    const rel = `images/${pad(n)}.jpg`;
    const dest = path.join(outRoot, rel);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      await convertOne(src, dest);
    }
    rows[i] = stubRow(n, rel, src);
    done += 1;
    if (done % 25 === 0 || done === heics.length) {
      const sec = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  converted ${done}/${heics.length} (${sec}s)`);
    }
  });

  const dataset = rows.filter(Boolean);
  const datasetPath = path.join(outRoot, 'dataset.json');
  fs.writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`);

  const cleanQueue = {
    version: 1,
    source: 'oxford_street',
    total: dataset.length,
    pending: dataset.map((r) => r.id),
    labeled: [],
    discarded: [],
    notes:
      'Re-label outfit/colour/brand in dataset.json, set rules.valid=true and label_status=labeled, then rebuild signals.',
  };
  fs.writeFileSync(
    path.join(outRoot, 'clean_queue.json'),
    `${JSON.stringify(cleanQueue, null, 2)}\n`,
  );

  const readme = `# Oxford Street style dataset

${dataset.length} shop-window photos from Oxford Street (July 2026), structured like Sloane / Croydon / Brixton for Dripn scoring and YOLO fine-tune.

## Layout

\`\`\`
data/oxford_street_dataset/
  images/001.jpg … ${pad(dataset.length)}.jpg
  dataset.json          # per-outfit rows (oxford_001–${pad(dataset.length)})
  clean_queue.json      # pending human / vision labels
  signals.json          # generated after labels exist
  README.md
\`\`\`

## Status

Rows ship as **pending labels**:
- \`rules.valid: false\` → excluded from soft-scoring signals until labeled
- \`use_for_detection: true\` → included in YOLO shop-window scaffold (weak boxes)

## Rebuild signals (after labeling)

\`\`\`bash
npm run build:shop-window-signals
npm run prepare:yolo-shop-windows
\`\`\`

## Re-ingest / re-convert HEICs

\`\`\`bash
node scripts/ingest-oxford-street.mjs
\`\`\`

Existing JPGs are skipped if already present.
`;
  fs.writeFileSync(path.join(outRoot, 'README.md'), readme);

  console.log(`\nWrote ${dataset.length} rows → ${datasetPath}`);
  console.log(`Images → ${imgDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
