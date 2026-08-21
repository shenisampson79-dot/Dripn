/**
 * Multi-day travel clarification flow — first-class Ivy contract (client mirror).
 *
 * States: DETECTED → AWAITING_SLOTS → READY → GENERATING → DONE
 * Required: destination, tripType, datesOrSeason, occasions (or explicit none)
 * Exit: only when ready → POST /api/chat/multi-day-outfits (destination weather)
 */

export type TripType = 'business' | 'leisure' | 'mixed';

export type MultiDayTravelSlots = {
  destination: string | null;
  tripType: TripType | null;
  datesOrSeason: string | null;
  occasions: string | null;
  dayCount: number | null;
  occasionsExplicitNone: boolean;
};

export const MULTI_DAY_TRAVEL_FLOW = 'multi_day_travel_clarify';

export const MULTI_DAY_STATES = {
  DETECTED: 'DETECTED',
  AWAITING_SLOTS: 'AWAITING_SLOTS',
  READY: 'READY',
  GENERATING: 'GENERATING',
  DONE: 'DONE',
} as const;

export function emptyMultiDaySlots(): MultiDayTravelSlots {
  return {
    destination: null,
    tripType: null,
    datesOrSeason: null,
    occasions: null,
    dayCount: null,
    occasionsExplicitNone: false,
  };
}

export function isMultiDayTravelOutfitAsk(query = ''): boolean {
  const text = String(query || '').trim();
  if (!text) return false;
  if (/\bdress me like\b|\bstyle me like\b|\bin the style of\b/i.test(text)) return false;
  if (/\blike\s+[A-Z][A-Za-z0-9.'’\-]+(?:\s+[A-Z][A-Za-z0-9.'’\-]+){0,3}\b/.test(text)) return false;
  return (
    /\b(for|each|every)\s+(day|night|morning)\b/i.test(text)
    || /\b\d+\s+days?\b/i.test(text)
    || /\b(three|3|four|4|five|5|seven|7|week)\b.{0,24}\b(day|days|outfits?|looks?)\b/i.test(text)
    || /\b(outfits?|looks?)\b.{0,24}\b(for|each|every)\b.{0,16}\b(day|days)\b/i.test(text)
    || /\b(away|travelling|traveling|trip|packing)\b.{0,48}\b(day|days|outfits?|looks?)\b/i.test(text)
    || /\boutfit for each day\b/i.test(text)
  );
}

export function extractDayCount(text = ''): number | null {
  const t = String(text || '');
  const num = t.match(/\b(\d+)\s*days?\b/i);
  if (num) {
    const n = Number(num[1]);
    if (n >= 2 && n <= 21) return n;
  }
  if (/\b(three|3)\b.{0,24}\b(day|days|outfits?)\b/i.test(t) || /\bfor three days\b/i.test(t)) return 3;
  if (/\b(four|4)\b.{0,24}\b(day|days|outfits?)\b/i.test(t)) return 4;
  if (/\b(five|5)\b.{0,24}\b(day|days|outfits?)\b/i.test(t)) return 5;
  if (/\b(seven|7|a\s+week|one\s+week)\b/i.test(t)) return 7;
  if (/\baway for\b/i.test(t) && /\bdays?\b/i.test(t)) return 3;
  return null;
}

