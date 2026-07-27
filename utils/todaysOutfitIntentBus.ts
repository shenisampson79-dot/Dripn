/**
 * Today's Outfit intent bus — remote taps only.
 *
 * External systems (notifications, deep links) may ONLY emit intents.
 * The component is the sole authority that calls loadOutfit().
 *
 * Sticky last-intent: if the card mounts after a cold-start emit,
 * the new subscriber still receives it (TTL). No navigation, no UI state.
 */

export type TodaysOutfitIntent = 'OPEN_TODAYS_OUTFIT';

type Listener = (intent: TodaysOutfitIntent) => void;

const INTENT_TTL_MS = 60_000;

let listeners: Listener[] = [];
let lastIntent: { intent: TodaysOutfitIntent; at: number } | null = null;

export function emitTodaysOutfitIntent(intent: TodaysOutfitIntent): void {
  lastIntent = { intent, at: Date.now() };
  listeners.forEach((listener) => {
    try {
      listener(intent);
    } catch {
      // never let a bad subscriber break the bus
    }
  });
}

export function subscribeTodaysOutfitIntent(listener: Listener): () => void {
  listeners.push(listener);
  if (lastIntent && Date.now() - lastIntent.at < INTENT_TTL_MS) {
    try {
      listener(lastIntent.intent);
    } catch {
      // ignore
    }
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/** Call after the component has acted so remounts don't re-fire forever. */
export function consumeTodaysOutfitIntent(): void {
  lastIntent = null;
}

export function peekTodaysOutfitIntent(): TodaysOutfitIntent | null {
  if (!lastIntent) return null;
  if (Date.now() - lastIntent.at >= INTENT_TTL_MS) {
    lastIntent = null;
    return null;
  }
  return lastIntent.intent;
}

/** Test helper */
export function __resetTodaysOutfitIntentBusForTests(): void {
  listeners = [];
  lastIntent = null;
}
