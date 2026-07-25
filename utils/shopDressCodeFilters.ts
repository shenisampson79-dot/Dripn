/**
 * Client-side dress-code / gender shop filters (layer 3 — shop UI).
 * Server already filters; this is belt-and-suspenders so cargo / wrong-gender
 * never render even if an older API payload slips through.
 */

export type StyleGender = 'male' | 'female' | 'neutral';

const MALE_FORMAL_BAN_RE =
  /\b(skirt|skirts|blouse|blouses|heels?|stilettos?|pumps?|court\s*shoes?|midi\s*dress|maxi\s*dress|bodycon|leggings?)\b/i;

const FORMAL_STREET_BAN_RE =
  /\b(cargo|hoodie|hooded|jersey|sportswear|gym\s*shorts?|gym\s*kit|joggers?|sweatpants?|sweatshirts?|trainers?|sneakers?|activewear)\b/i;

export function normalizeStyleGender(gender?: string | null): StyleGender {
  const g = String(gender || '').toLowerCase().trim();
  if (!g || g === 'unknown' || g === 'prefer_not_to_say') return 'neutral';
  if (/^(men|man|male|mens|masculine)\b/.test(g) || g === 'm') return 'male';
  if (/^(women|woman|female|womens|feminine)\b/.test(g) || g === 'f') return 'female';
  return 'neutral';
}

export function isStrictFormalDressCode(dressCode?: string | null): boolean {
  return /wedding|formal|black[\s_-]?tie|white[\s_-]?tie/i.test(String(dressCode || ''));
}

export function genderAwareGapSuggestions(gender?: string | null, formal = true): string[] {
  const g = normalizeStyleGender(gender);
  if (!formal) {
    return [
      'A polished top that fits the occasion',
      'Clean trousers or dark denim',
      'Smart shoes (not gym trainers)',
    ];
  }
  if (g === 'female') {
    return [
      'Tailored trousers or a midi skirt',
      'Crisp blouse or formal shirt',
      'Leather heels or polished flats',
      'Structured blazer',
    ];
  }
  if (g === 'male') {
    return [
      'Charcoal or navy tailored trousers',
      'White dress shirt or oxford',
      'Black oxfords or loafers',
      'Navy or charcoal blazer',
    ];
  }
  return [
    'Tailored trousers',
    'Crisp dress shirt or polished top',
    'Leather dress shoes or loafers',
    'Structured blazer',
  ];
}

function itemBlob(item: { name?: string; title?: string; label?: string; brand?: string; category?: string } | string): string {
  if (typeof item === 'string') return item;
  return `${item.name || ''} ${item.title || ''} ${item.label || ''} ${item.brand || ''} ${item.category || ''}`.toLowerCase();
}

export function filterShopItemsForUi<T extends { name?: string; title?: string; label?: string; brand?: string; category?: string }>(
  items: T[] | null | undefined,
  opts: { gender?: string | null; dressCode?: string | null } = {},
): T[] {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  const gender = normalizeStyleGender(opts.gender);
  const strict = !opts.dressCode || isStrictFormalDressCode(opts.dressCode);
  return list.filter((item) => {
    const blob = itemBlob(item);
    if (strict && FORMAL_STREET_BAN_RE.test(blob)) return false;
    if (gender === 'male' && strict && MALE_FORMAL_BAN_RE.test(blob)) return false;
    return true;
  });
}

export function filterSuggestionStringsForUi(
  suggestions: string[] | null | undefined,
  opts: { gender?: string | null; dressCode?: string | null } = {},
): string[] {
  const asItems = (Array.isArray(suggestions) ? suggestions : [])
    .filter((s) => typeof s === 'string' && s.trim())
    .map((s) => ({ name: s, label: s }));
  return filterShopItemsForUi(asItems, opts).map((i) => i.label || i.name || '');
}

export function rewriteStylistCtaJargon(text?: string | null): string {
  if (typeof text !== 'string' || !text.trim()) return '';
  let out = text;
  out = out.replace(
    /\bIf you want,?\s*I can help you log this (?:wedding )?outfit\b[^.!?]*[.!?]?/gi,
    'Want to save this look, or shop the missing pieces?',
  );
  out = out.replace(
    /\b(?:want(?: to)?|I can help you|shall I|let me) log this (?:wedding )?outfit\b[^.!?]*[.!?]?/gi,
    'Want to save this look?',
  );
  out = out.replace(/\blog this (?:wedding )?outfit(?: choice)?\b/gi, 'save this look');
  out = out.replace(/\bhelp you log\b/gi, 'help you save');
  out = out.replace(/\blog (?:the |this |your )?outfit\b/gi, 'save this look');
  return out.replace(/\s{2,}/g, ' ').trim();
}
