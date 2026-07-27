/**
 * Today's Outfit UI + state contracts (HQG).
 *
 * Run: npx tsx scripts/verify-todays-outfit-ui-contract.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  TODAYS_OUTFIT_LAYOUT_CONTRACT,
  TODAYS_OUTFIT_SUBTITLE_CONTRACT,
  createInitialDailyState,
  markSaved,
  markWorn,
  mergeDailyState,
  parseDailyState,
  runTodaysOutfitHqg,
} from '../utils/todaysOutfitDailyStore';

console.log('=== Today\'s Outfit UI + state contracts ===\n');

// --- Merge never wipes worn/saved ---
const wornLocal = {
  date: '2026-07-27',
  outfitId: 'old',
  worn: true,
  saved: true,
};
const merged = mergeDailyState(wornLocal, 'new-outfit', '2026-07-27');
assert.equal(merged.worn, true, 'hydrate must preserve worn');
assert.equal(merged.saved, true, 'hydrate must preserve saved');
assert.equal(merged.outfitId, 'new-outfit');

const freshDay = mergeDailyState(wornLocal, 'x', '2026-07-28');
assert.equal(freshDay.worn, false, 'new date resets worn');
assert.equal(freshDay.saved, false);

// --- Wear / save mutations ---
const base = createInitialDailyState('o1', '2026-07-27');
assert.equal(markWorn(base).worn, true);
assert.equal(markSaved(base).saved, true);
assert.ok(parseDailyState(JSON.stringify(markWorn(base))));

// --- HQG: WEAR keeps card open + persists ---
const wearPass = runTodaysOutfitHqg({
  event: 'WEAR',
  daily: markWorn(base),
  ui: {
    subtitle: TODAYS_OUTFIT_SUBTITLE_CONTRACT,
    wearLabel: 'Wearing today',
    cardOpen: true,
    sheetMode: 'view',
    saveUsesStackedModal: false,
  },
});
assert.equal(wearPass.pass, true, wearPass.issues.join('; '));

const wearFailClose = runTodaysOutfitHqg({
  event: 'WEAR',
  daily: markWorn(base),
  ui: {
    subtitle: TODAYS_OUTFIT_SUBTITLE_CONTRACT,
    wearLabel: 'Wearing today',
    cardOpen: false,
    sheetMode: 'view',
    saveUsesStackedModal: false,
  },
});
assert.equal(wearFailClose.pass, false);
assert.ok(wearFailClose.issues.some((i) => /closed/i.test(i)));

// --- HQG: forbidden subtitle ---
const subFail = runTodaysOutfitHqg({
  event: 'RENDER',
  daily: base,
  ui: {
    subtitle: 'Different from yesterday',
    wearLabel: 'Wear this',
    cardOpen: true,
    sheetMode: 'view',
    saveUsesStackedModal: false,
  },
});
assert.equal(subFail.pass, false);

// --- HQG: reopen preserves worn ---
const reopen = runTodaysOutfitHqg({
  event: 'REOPEN',
  daily: markWorn(base),
  ui: {
    subtitle: TODAYS_OUTFIT_SUBTITLE_CONTRACT,
    wearLabel: 'Wearing today',
    cardOpen: true,
    sheetMode: 'view',
    saveUsesStackedModal: false,
  },
});
assert.equal(reopen.pass, true);

const reopenFail = runTodaysOutfitHqg({
  event: 'REOPEN',
  daily: markWorn(base),
  ui: {
    subtitle: TODAYS_OUTFIT_SUBTITLE_CONTRACT,
    wearLabel: 'Wear this',
    cardOpen: true,
    sheetMode: 'view',
    saveUsesStackedModal: false,
  },
});
assert.equal(reopenFail.pass, false);

assert.equal(TODAYS_OUTFIT_LAYOUT_CONTRACT.noStackedModals, true);
assert.equal(TODAYS_OUTFIT_LAYOUT_CONTRACT.wearDoesNotCloseCard, true);

// --- Source wiring ---
const cardSrc = readFileSync(
  resolve(__dirname, '../components/TodaysOutfitCard.tsx'),
  'utf8',
);
assert.ok(cardSrc.includes('todaysOutfitDailyStore'));
assert.ok(cardSrc.includes('TODAYS_OUTFIT_SUBTITLE_CONTRACT'));
assert.ok(cardSrc.includes("setSheetMode('save')"));
assert.ok(cardSrc.includes('setWornDaily'));
assert.ok(!/Different from yesterday/.test(cardSrc));
// Wear must not close the card
assert.ok(
  !/setWornDaily[\s\S]{0,400}setVisible\(false\)/.test(cardSrc),
  'Wear path must not call setVisible(false)',
);
assert.ok(
  !cardSrc.includes('setShowSaveModal(true)'),
  'must not use stacked save modal flag',
);
assert.ok(cardSrc.includes('manualOpenRef'));
assert.ok(cardSrc.includes('loadGenRef'));
assert.ok(cardSrc.includes('useTodaysOutfitHqgGuard'));
assert.ok(
  /const showReopenChip = Boolean\(user\) && !visible && !gapVisible;/.test(cardSrc),
  'chip must stay available when sheet is closed (not gated on loading)',
);

const storeSrc = readFileSync(
  resolve(__dirname, '../utils/todaysOutfitDailyStore.ts'),
  'utf8',
);
assert.ok(storeSrc.includes('mergeDailyState'));
assert.ok(storeSrc.includes('runTodaysOutfitHqg'));

console.log('All Today\'s Outfit UI contract checks passed.\n');
console.log('  ✓ worn/saved survive hydrate merge');
console.log('  ✓ wear HQG requires card open + Wearing today');
console.log('  ✓ forbidden subtitle blocked');
console.log('  ✓ reopen preserves worn label');
console.log('  ✓ card source: SSOT + inline save + no close-on-wear\n');
