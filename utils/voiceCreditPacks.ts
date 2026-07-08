/** Benefit-led labels for voice credit packs (matches ASC metadata tone). */
export const VOICE_PACK_DISPLAY: Record<string, { label: string; subtitle: string }> = {
  small: { label: 'Quick Top-Up', subtitle: 'Get instant voice styling advice' },
  medium: { label: 'Keep It Going', subtitle: 'Talk through your outfit decisions' },
  large: { label: 'In the Zone', subtitle: 'Your stylist, whenever you need it' },
  xlarge: { label: 'All In', subtitle: 'Maximum credits — stylist on demand' },
};

/** Pack prices in pence — matches server VOICE_CREDIT_PACKAGES / ASC UK tier */
export const VOICE_PACK_PRICE_PENCE: Record<string, number> = {
  small: 100,
  medium: 300,
  large: 500,
  xlarge: 800,
};

export function getVoicePackDisplay(packageId: string, fallbackDescription: string, credits: number) {
  const mapped = VOICE_PACK_DISPLAY[packageId];
  if (mapped) return mapped;
  return { label: fallbackDescription, subtitle: `${credits} spoken replies` };
}

export function formatVoicePricePence(pricePence?: number): string {
  if (pricePence == null) return '';
  return `£${(pricePence / 100).toFixed(2)}`;
}