export function parseMultiDayTravelSlots(
  prior: MultiDayTravelSlots | null | undefined,
  text = '',
): MultiDayTravelSlots {
  const slots: MultiDayTravelSlots = { ...(prior || emptyMultiDaySlots()) };
  const t = String(text || '').trim();
  if (!t) return slots;

  // Numbered batch: "1. Rome 2. Mix 3. August 23 4. walking"
  const numbered = [...t.matchAll(/(?:^|\n|\s)(\d+)[\).:\-]\s*([^\n\d]+?)(?=(?:\s*\d+[\).:\-])|$)/g)];
  if (numbered.length >= 2) {
    const order: Array<keyof MultiDayTravelSlots> = ['destination', 'tripType', 'datesOrSeason', 'occasions'];
    for (const m of numbered) {
      const idx = Math.max(0, Number(m[1]) - 1);
      const value = String(m[2] || '').trim().replace(/[.,;]+$/, '');
      if (!value || idx >= order.length) continue;
      const key = order[idx];
      if (key === 'destination' && value.length >= 2 && value.length <= 48) {
        slots.destination = value.replace(/^(to|in|for)\s+/i, '');
      } else if (key === 'tripType') {
        if (/\b(mix|mixed|both|business and leisure|work and play)\b/i.test(value)) slots.tripType = 'mixed';
        else if (/\b(business|work)\b/i.test(value)) slots.tripType = 'business';
        else if (/\b(leisure|pleasure|holiday|vacation)\b/i.test(value)) slots.tripType = 'leisure';
      } else if (key === 'datesOrSeason') {
        slots.datesOrSeason = value;
      } else if (key === 'occasions') {
        if (/\b(no dinners?|no dress codes?|nothing special|none|just casual|walking|sightseeing|explore)\b/i.test(value)) {
          slots.occasionsExplicitNone = true;
          slots.occasions = /walking|sightseeing|explore/i.test(value) ? value : 'none';
        } else {
          slots.occasions = value;
          slots.occasionsExplicitNone = false;
        }
      }
    }
  }

  const dayCount = extractDayCount(t);
  if (dayCount != null) slots.dayCount = dayCount;

  if (/\b(mixed|mix of both|business and leisure|work and play)\b/i.test(t)
    || /(?:^|[\n,;])\s*mix\s*(?:$|[\n,;])/i.test(t)) {
    slots.tripType = 'mixed';
  } else if (/\b(business|work trip|client|conference|meetings?)\b/i.test(t)) {
    slots.tripType = 'business';
  } else if (/\b(leisure|pleasure|holiday|vacation|weekend away|city break|tourist)\b/i.test(t)) {
    slots.tripType = 'leisure';
  }

  if (/\b(no dinners?|no dress codes?|nothing special|none|no major occasions?|just casual)\b/i.test(t)
    || /\b(mostly\s+)?walking\b/i.test(t)
    || /\bsightseeing\b/i.test(t)) {
    if (!slots.occasions || slots.occasionsExplicitNone || /\b(none|walking|sightseeing)\b/i.test(t)) {
      slots.occasionsExplicitNone = true;
      slots.occasions = slots.occasions && slots.occasions !== 'none' ? slots.occasions : 'none';
    }
  } else {
    const occBits: string[] = [];
    if (/\b(dinner|restaurant|somewhere nice|evening out)\b/i.test(t)) occBits.push('dinner');
    if (/\b(wedding|ceremony)\b/i.test(t)) occBits.push('wedding');
    if (/\b(black\s*tie|cocktail|formal)\b/i.test(t) && !/\bnot\s+formal\b/i.test(t)) occBits.push('formal');
    if (/\b(client dinner|work dinner|business dinner)\b/i.test(t)) occBits.push('work_dinner');
    if (occBits.length) {
      slots.occasions = occBits.join(', ');
      slots.occasionsExplicitNone = false;
    }
  }

  const season = t.match(/\b(spring|summer|autumn|fall|winter)\b/i);
  const dateSpan = t.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*|(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{2,4})?)\b/i);
  const relative = t.match(/\b(next\s+week|this\s+weekend|next\s+weekend)\b/i);
  if (dateSpan) slots.datesOrSeason = dateSpan[0];
  else if (season) slots.datesOrSeason = season[1].toLowerCase();
  else if (relative) slots.datesOrSeason = relative[0];
  else {
    const m = t.match(/\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{2,4})?|(?:january|february|march|april|may|june|july|august|september|october|november|december))\b/i);
    if (m) slots.datesOrSeason = m[1].toLowerCase();
  }

  if (!slots.destination) {
    const headed = t.match(/\b(?:in|to|for|heading(?:\s+to)?|visiting|going(?:\s+to)?)\s+([A-Z][A-Za-zÀ-ÿ'’\-]+(?:\s+[A-Z][A-Za-zÀ-ÿ'’\-]+){0,2})\b/);
    if (headed && !/^(Business|Leisure|Mixed|Mix|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Summer|Winter|Spring|Autumn|Fall|August|Walking)\b/i.test(headed[1])) {
      slots.destination = headed[1].trim();
    } else {
      const firstChunk = t.split(/[,;\n]/)[0]?.trim().replace(/^\d+[\).:\-]\s*/, '');
      if (
        firstChunk
        && firstChunk.length >= 2
        && firstChunk.length <= 48
        && !/\b(business|leisure|mixed|mix|dinner|none|days?|outfit|walking)\b/i.test(firstChunk)
        && /^[A-Za-zÀ-ÿ]/.test(firstChunk)
        && (/^[A-Z]/.test(firstChunk) || /\b(spain|france|italy|uk|usa|portugal|greece|germany|nyc|london|paris|rome|berlin|madrid|lisbon|amsterdam|dublin|edinburgh)\b/i.test(firstChunk))
      ) {
        slots.destination = firstChunk.replace(/\.$/, '');
      }
    }
  }

  return slots;
}

