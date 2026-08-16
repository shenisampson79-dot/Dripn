/**
 * Normalise wardrobe item names so colour isn't duplicated in the name
 * (colour lives in the separate `color` field for filters/search).
 *
 * Display / storage casing is editorial: brands keep proper case (Gap, Next),
 * garment descriptors stay lowercase — never Title Case Every Word.
 */

const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'the', 'to', 'with']);

/** Brands with intentional casing (including official lowercase-first). */
const BRAND_CASING: Record<string, string> = {
  gap: 'Gap',
  next: 'Next',
  nike: 'Nike',
  adidas: 'adidas',
  cavani: 'Cavani',
  primark: 'Primark',
  zara: 'Zara',
  uniqlo: 'Uniqlo',
  'h&m': 'H&M',
  hm: 'H&M',
  mango: 'Mango',
  reiss: 'Reiss',
  asos: 'ASOS',
  levi: "Levi's",
  "levi's": "Levi's",
  levis: "Levi's",
  cos: 'COS',
  arket: 'ARKET',
  '&otherstories': '& Other Stories',
  kaecen: 'Kaecen',
  'kæcen': 'Kaecen',
  newbalance: 'New Balance',
  'new balance': 'New Balance',
  underarmour: 'Under Armour',
  'under armour': 'Under Armour',
  lululemon: 'lululemon',
  reformation: 'Reformation',
  everlane: 'Everlane',
  jcrew: 'J.Crew',
  'j.crew': 'J.Crew',
  ralphlauren: 'Ralph Lauren',
  'ralph lauren': 'Ralph Lauren',
  tommy: 'Tommy',
  hilfiger: 'Hilfiger',
  calvin: 'Calvin',
  klein: 'Klein',
  hugo: 'Hugo',
  boss: 'Boss',
  gucci: 'Gucci',
  prada: 'Prada',
  massimodutti: 'Massimo Dutti',
  'massimo dutti': 'Massimo Dutti',
  marksandspencer: 'Marks & Spencer',
  'marks & spencer': 'Marks & Spencer',
  'm&s': 'M&S',
  tesco: 'Tesco',
  matalan: 'Matalan',
  newlook: 'New Look',
  'new look': 'New Look',
  topshop: 'Topshop',
  topman: 'Topman',
  office: 'Office',
  schuh: 'Schuh',
  clarks: 'Clarks',
  dr: 'Dr.',
  martens: 'Martens',
  vans: 'Vans',
  converse: 'Converse',
  puma: 'Puma',
  reebok: 'Reebok',
  asics: 'ASICS',
  hoka: 'HOKA',
};

const COLOUR_OR_TONE =
  /^(black|white|navy|grey|gray|brown|cream|beige|khaki|olive|red|blue|green|pink|purple|orange|yellow|turquoise|charcoal|stone|tan|neon|light|dark|multicolou?r|sage|burgundy|maroon|ivory|off-?white)$/i;
const GARMENT_WORD =
  /^(t-?shirts?|tees?|shirts?|jeans|trousers?|pants?|trainers?|sneakers?|boots?|loafers?|sandals?|heels?|tote|bag|bags?|jacket|blazer|coat|hoodie|polo|blouse|skirt|dress|shorts?|joggers?|singlet|overshirt|cargos?|chinos?|utility|plaid|striped|check(?:ed)?|henley|oxford|windowpane|button-?downs?)$/i;
const DESCRIPTOR =
  /^(relaxed|slim|straight|wide|cropped|canvas|leather|cotton|wool|knit|crew|low-?top|high-?top|insulated|elastic-?waist|button-?(?:up|down)|short-?sleeve(?:d)?|long-?sleeve(?:d)?|sleeveless|running|coated|tailored|fitted|oversized|classic|casual|formal)$/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Collapse repeated words: "Denim Denim Denim Shirt" → "Denim Shirt" */
function collapseDuplicateWords(name: string): string {
  return name.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1');
}

function resolveBrandToken(word: string, brandHint?: string | null): string | null {
  const lower = word.toLowerCase().replace(/\.$/, '');
  if (BRAND_CASING[lower]) return BRAND_CASING[lower];
  const hint = String(brandHint || '').trim();
  if (hint && hint.toLowerCase() === lower) {
    // Prefer brand field; if it is ALL CAPS short code keep it, else Title-ish brand field
    if (/^[A-Z0-9&]{2,6}$/.test(hint)) return hint;
    if (/^[a-z]/.test(hint) && BRAND_CASING[hint.toLowerCase()]) {
      return BRAND_CASING[hint.toLowerCase()];
    }
    return hint.charAt(0).toUpperCase() + hint.slice(1);
  }
  return null;
}

