/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 * 
 * Body Profile Context - Stores body measurements and body type data
 * Supports both manual input and AI-powered body scanning
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

const BODY_PROFILE_STORAGE_KEY = '@dripn_body_profile';

export type BodyShape = 
  | 'hourglass'
  | 'pear'
  | 'apple'
  | 'rectangle'
  | 'inverted-triangle'
  | 'athletic'
  | 'petite'
  | 'plus-size'
  | 'tall'
  | 'unknown';

export type HeightCategory = 'petite' | 'average' | 'tall' | 'very-tall';
export type BuildCategory = 'slim' | 'average' | 'athletic' | 'curvy' | 'plus';

export interface BodyMeasurements {
  neck?: number;
  shoulders?: number;
  bust?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  inseam?: number;
  height?: number;
  armLength?: number;
  torsoLength?: number;
}

export type ColorSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type ColorSubtype = 'light' | 'true' | 'deep' | 'warm' | 'cool' | 'soft' | 'clear' | 'bright';
export type MetallicType = 'gold' | 'silver' | 'rose-gold' | 'mixed';

export interface ColorSeasonData {
  season: ColorSeason;
  subtype?: ColorSubtype;
  bestColors: string[];
  avoidColors: string[];
  metallic: MetallicType;
  confidence: number;
  analyzedAt: string;
}

export interface StylingGuideData {
  bodyShape: string;
  bestSilhouettes: string[];
  idealNecklines: string[];
  recommendedPants: string[];
  skirtStyles: string[];
  dressStyles: string[];
  avoidStyles: string[];
  proportionTips: string[];
  accessoryTips: string[];
  generatedAt: string;
}

export interface ColorAnalysisResult {
  success: boolean;
  colorSeason: ColorSeasonData;
  skinUndertone: 'warm' | 'cool' | 'neutral';
  eyeColor: string;
  hairColor: string;
  recommendations: string[];
}

export interface StylingGuideResult {
  success: boolean;
  guide: StylingGuideData;
}

export interface BodyProfile {
  id: string;
  userId: string;
  
  measurements: BodyMeasurements;
  
  bodyShape: BodyShape;
  heightCategory: HeightCategory;
  buildCategory: BuildCategory;
  
  proportions: {
    shoulderToHipRatio: number;
    waistToHipRatio: number;
    bustToWaistRatio: number;
    torsoToLegRatio: number;
  };
  
  fitPreferences: {
    preferredFit: 'tight' | 'fitted' | 'relaxed' | 'oversized';
    problemAreas: string[];
    highlightAreas: string[];
  };
  
  scanData?: {
    imageUri: string;
    scannedAt: string;
    confidence: number;
    aiModel: string;
  };
  
  colorSeason?: ColorSeasonData;
  
  stylingGuide?: StylingGuideData;
  
  isManualEntry: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BodyScanResult {
  success: boolean;
  measurements: BodyMeasurements;
  bodyShape: BodyShape;
  heightCategory: HeightCategory;
  buildCategory: BuildCategory;
  proportions: {
    shoulderToHipRatio: number;
    waistToHipRatio: number;
    bustToWaistRatio: number;
    torsoToLegRatio: number;
  };
  confidence: number;
  recommendations: string[];
  fitAdvice: string[];
}

interface BodyProfileContextType {
  bodyProfile: BodyProfile | null;
  isLoading: boolean;
  isScanning: boolean;
  isAnalyzingColor: boolean;
  isGeneratingStylingGuide: boolean;
  hasBodyProfile: boolean;
  hasColorAnalysis: boolean;
  hasStylingGuide: boolean;
  error: string | null;
  
