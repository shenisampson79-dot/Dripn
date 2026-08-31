/**
 * Chat outfit POST must allow ≥22s for Tier-B second-hop + explanation (pre-9159734e boundary).
 * Run: npx tsx scripts/verify-chat-outfit-post-timeout.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const apiSrc = readFileSync(resolve(import.meta.dirname, '..', 'services/ApiService.ts'), 'utf8');

const fnBlock = apiSrc.match(
  /async sendWardrobeOutfitFromChat[\s\S]*?\/api\/chat\/outfit-from-wardrobe[\s\S]*?timeout:\s*(\d+)/,
);
assert.ok(fnBlock, 'sendWardrobeOutfitFromChat outfit-from-wardrobe request block');
assert.equal(fnBlock![1], '22000', 'outfit-from-wardrobe POST timeout must be 22000ms');

console.log('verify-chat-outfit-post-timeout — all passed');
