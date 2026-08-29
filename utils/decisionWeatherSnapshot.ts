/**
 * Canonical live weather snapshot for Decisions (QSC / Event).
 * Reuses WeatherService (Open-Meteo + device location) — no second provider.
 */

type WeatherConditionSnapshot = {
  temperature: number;
  feelsLike?: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy' | 'windy';
  description?: string;
  timestamp?: number;
  location?: string;
};

/** Max age for a client snapshot the server should treat as current (ms). */
export const DECISION_WEATHER_MAX_AGE_MS = 35 * 60 * 1000;

export type DecisionWeatherSnapshot = {
  source: 'live';
  temperatureC: number;
  feelsLikeC?: number | null;
  conditions: string;
  description?: string | null;
  observedAt: number;
  latitude?: number;
  longitude?: number;
  location?: string;
};

function mapConditionToServerLabel(condition: WeatherConditionSnapshot['condition']): string {
  switch (condition) {
    case 'rainy':
    case 'stormy':
      return 'Rain';
    case 'snowy':
      return 'Snow';
    case 'foggy':
      return 'Fog';
    case 'windy':
      return 'Wind';
    case 'cloudy':
      return 'Clouds';
    case 'sunny':
    default:
      return 'Clear';
  }
}

export function weatherConditionToDecisionSnapshot(
  weather: WeatherConditionSnapshot,
  coords?: { lat: number; lon: number } | null,
): DecisionWeatherSnapshot {
  return {
    source: 'live',
    temperatureC: weather.temperature,
    feelsLikeC: weather.feelsLike ?? null,
    conditions: mapConditionToServerLabel(weather.condition),
    description: weather.description || null,
    observedAt: weather.timestamp || Date.now(),
    latitude: coords?.lat,
    longitude: coords?.lon,
    location: weather.location || undefined,
  };
}

export function isFreshDecisionWeatherSnapshot(
  snapshot: DecisionWeatherSnapshot | null | undefined,
  maxAgeMs: number = DECISION_WEATHER_MAX_AGE_MS,
): boolean {
  if (!snapshot || snapshot.source !== 'live') return false;
  if (!Number.isFinite(snapshot.temperatureC)) return false;
  if (!snapshot.observedAt || !Number.isFinite(snapshot.observedAt)) return false;
  return Date.now() - snapshot.observedAt <= maxAgeMs;
}

/**
 * Best-effort current weather for Decisions submit.
 * Never throws — returns null when permission, provider, or freshness fails.
 */
export async function fetchDecisionWeatherSnapshot(options?: {
  timeoutMs?: number;
  skipCache?: boolean;
}): Promise<DecisionWeatherSnapshot | null> {
  const timeoutMs = options?.timeoutMs ?? 3500;
  try {
    const weatherService = (await import('@/services/WeatherService')).default;
    const weatherPromise = weatherService.getWeatherForOutfits(options?.skipCache ?? false);
    const weather = await Promise.race([
      weatherPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!weather || !Number.isFinite(weather.temperature)) return null;

    let coords: { lat: number; lon: number } | null = null;
    try {
      const loc = await Promise.race([
        weatherService.getLocationCoords(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
      ]);
      if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) {
        coords = { lat: loc.lat, lon: loc.lon };
      }
    } catch {
      coords = null;
    }

    const snapshot = weatherConditionToDecisionSnapshot(weather, coords);
    return isFreshDecisionWeatherSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

/** Event: only attach device-current weather when no distinct event venue is set. */
export function shouldAttachDeviceWeatherForDecision(
  decisionType: 'sanity-check' | 'event-outfit' | 'shopping',
  eventVenue?: string | null,
): boolean {
  if (decisionType === 'sanity-check') return true;
  if (decisionType === 'event-outfit') {
    return !String(eventVenue || '').trim();
  }
  return false;
}