  saveBodyProfile: (profile: Partial<BodyProfile>) => Promise<void>;
  updateMeasurements: (measurements: Partial<BodyMeasurements>) => Promise<void>;
  scanBody: (imageBase64: string) => Promise<BodyScanResult>;
  analyzeColorSeason: (selfieBase64: string) => Promise<ColorAnalysisResult>;
  generateStylingGuide: () => Promise<StylingGuideResult>;
  clearBodyProfile: () => Promise<void>;
  getBodyMatchScore: (otherProfile: BodyProfile) => number;
}

const BodyProfileContext = createContext<BodyProfileContextType | null>(null);

interface BodyProfileProviderProps {
  children: ReactNode;
}

export function BodyProfileProvider({ children }: BodyProfileProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzingColor, setIsAnalyzingColor] = useState(false);
  const [isGeneratingStylingGuide, setIsGeneratingStylingGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBodyProfile = bodyProfile !== null && (
    bodyProfile.bodyShape !== 'unknown' || 
    Object.keys(bodyProfile.measurements).length > 0
  );
  
  const hasColorAnalysis = bodyProfile?.colorSeason !== undefined;
  const hasStylingGuide = bodyProfile?.stylingGuide !== undefined;

  useEffect(() => {
    loadBodyProfile();
  }, [isAuthenticated, user?.id]);

  const loadBodyProfile = async () => {
    setIsLoading(true);
    try {
      const stored = await AsyncStorage.getItem(BODY_PROFILE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!user || parsed.userId === user.id) {
          setBodyProfile(parsed);
        }
      }
    } catch (err) {
      console.error('Failed to load body profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBodyProfile = useCallback(async (profileData: Partial<BodyProfile>) => {
    try {
      const now = new Date().toISOString();
      const newProfile: BodyProfile = {
        id: bodyProfile?.id || `body_${Date.now()}`,
        userId: user?.id || 'anonymous',
        measurements: profileData.measurements || bodyProfile?.measurements || {},
        bodyShape: profileData.bodyShape || bodyProfile?.bodyShape || 'unknown',
        heightCategory: profileData.heightCategory || bodyProfile?.heightCategory || 'average',
        buildCategory: profileData.buildCategory || bodyProfile?.buildCategory || 'average',
        proportions: profileData.proportions || bodyProfile?.proportions || {
          shoulderToHipRatio: 1,
          waistToHipRatio: 0.75,
          bustToWaistRatio: 1.2,
          torsoToLegRatio: 0.9,
        },
        fitPreferences: profileData.fitPreferences || bodyProfile?.fitPreferences || {
          preferredFit: 'fitted',
          problemAreas: [],
          highlightAreas: [],
        },
        scanData: profileData.scanData || bodyProfile?.scanData,
        colorSeason: profileData.colorSeason || bodyProfile?.colorSeason,
        stylingGuide: profileData.stylingGuide || bodyProfile?.stylingGuide,
        isManualEntry: profileData.isManualEntry ?? bodyProfile?.isManualEntry ?? true,
        createdAt: bodyProfile?.createdAt || now,
        updatedAt: now,
      };

      await AsyncStorage.setItem(BODY_PROFILE_STORAGE_KEY, JSON.stringify(newProfile));
      setBodyProfile(newProfile);
      setError(null);
    } catch (err) {
      console.error('Failed to save body profile:', err);
      setError('Failed to save body profile');
      throw err;
    }
  }, [bodyProfile, user]);

  const updateMeasurements = useCallback(async (measurements: Partial<BodyMeasurements>) => {
    const updatedMeasurements = {
      ...bodyProfile?.measurements,
      ...measurements,
    };
    await saveBodyProfile({ measurements: updatedMeasurements });
  }, [bodyProfile, saveBodyProfile]);

  const scanBody = useCallback(async (imageBase64: string): Promise<BodyScanResult> => {
    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an advanced AI body measurement analyzer for a fashion app. Your role is to analyze full-body photos and extract body proportions and measurements with high precision.

CRITICAL: You are analyzing body proportions for fashion fitting purposes, NOT for medical or health assessments.

Analyze the image and provide:
1. Estimated measurements in inches (be realistic based on visual proportions)
2. Body shape classification (hourglass, pear, apple, rectangle, inverted-triangle, athletic)
3. Height category (petite: <5'3", average: 5'3"-5'7", tall: 5'7"-5'11", very-tall: >5'11")
4. Build category (slim, average, athletic, curvy, plus)
5. Body proportions ratios
6. Fit recommendations

Be encouraging and body-positive. Focus on helping the user find clothes that fit and flatter.

Respond in this exact JSON format:
{
  "measurements": {
    "neck": <number or null>,
    "shoulders": <number or null>,
    "bust": <number or null>,
    "chest": <number or null>,
    "waist": <number or null>,
    "hips": <number or null>,
    "inseam": <number or null>,
    "height": <number or null>,
    "armLength": <number or null>,
    "torsoLength": <number or null>
  },
  "bodyShape": "<hourglass|pear|apple|rectangle|inverted-triangle|athletic>",
  "heightCategory": "<petite|average|tall|very-tall>",
  "buildCategory": "<slim|average|athletic|curvy|plus>",
  "proportions": {
    "shoulderToHipRatio": <number>,
    "waistToHipRatio": <number>,
    "bustToWaistRatio": <number>,
    "torsoToLegRatio": <number>
  },
  "confidence": <0-100>,
  "recommendations": ["<styling recommendation 1>", "<styling recommendation 2>", "<styling recommendation 3>"],
  "fitAdvice": ["<fit advice 1>", "<fit advice 2>"]
}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this full-body photo and provide body measurements and proportions for fashion fitting purposes. Focus on accuracy for clothing recommendations.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const result = JSON.parse(jsonMatch[0]) as BodyScanResult;
      result.success = true;

      await saveBodyProfile({
        measurements: result.measurements,
        bodyShape: result.bodyShape,
        heightCategory: result.heightCategory,
        buildCategory: result.buildCategory,
        proportions: result.proportions,
        isManualEntry: false,
        scanData: {
          imageUri: `scan_${Date.now()}`,
          scannedAt: new Date().toISOString(),
          confidence: result.confidence,
          aiModel: 'gpt-4o-vision',
        },
      });

      return result;
    } catch (err) {
      console.error('Body scan failed:', err);
      setError('Failed to analyze body. Please try again with a clearer photo.');
      return {
        success: false,
        measurements: {},
        bodyShape: 'unknown' as BodyShape,
        heightCategory: 'average',
        buildCategory: 'average',
        proportions: {
          shoulderToHipRatio: 1,
          waistToHipRatio: 0.75,
          bustToWaistRatio: 1.2,
          torsoToLegRatio: 0.9,
        },
        confidence: 0,
        recommendations: [],
        fitAdvice: [],
      };
    } finally {
      setIsScanning(false);
    }
  }, [saveBodyProfile]);

