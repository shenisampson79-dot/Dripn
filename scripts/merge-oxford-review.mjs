/**
 * Merge gold Oxford review + expand review chunks → oxford_review.json
 * Usage: node scripts/merge-oxford-review.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataset = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'oxford_street_dataset', 'dataset.json'), 'utf8'),
);
const prior = JSON.parse(
  fs.readFileSync(path.join(root, 'data', 'street_label_reviews', 'oxford_review.json'), 'utf8'),
);
const reviewsDir = path.join(root, 'data', 'street_label_reviews');

const GOLD_FIX = new Set(
  '008,015,022,037,051,058,073,080,115,123,151,180,194,216,223,323,330,337,344,351,380,387,394,402'.split(','),
);
const GOLD_UNC = new Set('173,187,258,273,287,294,316,366'.split(','));
const GOLD_OK = new Set(
  '001,030,044,065,087,094,101,108,130,137,144,158,166,201,208,230,237,244,251,266,280,301,309,359,373,409,416'.split(','),
);

const byId = new Map();
for (const it of prior.items || []) {
  byId.set(String(it.id).padStart(3, '0'), it);
}

const chunkFiles = fs
  .readdirSync(reviewsDir)
  .filter((f) => /^oxford_review_chunk_\d+\.json$/.test(f))
  .sort();

let chunkRows = 0;
for (const f of chunkFiles) {
  const rows = JSON.parse(fs.readFileSync(path.join(reviewsDir, f), 'utf8'));
  for (const row of rows) {
    const id = String(row.id).padStart(3, '0');
    byId.set(id, {
      id,
      status: row.status,
      notes: row.notes || '',
      ...(row.pieces ? { pieces: row.pieces } : {}),
    });
    chunkRows += 1;
  }
}

const items = [];
for (const row of dataset) {
  const id = String(row.id).replace(/^oxford_/, '').padStart(3, '0');
  if (byId.has(id)) {
    items.push(byId.get(id));
    continue;
  }
  if (row.label_status === 'gold') {
    if (GOLD_FIX.has(id)) {
      items.push(byId.get(id) || { id, status: 'fix', notes: 'Gold Must fix (prior)' });
    } else if (GOLD_UNC.has(id)) {
      items.push(byId.get(id) || { id, status: 'uncertain', notes: 'Gold Your call (prior)' });
    } else if (GOLD_OK.has(id)) {
      items.push({ id, status: 'ok', notes: 'Gold OK' });
    } else {
      items.push({ id, status: 'ok', notes: 'Gold labelled' });
    }
    continue;
  }
  if (row.label_status === 'discarded') {
    items.push({
      id,
      status: 'ok',
      notes: `Discarded (${(row.rules?.violations || ['not_shop_window']).join(', ')}) — confirmed non-window / poster`,
    });
    continue;
  }
  items.push({
    id,
    status: 'uncertain',
    notes: 'Missing review chunk — needs pass',
  });
}

items.sort((a, b) => Number(a.id) - Number(b.id));
const counts = { ok: 0, fix: 0, uncertain: 0 };
for (const it of items) counts[it.status] = (counts[it.status] || 0) + 1;

const out = {
  street: 'oxford',
  total: items.length,
  reviewed_at: new Date().toISOString().slice(0, 10),
  scope: 'all_labelled_gold_expand_discarded',
  note: 'Must fix = gold + expand label corrections. Your call = ambiguous. OK = match or confirmed discard.',
  counts,
  chunk_files: chunkFiles,
  chunk_rows: chunkRows,
  items,
};

const outPath = path.join(reviewsDir, 'oxford_review.json');
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
console.log(`total=${items.length} ok=${counts.ok} fix=${counts.fix} uncertain=${counts.uncertain} chunks=${chunkFiles.length} chunk_rows=${chunkRows}`);
