/**
 * Soft logging for invalid outfit/wardrobe render payloads.
 * Never throws. Truncates payloads so production logs stay small.
 */

const MAX_PAYLOAD_CHARS = 400;
const MAX_DEV_PAYLOAD_CHARS = 1200;

function truncate(value: unknown, maxChars: number): string {
  try {
    const raw = typeof value === 'string' ? value : JSON.stringify(value);
    if (!raw) return '';
    if (raw.length <= maxChars) return raw;
    return `${raw.slice(0, maxChars)}…[truncated ${raw.length - maxChars}]`;
  } catch {
    return '[unserializable]';
  }
}

export type InvalidRenderType =
  | 'outfit_pieces'
  | 'outfit'
  | 'wardrobe_visual'
  | 'safe_image'
  | 'render_boundary'
  | string;

/**
 * Log invalid render data for triage. Safe to call from render paths.
 */
export function logInvalidRender(
  type: InvalidRenderType,
  payload?: unknown,
  extra?: Record<string, unknown>,
): void {
  try {
    const maxChars = typeof __DEV__ !== 'undefined' && __DEV__ ? MAX_DEV_PAYLOAD_CHARS : MAX_PAYLOAD_CHARS;
    const summary = {
      type,
      ...(extra || {}),
      payload: payload === undefined ? undefined : truncate(payload, maxChars),
    };
    console.warn('[SafeRender] invalid:', summary);
  } catch {
    // never throw from logger
  }
}
