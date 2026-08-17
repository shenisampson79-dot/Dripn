/**
 * Work dress-code hard gates + soft scoring.
 * Hard = discard candidates. Soft = rank remaining.
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { WorkDressCode } from '@/services/OnboardingProfileService';
import {
  classifyItem,
  isAthleticFootwear,
  isBootFootwear,
  isCasualTrainer,
  isDressyBootFootwear,
  isShortsItem,
} from '@/utils/outfitClashRules';

export type OutfitPieceRole = 'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessory';

function itemText(item: WardrobeItem): string {
  return `${item.name || ''} ${item.category || ''} ${item.subcategory || ''}`.toLowerCase();
}

export function isRuggedWorkBoot(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  return /combat|hiking|timberland|work boot|rugged|chunky boot|doc\b|dr\.?\s*marten|army boot|lace-up work/.test(t)
    || (isBootFootwear(item) && !isDressyBootFootwear(item) && !/chelsea|loafer|oxford|derby/.test(t));
}

export function isSmartOfficeShoe(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  const signals = classifyItem(item);
  if (signals.isFormalShoes || signals.isChelseaBoots || signals.isDressyBoots || signals.isHeels) return true;
  return /oxford|derby|brogue|loafer|chelsea|dress shoe|court shoe|pump|heel/.test(t);
}

export function isBusinessFormalShoe(item: WardrobeItem): boolean {
  if (item.category !== 'shoes') return false;
  const t = itemText(item);
  return /oxford|derby|brogue|dress shoe|court shoe|formal shoe|stiletto|pump/.test(t)
    || classifyItem(item).isFormalShoes;
}

function isTieItem(item: WardrobeItem): boolean {
  return classifyItem(item).isTie
    || (item.category === 'accessories' && /\btie\b|necktie|bow\s*tie/.test(itemText(item)));
}

function isCasualTop(item: WardrobeItem): boolean {
  const t = itemText(item);
  const cat = String(item.category || '').toLowerCase();
  if (cat && !['tops', 'shirts', 'formal', 'activewear_tops', 'activewear'].includes(cat)) {
    return false;
  }
  const signals = classifyItem(item);
  return /t-shirt|tee\b|polo\b|hoodie|jersey|graphic|tank|camisole|henley/.test(t)
    || signals.isAthleticTop
    || signals.isHoodie;
}

function isLinenCasualShirt(item: WardrobeItem): boolean {
  const t = itemText(item);
  if (!/linen/.test(t)) return false;
  // Long-sleeve "linen dress shirt" can still be borderline; short / camp / Cuban linen is casual.
  if (/dress shirt|oxford/.test(t) && /long[\s-]?sleeve/.test(t)) return false;
  return true;
}

/**
 * Hard pool gate — drop items that can never appear for this workplace code.
 * `role` optional; when omitted, infer from category.
 */
