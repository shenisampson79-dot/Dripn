/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Weather Service for outfit recommendations based on weather conditions
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveContentLang, type ContentLang } from '@/utils/contentLang';
import {
  buildLocalizedOutfitRecommendation,
  getDefaultWeatherDescription,
  getWeatherDescription as getLocalizedWeatherDescription,
  UNKNOWN_LOCATION,
} from '@/data/weatherOutfitCopy';

const WEATHER_CACHE_KEY = '@dripn_weather_cache_v2';
const LEGACY_WEATHER_CACHE_KEY = '@dripn_weather_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export interface WeatherCondition {
  temperature: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon: string;
  windSpeed: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy' | 'foggy' | 'stormy';
  location: string;
  timestamp: number;
  /** Open-Meteo WMO weather code — used to re-localize description */
  weatherCode?: number;
  /** Today's forecast low (°C), when available */
  tempMin?: number;
  /** Today's forecast high (°C), when available */
  tempMax?: number;
}

export interface WeatherOutfitRecommendation {
  layers: string[];
  keyPieces: string[];
  accessories: string[];
  colors: string[];
  fabricTips: string;
  stylingNote: string;
}

export interface DailyForecastDay {
  dayIndex: number;
  date: string;
  tempMin: number;
  tempMax: number;
  precipitationProbability: number;
  windSpeedMax?: number;
  condition: WeatherCondition['condition'];
  description: string;
}

export interface DailyForecast {
  location: string;
  lat: number;
  lon: number;
  days: DailyForecastDay[];
  source: string;
  fetchedAt: string;
}

export interface LocationCoords {
  lat: number;
  lon: number;
  locationName?: string;
}

interface CachedWeather {
  data: WeatherCondition;
  timestamp: number;
}

class WeatherService {
  private apiKey: string | null = null;