  const analyzeColorSeason = useCallback(async (selfieBase64: string): Promise<ColorAnalysisResult> => {
    setIsAnalyzingColor(true);
    setError(null);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are an expert color analyst for a fashion app. Analyze selfie photos to determine the person's seasonal color palette based on their natural coloring (skin undertone, eye color, hair color).

SEASONAL COLOR ANALYSIS GUIDE:
- SPRING: Warm undertone, clear/bright coloring. Light warm colors, coral, peach, warm greens.
- SUMMER: Cool undertone, soft/muted coloring. Soft cool colors, lavender, dusty rose, sage.
- AUTUMN: Warm undertone, deep/rich coloring. Earth tones, rust, olive, burnt orange.
- WINTER: Cool undertone, high contrast/clear coloring. Bold cool colors, jewel tones, black, white.

Each season has subtypes:
- Light: Lighter coloring within the season
- True/Pure: Classic representative of the season
- Deep: Darker coloring within the season
- Warm/Cool: Leaning more warm or cool
- Soft: Muted, gentle coloring
- Clear/Bright: High clarity, vivid coloring

Analyze the image and provide color recommendations. Be encouraging and helpful.

Respond in this exact JSON format:
{
  "season": "<spring|summer|autumn|winter>",
  "subtype": "<light|true|deep|warm|cool|soft|clear|bright>",
  "skinUndertone": "<warm|cool|neutral>",
  "eyeColor": "<descriptive eye color>",
  "hairColor": "<descriptive hair color>",
  "bestColors": ["<color 1>", "<color 2>", "<color 3>", "<color 4>", "<color 5>", "<color 6>"],
  "avoidColors": ["<color 1>", "<color 2>", "<color 3>"],
  "metallic": "<gold|silver|rose-gold|mixed>",
  "confidence": <0-100>,
  "recommendations": ["<styling tip 1>", "<styling tip 2>", "<styling tip 3>"]
}`
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Please analyze this selfie and determine my seasonal color palette. Focus on skin undertone, eye color, and natural hair color to recommend the most flattering colors for me.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${selfieBase64}`,
                    detail: 'high'
                  }
                }
              ]
            }
          ],
          max_tokens: 1200,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const colorSeasonData: ColorSeasonData = {
        season: parsed.season,
        subtype: parsed.subtype,
        bestColors: parsed.bestColors,
        avoidColors: parsed.avoidColors,
        metallic: parsed.metallic,
        confidence: parsed.confidence,
        analyzedAt: new Date().toISOString(),
      };

      await saveBodyProfile({ colorSeason: colorSeasonData });

      return {
        success: true,
        colorSeason: colorSeasonData,
        skinUndertone: parsed.skinUndertone,
        eyeColor: parsed.eyeColor,
        hairColor: parsed.hairColor,
        recommendations: parsed.recommendations,
      };
    } catch (err) {
      console.error('Color analysis failed:', err);
      setError('Failed to analyze colors. Please try again with a clearer selfie.');
      return {
        success: false,
        colorSeason: {
          season: 'autumn',
          bestColors: [],
          avoidColors: [],
          metallic: 'mixed',
          confidence: 0,
          analyzedAt: new Date().toISOString(),
        },
        skinUndertone: 'neutral',
        eyeColor: 'unknown',
        hairColor: 'unknown',
        recommendations: [],
      };
    } finally {
      setIsAnalyzingColor(false);
    }
  }, [saveBodyProfile]);

  const generateStylingGuide = useCallback(async (): Promise<StylingGuideResult> => {
    if (!bodyProfile || bodyProfile.bodyShape === 'unknown') {
      setError('Please complete a body scan first to generate styling tips.');
      return {
        success: false,
        guide: {
          bodyShape: 'unknown',
          bestSilhouettes: [],
          idealNecklines: [],
          recommendedPants: [],
          skirtStyles: [],
          dressStyles: [],
          avoidStyles: [],
          proportionTips: [],
          accessoryTips: [],
          generatedAt: new Date().toISOString(),
        },
      };
    }

    setIsGeneratingStylingGuide(true);
    setError(null);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: `You are a professional fashion stylist providing personalized styling advice based on body shape analysis. Your advice should be encouraging, body-positive, and practical.

Provide comprehensive styling recommendations tailored to the specific body shape, considering proportions and what silhouettes work best.

Be specific with recommendations - name actual styles, cuts, and shapes rather than vague suggestions.

Respond in this exact JSON format:
{
  "bestSilhouettes": ["<silhouette 1>", "<silhouette 2>", "<silhouette 3>"],
  "idealNecklines": ["<neckline 1>", "<neckline 2>", "<neckline 3>"],
  "recommendedPants": ["<pant style 1>", "<pant style 2>", "<pant style 3>"],
  "skirtStyles": ["<skirt 1>", "<skirt 2>", "<skirt 3>"],
  "dressStyles": ["<dress 1>", "<dress 2>", "<dress 3>"],
  "avoidStyles": ["<style to avoid 1>", "<style to avoid 2>"],
  "proportionTips": ["<proportion tip 1>", "<proportion tip 2>", "<proportion tip 3>"],
  "accessoryTips": ["<accessory tip 1>", "<accessory tip 2>"]
}`
            },
            {
              role: 'user',
              content: `Generate personalized styling recommendations for someone with:
- Body Shape: ${bodyProfile.bodyShape}
- Height Category: ${bodyProfile.heightCategory}
- Build: ${bodyProfile.buildCategory}
- Shoulder to Hip Ratio: ${bodyProfile.proportions?.shoulderToHipRatio || 1}
- Waist to Hip Ratio: ${bodyProfile.proportions?.waistToHipRatio || 0.75}
- Preferred Fit: ${bodyProfile.fitPreferences?.preferredFit || 'fitted'}

Please provide specific, actionable styling advice that flatters this body type.`
            }
          ],
          max_tokens: 1200,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      const stylingGuideData: StylingGuideData = {
        bodyShape: bodyProfile.bodyShape,
        bestSilhouettes: parsed.bestSilhouettes,
        idealNecklines: parsed.idealNecklines,
        recommendedPants: parsed.recommendedPants,
        skirtStyles: parsed.skirtStyles,
        dressStyles: parsed.dressStyles,
        avoidStyles: parsed.avoidStyles,
        proportionTips: parsed.proportionTips,
        accessoryTips: parsed.accessoryTips,
        generatedAt: new Date().toISOString(),
      };

      await saveBodyProfile({ stylingGuide: stylingGuideData });

      return {
        success: true,
        guide: stylingGuideData,
      };
    } catch (err) {
      console.error('Styling guide generation failed:', err);
      setError('Failed to generate styling guide. Please try again.');
      return {
        success: false,
        guide: {
          bodyShape: bodyProfile.bodyShape,
          bestSilhouettes: [],
          idealNecklines: [],
          recommendedPants: [],
          skirtStyles: [],
          dressStyles: [],
          avoidStyles: [],
          proportionTips: [],
          accessoryTips: [],
          generatedAt: new Date().toISOString(),
        },
      };
    } finally {
      setIsGeneratingStylingGuide(false);
    }
  }, [bodyProfile, saveBodyProfile]);

  const clearBodyProfile = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(BODY_PROFILE_STORAGE_KEY);
      setBodyProfile(null);
      setError(null);
    } catch (err) {
      console.error('Failed to clear body profile:', err);
    }
  }, []);

  const getBodyMatchScore = useCallback((otherProfile: BodyProfile): number => {
    if (!bodyProfile || !otherProfile) return 0;

    let score = 0;
    let factors = 0;

    if (bodyProfile.bodyShape === otherProfile.bodyShape) {
      score += 30;
    } else {
      const shapeGroups = {
        curvy: ['hourglass', 'pear', 'apple'],
        straight: ['rectangle', 'athletic', 'inverted-triangle'],
        petitePlus: ['petite', 'plus-size'],
      };
      
      for (const group of Object.values(shapeGroups)) {
        if (group.includes(bodyProfile.bodyShape) && group.includes(otherProfile.bodyShape)) {
          score += 20;
          break;
        }
      }
    }
    factors++;

    if (bodyProfile.heightCategory === otherProfile.heightCategory) {
      score += 25;
    } else {
      const heightDiff = Math.abs(
        ['petite', 'average', 'tall', 'very-tall'].indexOf(bodyProfile.heightCategory) -
        ['petite', 'average', 'tall', 'very-tall'].indexOf(otherProfile.heightCategory)
      );
      score += Math.max(0, 25 - heightDiff * 10);
    }
    factors++;

    if (bodyProfile.buildCategory === otherProfile.buildCategory) {
      score += 25;
    } else {
      const buildDiff = Math.abs(
        ['slim', 'average', 'athletic', 'curvy', 'plus'].indexOf(bodyProfile.buildCategory) -
        ['slim', 'average', 'athletic', 'curvy', 'plus'].indexOf(otherProfile.buildCategory)
      );
      score += Math.max(0, 25 - buildDiff * 8);
    }
    factors++;

    if (bodyProfile.proportions && otherProfile.proportions) {
      const ratioSimilarity = 1 - Math.abs(
        bodyProfile.proportions.waistToHipRatio - otherProfile.proportions.waistToHipRatio
      );
      score += ratioSimilarity * 20;
      factors++;
    }

    return Math.min(100, Math.round(score));
  }, [bodyProfile]);

  const value: BodyProfileContextType = {
    bodyProfile,
    isLoading,
    isScanning,
    isAnalyzingColor,
    isGeneratingStylingGuide,
    hasBodyProfile,
    hasColorAnalysis,
    hasStylingGuide,
    error,
    saveBodyProfile,
    updateMeasurements,
    scanBody,
    analyzeColorSeason,
    generateStylingGuide,
    clearBodyProfile,
    getBodyMatchScore,
  };

  return (
    <BodyProfileContext.Provider value={value}>
      {children}
    </BodyProfileContext.Provider>
  );
}

export function useBodyProfile() {
  const context = useContext(BodyProfileContext);
  if (!context) {
    throw new Error('useBodyProfile must be used within a BodyProfileProvider');
  }
  return context;
}
