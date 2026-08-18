/**
 * Live copy renderer — score / headline / summary / bullets consume published truth.
 *
 * No raw Cloud sentence, no stale shoe name, no YOLO-only garment, no previous
 * frame. If footwear is unresolved, copy must not mention footwear.
 */

import type { LiveCoaching } from '@/types/liveStylist';
import { sentenceCaseGarmentName } from '@/utils/liveLayeringIntelligence';
import { polishUkCoaching, polishUkLiveLabel } from '@/utils/liveLocaleLabels';
import { scoreToBand } from '@/utils/liveOutcomeContract';
import type { LiveOutfitTruth, LiveTruthItem } from '@/utils/liveOutfitTruth';

export const FOOTWEAR_COPY_RE =
  /\b(shoes?|footwear|sneakers?|trainers?|boots?|loafers?|sandals?|flip[\s-]?flops?|clogs?|boat\s*shoes?|deck\s*shoes?|heels?|mules?|slides?)\b/i;

const GARMENT_TOKEN_RE =
  /\b(shirts?|tees?|t-shirts?|hoodies?|jackets?|blazers?|coats?|shorts?|trousers?|jeans?|chinos?|sweatpants?|joggers?|leggings?|dresses?|shoes?|boots?|loafers?|trainers?|sneakers?|sandals?|clogs?|tops?|polos?|blouses?)\b/gi;

export type PublishedTruthNames = {
  onePiece?: string;
  layer?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  listed: string[];
};

function isDressItem(item: LiveTruthItem | null | undefined): boolean {
  if (!item) return false;
  const blob = `${item.category} ${item.subcategory || ''} ${item.name || ''}`.toLowerCase();
  if (/dress[\s_-]*shirt|shirt[\s_-]*dress/.test(blob)) return false;
  return /\bdress\b/.test(blob) || /dresses/.test(blob);
}

export function publishedTruthNames(truth: LiveOutfitTruth): PublishedTruthNames {
  const dressItem = isDressItem(truth.bottom)
    ? truth.bottom
    : isDressItem(truth.top)
      ? truth.top
      : null;
  const onePiece = dressItem?.name || undefined;
  const layer = truth.layer?.name || undefined;
  const top = truth.top && truth.top !== dressItem ? (truth.top.name || undefined) : undefined;
  const bottom = truth.bottom && truth.bottom !== dressItem
    ? (truth.bottom.name || undefined)
    : undefined;
  const shoes = truth.footwear?.name || undefined;
  const listed = [onePiece, layer, top, bottom, shoes].filter(
    (n): n is string => Boolean(n && String(n).trim()),
  );
  return { onePiece, layer, top, bottom, shoes, listed };
}

function joinAnd(names: string[]): string {
  const cased = names.map((n, i) => sentenceCaseGarmentName(n, i === 0));
  if (!cased.length) return '';
  if (cased.length === 1) return cased[0]!;
  if (cased.length === 2) return `${cased[0]} and ${cased[1]}`;
  return `${cased.slice(0, -1).join(', ')} and ${cased[cased.length - 1]}`;
}

function omitMissingSlots(template: string, names: PublishedTruthNames): string {
  const slots = ['onePiece', 'layer', 'top', 'bottom', 'shoes', 'accessory'] as const;
  let t = String(template || '');
  for (const slot of slots) {
    if (names[slot as keyof PublishedTruthNames]) continue;
    t = t.replace(
      new RegExp(
        `\\s*(?:,|and)?\\s*\\{${slot}\\}(?:\\s+(?:sits over|sits awkwardly with|pull against|feel slightly dressy against|ground the look|lift the look|finish(?:es)? the look)[^.,]*)?`,
        'gi',
      ),
      '',
    );
    t = t.replace(new RegExp(`\\{${slot}\\}`, 'g'), '');
  }
  return t
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/^,\s*/, '')
    .replace(/\s+and\s+and/gi, ' and ')
    .trim();
}

