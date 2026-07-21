/**
 * Flight / travel-day outfit builder — comfort, closed shoes, removable layer.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import { isOutfitValid } from '@/utils/outfitClashRules';
import { passesHardOutfitChecks } from '@/utils/outfitDiversity';

function itemText(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

function isClosedShoe(item: WardrobeItem): boolean {
  if (!isShoesItem(item)) return false;
  return !/sandal|slide|flip.?flop|open.?toe|mule/.test(itemText(item));
}

function isComfortBottom(item: WardrobeItem): boolean {
  if (!isBottomItem(item)) return false;
  if (/tight|skinny.*stiff|pencil|leather pant/.test(itemText(item))) return false;
  return true;
}

function scoreLayer(item: WardrobeItem): number {
  const t = itemText(item);
  let s = 0;
  if (/hoodie|overshirt|cardigan|shacket|light jacket|blazer|softshell|zip/.test(t)) s += 3;
  if (/fleece|bomber/.test(t)) s += 2;
  if (/puffer|parka|trench|heavy|wool coat/.test(t)) s -= 1;
  if (/easy|light|packable/.test(t)) s += 1;
  return s;
}

function scoreTop(item: WardrobeItem): number {
  const t = itemText(item);
  let s = 0;
  if (/tee|t-shirt|long.?sleeve|knit|polo|crew/.test(t)) s += 3;
  if (/oxford|button|shirt/.test(t)) s += 1.5;
  if (/stiff|formal|tuxedo|sequin/.test(t)) s -= 2;
  return s;
}

function scoreBottom(item: WardrobeItem): number {
  const t = itemText(item);
  let s = 0;
  if (/jogger|sweatpant/.test(t)) s += 4;
  if (/chino|relaxed|soft|linen pant/.test(t)) s += 3;
  if (/jean/.test(t)) s += 1.5;
  if (/tight|skinny|leather|suit pant|tailored.*stiff/.test(t)) s -= 2;
  if (/short/.test(t)) s -= 1; // airport AC + security: prefer full length
  return s;
}

function scoreShoe(item: WardrobeItem): number {
  const t = itemText(item);
  let s = 0;
  if (!isClosedShoe(item)) return -10;
  if (/slip.?on|loafer/.test(t)) s += 4;
  if (/sneaker|trainer/.test(t)) s += 3.5;
  if (/boot/.test(t)) s += 0.5;
  if (/lace|hiking|combat/.test(t)) s -= 0.5;
  return s;
}

function pickBest(
  pool: WardrobeItem[],
  scorer: (item: WardrobeItem) => number,
  excludeIds: Set<string>,
): WardrobeItem | null {
  let best: WardrobeItem | null = null;
  let bestScore = -Infinity;
  for (const item of pool) {
    if (excludeIds.has(String(item.id))) continue;
    const score = scorer(item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore > -5 ? best : null;
}

/**
 * Build a travel-day (flight) outfit preferring capsule pieces.
 * Returns null only if structure cannot be satisfied.
 */
export function buildFlightOutfit(
  wardrobe: WardrobeItem[],
  capsule?: WardrobeItem[] | null,
): WardrobeItem[] | null {
  const prefer = capsule?.length ? capsule : wardrobe;
  const fallback = wardrobe;

  const layers = prefer.filter(isOuterwearItem);
  const tops = prefer.filter(isTopItem);
  const bottoms = prefer.filter(isBottomItem);
  const shoes = prefer.filter(isShoesItem);

  const used = new Set<string>();
  let layer =
    pickBest(layers, scoreLayer, used)
    || pickBest(fallback.filter(isOuterwearItem), scoreLayer, used);
  // Soft midlayer as layer if no outerwear (hoodie often tagged as top)
  if (!layer) {
    const hoodie = pickBest(
      [...prefer, ...fallback].filter(
        (i) => isTopItem(i) && /hoodie|sweatshirt|cardigan|zip/.test(itemText(i)),
      ),
      scoreLayer,
      used,
    );
    layer = hoodie;
  }

  if (layer) used.add(String(layer.id));

  let top =
    pickBest(tops.filter((t) => String(t.id) !== String(layer?.id)), scoreTop, used)
    || pickBest(fallback.filter(isTopItem), scoreTop, used);
  if (top) used.add(String(top.id));

  let bottom =
    pickBest(bottoms.filter(isComfortBottom), scoreBottom, used)
    || pickBest(fallback.filter(isBottomItem), scoreBottom, used);
  if (bottom) used.add(String(bottom.id));

  let shoe =
    pickBest(shoes.filter(isClosedShoe), scoreShoe, used)
    || pickBest(fallback.filter((i) => isShoesItem(i) && isClosedShoe(i)), scoreShoe, used);
  if (shoe) used.add(String(shoe.id));

  if (!top || !bottom || !shoe) return null;

  const base = [top, bottom, shoe];
  const withLayer = layer ? [...base, layer] : base;

  if (passesHardOutfitChecks(withLayer) || isOutfitValid(withLayer)) {
    return withLayer;
  }
  if (passesHardOutfitChecks(base) || isOutfitValid(base)) {
    return base;
  }
  return null;
}

export function flightOutfitNote(isReturn: boolean): string {
  return isReturn
    ? 'Return travel day — comfortable layers, closed shoes, easy through security.'
    : 'Travel day — designed for comfort, security, and changing cabin temperatures.';
}
