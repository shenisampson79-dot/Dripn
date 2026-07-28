/**
 * Ranked multi-look models for Stylist Chat — equal-size cards with role hierarchy.
 */

import {
  splitIntoOutfitSections,
  extractSectionTitle,
  type WardrobeOutfitVisual,
  type WardrobeVisualPayload,
} from '@/utils/wardrobeMentionMatcher';
import { sanitizeOutfitPieces } from '@/utils/safeRender';
import type { OutfitPieceVisual } from '@/components/OutfitPiecesVisual';

export type RankedLookRole = 'hero' | 'safe' | 'bold' | 'alt';

export type RankedLookMeta = {
  role?: RankedLookRole | string | null;
  roleLabel?: string | null;
  label?: string | null;
  reason?: string | null;
  itemIds?: Array<string | number>;
};

export type RankedLookCard = {
  id: string;
  index: number;
  role: RankedLookRole;
  roleLabel: string;
  title: string;
  reason: string;
  pieces: OutfitPieceVisual[];
  itemIds: string[];
  isPrimary: boolean;
  primaryCta: 'wear' | 'try';
};

const ROLE_ORDER: RankedLookRole[] = ['hero', 'safe', 'bold', 'alt'];

function clampRole(raw: unknown, index: number): RankedLookRole {
  const v = String(raw || '').toLowerCase();
  if (v === 'hero' || v === 'best') return 'hero';
  if (v === 'safe' || v === 'easy') return 'safe';
  if (v === 'bold' || v === 'expressive') return 'bold';
  if (index === 0) return 'hero';
  if (index === 1) return 'safe';
  if (index === 2) return 'bold';
  return 'alt';
}

export function roleLabelFor(role: RankedLookRole, fallbackTitle?: string | null): string {
  if (role === 'hero') return 'Best option';
  if (role === 'safe') return 'Easy option';
  if (role === 'bold') return 'More expressive';
  const title = String(fallbackTitle || '').trim();
  if (/best/i.test(title)) return 'Best option';
  if (/easy/i.test(title)) return 'Easy option';
  if (/express/i.test(title)) return 'More expressive';
  return title || 'Option';
}

function inferRoleFromTitle(title: string | null | undefined, index: number): RankedLookRole {
  const t = String(title || '').toLowerCase();
  if (/best/.test(t)) return 'hero';
  if (/easy/.test(t)) return 'safe';
  if (/express|bold|different/.test(t)) return 'bold';
  return clampRole(null, index);
}

function extractReasonFromSection(section: string): string {
  const lines = String(section || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  // Skip title + piece list; pick the human reason sentence
  for (const line of lines) {
    if (/^(?:look|outfit|option|idea)\s*#?\s*\d+/i.test(line)) continue;
    if (/^here are a few/i.test(line)) continue;
    if (/^wear this\s*:/i.test(line)) continue;
    if (/this is your strongest|easiest to wear|more expressive|just works|cannot really go wrong|stands out/i.test(line)) {
      return line.replace(/\*+/g, '').trim();
    }
  }
  for (const line of lines) {
    if (/^(?:look|outfit|option|idea)\s*#?\s*\d+/i.test(line)) continue;
    if (/^here are a few/i.test(line)) continue;
    if (/^wear this\s*:/i.test(line)) continue;
    if (line.includes(',') && line.length < 120) continue; // piece list
    if (line.length > 24 && /[.!—–]/.test(line)) return line.replace(/\*+/g, '').trim();
  }
  return '';
}

/** Keep a short intro; drop Look 1/2/3 bodies when cards render them. */
export function multiLookIntroText(content: string): string {
  const text = String(content || '').trim();
  if (!text) return '';
  const sections = splitIntoOutfitSections(text);
  if (sections.length < 2) {
    // Single block — keep first line if it's an intro
    const first = text.split('\n').map((l) => l.trim()).find(Boolean) || '';
    if (/^here are a few/i.test(first)) return first;
    return '';
  }
  const first = sections[0];
  if (/^(?:look|outfit|option)\s*#?\s*\d+/i.test(first.trim())) {
    return 'Here are a few options:';
  }
  const firstLine = first.split('\n').map((l) => l.trim()).find(Boolean) || '';
  if (/^here are a few/i.test(firstLine)) return firstLine;
  if (firstLine.length <= 80 && !/,.*,/.test(firstLine)) return firstLine;
  return 'Here are a few options:';
}

function pieceIds(pieces: OutfitPieceVisual[]): string[] {
  return pieces
    .map((p) => (p.wardrobeItemId != null ? String(p.wardrobeItemId) : ''))
    .filter(Boolean);
}

/**
 * Build equal-size ranked cards from server looks + multi visual (titles/reasons fallback).
 */
export function buildRankedLookCards(input: {
  outfits?: WardrobeOutfitVisual[] | null;
  looks?: RankedLookMeta[] | null;
  content?: string;
}): RankedLookCard[] {
  const outfits = Array.isArray(input.outfits) ? input.outfits.filter(Boolean) : [];
  if (outfits.length < 2) return [];

  const looks = Array.isArray(input.looks) ? input.looks : [];
  const sections = splitIntoOutfitSections(String(input.content || ''));
  const lookSections = sections.filter((s, i) => {
    if (i === 0 && /^here are a few/i.test(s.trim())) return false;
    return /(?:look|outfit|option|idea)\s*#?\s*\d+/i.test(s)
      || /best option|easy option|more expressive/i.test(s);
  });

  const cards: RankedLookCard[] = outfits.map((outfit, index) => {
    const meta = looks[index] || null;
    const title = String(meta?.label || outfit.title || `Look ${index + 1}`).trim();
    const role = meta?.role
      ? clampRole(meta.role, index)
      : inferRoleFromTitle(title, index);
    const roleLabel = String(meta?.roleLabel || roleLabelFor(role, title)).trim();
    const section = lookSections[index]
      || sections.find((s) => extractSectionTitle(s)?.includes(String(index + 1)))
      || '';
    const reason = String(meta?.reason || extractReasonFromSection(section) || '').trim();
    const pieces = sanitizeOutfitPieces(outfit.pieces || [], { log: false });
    const fromMeta = Array.isArray(meta?.itemIds) ? meta!.itemIds!.map(String).filter(Boolean) : [];
    const itemIds = fromMeta.length >= 2 ? fromMeta : pieceIds(pieces);
    const isPrimary = role === 'hero' || index === 0;

    return {
      id: `look_${index + 1}_${role}`,
      index,
      role,
      roleLabel,
      title,
      reason,
      pieces,
      itemIds,
      isPrimary,
      primaryCta: isPrimary ? 'wear' : 'try',
    };
  }).filter((c) => c.pieces.length > 0);

  // Prefer hero → safe → bold order when roles are present
  const hasRoles = cards.some((c) => c.role !== 'alt');
  if (hasRoles) {
    cards.sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
    // Re-assert primary after sort
    for (let i = 0; i < cards.length; i += 1) {
      cards[i].isPrimary = cards[i].role === 'hero' || (i === 0 && !cards.some((c) => c.role === 'hero'));
      cards[i].primaryCta = cards[i].isPrimary ? 'wear' : 'try';
    }
  }

  return cards.slice(0, 3);
}

export function isRankedMultiLookVisual(
  visual: WardrobeVisualPayload | null | undefined,
): boolean {
  return Boolean(
    visual
    && visual.layout === 'multi'
    && Array.isArray(visual.outfits)
    && visual.outfits.length >= 2,
  );
}
