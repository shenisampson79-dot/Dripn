/**
 * Cold-start / jetsam guard.
 * Heavy wardrobe image work must not run until the user opens Wardrobe,
 * or until a long quiet window after boot (never on login).
 */

let wardrobeSurfaceOpenedAt = 0;
let stableAt = 0;

/** Call when boot marks STABLE (from App.tsx). */
export function noteAppBecameStable(): void {
  if (!stableAt) stableAt = Date.now();
}

/** Call when Wardrobe screen gains focus — unlocks intentional image work. */
export function noteWardrobeSurfaceOpened(): void {
  wardrobeSurfaceOpenedAt = Date.now();
}

/**
 * True only when bulk image hydrate / base64 backfill / migrate is allowed.
 * Cold start and stylist-hub idle: always false.
 */
export function isWardrobeHeavyWorkAllowed(): boolean {
  // Explicit user intent: opened Wardrobe tab/screen.
  if (wardrobeSurfaceOpenedAt > 0) return true;
  // Never allow bulk image jobs from login alone — even after "stable".
  return false;
}

export function resetColdStartGuardForTests(): void {
  wardrobeSurfaceOpenedAt = 0;
  stableAt = 0;
}
