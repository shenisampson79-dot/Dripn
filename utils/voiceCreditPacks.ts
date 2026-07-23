/** Benefit-led labels for voice credit packs (matches ASC metadata tone). */
export const VOICE_PACK_DISPLAY: Record<string, { label: string; subtitle: string }> = {
  boost: { label: 'Voice Boost', subtitle: 'For when you want more personalised advice' },
  pro: { label: 'Pro Pack', subtitle: 'Perfect for daily outfit planning' },
  weekend: { label: '2-Day Unlimited', subtitle: 'Unlimited voice for 48 hours — buy any day' },
};

/** Display order in the buy-credits modal: 2-Day Unlimited → Pro (most popular) → Boost */
export const VOICE_PACK_DISPLAY_ORDER = ['weekend', 'pro', 'boost'] as const;

const VOICE_PACK_ORDER_RANK: Record<string, number> = Object.fromEntries(
  VOICE_PACK_DISPLAY_ORDER.map((id, index) => [id, index]),
);

export function sortVoiceCreditPacks<T extends { id: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aRank = VOICE_PACK_ORDER_RANK[a.id] ?? VOICE_PACK_DISPLAY_ORDER.length;
    const bRank = VOICE_PACK_ORDER_RANK[b.id] ?? VOICE_PACK_DISPLAY_ORDER.length;
    return aRank - bRank;
  });
}

/** Pack prices in pence — matches server VOICE_CREDIT_PACKAGES / ASC UK tier */
export const VOICE_PACK_PRICE_PENCE: Record<string, number> = {
  boost: 299,
  pro: 599,
  weekend: 899,
};

export function getVoicePackDisplay(
  packageId: string,
  fallbackDescription: string,
  credits: number,
  weekendUnlimited?: boolean,
) {
  const mapped = VOICE_PACK_DISPLAY[packageId];
  if (mapped) return mapped;
  if (weekendUnlimited) {
    return { label: fallbackDescription, subtitle: 'Unlimited voice for 48 hours' };
  }
  return { label: fallbackDescription, subtitle: `${credits} spoken replies` };
}

/** Legacy helper — prefers session currency via CurrencyService when available. */
export function formatVoicePricePence(pricePence?: number, currencySymbol = '£'): string {
  if (pricePence == null) return '';
  return `${currencySymbol}${(pricePence / 100).toFixed(2)}`;
}

export function formatWeekendExpiry(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const expires = new Date(isoDate);
  if (Number.isNaN(expires.getTime())) return '';
  return expires.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
