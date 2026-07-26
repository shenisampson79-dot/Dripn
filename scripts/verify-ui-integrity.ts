/**
 * Outfit Mix UI Reality Layer — completeness, visibility, layout contracts.
 * Run: npx tsx scripts/verify-ui-integrity.ts
 */
import {
  buildMixReelPools,
  mixFilterDropRatio,
  hasMixDisplayImage,
  withMixImageFallback,
  isMixBottomsCandidate,
  isMixShoesCandidate,
} from '../utils/outfitMixConstraints';
import {
  OUTFIT_MIX_LAYOUT,
  OUTFIT_MIX_COVERAGE,
  evaluateOutfitMixUiReality,
  ensureMinimumCoverage,
  outfitMixReelBottomPad,
  assertSaveDoesNotCoverShoes,
} from '../utils/uiRealityLayer/outfitMixUiReality';
import type { WardrobeItem } from '../contexts/WardrobeContext';

function item(partial: Partial<WardrobeItem> & Pick<WardrobeItem, 'id' | 'category' | 'name'>): WardrobeItem {
  return {
    userId: 'u1',
    imageUri: 'https://cdn.example/x.jpg',
    color: 'black',
    seasons: ['all-season'],
    occasions: ['everyday'],
    timesWorn: 0,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const casualTrousers = item({ id: 'casual-trouser', category: 'bottoms', name: 'Black Casual Trousers' });
const formalTrousers = item({
  id: 'formal-trouser',
  category: 'formal',
  name: 'Charcoal Dress Trousers',
});
const cargo = item({ id: 'cargo', category: 'bottoms', name: 'Black Cargo Pants' });
const loafers = item({ id: 'loafers', category: 'shoes', name: 'Brown Loafers' });
const sneakers = item({ id: 'sneakers', category: 'shoes', name: 'Cream Lifestyle Sneakers' });
const oxfords = item({ id: 'oxfords', category: 'shoes', name: 'Black Oxford Shoes' });
const formalShoes = item({
  id: 'formal-shoes',
  category: 'formal',
  name: 'Black Formal Derby Shoes',
});
const oxford = item({ id: 'oxford-shirt', category: 'tops', name: 'White Oxford Shirt' });
const blankShoe = item({
  id: 'blank-shoe',
  category: 'shoes',
  name: 'Mystery Shoe',
  imageUri: '',
});

assert(isMixBottomsCandidate(formalTrousers), 'formal trousers are bottoms candidates');
assert(isMixShoesCandidate(formalShoes), 'formal footwear are shoes candidates');
assert(!hasMixDisplayImage(blankShoe), 'blank shoe has no display image');
assert(withMixImageFallback(blankShoe, 'shoes')._mixImageFallback === true, 'blank → fallback flag');

const wardrobe = [
  casualTrousers,
  formalTrousers,
  cargo,
  loafers,
  sneakers,
  oxfords,
  formalShoes,
  oxford,
  blankShoe,
];

const workPools = buildMixReelPools(wardrobe, 'work', {
  tops: 'oxford-shirt',
  bottoms: 'casual-trouser',
  shoes: 'loafers',
});

// 1) Completeness — never collapse to 1 when inventory ≥ 2
assert(workPools.bottoms.length >= OUTFIT_MIX_COVERAGE.bottoms, `bottoms ≥${OUTFIT_MIX_COVERAGE.bottoms}`);
assert(workPools.shoes.length >= OUTFIT_MIX_COVERAGE.shoes, `shoes ≥${OUTFIT_MIX_COVERAGE.shoes}`);
assert(workPools.bottoms.some((i) => i.id === 'formal-trouser'), 'formal trousers visible');
assert(workPools.bottoms.some((i) => i.id === 'cargo'), 'cargo soft-visible on work');
assert(workPools.shoes.some((i) => i.id === 'sneakers'), 'lifestyle sneakers visible on work');
assert(workPools.shoes.some((i) => i.id === 'formal-shoes'), 'formal shoes in shoes reel');
assert(workPools.shoes.some((i) => i.id === 'blank-shoe'), 'blank shoe kept with fallback (not dropped)');

// Ranking must not limit visibility — all owned bottoms/shoes stay in reel
assert(
  workPools.bottoms.length >= wardrobe.filter((i) => isMixBottomsCandidate(i)).length,
  'bottoms reel covers full bottoms inventory',
);
assert(
  workPools.shoes.length >= wardrobe.filter((i) => isMixShoesCandidate(i)).length,
  'shoes reel covers full shoes inventory',
);

// 2) ensureMinimumCoverage floor
const covered = ensureMinimumCoverage(
  [casualTrousers],
  [cargo, formalTrousers],
  [casualTrousers, cargo, formalTrousers],
  2,
);
assert(covered.length >= 2, 'ensureMinimumCoverage backfills to 2');
assert(covered[0].id === 'casual-trouser', 'preferred stays first');

// 3) Filter transparency — visibility drop must be 0 (soft-ban ≠ hide)
const bottomsDrop = mixFilterDropRatio(wardrobe, 'bottoms', 'work');
const shoesDrop = mixFilterDropRatio(wardrobe, 'shoes', 'work');
// prune may drop many for scoring preference; UI visibility drop is separate
const bottomsVisibleDrop =
  1 - workPools.bottoms.length / Math.max(1, wardrobe.filter((i) => isMixBottomsCandidate(i)).length);
const shoesVisibleDrop =
  1 - workPools.shoes.length / Math.max(1, wardrobe.filter((i) => isMixShoesCandidate(i)).length);
assert(bottomsVisibleDrop === 0, `bottoms visibility drop must be 0, got ${bottomsVisibleDrop}`);
assert(shoesVisibleDrop === 0, `shoes visibility drop must be 0, got ${shoesVisibleDrop}`);
assert(bottomsDrop >= 0 && bottomsDrop <= 1, 'prune drop ratio bounded');
assert(shoesDrop >= 0 && shoesDrop <= 1, 'shoes prune drop ratio bounded');

// 4) Layout contract — Save never overlaps shoes
assert(OUTFIT_MIX_LAYOUT.contentPadForSave >= OUTFIT_MIX_LAYOUT.saveButtonMinHeight, 'content pad ≥ button');
assert(outfitMixReelBottomPad(true) === OUTFIT_MIX_LAYOUT.contentPadForSave, 'pad helper');
assert(outfitMixReelBottomPad(false) === 0, 'no pad without save');

const shoesRowBottom = 700;
const saveTop = shoesRowBottom + OUTFIT_MIX_LAYOUT.reelToSaveGap;
const saveBottom = saveTop + OUTFIT_MIX_LAYOUT.saveButtonMinHeight;
assertSaveDoesNotCoverShoes({
  saveButton: { top: saveTop, bottom: saveBottom },
  row_shoes: { top: 620, bottom: shoesRowBottom },
});

let overlapThrew = false;
try {
  assertSaveDoesNotCoverShoes({
    saveButton: { top: 680, bottom: 740 },
    row_shoes: { top: 620, bottom: 710 },
  });
} catch {
  overlapThrew = true;
}
assert(overlapThrew, 'overlap assert must throw');

// 5) Master evaluateOutfitMixUiReality
const reality = evaluateOutfitMixUiReality({
  inventoryByRow: {
    bottoms: workPools.bottoms.length,
    shoes: workPools.shoes.length,
    'bottoms:formal': 1,
    'bottoms:formalVisible': workPools.bottoms.some((i) => i.id === 'formal-trouser') ? 1 : 0,
  },
  visibleByRow: {
    bottoms: workPools.bottoms.map((i) => ({
      id: i.id,
      image: (i as WardrobeItem).imageUri,
      softBanned: (i as { softBanned?: boolean }).softBanned,
      _mixImageFallback: (i as { _mixImageFallback?: boolean })._mixImageFallback,
    })),
    shoes: workPools.shoes.map((i) => ({
      id: i.id,
      image: (i as WardrobeItem).imageUri || null,
      softBanned: (i as { softBanned?: boolean }).softBanned,
      _mixImageFallback: (i as { _mixImageFallback?: boolean })._mixImageFallback,
    })),
  },
  // Visibility drop (not prune drop) — must stay transparent
  filterDropRatioByRow: {
    bottoms: bottomsVisibleDrop,
    shoes: shoesVisibleDrop,
  },
  layout: {
    saveButton: { top: saveTop, bottom: saveBottom },
    row_shoes: { top: 620, bottom: shoesRowBottom },
  },
});

assert(reality.pass, `UI Reality failed: ${reality.errors.join('; ')}`);

console.log('verify-ui-integrity: Outfit Mix UI Reality contracts passed');
