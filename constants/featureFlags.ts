/**
 * Frontend feature flags for launch vs. full product surface.
 *
 * Re-enable hidden features post-launch:
 * 1. Set `launchSimplified` to `false` — restores Outfit Calendar, Weather Outfits,
 *    Colour Insights hub tiles, and the tab-bar + (Ask Stylist) button.
 * 2. Or keep `launchSimplified: true` and remove ids from `LAUNCH_HIDDEN_STYLIST_FEATURE_IDS`.
 * 3. Set `hideDfyPurchaseUi` to `false` — restores DFY Core / Full Wardrobe Setup
 *    upsell cards on Subscription + related paywall CTAs (product IDs stay in ASC/RC).
 */
export const FEATURE_FLAGS = {
  /** When true: hides Outfit Calendar, Weather Outfits, Colour Insights; adds decision tiles; removes + tab. */
  launchSimplified: true,
  /**
   * When true: hide DFY Core / Full Wardrobe Setup purchase & benefit upsell UI
   * (subscription page, wardrobe unlock CTA, DFYStart paid/core paths, comparison paywall).
   * Does not remove ASC/RevenueCat product IDs or Travel Capsule trip editor.
   */
  hideDfyPurchaseUi: true,
} as const;

/** Stylist Hub tile ids hidden while `launchSimplified` is enabled. */
export const LAUNCH_HIDDEN_STYLIST_FEATURE_IDS = [
  'outfit-calendar',
  'weather-outfit',
  'colour-insights',
] as const;
