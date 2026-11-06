/**
 * Hub heading + Android assistant chat bullet display.
 * Run: npx tsx scripts/test-stylist-hub-and-chat-display.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatChatAssistantDisplayText,
  resolveChatSelectableDisplayText,
} from '../utils/formatChatAssistantDisplay';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const hubSrc = readFileSync(resolve(root, 'screens/StylistHubScreen.tsx'), 'utf8');
assert.doesNotMatch(
  hubSrc,
  /stylistHub\.styleToolsTitle|\|\| 'Style Tools'/,
  'Style Tools heading is not rendered',
);
assert.match(
  hubSrc,
  /stylistHub\.styleToolsSubtitle/,
  'hub subtitle translation key remains',
);
assert.match(
  hubSrc,
  /\|\| 'Your personal fashion assistant'/,
  'hub subtitle fallback remains',
);
assert.match(
  hubSrc,
  /stylistHub\.screenTitle|\|\| 'Stylist'/,
  'main Stylist header remains',
);
assert.match(hubSrc, /GRID_TOP_GAP/, 'tile grid spacing remains');
assert.match(hubSrc, /getFeatures|getLaunchDecisionTiles/, 'tool tiles remain');

const translationSrc = readFileSync(resolve(root, 'services/TranslationService.ts'), 'utf8');
assert.match(translationSrc, /styleToolsTitle: 'Style Tools'/, 'translation key kept for other use');

const glued =
  'Possible. Red and blue can work when one is muted and the silhouette stays clean. • Mute at least one colour\n• Add black, white, navy, or beige to calm the pair\n• Keep prints minimal';
const expectedGlued =
  'Possible. Red and blue can work when one is muted and the silhouette stays clean.\n• Mute at least one colour\n• Add black, white, navy, or beige to calm the pair\n• Keep prints minimal';
assert.equal(
  formatChatAssistantDisplayText(glued),
  expectedGlued,
  'prose followed by inline first bullet starts the list on its own line',
);

const gluedMiddleDot =
  'Possible. Red and blue can work when one is muted and the silhouette stays clean. · Mute at least one colour\n· Add black, white, navy, or beige to calm the pair\n· Keep prints minimal';
assert.equal(
  formatChatAssistantDisplayText(gluedMiddleDot),
  'Possible. Red and blue can work when one is muted and the silhouette stays clean.\n· Mute at least one colour\n· Add black, white, navy, or beige to calm the pair\n· Keep prints minimal',
  'middle-dot list markers unstick the same way',
);

assert.equal(
  formatChatAssistantDisplayText(expectedGlued),
  expectedGlued,
  'already formatted bullet lists stay unchanged',
);

const alreadyBlankLine =
  'Possible. Red and blue can work when one is muted and the silhouette stays clean.\n\n• Mute at least one colour\n• Add black, white, navy, or beige to calm the pair';
assert.equal(
  formatChatAssistantDisplayText(alreadyBlankLine),
  alreadyBlankLine,
  'already separated lists with a blank line are preserved',
);

const ordinary = 'Possible. Red and blue can work when one is muted and the silhouette stays clean.';
assert.equal(formatChatAssistantDisplayText(ordinary), ordinary, 'ordinary prose is unchanged');

const midProse = 'Keep a smart casual · navy mix for the evening.';
assert.equal(formatChatAssistantDisplayText(midProse), midProse, 'mid-sentence middle dots are unchanged');

const loneInline = 'That works. · Maybe keep the jacket.';
assert.equal(
  formatChatAssistantDisplayText(loneInline),
  loneInline,
  'a single inline marker is not treated as a list',
);

const firstPass = formatChatAssistantDisplayText(glued);
assert.equal(
  formatChatAssistantDisplayText(firstPass),
  firstPass,
  'repeated formatting is idempotent',
);

assert.equal(
  resolveChatSelectableDisplayText(glued, { platform: 'android' }),
  expectedGlued,
  'Android assistant display applies the formatter',
);
assert.equal(
  resolveChatSelectableDisplayText(glued, { platform: 'android', inverted: true }),
  glued,
  'Android user bubbles stay raw',
);
assert.equal(
  resolveChatSelectableDisplayText(glued, { platform: 'ios' }),
  glued,
  'iOS assistant display stays raw',
);
assert.equal(
  resolveChatSelectableDisplayText(glued, { platform: 'ios', inverted: true }),
  glued,
  'iOS user bubbles stay raw',
);

const selectableSrc = readFileSync(resolve(root, 'components/chat/ChatSelectableText.tsx'), 'utf8');
assert.match(selectableSrc, /value=\{plain\}/, 'iOS TextInput still uses unformatted stripped text');
const iosReturnIdx = selectableSrc.indexOf("if (Platform.OS === 'ios')");
const formatIdx = selectableSrc.indexOf('resolveChatSelectableDisplayText');
const formatCallIdx = selectableSrc.indexOf("platform: 'android'");
assert.ok(iosReturnIdx > 0, 'iOS branch exists');
assert.ok(formatCallIdx > iosReturnIdx, 'Android formatter runs after the iOS return');
assert.match(selectableSrc, /inverted/);
assert.ok(
  selectableSrc.indexOf('stripMarkdownBold') < iosReturnIdx,
  'iOS still strips markdown independently of the formatter',
);
assert.ok(formatIdx > 0 && formatCallIdx > formatIdx);

const chatSrc = readFileSync(resolve(root, 'screens/AIStylistScreen.tsx'), 'utf8');
assert.match(chatSrc, /StylistComposerPad/);
assert.match(chatSrc, /androidMeasuredStickOffset/);

console.log('test-stylist-hub-and-chat-display: all passed');
