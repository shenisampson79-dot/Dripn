/**
 * Sync oxford/sloane review JSON after pedestal footwear inclusion.
 * Usage: node scripts/sync-pedestal-footwear-reviews.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(
  fs.readFileSync(path.join(root, 'data/street_label_reviews/pedestal_footwear_report.json'), 'utf8'),
);
const dataset = JSON.parse(
  fs.readFileSync(path.join(root, 'data/oxford_street_dataset/dataset.json'), 'utf8'),
);
const byId = Object.fromEntries(dataset.map((r) => [r.id, r]));
const applied = new Set(report.oxford_detail.applied.map((a) => a.id));
const uncertain = new Map(report.oxford_detail.uncertain.map((u) => [u.id, u]));

function fullOxfordId(id) {
  return String(id).startsWith('oxford_') ? String(id) : `oxford_${String(id).padStart(3, '0')}`;
}

function patchItem(item) {
  const fullId = fullOxfordId(item.id);
  if (applied.has(fullId)) {
    const fw = byId[fullId]?.outfit?.footwear;
    item.status = 'ok';
    item.notes = fw
      ? `Pedestal footwear policy: included ${fw.color} ${fw.subcategory} with this look`
      : item.notes;
    if (fw) {
      const withoutShoes = (item.pieces || []).filter(
        (p) => !/shoe|footwear/i.test(String(p.category || '')),
      );
      item.pieces = [
        ...withoutShoes,
        { category: 'footwear', subcategory: fw.subcategory, color: fw.color },
      ];
    }
    return true;
  }
  if (uncertain.has(fullId)) {
    item.status = 'uncertain';
    item.notes = uncertain.get(fullId).notes;
    return true;
  }
  return false;
}

const chunkFiles = [1, 2, 3, 4, 5, 6, 7, 8].map(
  (n) => path.join(root, `data/street_label_reviews/oxford_review_chunk_0${n}.json`),
);

for (const file of chunkFiles) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  let changed = 0;
  for (const item of items) {
    if (patchItem(item)) changed += 1;
  }
  fs.writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`);
  console.log(path.basename(file), 'changed', changed);
}

const mainPath = path.join(root, 'data/street_label_reviews/oxford_review.json');
const main = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
let changed = 0;
for (const item of main.items) {
  if (patchItem(item)) changed += 1;
}
const counts = { ok: 0, fix: 0, uncertain: 0 };
for (const it of main.items) {
  counts[it.status] = (counts[it.status] || 0) + 1;
}
main.counts = counts;
main.reviewed_at = '2026-08-03';
main.note =
  'Must fix = gold + expand label corrections. Your call = ambiguous. OK = match or confirmed discard. '
  + 'Pedestal/stand footwear included as outfit pieces (2026-08-03).';
fs.writeFileSync(mainPath, `${JSON.stringify(main, null, 2)}\n`);
console.log('oxford_review.json changed', changed, 'counts', counts);

const sloanePath = path.join(root, 'data/street_label_reviews/sloane_review.json');
const sloane = JSON.parse(fs.readFileSync(sloanePath, 'utf8'));
for (const item of sloane.items) {
  if (item.id === '004' || item.id === '026') {
    item.status = 'ok';
    item.notes =
      'Pedestal footwear policy: keep sandals/mules styled with this look (not only worn-on-feet)';
  }
}
sloane.reviewed_at = '2026-08-03';
sloane.note =
  'Pedestal/stand footwear is part of the outfit when styled with the mannequin look.';
fs.writeFileSync(sloanePath, `${JSON.stringify(sloane, null, 2)}\n`);
console.log('sloane_review.json updated');
