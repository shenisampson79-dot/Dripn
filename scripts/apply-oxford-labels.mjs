/**
 * Apply gold-set labels into oxford_street_dataset/dataset.json.
 * Does NOT overwrite rows already labeled (label_status === 'gold' | 'labeled').
 *
 * Usage: node scripts/apply-oxford-labels.mjs [path/to/labels.json]
 * Default labels file: data/oxford_street_dataset/gold_labels.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const datasetPath = path.join(root, 'data', 'oxford_street_dataset', 'dataset.json');
const queuePath = path.join(root, 'data', 'oxford_street_dataset', 'clean_queue.json');
const defaultLabels = path.join(root, 'data', 'oxford_street_dataset', 'gold_labels.json');

const labelsPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : defaultLabels;

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const labelsDoc = JSON.parse(fs.readFileSync(labelsPath, 'utf8'));
const labels = Array.isArray(labelsDoc) ? labelsDoc : labelsDoc.labels || [];

const byId = new Map(dataset.map((r) => [r.id, r]));
let applied = 0;
let skipped = 0;

for (const lab of labels) {
  const row = byId.get(lab.id);
  if (!row) {
    console.warn('missing id', lab.id);
    continue;
  }
  if (row.label_status === 'gold' || row.label_status === 'labeled') {
    skipped += 1;
    continue;
  }
  Object.assign(row, lab);
  if (!row.label_status) row.label_status = 'gold';
  if (row.rules?.valid === true && (row.confidence ?? 0) >= 0.75) {
    // ok
  }
  applied += 1;
}

fs.writeFileSync(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`);

const goldIds = new Set(
  dataset.filter((r) => r.label_status === 'gold').map((r) => r.id),
);
const labeled = dataset.filter((r) => r.rules?.valid === true).map((r) => r.id);
const pending = dataset
  .filter((r) => r.rules?.valid !== true && r.label_status !== 'discarded')
  .map((r) => r.id);
const lowConf = dataset
  .filter(
    (r) =>
      r.label_status === 'auto'
      && typeof r.confidence === 'number'
      && r.confidence < 0.75,
  )
  .map((r) => r.id);

const queue = {
  version: 2,
  source: 'oxford_street',
  total: dataset.length,
  gold: [...goldIds],
  labeled,
  pending,
  low_confidence: lowConf,
  discarded: dataset.filter((r) => r.label_status === 'discarded').map((r) => r.id),
  notes:
    'Gold set is protected. Auto labels only set valid:true when confidence > 0.75. Review low_confidence.',
};

fs.writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`);
console.log(`Applied ${applied}, skipped protected ${skipped}, gold=${goldIds.size}, valid=${labeled.length}, pending=${pending.length}`);
