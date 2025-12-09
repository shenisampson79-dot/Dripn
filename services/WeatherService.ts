/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Weather Service for outfit recommendations based on weather conditions
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEATHER_CACHE_KEY = '@dripn_weather_cache';
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
}

export interface WeatherOutfitRecommendation {
  layers: string[];
  keyPieces: string[];
  accessories: string[];
  colors: string[];
  fabricTips: string;
  stylingNote: string;
}

interface CachedWeather {
  data: WeatherCondition;
  timestamp: number;
}

class WeatherService {
  private apiKey: string | null = null;

  async getCurrentWeather(skipPermissionCheck: boolean = false): Promise<WeatherCondition | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        return null;
      }

      const cached = await this.getCachedWeather();
      if (cached) {
        return cached;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const weather = await this.fetchWeatherByCoords(
        location.coords.latitude,
        location.coords.longitude
      );

      if (weather) {
        await this.cacheWeather(weather);
      }

      return weather;
    } catch (error) {
      console.error('Failed to get weather:', error);
      return null;
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

  private async fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherCondition | null> {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
      );

      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data = await response.json();
      const current = data.current;

      const weatherCode = current.weather_code;
      const condition = this.mapWeatherCode(weatherCode);

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

  private getWeatherDescription(code: number): string {
    const descriptions: Record<number, string> = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };
    return descriptions[code] || 'Unknown';
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
      description: 'Partly cloudy',
      icon: 'cloud',
      windSpeed: 10,
      condition: 'cloudy',
      location: 'Unknown',
      timestamp: Date.now(),
    };
  }

  private async getCachedWeather(): Promise<WeatherCondition | null> {
    try {
      const cached = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
      if (cached) {
        const parsed: CachedWeather = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
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

  getOutfitRecommendation(weather: WeatherCondition, gender: string = 'unspecified'): WeatherOutfitRecommendation {
    const { temperature, condition, humidity, windSpeed } = weather;
    const isFemale = gender === 'female';
    const isMale = gender === 'male';

    let recommendation: WeatherOutfitRecommendation = {
      layers: [],
      keyPieces: [],
      accessories: [],
      colors: [],
      fabricTips: '',
      stylingNote: '',
    };

    if (temperature >= 25) {
      recommendation.layers = ['Single layer'];
      recommendation.keyPieces = isFemale 
        ? ['Linen dress', 'Flowy midi skirt', 'Cotton blouse', 'Breathable shorts']
        : ['Linen shirt', 'Cotton chinos', 'Breathable polo', 'Tailored shorts'];
      recommendation.accessories = ['Sunglasses', 'Wide-brim hat', 'Light scarf for AC'];
      recommendation.colors = ['White', 'Cream', 'Pastels', 'Light blue'];
      recommendation.fabricTips = 'Choose natural fabrics like linen and cotton for breathability';
      recommendation.stylingNote = 'Keep it light and airy. Opt for loose silhouettes that allow airflow.';
    } else if (temperature >= 18) {
      recommendation.layers = ['Light layer option'];
      recommendation.keyPieces = isFemale
        ? ['Midi dress with cardigan', 'High-waisted jeans', 'Light blazer', 'Flowy top']
        : ['Chinos with shirt', 'Light blazer', 'Knit polo', 'Cotton jacket'];
      recommendation.accessories = ['Light scarf', 'Sunglasses', 'Canvas bag'];
      recommendation.colors = ['Earth tones', 'Sage green', 'Dusty rose', 'Camel'];
      recommendation.fabricTips = 'Mix cotton with light knits for versatility';
      recommendation.stylingNote = 'Perfect layering weather. Bring a light jacket for temperature changes.';
    } else if (temperature >= 10) {
      recommendation.layers = ['Base + mid layer', 'Optional outer layer'];
      recommendation.keyPieces = isFemale
        ? ['Tailored coat', 'Knit sweater', 'Wool trousers', 'Midi skirt with boots']
        : ['Wool coat', 'Cable knit sweater', 'Chinos', 'Tailored jacket'];
      recommendation.accessories = ['Light scarf', 'Leather gloves', 'Structured bag'];
      recommendation.colors = ['Burgundy', 'Forest green', 'Chocolate brown', 'Navy'];
      recommendation.fabricTips = 'Wool and cashmere blends provide warmth without bulk';
      recommendation.stylingNote = 'Layer strategically. A quality coat elevates any outfit.';
    } else if (temperature >= 0) {
      recommendation.layers = ['Base layer', 'Insulating mid layer', 'Warm outer layer'];
      recommendation.keyPieces = isFemale
        ? ['Puffer jacket', 'Wool coat', 'Thermal leggings', 'Chunky knit sweater']
        : ['Puffer jacket', 'Wool overcoat', 'Thermal base layer', 'Heavy knit sweater'];
      recommendation.accessories = ['Beanie', 'Wool scarf', 'Leather gloves', 'Warm boots'];
      recommendation.colors = ['Black', 'Charcoal', 'Deep burgundy', 'Cream'];
      recommendation.fabricTips = 'Merino wool base layers trap heat while wicking moisture';
      recommendation.stylingNote = 'Invest in quality outerwear. Warmth and style are both essential.';
    } else {
      recommendation.layers = ['Thermal base', 'Heavy insulation', 'Waterproof outer'];
      recommendation.keyPieces = isFemale
        ? ['Long puffer coat', 'Fleece-lined trousers', 'Chunky turtleneck', 'Insulated boots']
        : ['Long parka', 'Fleece-lined pants', 'Heavy wool sweater', 'Insulated boots'];
      recommendation.accessories = ['Warm beanie', 'Cashmere scarf', 'Insulated gloves', 'Ear muffs'];
      recommendation.colors = ['Black', 'Deep navy', 'Burgundy', 'Cream accents'];
      recommendation.fabricTips = 'Technical fabrics and down insulation are your friends';
      recommendation.stylingNote = 'Prioritize warmth. You can still look chic with the right layering technique.';
    }

    if (condition === 'rainy' || condition === 'stormy') {
      recommendation.keyPieces.unshift('Waterproof jacket or trench');
      recommendation.accessories.push('Umbrella', 'Waterproof boots');
      recommendation.fabricTips += ' Choose water-resistant materials.';
      recommendation.stylingNote = 'A stylish rain jacket is essential. Consider Chelsea rain boots for chic protection.';
    }

    if (condition === 'snowy') {
      recommendation.accessories.push('Snow boots', 'Waterproof gloves');
      recommendation.stylingNote = 'Function meets fashion. Quality snow boots and a warm parka are non-negotiable.';
    }

    if (windSpeed > 20) {
      recommendation.accessories.push('Windproof scarf');
      recommendation.stylingNote += ' Secure loose items and opt for fitted silhouettes in wind.';
    }

    return recommendation;
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
