/**
 * Shopping DO_NOT_BUY must never map onto event SHOP_REQUIRED UI.
 * Also locks honest shop-copy keys.
 * Run: npx tsx scripts/verify-stylist-display-state.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  resolveStylistResultDisplayState,
  isShoppingOwnedVerdict,
} from '../utils/stylistResultDisplayState';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('=== Stylist display-state + shop copy (StyleWise) ===\n');

{
  const state = resolveStylistResultDisplayState(
    {
      purchaseDecision: { decision: 'DO_NOT_BUY' },
      displayState: 'SHOP_REQUIRED',
      retailOutfit: {
        products: [{ id: 'x', title: 'White shirt' }],
        outfit: { top: { title: 'White shirt' } },
      },
      status: 'SHOP_REQUIRED',
    },
    'shopping',
  );
  assert(state === 'APPROVED', 'DO_NOT_BUY must not open SHOP_REQUIRED UI');
  assert(
    isShoppingOwnedVerdict({ purchaseDecision: { decision: 'DO_NOT_BUY' } }),
    'isShoppingOwnedVerdict detects DO_NOT_BUY',
  );
}

{
  const state = resolveStylistResultDisplayState(
    {
      alreadyOwnedOverride: true,
      status: 'wardrobe_gap',
      retailOutfit: { products: [{ id: '1' }] },
    },
    'shopping',
  );
  assert(state === 'APPROVED', 'alreadyOwnedOverride isolates from SHOP_REQUIRED');
}

{
  const state = resolveStylistResultDisplayState(
    {
      displayState: 'SHOP_REQUIRED',
      retailOutfit: { products: [{ id: '1' }] },
    },
    'event-outfit',
  );
  assert(state === 'SHOP_REQUIRED', 'event SHOP_REQUIRED still maps for real gaps');
}

{
  const state = resolveStylistResultDisplayState(
    {
      displayState: 'SHOP_REQUIRED',
      retailOutfit: { products: [{ id: '1' }] },
      status: 'SHOP_REQUIRED',
    },
    'sanity-check',
  );
  assert(state === 'APPROVED', 'sanity-check never opens SHOP_REQUIRED UI');
}

{
  const state = resolveStylistResultDisplayState(
    { status: 'ok', recommendation: 'Looks good' },
    'sanity-check',
  );
  assert(state === 'APPROVED', 'casual sanity stays APPROVED');
}

{
  // Even if a stale DO_NOT_BUY leaks onto a sanity payload, UI must not treat it as shop gap.
  // (Server should strip ownership for sanity; client also hides the buy banner.)
  const state = resolveStylistResultDisplayState(
    {
      purchaseDecision: { decision: 'DO_NOT_BUY' },
      alreadyOwnedOverride: true,
      recommendation: 'You already own this',
    },
    'sanity-check',
  );
  assert(state === 'APPROVED', 'leaked DO_NOT_BUY on sanity still APPROVED display');
}

{
  const state = resolveStylistResultDisplayState(
    {
      status: 'wardrobe_gap',
      purchaseDecision: { decision: 'STRONG_BUY' },
    },
    'event-outfit',
  );
  assert(state === 'SHOP_REQUIRED', 'event wardrobe_gap still shops');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8'));
const recreate = en['stylistFlow.shopRecreateLook'];
const match = en['stylistFlow.shopPiecesToMatch'];
const hero = en['stylistFlow.shopHeroInspiration'];
assert(typeof recreate === 'string' && /recreate/i.test(recreate), 'shopRecreateLook key');
assert(typeof match === 'string' && /match this style/i.test(match), 'shopPiecesToMatch key');
assert(
  typeof hero === 'string' && /style and fit role/i.test(hero) && !/shop the look/i.test(hero),
  'honest hero subtext (not Shop the look)',
);
assert(!/shop the look/i.test(JSON.stringify([
  en['stylistFlow.shopRecreateLook'],
  en['stylistFlow.shopPiecesToMatch'],
  en['stylistFlow.shopPiecesToComplete'],
  en['stylistFlow.shopSuggestedForDressCode'],
])), 'no traditional Shop the look claim in shop keys');

console.log('All stylist display-state + shop copy checks passed.');
