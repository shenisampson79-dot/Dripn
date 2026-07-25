/**
 * Resolve stylist result UI state.
 * Shopping DO_NOT_BUY / already-owned must NEVER map onto event SHOP_REQUIRED UI.
 */

export type StylistUiDisplayState = 'APPROVED' | 'REJECTED_WARDROBE_FIX' | 'SHOP_REQUIRED';

export type StylistDisplayStateInput = {
  displayState?: string | null;
  status?: string | null;
  type?: string | null;
  success?: boolean;
  alreadyOwnedOverride?: boolean;
  purchaseDecision?: { decision?: string | null } | null;
  retailOutfit?: { products?: unknown[]; outfit?: unknown } | null;
  recommendation?: string | null;
  reasoning?: string | null;
  stylistNote?: string | null;
  isFallback?: boolean;
};

export function isShoppingOwnedVerdict(res: StylistDisplayStateInput): boolean {
  return Boolean(
    res.alreadyOwnedOverride
    || res.purchaseDecision?.decision === 'DO_NOT_BUY',
  );
}

/**
 * @param decisionType client flow id: shopping | event-outfit | sanity-check
 */
export function resolveStylistResultDisplayState(
  res: StylistDisplayStateInput,
  decisionType: string,
  opts: { textReject?: boolean } = {},
): StylistUiDisplayState {
  // User-intent / shopping ownership outcomes are isolated from event shop UI
  if (isShoppingOwnedVerdict(res)) {
    return 'APPROVED';
  }

  const textReject = Boolean(opts.textReject);
  const isFallback =
    res.status === 'fallback_outfit'
    || res.type === 'fallback_outfit'
    || res.isFallback === true;

  const explicit =
    res.displayState === 'APPROVED'
    || res.displayState === 'REJECTED_WARDROBE_FIX'
    || res.displayState === 'SHOP_REQUIRED'
      ? (res.displayState as StylistUiDisplayState)
      : null;
  if (explicit) return explicit;

  const serverShopRequired =
    res.status === 'SHOP_REQUIRED'
    || res.type === 'shop_required'
    || Boolean(res.retailOutfit?.products?.length || res.retailOutfit?.outfit);

  const wardrobeGapShop =
    res.status === 'wardrobe_gap'
    || res.status === 'no_outfit_possible'
    || res.status === 'refused'
    || res.status === 'clash_blocked'
    || res.status === 'no_wardrobe'
    || (res.success === false && textReject)
    || (textReject && decisionType === 'event-outfit');

  if (serverShopRequired || wardrobeGapShop) return 'SHOP_REQUIRED';
  if (isFallback) return 'REJECTED_WARDROBE_FIX';
  return 'APPROVED';
}