  async getCurrentWeather(skipCache: boolean = false): Promise<WeatherCondition | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        return null;
      }

      if (!skipCache) {
        const cached = await this.getCachedWeather();
        if (cached) {
          return this.enrichWithDailyRange(cached);
        }
      } else {
        await this.clearWeatherCache();
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const weather = await this.fetchWeatherByCoords(
        location.coords.latitude,
        location.coords.longitude
      );

      if (weather) {
        const enriched = await this.enrichWithDailyRange(weather);
        await this.cacheWeather(enriched);
        return enriched;
      }

      return weather;
    } catch (error) {
      console.error('Failed to get weather:', error);
      return null;
    }
  }

  /** Always includes today's high/low — used by Weather Outfits. */
  async getWeatherForOutfits(skipCache: boolean = false): Promise<WeatherCondition | null> {
    await AsyncStorage.removeItem(LEGACY_WEATHER_CACHE_KEY).catch(() => {});
    return this.getCurrentWeather(skipCache);
  }

  private async enrichWithDailyRange(weather: WeatherCondition): Promise<WeatherCondition> {
    if (weather.tempMin != null && weather.tempMax != null) {
      return weather;
    }

    try {
      const coords = await this.getLocationCoords();
      if (!coords) return weather;

      const forecast = await this.fetchDailyForecast(coords.lat, coords.lon, 1, coords.locationName);
      const today = forecast?.days?.[0];
      if (!today) return weather;

      return {
        ...weather,
        tempMin: today.tempMin,
        tempMax: today.tempMax,
      };
    } catch {
      return weather;
    }
  }

  async checkPermissionStatus(): Promise<{ granted: boolean; canAskAgain: boolean }> {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain: canAskAgain !== false,
    };
  }

  async requestPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async getLocationCoords(): Promise<LocationCoords | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await this.requestPermission();
        if (!granted) return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      let locationName: string | undefined;
      try {
        const geoResponse = await fetch(
          `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&count=1`,
        );
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          const place = geoData.results?.[0];
          locationName = place?.name || place?.admin1 || undefined;
        }
      } catch {
        // non-blocking
      }

      return {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        locationName,
      };
    } catch (error) {
      console.error('Failed to get location coords:', error);
      return null;
    }
  }

  async get14DayForecast(): Promise<DailyForecast | null> {
    const coords = await this.getLocationCoords();
    if (!coords) return null;
    return this.fetchDailyForecast(coords.lat, coords.lon, 14, coords.locationName);
  }

  async fetchDailyForecast(
    lat: number,
    lon: number,
    days: number = 14,
    locationName?: string,
  ): Promise<DailyForecast | null> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,wind_speed_10m_max` +
          `&timezone=auto&forecast_days=${Math.min(Math.max(days, 1), 16)}`,
      );

      if (!response.ok) {
        throw new Error('Forecast API request failed');
      }

      const data = await response.json();
      const daily = data.daily;
      if (!daily?.time?.length) return null;

      const forecastDays: DailyForecastDay[] = daily.time.map((date: string, idx: number) => {
        const code = daily.weathercode?.[idx] ?? 0;
        return {
          dayIndex: idx + 1,
          date,
          tempMin: Math.round(daily.temperature_2m_min?.[idx] ?? 0),
          tempMax: Math.round(daily.temperature_2m_max?.[idx] ?? 0),
          precipitationProbability: Math.round(daily.precipitation_probability_max?.[idx] ?? 0),
          windSpeedMax: Math.round(daily.wind_speed_10m_max?.[idx] ?? 0),
          condition: this.mapWeatherCode(code),
          description: this.getWeatherDescription(code),
        };
      });

      return {
        location: locationName || 'Your location',
        lat,
        lon,
        days: forecastDays,
        source: 'open-meteo',
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error fetching daily forecast:', error);
      return null;
    }
  }

  buildWeatherNoteForDay(day?: DailyForecastDay | null): string | undefined {
    if (!day) return undefined;
    const rain =
      day.precipitationProbability >= 40 || day.condition === 'rainy' || day.condition === 'stormy'
        ? ` · ${day.precipitationProbability}% rain`
        : '';
    return `${day.tempMin}–${day.tempMax}°C, ${day.description}${rain}`;
  }

  getForecastDay(forecast: DailyForecast | null | undefined, dayIndex: number): DailyForecastDay | null {
    if (!forecast?.days?.length) return null;
    return forecast.days.find((d) => d.dayIndex === dayIndex) || forecast.days[dayIndex - 1] || null;
  }

  private async fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherCondition | null> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
          `&daily=temperature_2m_max,temperature_2m_min` +
          `&timezone=auto&forecast_days=1`
      );

      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = await response.json();
      const current = data.current;
      const daily = data.daily;

      const weatherCode = current.weather_code;
      const condition = this.mapWeatherCode(weatherCode);
      const tempMin = daily?.temperature_2m_min?.[0] != null
        ? Math.round(daily.temperature_2m_min[0])
        : undefined;
      const tempMax = daily?.temperature_2m_max?.[0] != null
        ? Math.round(daily.temperature_2m_max[0])
        : undefined;

      const locationResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
      );
      let locationName = 'Your Location';
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        locationName = locationData.address?.city || 
                       locationData.address?.town || 
                       locationData.address?.village ||
                       locationData.address?.county ||
                       'Your Location';
      }

      return {
        temperature: Math.round(current.temperature_2m),
        feelsLike: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        description: this.getWeatherDescription(weatherCode),
        icon: this.getWeatherIcon(weatherCode),
        windSpeed: Math.round(current.wind_speed_10m),
        condition,
        location: locationName,
        timestamp: Date.now(),
        weatherCode,
        tempMin,
        tempMax,
      };
    } catch (error) {
      console.error('Error fetching weather:', error);
      return null;
    }
  }

  private mapWeatherCode(code: number): WeatherCondition['condition'] {
    if (code === 0 || code === 1) return 'sunny';
    if (code >= 2 && code <= 3) return 'cloudy';
    if (code >= 45 && code <= 48) return 'foggy';
    if (code >= 51 && code <= 67) return 'rainy';
    if (code >= 71 && code <= 77) return 'snowy';
    if (code >= 80 && code <= 82) return 'rainy';
    if (code >= 85 && code <= 86) return 'snowy';
    if (code >= 95 && code <= 99) return 'stormy';
    return 'cloudy';
  }

  private getWeatherDescription(code: number, lang: ContentLang = 'en'): string {
    return getLocalizedWeatherDescription(code, lang);
  }

  /** Re-localize a weather condition description for the UI language. */
  localizeWeatherCondition(weather: WeatherCondition, language?: string | null): WeatherCondition {
    const lang = resolveContentLang(language);
    if (weather.weatherCode != null) {
      return {
        ...weather,
        description: getLocalizedWeatherDescription(weather.weatherCode, lang),
      };
    }
    return weather;
  }

  private getWeatherIcon(code: number): string {
    if (code === 0 || code === 1) return 'sun';
    if (code >= 2 && code <= 3) return 'cloud';
    if (code >= 45 && code <= 48) return 'cloud';
    if (code >= 51 && code <= 67) return 'cloud-rain';
    if (code >= 71 && code <= 77) return 'cloud-snow';
    if (code >= 80 && code <= 82) return 'cloud-drizzle';
    if (code >= 85 && code <= 86) return 'cloud-snow';
    if (code >= 95) return 'cloud-lightning';
    return 'cloud';
  }

  private getDefaultWeather(): WeatherCondition {
    return {
      temperature: 18,
      feelsLike: 17,
      humidity: 60,
      description: getDefaultWeatherDescription('en'),
      icon: 'cloud',
      windSpeed: 10,
      condition: 'cloudy',
      location: UNKNOWN_LOCATION.en.unknown,
      timestamp: Date.now(),
      weatherCode: 2,
    };
  }

  private async getCachedWeather(): Promise<WeatherCondition | null> {
    try {
      const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const parsed: CachedWeather = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          // Ignore legacy cache entries saved before daily high/low support.
          if (parsed.data.tempMin == null || parsed.data.tempMax == null) {
            return null;
          }
          return parsed.data;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async cacheWeather(weather: WeatherCondition): Promise<void> {
    try {
      const cacheData: CachedWeather = {
        data: weather,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      console.error('Failed to cache weather');
    }
  }

  async clearWeatherCache(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WEATHER_CACHE_KEY);
    } catch {
      // non-blocking
    }
  }

  getOutfitRecommendation(
    weather: WeatherCondition,
    gender: string = 'unspecified',
    language?: string | null,
  ): WeatherOutfitRecommendation {
    const { temperature, condition, windSpeed, tempMin, tempMax } = weather;
    const peakTemp = tempMax ?? temperature;
    const lowTemp = tempMin ?? temperature;
    const tempSpread = peakTemp - lowTemp;
    const hasDailyRange = tempMin != null && tempMax != null;
    const lang = resolveContentLang(language);

    // Auth gender uses woman/man; older callers may pass female/male
    const normalizedGender =
      gender === 'woman' || gender === 'female'
        ? 'female'
        : gender === 'man' || gender === 'male'
          ? 'male'
          : gender;

    return buildLocalizedOutfitRecommendation({
      peakTemp,
      lowTemp,
      tempSpread,
      hasDailyRange,
      condition,
      windSpeed,
      gender: normalizedGender,
      lang,
    });
  }

  /** Pick season for wardrobe matching using the warmer end of today's range. */
  getSeasonFromDailyRange(tempMin?: number, tempMax?: number, current?: number): 'spring' | 'summer' | 'autumn' | 'winter' {
    const peak = tempMax ?? current ?? 18;
    if (peak >= 25) return 'summer';
    if (peak >= 18) return 'spring';
    if (peak >= 10) return 'autumn';
    return 'winter';
  }

  getSeasonFromTemperature(temp: number): 'spring' | 'summer' | 'autumn' | 'winter' {
    if (temp >= 25) return 'summer';
    if (temp >= 15) return 'spring';
    if (temp >= 5) return 'autumn';
    return 'winter';
  }
}

export const weatherService = new WeatherService();
export default weatherService;
