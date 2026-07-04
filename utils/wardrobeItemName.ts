/**
 * Normalise wardrobe item names so colour isn't duplicated in the name
 * (colour lives in the separate `color` field for filters/search).
 */

const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'the', 'to', 'with']);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Collapse repeated words: "Denim Denim Denim Shirt" → "Denim Shirt" */
function collapseDuplicateWords(name: string): string {
  return name.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
}

function titleCaseWord(word: string, index: number): string {
  const lower = word.toLowerCase();
  if (index > 0 && SMALL_WORDS.has(lower)) return lower;
  if (lower === 't-shirt') return 'T-Shirt';
  if (lower === 'crew' && index >= 0) return 'Crew';
  if (word === word.toUpperCase() && word.length <= 4) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function titleCaseWardrobeName(name: string): string {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .map((word, index) => titleCaseWord(word, index))
    .join(' ')
    .replace(/\bCrew neck\b/gi, 'Crew Neck')
    .replace(/\bLow-top\b/gi, 'Low-Top');
}

export function sanitizeWardrobeItemName(
  rawName: string,
  options?: { color?: string | null; brand?: string | null },
): string {
  let name = String(rawName || '').trim().replace(/\s+/g, ' ');
  if (!name) return name;

  name = collapseDuplicateWords(name);

  const color = String(options?.color || '').trim().toLowerCase();
  if (color.length > 2) {
    const colorRe = new RegExp(`\\b${escapeRegExp(color)}\\b`, 'i');

    // "cream Primark Cream Crew Neck" → "Primark Cream Crew Neck"
    const parts = name.split(/\s+/);
    if (parts.length >= 2 && parts[0].toLowerCase() === color) {
      const rest = parts.slice(1).join(' ');
      if (colorRe.test(rest)) {
        name = rest;
      }
    }

    // Leading colour + rest already starts with same colour word
    const leadingColorMatch = name.match(/^([a-z]+)\s+(.+)$/i);
    if (leadingColorMatch) {
      const [, lead, rest] = leadingColorMatch;
      if (lead.toLowerCase() === color && colorRe.test(rest)) {
        name = rest;
      }
    }
  }

  name = collapseDuplicateWords(name);
  return titleCaseWardrobeName(name);
}

/** Display name for UI + stylist context — never prepend colour again. */
export function formatWardrobeItemDisplayName(item: {
  name?: string | null;
  color?: string | null;
  brand?: string | null;
}): string {
  const name = sanitizeWardrobeItemName(item.name || '', {
    color: item.color,
    brand: item.brand,
  });
  const brand = String(item.brand || '').trim();
  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    return `${brand} ${name}`.trim();
  }
  return name;
}

export function reconcileWardrobeBrandName(
  rawName: string,
  brand?: string | null,
): string {
  const name = String(rawName || '').trim();
  const brandClean = String(brand || '').trim();
  if (!name || !brandClean) return name;

  if (name.toLowerCase().startsWith(brandClean.toLowerCase())) {
    return titleCaseWardrobeName(name);
  }

  const leadingBrand = name.match(/^([A-Z][A-Za-z0-9&'.-]+)\s+(.+)$/);
  if (leadingBrand) {
    const [, wrongBrand, rest] = leadingBrand;
    if (wrongBrand.toLowerCase() !== brandClean.toLowerCase()) {
      return titleCaseWardrobeName(`${brandClean} ${rest}`);
    }
  }

  return titleCaseWardrobeName(`${brandClean} ${name}`);
}

const PLACEHOLDER_NAME_RE = /^(unknown|n\/a|na|none|null|item|clothing|garment)(\s+(unknown|n\/a|na|none|null|item|clothing|garment))*$/i;

export function isPlaceholderGarmentName(name?: string | null): boolean {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return true;
  return PLACEHOLDER_NAME_RE.test(trimmed);
}

const CATEGORY_DISPLAY: Record<string, string> = {
  tops: 'Top',
  bottoms: 'Trousers',
  dresses: 'Dress',
  outerwear: 'Jacket',
  shoes: 'Shoes',
  bags: 'Bag',
  accessories: 'Accessory',
  activewear_tops: 'Active Top',
  activewear_bottoms: 'Active Bottoms',
  swimwear: 'Swimwear',
  sleepwear: 'Sleepwear',
  formal: 'Formal Wear',
};

function humanizeGarmentTypeHint(value?: string | null): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || isPlaceholderGarmentName(raw)) return '';
  const categoryKey = raw.replace(/\s+/g, '_');
  if (CATEGORY_DISPLAY[categoryKey]) {
    return CATEGORY_DISPLAY[categoryKey];
  }
  return titleCaseWardrobeName(raw.replace(/_/g, ' '));
}

/** Build a readable name when vision returns placeholders like "Unknown Unknown". */
export function resolveDetectedGarmentName(
  rawName: string | undefined,
  options?: {
    color?: string | null;
    category?: string | null;
    subcategory?: string | null;
    brand?: string | null;
  },
): string {
  const sanitized = sanitizeWardrobeItemName(rawName || '', {
    color: options?.color,
    brand: options?.brand,
  });
  if (!isPlaceholderGarmentName(sanitized)) {
    return sanitized;
  }

  const colorLabel = options?.color
    ? titleCaseWardrobeName(String(options.color).replace(/_/g, ' '))
    : '';
  const typeLabel =
    humanizeGarmentTypeHint(options?.subcategory) ||
    humanizeGarmentTypeHint(options?.category) ||
    'Item';
  const brand = String(options?.brand || '').trim();

  if (brand) {
    return titleCaseWardrobeName(`${brand} ${colorLabel} ${typeLabel}`.replace(/\s+/g, ' ').trim());
  }
  if (colorLabel) {
    return titleCaseWardrobeName(`${colorLabel} ${typeLabel}`.trim());
  }
  return typeLabel;
}
