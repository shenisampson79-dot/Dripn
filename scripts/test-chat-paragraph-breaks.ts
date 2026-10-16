/**
 * Chat-only paragraph preservation in stylist sanitizers.
 * Run: npx tsx scripts/test-chat-paragraph-breaks.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { cannedFallback } from '../utils/stylistPresentationBoundary';
import {
  sanitizeStylistUserText,
  stripInternalPromptLeaks,
} from '../utils/sanitizeStylistUserText';
import {
  rewriteStylistCtaJargon,
  stripNonActionableSaveLookProse,
} from '../utils/shopDressCodeFilters';

const PRESERVE = { preserveParagraphBreaks: true as const };
const PARA = 'Paragraph one.\n\nParagraph two.';
const CHAT = resolve(__dirname, '../screens/AIStylistScreen.tsx');
const DECISION = resolve(__dirname, '../hooks/useStylistDecision.ts');
const PRODUCT = resolve(__dirname, '../components/stylist/ProductCard.tsx');
const DECISION_PRESENTATION = resolve(__dirname, '../utils/decisionResultPresentation.ts');

assert.equal(
  sanitizeStylistUserText(PARA, PRESERVE),
  PARA,
  '1. Chat-scoped sanitization preserves paragraph separators',
);

assert.equal(
  stripInternalPromptLeaks(PARA, PRESERVE),
  PARA,
  '2a. stripInternalPromptLeaks keeps paragraph separators when opted in',
);
assert.equal(
  rewriteStylistCtaJargon(PARA, PRESERVE),
  PARA,
  '2b. rewriteStylistCtaJargon keeps paragraph separators when opted in',
);
assert.equal(
  stripNonActionableSaveLookProse(PARA, PRESERVE),
  PARA,
  '2c. stripNonActionableSaveLookProse keeps paragraph separators when opted in',
);

assert.equal(
  sanitizeStylistUserText(PARA),
  'Paragraph one. Paragraph two.',
  '3a. Default sanitizer still collapses paragraph separators',
);
assert.equal(
  stripInternalPromptLeaks(PARA),
  'Paragraph one. Paragraph two.',
  '3b. Default stripInternalPromptLeaks still collapses paragraph separators',
);
assert.equal(
  rewriteStylistCtaJargon(PARA),
  'Paragraph one. Paragraph two.',
  '3c. Default rewriteStylistCtaJargon still collapses paragraph separators',
);
assert.equal(
  stripNonActionableSaveLookProse(PARA),
  'Paragraph one. Paragraph two.',
  '3d. Default stripNonActionableSaveLookProse still collapses paragraph separators',
);

assert.equal(
  sanitizeStylistUserText('Paragraph  one.\t\tParagraph two.', PRESERVE),
  'Paragraph one. Paragraph two.',
  '4a. Repeated spaces and tabs are still normalized when preserving paragraphs',
);
assert.equal(
  sanitizeStylistUserText('Paragraph one.\n\n\n\nParagraph two.', PRESERVE),
  PARA,
  '4b. Excessive blank lines still collapse to a single paragraph break',
);
assert.equal(
  sanitizeStylistUserText('Paragraph one.\n\n \n\nParagraph two.', PRESERVE),
  PARA,
  '4c. Whitespace-only paragraph remnants are removed',
);
assert.equal(
  sanitizeStylistUserText('Paragraph one.\n\n\t\n\nParagraph two.', PRESERVE),
  PARA,
  '4d. Tab-only paragraph remnants are removed',
);
assert.equal(
  sanitizeStylistUserText('Paragraph one.\n\n \n\nParagraph two.'),
  'Paragraph one. Paragraph two.',
  '4e. Default sanitizer still collapses remnant blank lines to spaces',
);

assert.equal(
  sanitizeStylistUserText('DEBUG_TRACE=1', PRESERVE),
  cannedFallback('qsc'),
  '5a. Fatal internal-prompt leaks still force the canned fallback',
);
const workplaceLeak = sanitizeStylistUserText(
  'Paragraph one.\n\nWorkplace dress code from Settings: Smart casual.\n\nParagraph two.',
  PRESERVE,
);
assert.doesNotMatch(workplaceLeak, /Settings/i);
assert.doesNotMatch(workplaceLeak, /Workplace dress code/i);
assert.equal(
  workplaceLeak,
  PARA,
  '5b. Leak stripping leaves one blank line between genuine paragraphs',
);

const withSave = sanitizeStylistUserText(
  'Paragraph one.\n\nWant to save this look?\n\nParagraph two.',
  PRESERVE,
);
assert.doesNotMatch(withSave, /save this look/i);
assert.equal(
  withSave,
  PARA,
  '6a. Save-look stripping leaves one blank line between genuine paragraphs',
);

const withLog = sanitizeStylistUserText(
  'Paragraph one.\n\nIf you want, I can help you log this outfit.\n\nParagraph two.',
  PRESERVE,
);
assert.doesNotMatch(withLog, /log this/i);
assert.equal(
  withLog,
  PARA,
  '6b. CTA stripping leaves one blank line between genuine paragraphs',
);

const single = 'Navy chinos with a white Oxford reads smart-casual for the office.';
assert.equal(
  sanitizeStylistUserText(single, PRESERVE),
  single,
  '7a. Ordinary single-paragraph advice is unchanged with the option',
);
assert.equal(
  sanitizeStylistUserText(single),
  single,
  '7b. Ordinary single-paragraph advice is unchanged on the default path',
);

const chatSrc = readFileSync(CHAT, 'utf8');
assert.match(
  chatSrc,
  /sanitizeStylistUserText\(\s*stripStructuredOutfitMarkers\(message\.content\),\s*\{\s*preserveParagraphBreaks:\s*true\s*,?\s*\}\s*\)/,
  '8. Assistant Chat path enables preserveParagraphBreaks',
);
assert.equal(
  (chatSrc.match(/preserveParagraphBreaks:\s*true/g) || []).length,
  1,
  '8b. Chat enables the option at exactly one assistant-content boundary',
);

for (const [label, file] of [
  ['useStylistDecision', DECISION],
  ['ProductCard', PRODUCT],
  ['decisionResultPresentation', DECISION_PRESENTATION],
] as const) {
  const src = readFileSync(file, 'utf8');
  assert.doesNotMatch(
    src,
    /preserveParagraphBreaks/,
    `9. ${label} does not enable Chat paragraph preservation`,
  );
}

console.log('test-chat-paragraph-breaks: all passed');
