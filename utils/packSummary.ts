/**
 * Constraint-aware summary packing for Live HUD.
 * Packs clause fragments with existing join style — never mid-word cuts.
 */

const DEFAULT_MAX = 120;

const MATERIAL_RE = /\b(linen|cotton|wool|leather|denim|silk|suede)\b/gi;
const SILHOUETTE_RE =
  /\b(pleated|wide-?\s*leg|barrel|flare|flared|cargo|oversized|slim(?:-?\s*fit)?|tailored|chunky|baggy)\b/gi;

export function cleanClause(s: string): string {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/** Word-safe hard cut — last resort only. */
export function cutAtWordBoundary(s: string, max = DEFAULT_MAX): string {
  const t = cleanClause(s);
  if (!t) return '';
  if (t.length <= max) return t;
  const cut = t.slice(0, max).replace(/\s+\S*$/, '').trim();
  return cut || t.slice(0, max).trim();
}

/** Drop material first, then silhouette — colour + category stay. */
export function shortenPieceLabel(s: string): string {
  return cleanClause(
    String(s || '')
      .replace(MATERIAL_RE, '')
      .replace(SILHOUETTE_RE, ''),
  );
}

/** Shorten tokens inside a clause fragment. */
export function shortenClauseTokens(clause: string): string {
  return cleanClause(
    String(clause || '')
      .replace(MATERIAL_RE, '')
      .replace(SILHOUETTE_RE, ''),
  );
}

/** Existing Live join: "A and B" / "A, and B, C". */
export function joinSummaryParts(parts: string[]): string {
  const list = (Array.isArray(parts) ? parts : []).map(cleanClause).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, and ${list.slice(1).join(', ')}`;
}

/**
 * Include clauses greedily under max. Always keeps a (possibly shortened) core.
 */
export function packSummary(clauses: string[], max = DEFAULT_MAX): string {
  const parts = (Array.isArray(clauses) ? clauses : []).map(cleanClause).filter(Boolean);
  if (!parts.length) return '';

  const included: string[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    let clause = parts[i];
    if (i === 0 && joinSummaryParts([clause]).length > max) {
      clause = shortenClauseTokens(clause);
      if (joinSummaryParts([clause]).length > max) {
        clause = cutAtWordBoundary(clause, max);
      }
    }
    const trial = [...included, clause];
    if (joinSummaryParts(trial).length <= max) {
      included.push(clause);
    } else if (i === 0) {
      included.push(cutAtWordBoundary(clause, max));
      break;
    } else {
      break;
    }
  }
  return joinSummaryParts(included);
}

export const LIVE_SUMMARY_MAX = DEFAULT_MAX;
export const LIVE_HEADLINE_MAX = 40;
