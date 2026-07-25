/**
 * Hard garment category overrides — Rules layer for Outfit Mix / scoring.
 * Mirrors Dripn-Server/services/garmentCategory.js
 */

export type GarmentFamily =
  | 'athletic'
  | 'tailored'
  | 'casual'
  | 'street'
  | 'dress'
  | 'footwear_athletic'
  | 'footwear_dress'
  | 'footwear_casual'
  | 'other';

export const GARMENT_FAMILY = {
  ATHLETIC: 'athletic',
  TAILORED: 'tailored',
  CASUAL: 'casual',
  STREET: 'street',
  DRESS: 'dress',
  FOOTWEAR_ATHLETIC: 'footwear_athletic',
  FOOTWEAR_DRESS: 'footwear_dress',
  FOOTWEAR_CASUAL: 'footwear_casual',
  OTHER: 'other',
} as const;

type ItemLike = {
  name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  color?: string | null;
  id?: string | null;
};

function itemText(item: ItemLike): string {
  return `${item?.name || ''} ${item?.category || ''} ${item?.subcategory || ''} ${item?.brand || ''}`.toLowerCase();
}

export function isAthleticTopOverride(item: ItemLike | null | undefined): boolean {
  if (!item) return false;
  const cat = String(item.category || '').toLowerCase();
  if (cat === 'shoes' || cat === 'bottoms' || cat === 'activewear_bottoms') return false;
  if (cat === 'activewear_tops' || cat === 'activewear') return true;
  const t = itemText(item);
  if (/\b(camisole|slip.?tank|dress.?tank|evening.?tank)\b/.test(t)) return false;
  return /singlet|muscle.?tank|running.?tank|gym.?tank|performance.?tank|running vest|gym vest|training vest|athletic vest|performance vest|running top|athletic top|gym top|training top|performance top|compression|sports top|sports bra|asics|nike.?run|gymshark/.test(t)
    || (/\b(tank|sleeveless)\b/.test(t) && /\b(run|gym|train|sport|athletic|performance|jersey)\b/.test(t))
    || (/\b(tank|sleeveless)\b/.test(t) && !/\b(dress|maxi|midi|camisole|silk|satin)\b/.test(t) && (cat === 'tops' || cat === 'activewear_tops'));
}

export function isAthleticBottomOverride(item: ItemLike | null | undefined): boolean {
  if (!item) return false;
  const cat = String(item.category || '').toLowerCase();
  if (cat === 'activewear_bottoms') return true;
  const t = itemText(item);
  return /jogger|track ?pant|tracksuit|track suit|legging|gym short|athletic short|sweatpant|sweat pant|training pant|sweat short|jersey short|french terry|sweat bottom/.test(t);
}

export function isCargoOverride(item: ItemLike | null | undefined): boolean {
  if (!item) return false;
  return /\bcargo\b/.test(itemText(item));
}

export function isAthleticFootwearOverride(item: ItemLike | null | undefined): boolean {
  if (!item || String(item.category || '').toLowerCase() !== 'shoes') return false;
  const t = itemText(item);
  if (/\b(loafer|oxford|derby|brogue|heel|pump|stiletto|chelsea|dress shoe)\b/.test(t)) return false;
  return /\b(trainers?|sneakers?|runners?|running shoe|sport shoe|gym shoe|hoka|pegasus|ultraboost|asics|gel-?kayano)\b/.test(t)
    || /chunky|dad shoe|technical|trail|performance|athletic|cross.?train/.test(t);
}

export function isStructuredTailoredBottom(item: ItemLike | null | undefined): boolean {
  if (!item) return false;
  const cat = String(item.category || '').toLowerCase();
  if (cat !== 'bottoms' && cat !== 'formal') return false;
  if (isAthleticBottomOverride(item) || isCargoOverride(item)) return false;
  const t = itemText(item);
  if (/\b(jersey|fleece|technical|mesh|stretch.?knit|poly.?sport)\b/.test(t)) return false;
  return /\b(suit.?trousers?|tailored.?trousers?|dress.?trousers?|dress.?pants?|suit.?pants?|wool.?trousers?|pleated.?trousers?|flannel.?trousers?)\b/.test(t)
    || (cat === 'formal' && /\b(trousers?|pants?|slacks?)\b/.test(t));
}

export function isCasualTrouserBottom(item: ItemLike | null | undefined): boolean {
  if (!item) return false;
  const cat = String(item.category || '').toLowerCase();
  if (cat !== 'bottoms' && cat !== 'formal') return false;
  if (isAthleticBottomOverride(item) || isStructuredTailoredBottom(item)) return false;
  const t = itemText(item);
  return /\b(trousers?|pants?|chinos?|khaki|slacks?)\b/.test(t);
}

export function resolveGarmentFamily(item: ItemLike | null | undefined): GarmentFamily {
  if (!item) return GARMENT_FAMILY.OTHER;
  const cat = String(item.category || '').toLowerCase();
  if (isAthleticTopOverride(item) || isAthleticBottomOverride(item)) return GARMENT_FAMILY.ATHLETIC;
  if (cat === 'shoes') {
    if (isAthleticFootwearOverride(item)) return GARMENT_FAMILY.FOOTWEAR_ATHLETIC;
    const t = itemText(item);
    if (/\b(loafer|oxford|derby|brogue|heel|pump|stiletto|chelsea|dress shoe)\b/.test(t)) {
      return GARMENT_FAMILY.FOOTWEAR_DRESS;
    }
    return GARMENT_FAMILY.FOOTWEAR_CASUAL;
  }
  if (isStructuredTailoredBottom(item)) return GARMENT_FAMILY.TAILORED;
  const t = itemText(item);
  if (/\b(blazer|suit|dress shirt|oxford shirt|gown|tuxedo|evening)\b/.test(t) || cat === 'formal') {
    return GARMENT_FAMILY.TAILORED;
  }
  if (isCargoOverride(item) || /\b(hoodie|oversized|graphic tee|street|hype)\b/.test(t)) {
    return GARMENT_FAMILY.STREET;
  }
  if (cat === 'dresses') return GARMENT_FAMILY.DRESS;
  return GARMENT_FAMILY.CASUAL;
}

export function outfitHasAthleticPieces(items: ItemLike[] = []): boolean {
  return (items || []).some((i) => {
    const f = resolveGarmentFamily(i);
    return f === GARMENT_FAMILY.ATHLETIC || f === GARMENT_FAMILY.FOOTWEAR_ATHLETIC;
  });
}

export function outfitHasAthleticTop(items: ItemLike[] = []): boolean {
  return (items || []).some((i) => isAthleticTopOverride(i));
}
