/**
 * GON result polish — loading feedback + Refine→Ivy removal.
 * Run: npx tsx scripts/verify-gon-result-polish.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { shouldShowGonRefineCta } from '../utils/sanityFollowUpCta';

const root = resolve(__dirname, '..');
const scanSrc = readFileSync(resolve(root, 'screens/ScanWardrobeScreen.tsx'), 'utf8');
const modalSrc = readFileSync(resolve(root, 'components/outfit/GeneratedOutfitModal.tsx'), 'utf8');

assert.equal(shouldShowGonRefineCta(), false, 'GON refine CTA must stay off at launch');

assert.match(scanSrc, /renderGeneratingOutfits/, 'dedicated generating step renderer');
assert.match(scanSrc, /Creating your outfits/, 'plain-language loading copy');
assert.match(scanSrc, /ActivityIndicator size="large"/, 'visible spinner during generate');
assert.match(scanSrc, /step === 'outfit' && renderGeneratingOutfits\(\)/, 'outfit step shows loader');
assert.match(scanSrc, /setStep\('outfit'\)/, 'Process switches to outfit loading step');
assert.match(scanSrc, /disabled=\{isGenerating/, 'duplicate Process tap blocked');
assert.match(scanSrc, /finally\s*\{[\s\S]*setIsGenerating\(false\)/, 'loader clears on success and failure');

assert.doesNotMatch(scanSrc, /onAskStylist=\{/, 'ScanWardrobe must not wire Refine→Ivy');
assert.doesNotMatch(scanSrc, /navigate\(\s*['"]AIStylist['"]/, 'GON must not hand off to chat from result');

assert.match(modalSrc, /shouldShowGonRefineCta/, 'GeneratedOutfitModal uses launch gate');
assert.match(
  modalSrc,
  /shouldShowGonRefineCta\(\) && onAskStylist/,
  'Refine button doubly gated',
);

// Malformed Refine label cannot render while gate is false
assert.match(modalSrc, /stylistFlow\.refineWithStylist/, 'label preserved for future re-enable only');

// Generation API untouched
assert.match(scanSrc, /generateOutfitFromScan\(/, 'generation call preserved');
assert.doesNotMatch(scanSrc, /generate-outfit.*timeout/i, 'must not alter server timeout');

console.log(JSON.stringify({
  ok: true,
  gonRefineGate: false,
  loadingStep: 'outfit',
  loadingCopy: 'Creating your outfits…',
}, null, 2));
console.log('verify-gon-result-polish: PASS');
