import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import { getOccasionLabel } from '@/constants/outfitOccasions';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import {
  isAccessoryItem,
  isBottomItem,
  isOuterwearItem,
  isShoesItem,
  isTopItem,
} from '@/utils/completeOutfit';
import type { WeatherLike } from '@/utils/weatherOuterwear';
import { parseWeatherTempC } from '@/utils/weatherOuterwear';

/** Smart shorten — never mid-word cut on shirt/boots/trousers. */
function smartShortenName(raw: string, max = 42): string {
  const name = String(raw || '').trim();
  if (!name || name.length <= max) return name;
  const cut = name.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.55)) {
    return `${cut.slice(0, lastSpace).trim()}…`;
  }
  // Prefer dropping a trailing fragment rather than "t-s…" / "ankle b…"
  return `${cut.replace(/[\s\-–—]+[^\s\-–—]*$/, '').trim() || cut.slice(0, max - 1)}…`;
}

function pickRole(
  items: WardrobeItem[],
  pred: (i: WardrobeItem) => boolean,
): WardrobeItem | undefined {
  return items.find(pred);
}

/**
 * Short GQ-style card footer — occasion + weather why.
 * Items live on the card; do not inventory-dump or append "why these:".
 */
export function buildDeterministicOutfitExplain(params: {
  items: WardrobeItem[];
  occasionType: OutfitOccasionId | 'todays_look' | string;
  weather?: WeatherLike | null;
  userAsk?: string | null;
}): string {
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) return '';

  const occasion = String(params.occasionType || 'casual_day');
  const label =
    occasion === 'todays_look'
      ? "today's look"
      : getOccasionLabel(occasion as OutfitOccasionId).toLowerCase();

  const tempC = parseWeatherTempC(params.weather || null);
  const weatherBit =
    tempC != null
      ? tempC >= 22
        ? ' Light enough for the warm weather.'
        : tempC <= 10
          ? ' Enough warmth for the chill.'
          : ` Tuned for about ${tempC}°.`
      : '';

  const ask = String(params.userAsk || '').toLowerCase();
  let why = '';
  if (/\b(dinner|nice|restaurant|evening)\b/.test(ask) || occasion === 'evening_out' || occasion === 'date_night') {
    why = `Quiet elevation for ${label} — polished without reading formal.`;
  } else if (/\b(gym|workout|training)\b/.test(ask) || occasion === 'gym') {
    why = 'Built for moving — technical pieces that still look considered.';
  } else if (/\b(pub|friends|casual|today)\b/.test(ask) || occasion === 'casual_day' || occasion === 'weekend') {
    why = `Easy for ${label}, still intentional.`;
  } else if (occasion === 'work_outfit') {
    why = 'Clean enough for the room without overstating it.';
  } else if (occasion === 'smart_casual') {
    why = 'Smart-casual balance from pieces you already own.';
  } else {
    why = `A coherent read for ${label}.`;
  }

  // Optional one-name anchor when a single hero piece stands out — never a full inventory list.
  const top = pickRole(items, isTopItem);
  const shoes = pickRole(items, isShoesItem);
  const outer = pickRole(items, isOuterwearItem);
  const hero = outer || top || shoes || pickRole(items, isBottomItem) || pickRole(items, isAccessoryItem);
  const heroBit = hero
    ? ` Anchored by ${smartShortenName(String(hero.name || hero.category || 'your pieces'))}.`
    : '';

  return `${why}${weatherBit}${heroBit}`.replace(/\s+/g, ' ').trim();
}