export function missingMultiDaySlots(slots: MultiDayTravelSlots = emptyMultiDaySlots()): string[] {
  const missing: string[] = [];
  if (!slots.destination) missing.push('destination');
  if (!slots.tripType) missing.push('tripType');
  if (!slots.datesOrSeason) missing.push('datesOrSeason');
  if (!slots.occasions && !slots.occasionsExplicitNone) missing.push('occasions');
  return missing;
}

export function isMultiDayReady(slots: MultiDayTravelSlots = emptyMultiDaySlots()): boolean {
  return missingMultiDaySlots(slots).length === 0;
}

export function multiDayClarifyCopy(stylistId = 'ivy', slots: MultiDayTravelSlots | null = null): string {
  const missing = slots
    ? missingMultiDaySlots(slots)
    : ['destination', 'tripType', 'datesOrSeason', 'occasions'];
  const id = String(stylistId || 'ivy').toLowerCase();

  if (missing.length === 0) return '';

  if (missing.length >= 3 && !slots?.destination && !slots?.tripType) {
    if (id === 'max') {
      return "Happy to map a look for each day — a few quick ones so I nail it:\n1. Where are you heading?\n2. Business, leisure, or a mix?\n3. Dates or season?\n4. Any dinners or dress codes I should plan for?\n\nOnce I know that, I'll build day-by-day from your wardrobe.";
    }
    if (id === 'ace') {
      return "I can plan an outfit for each day — first:\n1. Where are you travelling?\n2. Is it mainly business, leisure, or mixed?\n3. Dates or season?\n4. Any dress codes or dinners to cover?\n\nReply with those and I'll build from your wardrobe.";
    }
    return "I'd love to dress you for each day of the trip — a few quick ones so I get it right:\n1. Where are you heading?\n2. Business, pleasure, or a mix?\n3. Dates or season?\n4. Any dinners or dress codes I should plan for?\n\nTell me those and I'll build day-by-day from pieces you already own.";
  }

  const labels: Record<string, string> = {
    destination: 'Where are you heading?',
    tripType: 'Is it business, leisure, or a mix?',
    datesOrSeason: 'What dates or season?',
    occasions: 'Any dinners or dress codes (or say none)?',
  };
  const lines = missing.map((k, i) => `${i + 1}. ${labels[k]}`);
  return `Almost there — just need:\n${lines.join('\n')}\n\nThen I'll build the day looks.`;
}

export function advanceMultiDayTravelClarify(opts: {
  query?: string;
  priorSlots?: MultiDayTravelSlots | null;
  stylistId?: string;
}) {
  const base = opts.priorSlots
    ? { ...emptyMultiDaySlots(), ...opts.priorSlots }
    : emptyMultiDaySlots();
  if (base.dayCount == null) {
    const n = extractDayCount(opts.query || '');
    if (n != null) base.dayCount = n;
  }
  const slots = parseMultiDayTravelSlots(base, opts.query || '');
  const ready = isMultiDayReady(slots);
  return {
    flow: MULTI_DAY_TRAVEL_FLOW,
    state: ready ? MULTI_DAY_STATES.READY : MULTI_DAY_STATES.AWAITING_SLOTS,
    slots,
    missing: missingMultiDaySlots(slots),
    clarifyCopy: ready ? null : multiDayClarifyCopy(opts.stylistId || 'ivy', slots),
  };
}
