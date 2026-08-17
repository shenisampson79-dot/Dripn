/**
 * QSC must never show workplace prompt / escaped quotes in the bubble.
 * Run: npx tsx scripts/test-sanitize-qsc-leak.ts
 */
import assert from 'node:assert/strict';
import { sanitizeStylistUserText } from '../utils/sanitizeStylistUserText';

const leaked = 'I\'ve got your look for \\"Work-right Workplace dress code from Settings: Smart casual. For work / office / work-appropr\\". Keep one clear style lane end to end — If a piece breaks the story, swap that piece only.';
const out = sanitizeStylistUserText(leaked);
assert.ok(out);
assert.doesNotMatch(out, /Settings/i);
assert.doesNotMatch(out, /judge against/i);
assert.doesNotMatch(out, /style lane end to end/i);
assert.doesNotMatch(out, /work-appropr/i);
assert.doesNotMatch(out, /\\"/);
assert.match(out, /I've got your look/i);

console.log('client QSC prompt-leak sanitize passed');
