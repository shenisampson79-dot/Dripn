/**
 * Client-side type contract for fallback_outfit responses.
 * Run: npx tsx scripts/verify-fallback-outfit.ts
 */
import assert from 'node:assert/strict';
import { sanitizeOutfitPieces } from '../utils/safeRender/sanitizeOutfit';
import type { DecisionResponse } from '../services/DecisionService';

function isFallbackResponse(res: DecisionResponse): boolean {
  return (
    res.status === 'fallback_outfit'
    || res.type === 'fallback_outfit'
    || res.isFallback === true
  );
}

function isGapResponse(res: DecisionResponse): boolean {
  if (isFallbackResponse(res)) return false;
  return (
    res.status === 'wardrobe_gap'
    || res.status === 'no_outfit_possible'
    || res.status === 'refused'
    || res.success === false
  );
}

const fallback: DecisionResponse = {
  id: '1',
  requestId: 'r1',
  recommendation: "You're very close — just one upgrade.",
  reasoning: '',
  stylistId: 'ruby',
  timestamp: new Date().toISOString(),
  success: true,
  status: 'fallback_outfit',
  type: 'fallback_outfit',
  isFallback: true,
  stylistNote: "You're very close — just one upgrade.",
  outfitPieces: [
    { type: 'owned', role: 'top', name: 'White Oxford', wardrobeItemId: 1 },
    { type: 'recommended', role: 'shoes', name: 'Leather loafers', stylingNote: 'Recommended upgrade' },
  ],
  missing: [
    {
      role: 'shoes',
      label: 'Leather loafers',
      products: [{ retailer: 'ASOS', url: 'https://www.asos.com/search/?q=loafers' }],
      retail: {
        nearby: {
          googleMaps: 'https://www.google.com/maps/search/?api=1&query=ASOS%20London',
          appleMaps: 'https://maps.apple.com/?q=ASOS%20London',
        },
      },
    },
  ],
};

assert.equal(isFallbackResponse(fallback), true);
assert.equal(isGapResponse(fallback), false);

const gap: DecisionResponse = {
  id: '2',
  requestId: 'r2',
  recommendation: 'Add pieces',
  reasoning: '',
  stylistId: 'ivy',
  timestamp: new Date().toISOString(),
  success: false,
  status: 'wardrobe_gap',
};
assert.equal(isFallbackResponse(gap), false);
assert.equal(isGapResponse(gap), true);

const cleaned = sanitizeOutfitPieces(fallback.outfitPieces);
assert.ok(cleaned.some((p) => p.type === 'owned'));
assert.ok(cleaned.some((p) => p.type === 'recommended'));
assert.ok(cleaned.some((p) => p.name === 'Leather loafers'));

console.log('✓ Client fallback_outfit type handling checks passed');
