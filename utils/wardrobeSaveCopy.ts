/**
 * Friendly wardrobe save confirmations — progress-feeling, no "+1" counters.
 */

const SINGLE = [
  { title: 'Nice find', body: 'Added to your wardrobe.' },
  { title: 'Got it', body: 'That’s in your wardrobe now.' },
  { title: 'Clean piece', body: 'Saved.' },
  { title: 'Love that', body: 'Added.' },
  { title: 'That’s a staple', body: 'Saved.' },
  { title: 'Sharp', body: 'Added to your wardrobe.' },
];

const MULTI = [
  { title: 'All set', body: 'Those pieces are in your wardrobe now.' },
  { title: 'Logged', body: 'Your wardrobe just got a refresh.' },
  { title: 'Nice haul', body: 'Saved and ready to style.' },
  { title: 'Wardrobe updated', body: 'New pieces are ready.' },
];

const LIVE_SAVED = [
  'Nice find — added to your wardrobe',
  'Got it — that’s in your wardrobe now',
  'Clean piece — saved',
  'Love that — added',
  'That’s a staple — saved',
  'Sharp — added to your wardrobe',
];

function pick<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
}

/** Title-case garment names for confirmations ("cream henley shirt" → "Cream Henley Shirt"). */
export function titleCaseItemName(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      // Keep short all-caps tokens (e.g. "TEE") readable as Title Case
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function wardrobeSaveConfirmation(
  count: number,
  itemName?: string,
): { title: string; body: string } {
  const n = Math.max(1, Math.floor(count) || 1);
  const name = titleCaseItemName(itemName);
  if (n === 1 && name) {
    const line = pick(SINGLE);
    return {
      title: line.title,
      body: `${name} — saved.`,
    };
  }
  if (n > 1) {
    const line = pick(MULTI);
    return {
      title: line.title,
      body: `${n} items saved. ${line.body}`,
    };
  }
  return { ...pick(SINGLE) };
}

/** After a live capture — short, item-aware when possible. */
export function liveCaptureConfirmation(itemName: string): string {
  const name = titleCaseItemName(itemName);
  if (name && Math.random() < 0.65) return `${name} — saved`;
  if (name) return `Got it — ${name}`;
  return pick(LIVE_SAVED);
}

export function liveDuplicateConfirmation(matchName?: string): string {
  const match = titleCaseItemName(matchName);
  if (match) return `Already in your wardrobe · looks like “${match}”`;
  return 'Already in your wardrobe';
}

export function liveNextItemPrompt(): string {
  return 'Move to the next item';
}
