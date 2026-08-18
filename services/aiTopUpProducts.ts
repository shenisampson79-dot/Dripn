/**
 * Canonical Apple IAP mapping for AI meter top-up consumables.
 * Product IDs must match App Store Connect + RevenueCat exactly.
 * Credits are the same unit as aiCostMeter budget cents (+300 / +600).
 */

export const APPLE_AI_TOPUP_PRODUCT_IDS = {
  standard: 'com.dripn.ai.topup.300',
  plus: 'com.dripn.ai.topup.600',
} as const;

export type AiTopUpPackId = keyof typeof APPLE_AI_TOPUP_PRODUCT_IDS;

export type AiTopUpCatalogEntry = {
  packId: AiTopUpPackId;
  credits: number;
  displayName: string;
};

export const APPLE_AI_TOPUP_CATALOG: Record<string, AiTopUpCatalogEntry> = {
  'com.dripn.ai.topup.300': {
    packId: 'standard',
    credits: 300,
    displayName: 'AI Top-Up',
  },
  'com.dripn.ai.topup.600': {
    packId: 'plus',
    credits: 600,
    displayName: 'AI Top-Up Plus',
  },
};

export function aiTopUpProductIdFor(packId: AiTopUpPackId): string {
  return APPLE_AI_TOPUP_PRODUCT_IDS[packId];
}

export function isAiTopUpProductId(productId?: string | null): boolean {
  if (!productId) return false;
  return Object.prototype.hasOwnProperty.call(APPLE_AI_TOPUP_CATALOG, productId);
}

export function creditsForAiTopUpProductId(productId?: string | null): number | null {
  if (!productId) return null;
  return APPLE_AI_TOPUP_CATALOG[productId]?.credits ?? null;
}

export function displayNameForAiTopUpProductId(productId?: string | null): string | null {
  if (!productId) return null;
  return APPLE_AI_TOPUP_CATALOG[productId]?.displayName ?? null;
}

export function resolveAiTopUpFromProductId(productId?: string | null): {
  productId: string;
  packId: AiTopUpPackId;
  credits: number;
  displayName: string;
} | null {
  if (!productId) return null;
  const row = APPLE_AI_TOPUP_CATALOG[productId];
  if (!row) return null;
  return { productId, ...row };
}
