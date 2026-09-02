/**
 * QSC selection counter: informational counts from existing IDs + item categories.
 * Run: npx tsx scripts/verify-qsc-selection-counter.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatQscSelectionCounter } from '../utils/qscSelectionCounter';

const root = resolve(__dirname, '..');
const flowSrc = readFileSync(resolve(root, 'components', 'stylist', 'StylistDecisionFlow.tsx'), 'utf8');
const hookSrc = readFileSync(resolve(root, 'hooks', 'useStylistDecision.ts'), 'utf8');
const helperSrc = readFileSync(resolve(root, 'utils', 'qscSelectionCounter.ts'), 'utf8');

const labels: Record<string, string> = {
  outerwear: 'Outerwear',
  tops: 'Tops',
  bottoms: 'Bottoms',
  footwear: 'Footwear',
  accessories: 'Accessories',
  dresses: 'Dresses',
  other: 'Other',
};

const items = [
  { id: 't1', category: 'tops', name: 'Oxford', enhancedImageUri: 'file://t1.jpg' },
  { id: 't2', category: 'tops', name: 'Jumper', enhancedImageUri: 'file://t2.jpg' },
  { id: 'b1', category: 'bottoms', name: 'Jeans', enhancedImageUri: 'file://b1.jpg' },
  { id: 'b2', category: 'bottoms', name: 'Trousers', enhancedImageUri: 'file://b2.jpg' },
  { id: 's1', category: 'shoes', name: 'Chelsea', enhancedImageUri: 'file://s1.jpg' },
  { id: 's2', category: 'shoes', name: 'Trainers', enhancedImageUri: 'file://s2.jpg' },
  { id: 'o1', category: 'outerwear', name: 'Barbour', enhancedImageUri: 'file://o1.jpg' },
  { id: 'o2', category: 'outerwear', name: 'Blazer', enhancedImageUri: 'file://o2.jpg' },
];

function summary(selectedIds: string[]) {
  return formatQscSelectionCounter({
    selectedIds,
    items,
    selectedLabel: (count) => `Selected ${count}`,
    labelForGroup: (key) => labels[key],
  });
}

assert.equal(summary([]), 'Selected 0', '1: empty total, no fake categories');
assert.doesNotMatch(summary([]), /Tops|Bottoms|Footwear|Outerwear/);

assert.equal(summary(['t1']), 'Selected 1 · Tops 1', '2: one top');

assert.equal(
  summary(['t1', 'b1', 's1']),
  'Selected 3 · Tops 1 · Bottoms 1 · Footwear 1',
  '3: top + bottom + shoes',
);

assert.equal(summary(['b1', 'b2']), 'Selected 2 · Bottoms 2', '4: two bottoms informational');
assert.equal(summary(['s1', 's2']), 'Selected 2 · Footwear 2', '5: two shoes informational');
assert.equal(summary(['t1', 't2']), 'Selected 2 · Tops 2', '6: layered tops informational');
assert.equal(
  summary(['o1', 'o2']),
  'Selected 2 · Outerwear 2',
  '7: two outerwear/layer pieces informational',
);

const afterDeselect = summary(['t1', 'b1', 's1'].filter((id) => id !== 'b1'));
assert.equal(afterDeselect, 'Selected 2 · Tops 1 · Footwear 1', '8: deselect decrements total and category');

assert.doesNotMatch(helperSrc, /warn|error|invalid|block|limit/i, 'no warning/blocking copy in helper');
assert.match(flowSrc, /formatQscSelectionCounter\(\{/, 'QSC input renders derived counter');
assert.match(
  flowSrc,
  /const renderSanityInput = \(\) => \([\s\S]*formatQscSelectionCounter/,
  'counter is QSC-only',
);
assert.doesNotMatch(
  flowSrc,
  /const renderEventInput = \(\) => \([\s\S]*formatQscSelectionCounter/,
  'Event picker does not gain a second counter',
);
assert.match(flowSrc, /styles\.qscSelectionCounter, \{ color: theme\.tabIconDefault \}/, '9/10: theme-aware caption colour');
assert.match(flowSrc, /qscSelectionCounter: \{[\s\S]*flexShrink: 1/, '11: compact wrap, no overflow style');

const fourIds = ['t1', 'b1', 's1', 'o1'];
assert.equal(summary(fourIds), 'Selected 4 · Outerwear 1 · Tops 1 · Bottoms 1 · Footwear 1');
assert.deepEqual(fourIds, ['t1', 'b1', 's1', 'o1'], '12: counter must not mutate selected IDs');

assert.match(hookSrc, /resolveQscEvaluateSubmitSelection/, '12: selection-integrity submit helper preserved');
assert.match(
  hookSrc,
  /decisionType === 'sanity-check'[\s\S]*return images\.length >= 1 \|\| selectedWardrobeIds\.length >= 1/,
  'QSC readiness predicate unchanged',
);

console.log('verify-qsc-selection-counter: ok');
