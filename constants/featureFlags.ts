/**
 * Frontend feature flags for launch vs. full product surface.
 *
 * Re-enable hidden features post-launch:
 * 1. Set `launchSimplified` to `false` — restores Outfit Calendar, Weather Outfits,
 *    Colour Insights hub tiles, and the tab-bar + (Ask Stylist) button.
 * 2. Or keep `launchSimplified: true` and remove ids from `LAUNCH_HIDDEN_STYLIST_FEATURE_IDS`.
 * 3. Set `hideDfyPurchaseUi` to `true` only to temporarily hide DFY Core / Full Wardrobe Setup
 *    and Travel Capsule purchase cards (product IDs stay in ASC/RC).
 * 4. Set `showDigitizeLiveMode` to `true` to restore Scan-my-wardrobe Live (fast) toggle.
 *    Live code paths stay in DigitizeWardrobeScreen; only the UI entry is gated.
 */
export const FEATURE_FLAGS = {
  /** When true: hides Outfit Calendar, Weather Outfits, Colour Insights; adds decision tiles; removes + tab. */
  launchSimplified: true,
  /**
   * When true: hide DFY Core / Full Wardrobe Setup + Travel Capsule purchase & benefit upsell UI.
   * Keep false so Travel Capsule card and payment flow remain available.
   */
  hideDfyPurchaseUi: true,
  /**
   * When false: Scan my wardrobe is Photo-only (Live toggle hidden).
   * Live ingest code remains for a later re-enable; Live Stylist is unaffected.
   */
  showDigitizeLiveMode: false,
} as const;

/** Stylist Hub tile ids hidden while `launchSimplified` is enabled. */
export const LAUNCH_HIDDEN_STYLIST_FEATURE_IDS = [
  'outfit-calendar',
  'weather-outfit',
  'colour-insights',
] as const;
