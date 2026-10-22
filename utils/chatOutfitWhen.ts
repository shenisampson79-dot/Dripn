/**
 * Chat-only outing when helpers. Mirrors backend services/chatOutfitWhen.js.
 * Does not invent coordinates or temperatures.
 */

import {
  getHourInTimeZone,
  TODAYS_OUTFIT_TIMEZONE,
} from '@/utils/todaysOutfitTime';
import { resolveWearTargetFromChat } from '@/utils/chatWearTargetDate';

export type ChatTimePeriod = 'morning' | 'afternoon' | 'evening';

export type ChatOutfitWhen = {
  kind: 'today' | 'tomorrow' | 'date' | 'unspecified';
  dateKey: string | null;
  timePeriod: ChatTimePeriod | null;
  periodKind: 'current' | 'forecast_slot';
  usesCurrentWeather: boolean;
};

export type ChatOutfitWeatherPayload = {
  temperature?: number;
  temp?: number;
  condition?: string;
  precipitation?: boolean | number;
  source?: string;
  applicableToRequest?: boolean;
  periodKind?: 'current' | 'forecast_slot';
  dateKey?: string | null;
  timePeriod?: ChatTimePeriod | null;
  forecastUnavailable?: boolean;
};

export function detectChatTimePeriod(text = ''): ChatTimePeriod | null {
  const t = String(text || '').toLowerCase();
  if (/\b(tonight|this evening|evening|night)\b/.test(t)) return 'evening';
  if (/\b(this afternoon|afternoon|matinee)\b/.test(t)) return 'afternoon';
  if (/\b(this morning|morning)\b/.test(t)) return 'morning';
  return null;
}

export function isCinemaAsk(text = ''): boolean {
  return /\b(movies?|cinema|film)\b/i.test(String(text || ''));
}

export function inferChatCinemaOccasion(text = ''): 'evening_out' | null {
  if (!isCinemaAsk(text)) return null;
  return detectChatTimePeriod(text) === 'evening' ? 'evening_out' : null;
}

export function hourForTimePeriod(timePeriod: ChatTimePeriod | null | undefined): number {
  if (timePeriod === 'morning') return 9;
  if (timePeriod === 'afternoon') return 14;
  if (timePeriod === 'evening') return 19;
  return 12;
}

export function parseChatOutfitWhen(text = '', now: Date = new Date()): ChatOutfitWhen {
  const target = resolveWearTargetFromChat(text, '', now);
  const timePeriod = detectChatTimePeriod(text);
  const currentHour = getHourInTimeZone(now, TODAYS_OUTFIT_TIMEZONE);
  const eveningStillAhead = timePeriod === 'evening' && currentHour < 17;
  const usesCurrentWeather = target.kind === 'unspecified'
    || (target.kind === 'today' && timePeriod !== 'evening')
    || (target.kind === 'today' && timePeriod === 'evening' && !eveningStillAhead);

  return {
    kind: target.kind,
    dateKey: target.dateKey,
    timePeriod,
    periodKind: usesCurrentWeather ? 'current' : 'forecast_slot',
    usesCurrentWeather,
  };
}

export function mapOpenMeteoWeatherCode(code: unknown): string {
  const n = Number(code);
  if (!Number.isFinite(n)) return 'clear';
  if (n === 0 || n === 1) return 'clear';
  if (n === 2 || n === 3 || n === 45 || n === 48) return 'cloudy';
  if ((n >= 51 && n <= 67) || (n >= 80 && n <= 82) || n >= 95) return 'rain';
  if ((n >= 71 && n <= 77) || (n >= 85 && n <= 86)) return 'snow';
  return 'cloudy';
}

