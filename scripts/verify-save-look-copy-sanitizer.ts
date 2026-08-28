/**
 * Launch: no non-actionable "Save this look" in customer-facing stylist prose.
 *
 * Run: npx tsx scripts/verify-save-look-copy-sanitizer.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { sanitizeStylistUserText } from '../utils/sanitizeStylistUserText';
import {
  rewriteStylistCtaJargon,
  stripNonActionableSaveLookProse,
} from '../utils/shopDressCodeFilters';
import { wearCtaLabels } from '../utils/chatWearTargetDate';

const aiStylistSrc = readFileSync(
  resolve(__dirname, '../screens/AIStylistScreen.tsx'),
  'utf8',
);

// Ordinary advice stays intact.
const advice = sanitizeStylistUserText(
  'Navy chinos with a white Oxford reads smart-casual for the office.',
);
assert.match(advice, /Navy chinos/);
assert.doesNotMatch(advice, /save this look/i);

// LLM path: strip imperative save wording.
const llm = sanitizeStylistUserText(
  'This pairing works for dinner. Save this look.',
);
assert.doesNotMatch(llm, /save this look/i);
assert.match(llm, /pairing works/i);

// Jargon rewrite must not inject save copy.
const fromLog = sanitizeStylistUserText(
  'If you want, I can help you log this wedding outfit when you are home.',
);
assert.doesNotMatch(fromLog, /save this look/i);
assert.doesNotMatch(fromLog, /log this/i);

const wantSave = sanitizeStylistUserText(
  'Want to save this look, or shop the missing pieces?',
);
assert.doesNotMatch(wantSave, /save this look/i);

// Direct strip helper.
assert.doesNotMatch(
  stripNonActionableSaveLookProse('Save this look?'),
  /save this look/i,
);

// rewriteStylistCtaJargon no longer maps log → save.
assert.doesNotMatch(
  rewriteStylistCtaJargon('help you log this outfit choice'),
  /save this look/i,
);

// Legitimate card/button labels (separate from prose sanitizer) remain available.
const saveLabels = wearCtaLabels({ kind: 'none' }, { isPrimary: true });
assert.equal(saveLabels.primary, 'Save look');

// Chat still sanitizes assistant content at the presentation boundary.
assert.match(aiStylistSrc, /sanitizeStylistUserText\(stripStructuredOutfitMarkers/);

console.log('verify-save-look-copy-sanitizer: all passed');
