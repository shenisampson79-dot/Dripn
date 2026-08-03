/** Benefit-led labels for voice credit packs (matches ASC metadata tone). */
export const VOICE_PACK_DISPLAY: Record<string, { label: string; subtitle: string }> = {
  boost: { label: 'Voice Boost', subtitle: '30 spoken replies — for when you want more personalised advice' },
  pro: { label: 'Pro Pack', subtitle: '80 spoken replies — perfect for daily outfit planning' },
  weekend: { label: 'Voice 50', subtitle: '50 spoken replies — the middle ground between Boost and Pro' },
};

/** Display order in the buy-credits modal: Voice Pass → Pro (most popular) → Boost */
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
  boost: 699,
  pro: 1499,
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
    return { label: fallbackDescription, subtitle: '50 spoken replies over 48 hours' };
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