export function buildOpenMeteoHourlyUrl(opts: {
  lat: number;
  lon: number;
  dateKey: string;
  timeZone?: string;
}): string | null {
  const date = String(opts.dateKey || '').slice(0, 10);
  if (!date || !Number.isFinite(opts.lat) || !Number.isFinite(opts.lon)) return null;
  const timeZone = opts.timeZone || TODAYS_OUTFIT_TIMEZONE;
  return `https://api.open-meteo.com/v1/forecast?latitude=${opts.lat}&longitude=${opts.lon}`
    + `&hourly=temperature_2m,precipitation_probability,weather_code`
    + `&start_date=${encodeURIComponent(date)}&end_date=${encodeURIComponent(date)}`
    + `&timezone=${encodeURIComponent(timeZone)}`;
}

export function pickHourlyForecastSample(
  hourly: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  } | null | undefined,
  opts: { dateKey?: string | null; timePeriod?: ChatTimePeriod | null },
): {
  temperature: number;
  hour: number;
  precipitation: number;
  weatherCode: unknown;
  stamp: string;
} | null {
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const temps = hourly?.temperature_2m;
  if (!times.length || !Array.isArray(temps)) return null;
  const wantHour = hourForTimePeriod(opts.timePeriod);
  const prefix = String(opts.dateKey || '').slice(0, 10);
  let best: {
    temperature: number;
    hour: number;
    precipitation: number;
    weatherCode: unknown;
    stamp: string;
  } | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < times.length; i += 1) {
    const stamp = String(times[i] || '');
    if (prefix && !stamp.startsWith(prefix)) continue;
    const hourMatch = stamp.match(/T(\d{2})/);
    const hour = hourMatch ? Number(hourMatch[1]) : NaN;
    if (!Number.isFinite(hour)) continue;
    const temp = Number(temps[i]);
    if (!Number.isFinite(temp)) continue;
    const dist = Math.abs(hour - wantHour);
    if (dist < bestDist) {
      bestDist = dist;
      const precip = Number(hourly?.precipitation_probability?.[i]);
      best = {
        temperature: Math.round(temp),
        hour,
        precipitation: Number.isFinite(precip) ? precip : 0,
        weatherCode: hourly?.weather_code?.[i],
        stamp,
      };
    }
  }
  return best;
}

export function unavailableForecastWeather(when: ChatOutfitWhen): ChatOutfitWeatherPayload {
  return {
    applicableToRequest: false,
    periodKind: 'forecast_slot',
    dateKey: when.dateKey,
    timePeriod: when.timePeriod,
    forecastUnavailable: true,
  };
}

export function snapshotFromHourlySample(
  sample: ReturnType<typeof pickHourlyForecastSample>,
  when: ChatOutfitWhen,
): ChatOutfitWeatherPayload | null {
  if (!sample) return null;
  return {
    temperature: sample.temperature,
    temp: sample.temperature,
    condition: mapOpenMeteoWeatherCode(sample.weatherCode),
    precipitation: sample.precipitation >= 40,
    source: 'open_meteo_forecast',
    applicableToRequest: true,
    periodKind: 'forecast_slot',
    dateKey: when.dateKey,
    timePeriod: when.timePeriod,
  };
}

export async function fetchChatOutfitForecast(opts: {
  lat: number;
  lon: number;
  when: ChatOutfitWhen;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ChatOutfitWeatherPayload> {
  const { lat, lon, when, timeoutMs = 2500 } = opts;
  const unavailable = unavailableForecastWeather(when);
  if (!when.dateKey || !Number.isFinite(lat) || !Number.isFinite(lon)) return unavailable;
  const url = buildOpenMeteoHourlyUrl({ lat, lon, dateKey: when.dateKey });
  if (!url) return unavailable;
  const doFetch = opts.fetchImpl || fetch;
  try {
    const response = await Promise.race([
      doFetch(url),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!response || !response.ok) return unavailable;
    const data = await response.json();
    return snapshotFromHourlySample(pickHourlyForecastSample(data?.hourly, when), when) || unavailable;
  } catch {
    return unavailable;
  }
}
