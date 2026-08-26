/**
 * Singular hard-lock mention resolution — evidence dominance (client mirror).
 * Server remains authoritative; client must not knowingly send multi-locks for singular asks.
 *
 * Contract: docs/qa/HARD_LOCK_MENTION_RESOLUTION_TRACE.md
 */

import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  matchWardrobeItemsInText,
  categoryToVisualRole,
} from '@/utils/wardrobeMentionMatcher';

const MATCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'with', 'in', 'of', 'for', 'your', 'my', 'from',
  'cotton', 'linen', 'wool', 'leather', 'light', 'dark', 'soft', 'pair', 'wear',
  'carry', 'this', 'works', 'because', 'optional',
  'definitely', 'really', 'absolutely', 'want', 'wanna', 'need', 'gotta',
  'build', 'rest', 'around', 'outfit', 'look', 'piece', 'pieces',
]);

function normalizeForMatch(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSignificantTokens(value: string) {
  return normalizeForMatch(value)
    .split(' ')
    .filter((word) => word.length > 2 && !MATCH_STOP_WORDS.has(word));
}

function asId(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && value !== null && 'id' in value && (value as { id: unknown }).id != null) {
    return String((value as { id: unknown }).id);
  }
  return String(value);
}

export function isMultiPieceHardLockAsk(query = ''): boolean {
  const t = String(query || '');
  return (
    /\b(\w+\s+){0,3}(top|blazer|shirt|tee|tank|trousers?|jeans?|shorts?)\b.{0,16}\b(and|with|\+)\b.{0,16}\b(top|blazer|shirt|tee|tank|trousers?|jeans?|shorts?|blazer)\b/i.test(t)
    || /\b(wear|using|with|include)\b.{0,12}\b(my|the)\s+(?:\w+\s+){0,2}(top|blazer|shirt|tee|tank|trousers?|jeans?|shorts?)\b.{0,16}\b(and|with)\b.{0,16}\b(my|the)\s+(?:\w+\s+){0,2}(top|blazer|shirt|tee|tank|trousers?|jeans?|shorts?|blazer)\b/i.test(t)
  );
}

export function isSingularHardLockAsk(query = ''): boolean {
  const t = String(query || '');
  if (!t.trim()) return false;
  if (isMultiPieceHardLockAsk(t)) return false;
  return /\b(build around|lock|include|wear my|using my|with my)\b/i.test(t)
    || /\bbuild (the )?rest around (it|that|this)\b/i.test(t)
    // "Build me an outfit around my …" / "build the look around my …"
    || /\bbuild\b[\w\s]{0,40}\b(outfit|look)\b[\w\s]{0,16}\baround\b/i.test(t)
    || /\bbuild\b[\w\s]{0,24}\baround\b/i.test(t);
}

export function evidenceTokensForItem(itemName: string, query: string): string[] {
  const queryTokens = new Set(getSignificantTokens(query));
  const nameTokens = getSignificantTokens(itemName);
  return nameTokens.filter((tok) => queryTokens.has(tok));
}

export function evidenceDominates(evidenceA: string[] = [], evidenceB: string[] = []): boolean {
  const a = new Set(evidenceA);
  const b = new Set(evidenceB);
  if (!b.size) return a.size > 0;
  if (!a.size) return false;
  for (const tok of b) {
    if (!a.has(tok)) return false;
  }
  return a.size > b.size;
}

function sameVisualRole(a?: WardrobeItem | null, b?: WardrobeItem | null) {
  return categoryToVisualRole(a?.category) === categoryToVisualRole(b?.category);
}

export type HardLockResolution = {
  mode: 'singular' | 'multi' | 'none';
  lockedItemIds: string[];
  action: 'lock' | 'clarify' | 'none';
  clarifyHint?: string;
  evidenceById?: Record<string, string[]>;
  ambiguousIds?: string[];
};

export function resolveHardLockMentions(params: {
  query?: string;
  wardrobeRows?: WardrobeItem[];
  clientLockedIds?: Array<string | number>;
  softLimit?: number;
}): HardLockResolution {
  const rows = Array.isArray(params.wardrobeRows) ? params.wardrobeRows.filter(Boolean) : [];
  const q = String(params.query || '').trim();
  const softLimit = params.softLimit ?? 8;
  if (!q || !rows.length) {
    return { mode: 'none', lockedItemIds: [], action: 'none' };
  }

  if (isMultiPieceHardLockAsk(q)) {
    const soft = matchWardrobeItemsInText(q, rows, softLimit);
    const ids = [...new Set(soft.map((i) => asId(i.id)).filter(Boolean))];
    return {
      mode: 'multi',
      lockedItemIds: ids,
      action: ids.length ? 'lock' : 'none',
      evidenceById: Object.fromEntries(
        soft.map((i) => [asId(i.id), evidenceTokensForItem(i.name || '', q)]),
      ),
    };
  }

  if (!isSingularHardLockAsk(q)) {
    return { mode: 'none', lockedItemIds: [], action: 'none' };
  }

  const byId = new Map(rows.map((r) => [asId(r.id), r]));
  const candidateIds = new Set<string>();

  for (const item of matchWardrobeItemsInText(q, rows, softLimit)) {
    candidateIds.add(asId(item.id));
  }
  for (const row of rows) {
    const ev = evidenceTokensForItem(row.name || '', q);
    if (ev.length) candidateIds.add(asId(row.id));
  }
  for (const id of params.clientLockedIds || []) {
    const sid = asId(id);
    if (byId.has(sid)) candidateIds.add(sid);
  }

  const candidates = [...candidateIds]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((item) => ({
      item: item as WardrobeItem,
      id: asId((item as WardrobeItem).id),
      evidence: evidenceTokensForItem((item as WardrobeItem).name || '', q),
    }))
    .filter((c) => c.evidence.length > 0);

  if (!candidates.length) {
    return { mode: 'singular', lockedItemIds: [], action: 'none', evidenceById: {} };
  }

  const undominated = candidates.filter((c) =>
    !candidates.some((other) =>
      other.id !== c.id && evidenceDominates(other.evidence, c.evidence),
    ));

  const evidenceById = Object.fromEntries(
    candidates.map((c) => [c.id, c.evidence]),
  );

  if (undominated.length === 1) {
    return {
      mode: 'singular',
      lockedItemIds: [undominated[0].id],
      action: 'lock',
      evidenceById,
    };
  }

  const sameRoleAmbiguity = undominated.some((a, i) =>
    undominated.slice(i + 1).some((b) => sameVisualRole(a.item, b.item)));

  if (sameRoleAmbiguity || undominated.length > 1) {
    return {
      mode: 'singular',
      lockedItemIds: [],
      action: 'clarify',
      clarifyHint:
        'I matched more than one piece that could fit that description — which one should I lock from your wardrobe?',
      evidenceById,
      ambiguousIds: undominated.map((c) => c.id),
    };
  }

  return { mode: 'singular', lockedItemIds: [], action: 'none', evidenceById };
}
