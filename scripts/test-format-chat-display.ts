/**
 * Focused Chat display + settings/hub copy checks.
 * Run: node --experimental-strip-types scripts/test-format-chat-display.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  chatDisplayTokens,
  formatChatAssistantDisplayText,
  splitChatDisplayBlocks,
} from '../utils/formatChatAssistantDisplay.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function assertSameWords(original: string, formatted: string, label: string) {
  assert.deepEqual(
    chatDisplayTokens(formatted),
    chatDisplayTokens(original),
    `${label}: words and order preserved`,
  );
}

const gluedBullets =
  "The navy is doing the heavy lifting here, so keep everything else quiet. Don't add another loud accessory or it will look accidental. · Give the eye one place to land\n· Keep metals to one finish\n· Let the navy stay the loudest colour";

const formattedGlued = formatChatAssistantDisplayText(gluedBullets);
assert.equal(
  formattedGlued.includes('accidental.\n· Give the eye'),
  true,
  'genuine first inline bullet starts on its own line',
);
assertSameWords(gluedBullets, formattedGlued, 'glued list');
assert.equal(
  (formattedGlued.match(/Give the eye one place to land/g) || []).length,
  1,
  'first bullet text is not duplicated',
);

const blocks = splitChatDisplayBlocks(gluedBullets);
assert.equal(blocks[0]?.endsWith('accidental.'), true, 'prose stays before the list');
assert.equal(blocks[1], '· Give the eye one place to land', 'first bullet is its own line');
assert.equal(blocks[2], '· Keep metals to one finish', 'second bullet remains separate');
assert.equal(blocks[3], '· Let the navy stay the loudest colour', 'third bullet remains separate');

const paras = 'Paragraph one.\n\nParagraph two.';
assert.equal(formatChatAssistantDisplayText(paras), paras, 'existing paragraph breaks remain intact');
assert.deepEqual(splitChatDisplayBlocks(paras), ['Paragraph one.', 'Paragraph two.']);

const unstructured = 'Single paragraph with no recoverable structure.';
assert.equal(formatChatAssistantDisplayText(unstructured), unstructured);
assert.deepEqual(splitChatDisplayBlocks(unstructured), [unstructured]);

const midProse = 'Keep a smart casual · navy mix for the evening.';
assert.equal(formatChatAssistantDisplayText(midProse), midProse, 'ordinary middle-dot prose is unchanged');

const loneInline = 'That works. · Maybe keep the jacket.';
assert.equal(
  formatChatAssistantDisplayText(loneInline),
  loneInline,
  'sentence plus one inline middle dot is not treated as a list',
);

const hubSrc = readFileSync(resolve(__dirname, '../screens/StylistHubScreen.tsx'), 'utf8');
assert.doesNotMatch(hubSrc, /stylistHub\.styleToolsTitle|\|\| 'Style Tools'/);
assert.match(hubSrc, /title: "Live Stylist"/);

const selectableSrc = readFileSync(resolve(__dirname, '../components/chat/ChatSelectableText.tsx'), 'utf8');
assert.match(selectableSrc, /formatChatAssistantDisplayText/);
assert.doesNotMatch(
  selectableSrc,
  /displayBlocks\.map|blocks\.map/,
  'whole-message selection uses one native text field',
);
assert.match(selectableSrc, /<TextInput/);
assert.doesNotMatch(selectableSrc, /Clipboard/);

const settingsSrc = readFileSync(resolve(__dirname, '../screens/SettingsScreen.tsx'), 'utf8');
assert.match(settingsSrc, /App Language/);
assert.match(settingsSrc, /Stylist Language/);

const en = JSON.parse(readFileSync(resolve(__dirname, '../locales/en.json'), 'utf8')) as Record<string, string>;
assert.equal(en['voiceCredits.voiceReplies'], 'Voice Replies');
assert.equal(en['settings.appLanguage'], 'App Language');
assert.equal(en['settings.stylistLanguage'], 'Stylist Language');

console.log('test-format-chat-display: all passed');
