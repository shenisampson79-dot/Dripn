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
  formatChatAssistantDisplayText,
  splitChatDisplayBlocks,
} from '../utils/formatChatAssistantDisplay';
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

const gluedBullets =
  "The navy is doing the heavy lifting here, so keep everything else quiet. Don't add another loud accessory or it will look accidental. · Give the eye one place to land\n· Keep metals to one finish\n· Let the navy stay the loudest colour";

assert.equal(
  formatChatAssistantDisplayText(gluedBullets).includes('accidental.\n· Give the eye'),
  true,
  '10. First inline middle-dot bullet starts on its own line',
);

const blocks = splitChatDisplayBlocks(gluedBullets);
assert.equal(blocks[0]?.endsWith('accidental.'), true, '10b. Prose stays in its own block');
assert.equal(blocks[1], '· Give the eye one place to land', '10c. First bullet is its own block');
assert.equal(blocks[2], '· Keep metals to one finish', '10d. Second bullet remains separate');
assert.equal(blocks[3], '· Let the navy stay the loudest colour', '10e. Third bullet remains separate');

assert.deepEqual(
  splitChatDisplayBlocks('Paragraph one.\n\nParagraph two.'),
  ['Paragraph one.', 'Paragraph two.'],
  '11. Existing paragraph breaks become spaced display blocks',
);

assert.deepEqual(
  splitChatDisplayBlocks('Single paragraph with no recoverable structure.'),
  ['Single paragraph with no recoverable structure.'],
  '12. Unstructured prose is not split into invented paragraphs',
);

const hubSrc = readFileSync(resolve(__dirname, '../screens/StylistHubScreen.tsx'), 'utf8');
assert.doesNotMatch(hubSrc, /stylistHub\.styleToolsTitle|\|\| 'Style Tools'/, '13. Stylist Hub no longer renders Style Tools heading');
assert.match(hubSrc, /title: "Live Stylist"/, '14. Live Stylist card uses requested capitalisation');

const selectableSrc = readFileSync(resolve(__dirname, '../components/chat/ChatSelectableText.tsx'), 'utf8');
assert.match(selectableSrc, /splitChatDisplayBlocks/, '15. Chat renderer uses display blocks');

const settingsSrc = readFileSync(resolve(__dirname, '../screens/SettingsScreen.tsx'), 'utf8');
assert.match(settingsSrc, /App Language/, '16. Settings fallback is App Language');
assert.match(settingsSrc, /Stylist Language/, '17. Settings fallback is Stylist Language');

const en = JSON.parse(readFileSync(resolve(__dirname, '../locales/en.json'), 'utf8')) as Record<string, string>;
assert.equal(en['voiceCredits.voiceReplies'], 'Voice Replies', '18. Voice Replies label');
assert.equal(en['settings.appLanguage'], 'App Language', '19. App Language label');
assert.equal(en['settings.stylistLanguage'], 'Stylist Language', '20. Stylist Language label');

console.log('test-chat-paragraph-breaks: all passed');