export function fillPublishedTemplate(
  template: string,
  names: PublishedTruthNames,
): string | null {
  if (!/\{(onePiece|layer|top|bottom|shoes|accessory)\}/.test(String(template || ''))) {
    return null;
  }
  const prepared = omitMissingSlots(template, names);
  if (!prepared) return null;
  let unresolved = false;
  const rendered = prepared.replace(
    /\{(onePiece|layer|top|bottom|shoes|accessory)\}/g,
    (_match, role: string, offset: number) => {
      const name = names[role as keyof PublishedTruthNames];
      if (typeof name !== 'string' || !name) {
        unresolved = true;
        return '';
      }
      return sentenceCaseGarmentName(name, offset === 0);
    },
  );
  if (unresolved) return null;
  let summary = rendered.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
  if (summary && !/[.!?]$/.test(summary)) summary = `${summary}.`;
  return summary || null;
}

export function synthesizePublishedSummary(
  truth: LiveOutfitTruth,
  names: PublishedTruthNames,
): string {
  const list = joinAnd(names.listed);
  if (!list) return '';
  const score = Number(truth.score);
  const band = Number.isFinite(score) ? scoreToBand(score) : 'mixed';
  if (truth.hasConflict || band === 'weak' || band === 'mixed') {
    return `${list} do not fully come together yet.`;
  }
  if (band === 'strong') return `${list} work well together.`;
  return `${list} hold a consistent direction.`;
}

function normalizeName(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function textUsesOnlyPublishedNames(
  text: string,
  names: PublishedTruthNames,
): boolean {
  if (!names.shoes && FOOTWEAR_COPY_RE.test(text)) return false;
  const published = names.listed.map(normalizeName).filter(Boolean);
  const publishedBlob = published.join(' ');
  const raw = String(text || '');
  const tokenRe = new RegExp(GARMENT_TOKEN_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(raw))) {
    const token = normalizeName(m[0] || '');
    if (token.length < 3) continue;
    if (!publishedBlob.includes(token)) return false;
  }
  const spans = raw.match(/\b[A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+){1,5}\b/g) || [];
  for (const span of spans) {
    const n = normalizeName(span);
    if (n.length < 4) continue;
    const looksGarment = /shirt|tee|hoodie|jacket|blazer|coat|short|trouser|jean|chino|pant|dress|shoe|boot|loafer|trainer|sneaker|sandal|clog|top|polo|blouse/i.test(span);
    if (!looksGarment) continue;
    const ok = published.some((p) => p.includes(n) || n.includes(p));
    if (!ok) return false;
  }
  return true;
}

/**
 * Bind visible copy to the published truth object. Last garment-name writer
 * before paint — Cloud/YOLO prose must not leak through.
 */
export function renderCopyFromPublishedTruth<T extends LiveCoaching>(
  coaching: T | null | undefined,
  truth: LiveOutfitTruth,
): T | null | undefined {
  if (!coaching) return coaching;
  if (truth.score == null || !Number.isFinite(Number(truth.score))) {
    return {
      ...coaching,
      summary: '',
      bullets: [],
    };
  }

  const names = publishedTruthNames(truth);
  let summary = fillPublishedTemplate(String(coaching.summaryTemplate || ''), names)
    || synthesizePublishedSummary(truth, names);

  if (summary && !names.shoes && FOOTWEAR_COPY_RE.test(summary)) {
    summary = synthesizePublishedSummary(truth, names);
  }

  const bullets = (Array.isArray(coaching.bullets) ? coaching.bullets : [])
    .map((b) => String(b || '').trim())
    .filter(Boolean)
    .filter((b) => textUsesOnlyPublishedNames(b, names))
    .slice(0, 2);

  return polishUkCoaching({
    ...coaching,
    summary: polishUkLiveLabel(summary),
    bullets: bullets.map((b) => polishUkLiveLabel(b)),
  }) as T;
}
