/**
 * Friendly wardrobe save confirmations — no "+1 / +2" counters.
 */

const SINGLE = [
  { title: 'Nice catch', body: 'That piece is in your wardrobe now.' },
  { title: 'Logged', body: 'Ready to style whenever you are.' },
  { title: 'Got it', body: 'Saved to your wardrobe.' },
  { title: 'In the vault', body: 'One more piece your stylist can use.' },
  { title: 'Wardrobe updated', body: 'Looking good — that item is saved.' },
];

const MULTI = [
  { title: 'All set', body: 'Those pieces are in your wardrobe now.' },
  { title: 'Logged', body: 'Your wardrobe just got a refresh.' },
  { title: 'Saved', body: 'Ready for outfits whenever you are.' },
  { title: 'Wardrobe updated', body: 'New pieces are ready to style.' },
];

export function wardrobeSaveConfirmation(count: number): { title: string; body: string } {
  const n = Math.max(1, Math.floor(count) || 1);
  const pool = n === 1 ? SINGLE : MULTI;
  const pick = pool[Math.floor(Math.random() * pool.length)] || pool[0];
  return { title: pick.title, body: pick.body };
}

export function liveCaptureConfirmation(itemName: string): string {
  const name = String(itemName || '').trim();
  if (name) return `Got it — ${name}. Move to the next piece.`;
  return 'Got it — move to the next piece.';
}
