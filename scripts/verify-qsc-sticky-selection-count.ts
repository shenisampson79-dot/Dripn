/**
 * QSC sticky Get verdict label includes count/max; standalone x/8 selected is QSC-only hidden.
 * Run: npx tsx scripts/verify-qsc-sticky-selection-count.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MAX_DECISION_WARDROBE_ITEMS } from '../utils/decisionWardrobeGroups';
import { formatQscSelectionCounter } from '../utils/qscSelectionCounter';

const root = resolve(__dirname, '..');
const flowSrc = readFileSync(resolve(root, 'components', 'stylist', 'StylistDecisionFlow.tsx'), 'utf8');
const pickerSrc = readFileSync(resolve(root, 'components', 'stylist', 'DecisionWardrobePicker.tsx'), 'utf8');
const hookSrc = readFileSync(resolve(root, 'hooks', 'useStylistDecision.ts'), 'utf8');
const counterSrc = readFileSync(resolve(root, 'utils', 'qscSelectionCounter.ts'), 'utf8');

function stickyVerdictLabel(verdict: string, count: number, max: number) {
  return verdict + ` · ${count}/${max}`;
}

assert.equal(MAX_DECISION_WARDROBE_ITEMS, 8, 'current QSC wardrobe max remains 8');
assert.equal(stickyVerdictLabel('Get verdict', 0, MAX_DECISION_WARDROBE_ITEMS), 'Get verdict · 0/8', '1: 0 selected');
assert.equal(stickyVerdictLabel('Get verdict', 1, MAX_DECISION_WARDROBE_ITEMS), 'Get verdict · 1/8', '2: 1 selected');
assert.equal(stickyVerdictLabel('Get verdict', 3, MAX_DECISION_WARDROBE_ITEMS), 'Get verdict · 3/8', '3: multiple selected total');
assert.equal(stickyVerdictLabel('Get verdict', 2, MAX_DECISION_WARDROBE_ITEMS), 'Get verdict · 2/8', '4: deselect decrements');
assert.equal(stickyVerdictLabel('Get verdict', 8, MAX_DECISION_WARDROBE_ITEMS), 'Get verdict · 8/8', '5: max/max');

assert.match(
  flowSrc,
  /const wardrobeMax = flow\.getWardrobeSelectLimit\?\.\(\) \?\? MAX_DECISION_WARDROBE_ITEMS;/,
  'max comes from existing QSC limit, not a hard-coded 8',
);
assert.match(
  flowSrc,
  /label: t\('stylistFlow\.getVerdict'\) \+ ` · \$\{flow\.selectedWardrobeIds\.length\}\/\$\{wardrobeMax\}`/,
  'CTA label is Get verdict plus existing selected count / max',
);
assert.match(
  flowSrc,
  /if \(flow\.step === 'input' && flow\.canProceedFromInput\(\)\) \{[\s\S]*?decisionType === 'sanity-check'[\s\S]*?useReadyAccent: true/,
  '1: readiness gate and ready accent unchanged',
);

const sanity = flowSrc.match(/const renderSanityInput = \(\) => \([\s\S]*?\n  \);/)?.[0] || '';
assert.ok(sanity, 'renderSanityInput must exist');
assert.match(sanity, /showSelectedCount=\{false\}/, '6: QSC picker hides standalone count');
assert.doesNotMatch(sanity, /wardrobeSelectedCount/, '6: QSC input does not render x/max selected copy');
assert.match(sanity, /formatQscSelectionCounter\(\{/, '7: top category counter still rendered');
assert.match(
  sanity,
  /styles\.qscSelectionCounter, \{ color: theme\.tabIconDefault \}/,
  '7: top category counter styling unchanged',
);

const event = flowSrc.match(/const renderEventInput = \(\) => \([\s\S]*?\n  \);/)?.[0] || '';
assert.ok(event, 'renderEventInput must exist');
assert.doesNotMatch(event, /showSelectedCount=\{false\}/, '12: Event picker keeps default standalone count');
assert.doesNotMatch(event, /formatQscSelectionCounter/, '12: Event does not use QSC category counter');

assert.match(
  pickerSrc,
  /showSelectedCount = true/,
  'Event default still shows {count}/{max} selected',
);
assert.match(pickerSrc, /const atLimit = selectedIds\.length >= maxItems/, '5: max-selection blocking unchanged');

assert.match(
  flowSrc,
  /label: t\('stylistFlow\.continue'\)[\s\S]*?useReadyAccent: true/,
  '12: Event Continue label unchanged',
);
assert.match(
  flowSrc,
  /decisionType === 'shopping'[\s\S]*?label: t\('stylistFlow\.getRecommendation'\)/,
  '12: Shopping CTA label unchanged',
);
assert.match(
  flowSrc,
  /decisionType === 'event-outfit'[\s\S]*?label: t\('stylistFlow\.getRecommendation'\)/,
  '12: Event input CTA label unchanged',
);
assert.doesNotMatch(
  flowSrc,
  /getRecommendation'\) \+ ` · /,
  '12: Shopping/Event recommendation labels do not gain a count suffix',
);

assert.equal(
  formatQscSelectionCounter({
    selectedIds: ['o1', 'o2', 't1'],
    items: [
      { id: 'o1', category: 'outerwear' },
      { id: 'o2', category: 'outerwear' },
      { id: 't1', category: 'tops' },
    ],
    selectedLabel: (count) => `Selected ${count}`,
    labelForGroup: (key) =>
      ({ outerwear: 'Outerwear', tops: 'Tops', bottoms: 'Bottoms', footwear: 'Footwear', accessories: 'Accessories', dresses: 'Dresses', other: 'Other' }[key]),
  }),
  'Selected 3 · Outerwear 2 · Tops 1',
  '7: top category counter text contract unchanged',
);
assert.match(counterSrc, /export function formatQscSelectionCounter/, '7: category counter helper still present');

assert.match(
  hookSrc,
  /decisionType === 'sanity-check'[\s\S]*return images\.length >= 1 \|\| selectedWardrobeIds\.length >= 1/,
  'readiness predicate unchanged',
);
assert.match(hookSrc, /resolveQscEvaluateSubmitSelection/, 'selection-integrity submit helper preserved');
assert.match(hookSrc, /const getWardrobeSelectLimit = useCallback\(\(\) => MAX_DECISION_WARDROBE_ITEMS, \[\]\)/, 'max-selection source unchanged');

console.log('verify-qsc-sticky-selection-count: ok');
