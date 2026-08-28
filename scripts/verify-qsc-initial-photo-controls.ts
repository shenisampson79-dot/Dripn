/**
 * QSC initial input paths: Camera, Gallery, Wardrobe visible without pre-selection.
 *
 * Run: npx tsx scripts/verify-qsc-initial-photo-controls.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const flowPath = resolve(__dirname, '../components/stylist/StylistDecisionFlow.tsx');
const hookPath = resolve(__dirname, '../hooks/useStylistDecision.ts');
const flowSrc = readFileSync(flowPath, 'utf8');
const hookSrc = readFileSync(hookPath, 'utf8');

const sanityBlock = flowSrc.match(
  /const renderSanityInput = \(\) => \([\s\S]*?\n  \);/,
);
assert.ok(sanityBlock, 'renderSanityInput must exist');
const sanity = sanityBlock[0];

const titleIdx = sanity.indexOf("stylistFlow.sanityCheck.inputTitle");
const uploadIdx = sanity.indexOf('renderUploadActions()');
const wardrobeIdx = sanity.indexOf('<DecisionWardrobePicker');
const contextIdx = sanity.indexOf('renderContextChips(');

assert.ok(titleIdx >= 0 && uploadIdx >= 0 && wardrobeIdx >= 0 && contextIdx >= 0);
assert.ok(titleIdx < uploadIdx, 'title must precede Gallery/Camera row');
assert.ok(uploadIdx < wardrobeIdx, 'Gallery/Camera must precede wardrobe picker');
assert.ok(wardrobeIdx < contextIdx, 'optional context chips must follow wardrobe');

assert.ok(
  !/selectedWardrobeIds\.length/.test(sanity),
  'sanity input must not gate photo controls on wardrobe selection',
);

assert.match(flowSrc, /onPress=\{flow\.handlePickImage\}/, 'Gallery handler preserved');
assert.match(flowSrc, /onPress=\{flow\.handleTakePhoto\}/, 'Camera handler preserved');
assert.match(
  sanity,
  /flow\.images\[0\]\s*\?\s*\([\s\S]*?\)\s*:\s*\(\s*\n?\s*renderUploadActions\(\)/,
  'hero image branch preserved for post-upload state',
);

assert.match(
  hookSrc,
  /decisionType === 'sanity-check'[\s\S]*return images\.length >= 1 \|\| selectedWardrobeIds\.length >= 1/,
  'QSC proceed rule unchanged (photo OR wardrobe)',
);

console.log('verify-qsc-initial-photo-controls: all passed');
