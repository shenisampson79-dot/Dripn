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

function rolePhrase(item: WardrobeItem): string {
  const name = String(item.name || item.category || 'piece').trim();
  const short = name.length > 36 ? `${name.slice(0, 34)}…` : name;
  return short;
}

function pickRole(
  items: WardrobeItem[],
  pred: (i: WardrobeItem) => boolean,
): WardrobeItem | undefined {
  return items.find(pred);
}

/**
 * Short, deterministic card footer — occasion + weather + item roles.
 * No LLM hang; omit empty filler rather than repeating a generic line.
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

  const top = pickRole(items, isTopItem);
  const bottom = pickRole(items, isBottomItem);
  const shoes = pickRole(items, isShoesItem);
  const outer = pickRole(items, isOuterwearItem);
  const accessory = pickRole(items, isAccessoryItem);

  const parts: string[] = [];
  if (top && bottom) {
    parts.push(`${rolePhrase(top)} with ${rolePhrase(bottom)}`);
  } else if (top) {
    parts.push(rolePhrase(top));
  } else if (bottom) {
    parts.push(rolePhrase(bottom));
  }
  if (shoes) parts.push(`${rolePhrase(shoes)} underfoot`);
  if (outer) parts.push(`${rolePhrase(outer)} on top`);
  else if (accessory) parts.push(`${rolePhrase(accessory)} to finish`);

  const mix = parts.slice(0, 3).join(', ');
  const tempC = parseWeatherTempC(params.weather || null);
  const weatherBit =
    tempC != null
      ? tempC >= 22
        ? ' kept light for the warm weather'
        : tempC <= 10
          ? ' with enough warmth for the chill'
          : ` tuned for about ${tempC}°`
      : '';

  const ask = String(params.userAsk || '').toLowerCase();
  let why = '';
  if (/\b(dinner|nice|restaurant|evening)\b/.test(ask) || occasion === 'evening_out' || occasion === 'date_night') {
    why = ' — elevated enough for dinner without overdoing it';
  } else if (/\b(pub|friends|casual)\b/.test(ask) || occasion === 'casual_day' || occasion === 'weekend') {
    why = ' — easy and social, still intentional';
  } else if (occasion === 'work_outfit') {
    why = ' — clean enough for the room';
  } else if (occasion === 'smart_casual') {
    why = ' — smart-casual balance from what you own';
  }

  if (!mix) {
    return `Chosen for ${label}${weatherBit}${why || ' from pieces that fit the brief'}.`.trim();
  }

  return `${mix[0].toUpperCase()}${mix.slice(1)} — why these: they fit ${label}${weatherBit}${why}.`;
}
