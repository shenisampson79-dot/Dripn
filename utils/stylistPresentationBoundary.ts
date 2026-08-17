/**
 * Client presentation boundary — keep in lockstep with
 * Dripn-Server/services/stylistPresentationBoundary.js
 *
 * Engine context is never eligible for direct rendering.
 */

export const ENGINE_LEAK_SENTINEL = 'INTERNAL_ONLY_DO_NOT_RENDER';

export const SAFE_FALLBACKS = {
  qsc: "I couldn't get a confident read on this look. Try again with the full outfit clearly in frame.",
  gon: "I couldn't lock a confident outfit from your wardrobe. Try again in a moment.",
  chat: "I couldn't finish that thought cleanly. Ask me again in a moment.",
  events: "I couldn't lock a confident event look. Try again in a moment.",
  shopping: "I couldn't compare those options confidently. Add a clearer photo or a short brief and I'll decide.",
} as const;

export type PresentationSurface = keyof typeof SAFE_FALLBACKS;

const ENGINE_LEAK_RES: RegExp[] = [
  new RegExp(ENGINE_LEAK_SENTINEL, 'i'),
  /\bWorkplace dress code from Settings\b/i,
  /\bjudge against this code\b/i,
  /\bgeneric office default\b/i,
  /\bKeep one clear style lane end to end\b/i,
  /\bINTERNAL[_A-Z0-9]{4,}\b/,
  /\bDEBUG[_A-Z0-9]{3,}\b/,
  /\bhardFail\b/i,
  /\bsoftBias\b/,
  /\bstyleScore\b/i,
  /\bdisplayState\s*[:=]/i,
  /\bwork_trainers_ban\b/,
  /\bperformance_trainer_tailored\b/,
  /\bCOMPAT_[A-Z_]+\b/,
  /\bhard_block\b/i,
  /\bUSER PROFILE\b/,
  /\bFASHION WISDOM\b/,
  /\bCRITICAL:\s*Use this profile\b/i,
  /\bNever recommend trainers or sneakers for this workplace\b/i,
  /\bTrainers only if they are clean\/minimal lifestyle\b/i,
];

const FATAL_ENGINE_LEAK_RES: RegExp[] = [
  new RegExp(ENGINE_LEAK_SENTINEL, 'i'),
  /\bINTERNAL[_A-Z0-9]{4,}\b/,
  /\bDEBUG[_A-Z0-9]{3,}\b/,
  /\bhardFail\b/i,
  /\bsoftBias\b/,
  /\bstyleScore\b/i,
  /\bdisplayState\s*[:=]/i,
  /\bwork_trainers_ban\b/,
  /\bperformance_trainer_tailored\b/,
  /\bCOMPAT_[A-Z_]+\b/,
  /\bhard_block\b/i,
  /\bUSER PROFILE\b/,
  /\bFASHION WISDOM\b/,
  /\bCRITICAL:\s*Use this profile\b/i,
];

export const VISIBLE_PAYLOAD_KEYS = [
  'decision',
  'recommendation',
  'stylistResponse',
  'message',
  'reasoning',
  'overallVerdict',
  'stylistNote',
  'outfitSummary',
  'confidenceNote',
  'ratingLabel',
  'text',
  'displayText',
  'explanation',
  'response',
  'fallback',
] as const;

export function containsEngineLeak(value?: string | null): boolean {
  const text = String(value || '');
  if (!text.trim()) return false;
  return ENGINE_LEAK_RES.some((re) => re.test(text));
}

export function isFatalEngineLeak(value?: string | null): boolean {
  const text = String(value || '');
  if (!text.trim()) return false;
  return FATAL_ENGINE_LEAK_RES.some((re) => re.test(text));
}

export function cannedFallback(surface: PresentationSurface = 'qsc'): string {
  return SAFE_FALLBACKS[surface] || SAFE_FALLBACKS.qsc;
}

export function presentText(raw?: string | null, surface: PresentationSurface = 'qsc'): string {
  const text = String(raw || '').trim();
  if (!text || containsEngineLeak(text)) return cannedFallback(surface);
  return text;
}

export function presentOptionalField(raw?: string | null, surface: PresentationSurface = 'qsc'): string {
  const text = String(raw || '').trim();
  if (!text || containsEngineLeak(text)) return '';
  if (text === cannedFallback(surface)) return '';
  return text;
}

function walkVisibleStrings(node: unknown, acc: string[]): string[] {
  if (node == null) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkVisibleStrings(item, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if ((VISIBLE_PAYLOAD_KEYS as readonly string[]).includes(key) || typeof value === 'string') {
      if (typeof value === 'string') acc.push(value);
    }
    if (value && typeof value === 'object') walkVisibleStrings(value, acc);
  }
  return acc;
}

export function collectVisibleStrings(payload: unknown): string[] {
  return walkVisibleStrings(payload, []);
}

export function sealVisiblePayload<T extends Record<string, unknown>>(
  payload: T,
  { surface = 'qsc' }: { surface?: PresentationSurface } = {},
): T {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload } as Record<string, unknown>;
  const fallback = cannedFallback(surface);
  for (const key of VISIBLE_PAYLOAD_KEYS) {
    if (typeof next[key] !== 'string') continue;
    next[key] = presentText(next[key] as string, surface);
    if (!next[key]) next[key] = fallback;
  }
  return next as T;
}

export function assertNoEngineLeak(payload: unknown, label = 'payload'): true {
  const leaked = collectVisibleStrings(payload).filter((s) => containsEngineLeak(s));
  if (leaked.length) {
    throw new Error(`${label}: engine leak in visible field: ${leaked[0].slice(0, 80)}`);
  }
  return true;
}