export function passesWorkDressCodeItemGate(
  item: WardrobeItem,
  workDressCode: WorkDressCode | null | undefined,
  role?: OutfitPieceRole,
): boolean {
  if (!workDressCode) return true;

  const cat = String(item.category || '').toLowerCase();
  const inferred: OutfitPieceRole =
    role
    || (cat === 'shoes' || cat === 'footwear' ? 'shoes'
      : cat === 'outerwear' ? 'outerwear'
        : cat === 'accessories' || cat === 'bags' ? 'accessory'
          : cat === 'bottoms' || cat === 'activewear_bottoms' ? 'bottom'
            : 'top');

  if (inferred === 'shoes') {
    if (workDressCode === 'creative') {
      if (isAthleticFootwear(item) || isCasualTrainer(item) || classifyItem(item).isFashionTrainer) {
        return Boolean(classifyItem(item).isFashionTrainer && !classifyItem(item).isChunkyOrTechTrainer);
      }
      return !isRuggedWorkBoot(item);
    }
    if (
      workDressCode === 'smart_casual'
      || workDressCode === 'business_casual'
      || workDressCode === 'business_formal'
    ) {
      // Launch freeze: no trainers for office / smart-casual / business workplaces.
      if (isAthleticFootwear(item) || isCasualTrainer(item) || classifyItem(item).isFashionTrainer) {
        return false;
      }
      if (isRuggedWorkBoot(item)) return false;
      if (workDressCode === 'business_formal') return isBusinessFormalShoe(item);
      return isSmartOfficeShoe(item) || classifyItem(item).isHeels;
    }
    return true;
  }

  if (inferred === 'accessory') {
    // Ties only from business casual upward
    if (isTieItem(item) && (workDressCode === 'creative' || workDressCode === 'smart_casual')) {
      return false;
    }
    return true;
  }

  if (inferred === 'top') {
    if (workDressCode === 'business_formal' || workDressCode === 'business_casual') {
      if (isCasualTop(item)) return false;
      if (workDressCode === 'business_formal' && classifyItem(item).isShortSleeve) return false;
    }
    return true;
  }

  if (inferred === 'bottom') {
    if (workDressCode === 'business_formal' || workDressCode === 'business_casual') {
      if (isShortsItem(item) && !classifyItem(item).isTailoredShorts) return false;
      if (classifyItem(item).isLoungeBottom || classifyItem(item).isAthleticBottom || classifyItem(item).isJoggers) {
        return false;
      }
    }
    if (workDressCode === 'business_formal' && classifyItem(item).isJeans) return false;
    return true;
  }

  if (inferred === 'outerwear') {
    if (workDressCode === 'business_formal') {
      const t = itemText(item);
      // Prefer structured; block fleece / hoodie outer layers
      if (/fleece|hoodie|puffer|windbreaker|raincoat\b/.test(t) && !/trench|mackintosh/.test(t)) {
        return false;
      }
    }
    return true;
  }

  return true;
}

/** Soft score delta (−20…+12) for how well the full set matches the workplace code. */
export function scoreWorkDressCodeFit(
  items: WardrobeItem[],
  workDressCode: WorkDressCode | null | undefined,
): number {
  if (!workDressCode || !items?.length) return 0;
  let score = 0;
  const signals = items.map(classifyItem);

  for (const item of items) {
    if (!passesWorkDressCodeItemGate(item, workDressCode)) {
      score -= 20;
    }
  }

  const shoes = items.filter((i) => String(i.category || '').toLowerCase() === 'shoes');
  const hasTie = signals.some((s) => s.isTie);
  const hasShortSleeve = signals.some((s) => s.isShortSleeve);
  const hasLinenCasual = items.some(isLinenCasualShirt);

  if (workDressCode === 'business_formal') {
    if (shoes.some(isBusinessFormalShoe)) score += 10;
    if (hasTie && signals.some((s) => s.isDressShirt && !s.isShortSleeve)) score += 6;
    if (signals.some((s) => s.isJeans || s.isCasualTrainer)) score -= 12;
  } else if (workDressCode === 'business_casual') {
    if (shoes.some(isSmartOfficeShoe)) score += 8;
    if (hasTie && (hasShortSleeve || hasLinenCasual)) score -= 8;
    if (shoes.some(isRuggedWorkBoot)) score -= 14;
  } else if (workDressCode === 'smart_casual') {
    if (shoes.some(isSmartOfficeShoe)) score += 5;
    if (shoes.some((s) => classifyItem(s).isCasualTrainer || classifyItem(s).isFashionTrainer)) score -= 12;
    if (hasTie) score -= 6;
    if (shoes.some(isRuggedWorkBoot)) score -= 8;
  } else if (workDressCode === 'creative') {
    if (hasTie) score -= 4;
    if (shoes.some(isRuggedWorkBoot) || shoes.some((s) => classifyItem(s).isCasualTrainer)) score += 3;
  }

  return Math.max(-20, Math.min(12, score));
}

export { isLinenCasualShirt, isTieItem };
