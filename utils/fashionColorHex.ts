/**
 * Resolve fashion colour names (and optional embedded hex) to a swatch hex.
 * Used when seasonal analysis returns names like "Icy pastels" without a code.
 */

const NAMED_COLOR_HEX: Record<string, string> = {
  // Core
  black: "#1A1A1A",
  white: "#F5F5F5",
  gray: "#808080",
  grey: "#808080",
  charcoal: "#36454F",
  navy: "#1E3A5F",
  brown: "#8B4513",
  beige: "#D4C4A8",
  cream: "#F5F0E6",
  ivory: "#FFFFF0",
  red: "#C94C5A",
  true: "#C41E3A",
  pink: "#E8A0BF",
  hot: "#FF69B4",
  orange: "#E09860",
  yellow: "#F5D547",
  green: "#4CAF50",
  blue: "#3D8BFF",
  purple: "#9B7EBD",
  denim: "#4A6FA5",

  // Fashion / seasonal
  burgundy: "#722F37",
  wine: "#722F37",
  maroon: "#800000",
  coral: "#FF7F50",
  peach: "#FFCBA4",
  rust: "#B7410E",
  terracotta: "#E2725B",
  mustard: "#E1AD01",
  gold: "#D4AF37",
  silver: "#C0C0C0",
  olive: "#808000",
  sage: "#9CAF88",
  forest: "#228B22",
  emerald: "#50C878",
  mint: "#98D8C8",
  teal: "#008080",
  turquoise: "#40E0D0",
  aqua: "#7FDBFF",
  cyan: "#00FFFF",
  sky: "#87CEEB",
  royal: "#4169E1",
  cobalt: "#0047AB",
  indigo: "#4B0082",
  sapphire: "#0F52BA",
  lavender: "#E6E6FA",
  violet: "#8B5CF6",
  plum: "#8E4585",
  mauve: "#E0B0FF",
  magenta: "#FF00FF",
  fuchsia: "#FF00FF",
  blush: "#DE5D83",
  rose: "#FF007F",
  salmon: "#FA8072",
  camel: "#C19A6B",
  taupe: "#483C32",
  khaki: "#C3B091",
  sand: "#C2B280",
  tan: "#D2B48C",
  chocolate: "#7B3F00",
  mocha: "#967969",
  espresso: "#3C1414",
  slate: "#708090",
  ash: "#B2BEB5",
  graphite: "#383838",
  neon: "#39FF14",
  lime: "#32CD32",
  lemon: "#FFF44F",
  amber: "#FFBF00",
  apricot: "#FBCEB1",
  butter: "#F5E6A3",
  champagne: "#F7E7CE",
  nude: "#E3BC9A",
  copper: "#B87333",
  bronze: "#CD7F32",
  jewel: "#4A0072",

  // Soft / pastel phrases commonly returned by colour analysis
  pastels: "#FFD1DC",
  pastel: "#FFD1DC",
  "icy pastels": "#D6EAF8",
  "cool lavender": "#B8A9D9",
  "warm orange": "#E67E22",
  "muted peach": "#E8B4A0",
  "bright yellow": "#F1C40F",
  "bright yellows": "#F1C40F",
  "bright orange": "#FF8C00",
  "bright oranges": "#FF8C00",
  "hot pink": "#FF69B4",
  "lime green": "#32CD32",
  "neon colors": "#39FF14",
  "neon colours": "#39FF14",
  "animal prints": "#C4A574",
  florals: "#E8A0BF",
  stripes: "#5DADE2",
  plaids: "#8B4513",
  "polka dots": "#E74C3C",
  camouflage: "#78866B",
  "tie-dye": "#9B59B6",
  ombre: "#AED6F1",
  metallics: "#C0C0C0",
};

/** Longest keys first so "cool lavender" wins over "lavender". */
const SORTED_NAME_KEYS = Object.keys(NAMED_COLOR_HEX).sort((a, b) => b.length - a.length);

function lightenHex(hex: string, amount = 0.45): string {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const mix = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  return `#${[mix(r), mix(g), mix(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Returns a hex swatch for a colour label, or null if nothing useful can be inferred.
 */
export function resolveFashionColorHex(colorLabel: string): string | null {
  if (!colorLabel || typeof colorLabel !== "string") return null;

  const hexMatch = colorLabel.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/);
  if (hexMatch) return hexMatch[0];

  const normalized = colorLabel
    .replace(/#[0-9A-Fa-f]{3,6}/gi, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!normalized || normalized.includes("open to all")) return null;

  if (NAMED_COLOR_HEX[normalized]) {
    return NAMED_COLOR_HEX[normalized];
  }

  for (const key of SORTED_NAME_KEYS) {
    if (normalized.includes(key)) {
      const base = NAMED_COLOR_HEX[key];
      const wantsSoft =
        /\b(icy|soft|pastel|muted|pale|dusty|light|cool)\b/.test(normalized) &&
        key !== "pastels" &&
        key !== "pastel" &&
        key !== "icy pastels" &&
        key !== "cool lavender" &&
        key !== "muted peach";
      return wantsSoft ? lightenHex(base) : base;
    }
  }

  return null;
}

export function stripColorHexFromLabel(colorLabel: string): string {
  return colorLabel.replace(/#[0-9A-Fa-f]{3,6}/gi, "").trim() || colorLabel;
}
