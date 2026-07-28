/**
 * Friendly wardrobe save confirmations — stylist tone, clear outcomes.
 */

const REACTIONS = ['Sharp', 'Nice', 'Good pick', 'Clean', 'Love that', 'Got it'] as const;

const LIVE_SAVED = [
  'Nice find — added to your wardrobe',
  'Got it — that’s in your wardrobe now',
  'Clean piece — added',
  'Love that — added',
  'That’s a staple — added',
  'Sharp — added to your wardrobe',
];

function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
}

/** Title-case garment names ("cream henley shirt" → "Cream Henley Shirt"). */
export function titleCaseItemName(name?: string | null): string {
  const raw = String(name || '').trim();
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export type SaveOutcomeSkipped = {
  name: string;
  reason: string;
};

export type SaveOutcome = {
  title: string;
  /** Primary line under title */
  body: string;
  /** Optional explanation when something was skipped */
  detail?: string;
  added: string[];
  skipped: SaveOutcomeSkipped[];
  detected: number;
};

export function wardrobeSaveConfirmation(
  count: number,
  itemName?: string,
): { title: string; body: string } {
  const n = Math.max(1, Math.floor(count) || 1);
  const name = titleCaseItemName(itemName);
  const title = pick(REACTIONS);
  if (n === 1 && name) {
    return { title, body: `${name} added` };
  }
  if (n > 1) {
    return { title, body: `${n} items added` };
  }
  return { title, body: 'Added to your wardrobe' };
}

/** Full save outcome — explains adds + skips so silent decisions never feel like bugs. */
export function buildSaveOutcome(opts: {
  addedNames: string[];
  skipped?: SaveOutcomeSkipped[];
  detected?: number;
}): SaveOutcome {
  const added = (opts.addedNames || []).map((n) => titleCaseItemName(n) || n).filter(Boolean);
  const skipped = (opts.skipped || []).map((s) => ({
    name: titleCaseItemName(s.name) || s.name,
    reason: s.reason,
  }));
  const detected = opts.detected ?? (added.length + skipped.length);
  const title = pick(REACTIONS);

  if (added.length === 0 && skipped.length > 0) {
    return {
      title: 'Already covered',
      body: `${skipped.length} skipped · nothing new to add`,
      detail: skipped[0]?.reason || 'Similar pieces are already in your wardrobe.',
      added,
      skipped,
      detected,
    };
  }

  if (skipped.length === 0) {
    const body = added.length === 1
      ? `${added[0]} added`
      : `${added.length} items added`;
    return { title, body, added, skipped, detected };
  }

  const body = `${added.length} added · ${skipped.length} skipped`;
  const firstSkip = skipped[0];
  const detail = firstSkip
    ? (firstSkip.reason
      || `We already have something similar to ${firstSkip.name}`)
    : undefined;

  return {
    title,
    body,
    detail,
    added,
    skipped,
    detected,
  };
}

export function liveCaptureConfirmation(itemName: string): string {
  const name = titleCaseItemName(itemName);
  if (name && Math.random() < 0.65) return `${name} — added`;
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
