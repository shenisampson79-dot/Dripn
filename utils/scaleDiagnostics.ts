/**
 * Lightweight scale / memory-discipline diagnostics.
 * Keeps wardrobe size vs active image work visible without a full APM setup.
 */

type ScalePayload = Record<string, unknown>;

export function logScale(event: string, payload: ScalePayload = {}): void {
  // Always log — needed to diagnose jetsam on preview builds without Metro.
  console.log(`[Scale] ${event}`, payload);
}
