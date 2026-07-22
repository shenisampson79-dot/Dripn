/**
 * Frontend feature flags for launch vs. full product surface.
 *
 * Re-enable hidden features post-launch:
 * 1. Set `launchSimplified` to `false` — restores Outfit Calendar, Weather Outfits,
 *    Colour Insights hub tiles, and the tab-bar + (Ask Stylist) button.
 * 2. Or keep `launchSimplified: true` and remove ids from `LAUNCH_HIDDEN_STYLIST_FEATURE_IDS`.
 */
export const FEATURE_FLAGS = {
  /** When true: hides Outfit Calendar, Weather Outfits, Colour Insights; adds decision tiles; removes + tab. */
  launchSimplified: true,
} as const;

/** Stylist Hub tile ids hidden while `launchSimplified` is enabled. */
export const LAUNCH_HIDDEN_STYLIST_FEATURE_IDS = [
  'outfit-calendar',
  'weather-outfit',
  'colour-insights',
] as const;
