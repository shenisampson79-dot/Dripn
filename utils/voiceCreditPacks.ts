/** Benefit-led labels for voice credit packs (matches ASC metadata tone). */
export const VOICE_PACK_DISPLAY: Record<string, { label: string; subtitle: string }> = {
  small: { label: 'Quick top-up', subtitle: 'Keep chatting hands-free' },
  medium: { label: 'Keep the conversation going', subtitle: 'Less typing, more ease' },
  large: { label: 'Hands-free styling help', subtitle: 'Best value per spoken reply' },
  xlarge: { label: 'Talk through style with ease', subtitle: 'Most credits — best value' },
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