/**
 * Editorial garment label: "Gap white and light blue striped button-down shirt"
 * — brand proper-cased, descriptors lowercase. Never Title Case Every Word.
 */
export function editorialGarmentName(
  name: string,
  options?: { brand?: string | null; atSentenceStart?: boolean },
): string {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';

  const brandHint = options?.brand;
  const lowered = words.map((word, index) => {
    if (/^[A-Z]{2,}$/.test(word) && word.length <= 5) return word;
    const brand = resolveBrandToken(word, index === 0 ? brandHint : null);
    if (brand) return brand;
    if (COLOUR_OR_TONE.test(word) || GARMENT_WORD.test(word) || DESCRIPTOR.test(word)) {
      return word.toLowerCase();
    }
    if (SMALL_WORDS.has(word.toLowerCase()) && index > 0) return word.toLowerCase();
    // Soften leftover Title Case tokens while keeping mixed model codes (HWPO, Air Max)
    if (/^[A-Z][a-z'’]*(-[A-Za-z][a-z'’]*)*$/.test(word)) return word.toLowerCase();
    if (/^[A-Z0-9][A-Za-z0-9+./-]*$/.test(word) && /[0-9]/.test(word)) return word;
    return word.toLowerCase();
  });

  // If brand field is set but missing from the name, prepend it
  const hint = String(brandHint || '').trim();
  let out = lowered.join(' ');
  if (hint && !out.toLowerCase().includes(hint.toLowerCase())) {
    const brandLabel = resolveBrandToken(hint, hint) || hint;
    out = `${brandLabel} ${out}`.trim();
  }

  if (!options?.atSentenceStart) return out;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** @deprecated Prefer editorialGarmentName — kept for call sites that still import title case. */
export function titleCaseWardrobeName(name: string): string {
  return editorialGarmentName(name);
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

    const parts = name.split(/\s+/);
    if (parts.length >= 2 && parts[0].toLowerCase() === color) {
      const rest = parts.slice(1).join(' ');
      if (colorRe.test(rest)) {
        name = rest;
      }
    }

    const leadingColorMatch = name.match(/^([a-z]+)\s+(.+)$/i);
    if (leadingColorMatch) {
      const [, lead, rest] = leadingColorMatch;
      if (lead.toLowerCase() === color && colorRe.test(rest)) {
        name = rest;
      }
    }
  }

  name = collapseDuplicateWords(name);
  return editorialGarmentName(name, { brand: options?.brand });
}

/** Display name for UI + stylist context — never prepend colour again. */
export function formatWardrobeItemDisplayName(item: {
  name?: string | null;
  color?: string | null;
  brand?: string | null;
}): string {
  return sanitizeWardrobeItemName(item.name || '', {
    color: item.color,
    brand: item.brand,
  });
}

export function reconcileWardrobeBrandName(
  rawName: string,
  brand?: string | null,
): string {
  const name = String(rawName || '').trim();
  const brandClean = String(brand || '').trim();
  if (!name || !brandClean) return name ? editorialGarmentName(name) : name;

  if (name.toLowerCase().startsWith(brandClean.toLowerCase())) {
    return editorialGarmentName(name, { brand: brandClean });
  }

  const leadingBrand = name.match(/^([A-Za-z][A-Za-z0-9&'.-]+)\s+(.+)$/);
  if (leadingBrand) {
    const [, wrongBrand, rest] = leadingBrand;
    if (wrongBrand.toLowerCase() !== brandClean.toLowerCase()) {
      return editorialGarmentName(`${brandClean} ${rest}`, { brand: brandClean });
    }
  }

  return editorialGarmentName(`${brandClean} ${name}`, { brand: brandClean });
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
  return editorialGarmentName(raw.replace(/_/g, ' '));
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
    ? String(options.color).replace(/_/g, ' ').toLowerCase()
    : '';
  const typeLabel =
    humanizeGarmentTypeHint(options?.subcategory) ||
    humanizeGarmentTypeHint(options?.category) ||
    'item';
  const brand = String(options?.brand || '').trim();

  if (brand) {
    return editorialGarmentName(`${brand} ${colorLabel} ${typeLabel}`.replace(/\s+/g, ' ').trim(), {
      brand,
    });
  }
  if (colorLabel) {
    return editorialGarmentName(`${colorLabel} ${typeLabel}`.trim());
  }
  return typeLabel;
}
