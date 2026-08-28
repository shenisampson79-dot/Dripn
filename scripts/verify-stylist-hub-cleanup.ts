/**
 * Post-cert cleanup: Stylist hub tile order + Today's Outfit customer hide.
 *
 * Run: npx tsx scripts/verify-stylist-hub-cleanup.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { isTodaysOutfitAllowed } from '../utils/staffAccess';

const hubPath = resolve(__dirname, '../screens/StylistHubScreen.tsx');
const hubSrc = readFileSync(hubPath, 'utf8');

const customer = { email: 'customer@gmail.com', role: 'user', isAdmin: false };
const staff = { email: 'qa@dripn.io', isAdmin: true };

assert.equal(isTodaysOutfitAllowed(false, customer), false, 'customers must not see Today\'s Outfit');
assert.equal(isTodaysOutfitAllowed(false, staff), true, 'staff QA may still see Today\'s Outfit');

const orderMatch = hubSrc.match(
  /export const STYLIST_HUB_LAUNCH_TILE_ORDER = \[([\s\S]*?)\] as const;/,
);
assert.ok(orderMatch, 'STYLIST_HUB_LAUNCH_TILE_ORDER must be exported');
const launchTileOrder = [...orderMatch![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

assert.deepEqual(
  launchTileOrder,
  [
    'live-stylist',
    'ai-stylist',
    'choosing-what-to-buy',
    'outfit-for-event',
    'quick-sanity-check',
    'scan-wardrobe',
    'fashion-blog',
    'style-rules',
  ],
  'launch tile order must match product spec',
);

const eventCount = launchTileOrder.filter((id) => id === 'outfit-for-event').length;
assert.equal(eventCount, 1, 'no duplicate Event tile');

assert.ok(hubSrc.includes('isTodaysOutfitAllowed'), 'hub must gate Today\'s Outfit');
assert.ok(hubSrc.includes('todaysOutfitVisible'), 'hub must conditional-render card');
assert.match(
  hubSrc,
  /todaysOutfitVisible\s*\?\s*\(\s*\n?\s*<TodaysOutfitCard/,
  'TodaysOutfitCard only when gate allows',
);

const tileScreens: Record<string, string> = {
  'live-stylist': 'LiveStylist',
  'ai-stylist': 'AIStylist',
  'choosing-what-to-buy': 'ChoosingWhatToBuy',
  'outfit-for-event': 'EventOutfit',
  'quick-sanity-check': 'SanityCheck',
  'scan-wardrobe': 'ScanWardrobe',
  'fashion-blog': 'FashionBlog',
  'style-rules': 'StyleRules',
};

for (const id of launchTileOrder) {
  const screen = tileScreens[id];
  assert.ok(screen, `missing screen mapping for ${id}`);
  const idBlock = new RegExp(`id:\\s*"${id}"[\\s\\S]*?screen:\\s*"${screen}"`);
  assert.match(hubSrc, idBlock, `${id} must still navigate to ${screen}`);
}

// Underlying generators remain (not deleted)
assert.ok(
  readFileSync(resolve(__dirname, '../services/TodaysOutfitGenerator.ts'), 'utf8').includes('generateTodaysWardrobeOutfit'),
  'outfit generation capability preserved',
);

console.log('verify-stylist-hub-cleanup: all passed');
