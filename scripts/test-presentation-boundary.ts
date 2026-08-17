/**
 * Client presentation boundary — forced fallback leak test.
 * Run: npx tsx scripts/test-presentation-boundary.ts
 */
import assert from 'node:assert/strict';
import {
  ENGINE_LEAK_SENTINEL,
  SAFE_FALLBACKS,
  assertNoEngineLeak,
  cannedFallback,
  collectVisibleStrings,
  isFatalEngineLeak,
  presentText,
  sealVisiblePayload,
} from '../utils/stylistPresentationBoundary';
import { sanitizeStylistUserText } from '../utils/sanitizeStylistUserText';

const SENTINEL = ENGINE_LEAK_SENTINEL;
const workplace =
  'Workplace dress code from Settings: Smart casual. For work / office / work-appropriate looks, judge against this code — not a generic office default.';
const poisoned = [
  `I've got your look for "Work-right ${workplace.slice(0, 80)}"`,
  SENTINEL,
  'work_trainers_ban COMPAT_FORMAL_TRAINERS hard_block:trainers',
  'DEBUG_TRACE=1 styleScore: 0.12 displayState: reject',
].join('\n');

function assertClean(text: string, label: string) {
  assert.doesNotMatch(text, new RegExp(SENTINEL, 'i'), `${label}: sentinel`);
  assert.doesNotMatch(text, /Workplace dress code from Settings/i, `${label}: settings`);
  assert.doesNotMatch(text, /judge against this code/i, `${label}: judge`);
  assert.doesNotMatch(text, /work_trainers_ban/, `${label}: clash id`);
  assert.doesNotMatch(text, /COMPAT_FORMAL_TRAINERS/, `${label}: compat`);
  assert.doesNotMatch(text, /DEBUG_TRACE/, `${label}: debug`);
  assert.doesNotMatch(text, /styleScore/, `${label}: styleScore`);
}

assert.equal(isFatalEngineLeak(SENTINEL), true);
assert.equal(isFatalEngineLeak('This navy look works for work.'), false);

assert.equal(sanitizeStylistUserText(SENTINEL), cannedFallback('qsc'));
assert.equal(sanitizeStylistUserText(poisoned), cannedFallback('qsc'));
assert.equal(sanitizeStylistUserText('why: work_trainers_ban'), cannedFallback('qsc'));
assert.equal(sanitizeStylistUserText('DEBUG_TRACE=1'), cannedFallback('qsc'));
assertClean(sanitizeStylistUserText(poisoned), 'fatal poison sanitize');

const workplaceOut = sanitizeStylistUserText(
  `I've got your look for \\"Work-right ${workplace}\\". Keep one clear style lane end to end — If a piece breaks the story, swap that piece only.`,
);
assertClean(workplaceOut, 'surgical workplace strip');
assert.doesNotMatch(workplaceOut, /Keep one clear style lane end to end/i);
assert.match(workplaceOut, /I've got your look/i);

assert.equal(presentText(poisoned, 'qsc'), SAFE_FALLBACKS.qsc);
assert.equal(presentText(poisoned, 'gon'), SAFE_FALLBACKS.gon);
assert.equal(presentText(poisoned, 'chat'), SAFE_FALLBACKS.chat);
assert.equal(presentText(poisoned, 'events'), SAFE_FALLBACKS.events);
assert.equal(presentText(poisoned, 'shopping'), SAFE_FALLBACKS.shopping);

const sealed = sealVisiblePayload({
  decision: poisoned,
  recommendation: workplace,
  message: SENTINEL,
  reasoning: 'work_trainers_ban',
}, { surface: 'qsc' });
assert.equal(sealed.decision, SAFE_FALLBACKS.qsc);
assert.equal(sealed.recommendation, SAFE_FALLBACKS.qsc);
assert.equal(sealed.message, SAFE_FALLBACKS.qsc);
assert.equal(sealed.reasoning, SAFE_FALLBACKS.qsc);
assertNoEngineLeak(sealed, 'sealed client payload');
assert.ok(!collectVisibleStrings(sealed).some((s) => s.includes(SENTINEL)));

const ok = sanitizeStylistUserText('This navy look works for work.');
assert.equal(ok, 'This navy look works for work.');

console.log('client presentation-boundary forced-fallback leak test passed');
