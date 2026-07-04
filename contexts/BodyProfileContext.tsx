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
import { getBestAvailableModel, preloadModelAvailability } from '@/services/ModelSelectionService';
import { API_URL } from '@/config/api';

const BODY_PROFILE_STORAGE_KEY = '@dripn_body_profile';

const getDefaultHexForDepth = (depth?: string): string => {
  const depthColors: Record<string, string> = {
    'very-fair': '#F5E6D3',
    'fair': '#E8D4C4',
    'light-medium': '#D4B896',
    'medium': '#C4A574',
    'medium-deep': '#A67C52',
    'deep': '#8B5A2B',
    'very-deep': '#5C4033',
  };
  return depthColors[depth || 'medium'] || '#B8A090';
};

const parseBestMetals = (metals: string): 'gold' | 'silver' | 'rose-gold' | 'mixed' => {
  const metalStr = (metals || '').toLowerCase();
  if (metalStr.includes('gold') && metalStr.includes('silver')) return 'mixed';
  if (metalStr.includes('rose')) return 'rose-gold';
  if (metalStr.includes('silver')) return 'silver';
  return 'gold';
};

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

export type SkinToneDepth = 'very-fair' | 'fair' | 'light-medium' | 'medium' | 'medium-deep' | 'deep' | 'very-deep';
export type SkinUndertone = 'warm' | 'cool' | 'neutral' | 'olive';

export interface SkinToneData {
  name: string;
  depth: SkinToneDepth;
  undertone: SkinUndertone;
  hexApproximation: string;
  description: string;
  complementaryColors: string[];
  analyzedAt: string;
}

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
  skinTone: SkinToneData;
  skinUndertone: 'warm' | 'cool' | 'neutral' | 'olive';
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
  
  skinTone?: SkinToneData;
  
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
  hasSkinToneAnalysis: boolean;
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
  const hasSkinToneAnalysis = bodyProfile?.skinTone !== undefined;
  const hasStylingGuide = bodyProfile?.stylingGuide !== undefined;

  useEffect(() => {
    loadBodyProfile();
    const apiKey = '';
    if (apiKey) {
      preloadModelAvailability(apiKey).catch(console.warn);
    }
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
        skinTone: profileData.skinTone || bodyProfile?.skinTone,
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
      const apiUrl = API_URL;
      const token = await AsyncStorage.getItem('@dripn_token');

      const response = await fetch(`${apiUrl}/api/onboarding/body-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64: imageBase64,
          autoSave: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const result: BodyScanResult = {
        success: true,
        measurements: data.measurements || {},
        bodyShape: data.bodyShape || 'unknown',
        heightCategory: data.heightCategory || 'average',
        buildCategory: data.buildCategory || 'average',
        proportions: data.proportions || {
          shoulderToHipRatio: 1,
          waistToHipRatio: 0.75,
          bustToWaistRatio: 1.2,
          torsoToLegRatio: 0.9,
        },
        confidence: data.confidence || 0,
        recommendations: data.recommendations || [],
        fitAdvice: data.fitAdvice || [],
      };

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
          aiModel: 'gpt-5.4',
        },
      });

      return result;
    } catch (err) {
      console.error('Body scan failed:', err);
      
      // Check if this is their first time doing a body scan (skipped during onboarding)
      const isFirstTime = bodyProfile?.bodyShape === 'unknown' || !bodyProfile?.bodyShape;
      
      const errorMsg = isFirstTime
        ? 'Let\'s try that again! Make sure your full body is visible from head to toe, in good lighting, and wearing fitted clothes.'
        : 'The photo wasn\'t clear enough. Please try again with a full-body photo in good lighting.';
      
      setError(errorMsg);
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
        recommendations: isFirstTime 
          ? ['Try a full-body photo with head to toe visible', 'Good natural lighting helps us analyze better', 'Fitted clothes show your body shape more clearly']
          : [],
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
      const apiUrl = API_URL;
      const token = await AsyncStorage.getItem('@dripn_token');

      const response = await fetch(`${apiUrl}/api/onboarding/color-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64: selfieBase64,
          autoSave: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const now = new Date().toISOString();
      
      const colorSeasonData: ColorSeasonData = {
        season: data.colorSeasonType?.toLowerCase() || 'autumn',
        subtype: data.seasonSubtype?.toLowerCase(),
        bestColors: data.colorPalette?.powerColors || [],
        avoidColors: data.colorPalette?.avoidColors || [],
        metallic: parseBestMetals(data.seasonAnalysis?.bestMetals || 'mixed'),
        confidence: data.confidence || 80,
        analyzedAt: now,
      };

      const hexRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/i;
      const rawHex = data.skinTone?.hexApproximation;
      const validHex = rawHex && hexRegex.test(rawHex) ? rawHex : getDefaultHexForDepth(data.skinTone?.depth);

      const skinToneData: SkinToneData = {
        name: data.skinTone?.name || 'Beautiful Natural',
        depth: data.skinTone?.depth || 'medium',
        undertone: data.skinTone?.undertone || data.skinUndertone || 'neutral',
        hexApproximation: validHex,
        description: data.skinTone?.description || 'Your unique and beautiful skin tone.',
        complementaryColors: data.skinTone?.complementaryColors || data.colorPalette?.powerColors?.slice(0, 4) || [],
        analyzedAt: now,
      };

      await saveBodyProfile({ colorSeason: colorSeasonData, skinTone: skinToneData });

      return {
        success: true,
        colorSeason: colorSeasonData,
        skinTone: skinToneData,
        skinUndertone: data.skinUndertone || data.skinTone?.undertone || 'neutral',
        eyeColor: data.eyeColor,
        hairColor: data.hairColor,
        recommendations: data.personalizedTips || [],
      };
    } catch (err) {
      console.error('Color analysis failed:', err);
      
      // Check if this is their first time doing color analysis (skipped during onboarding)
      const isFirstTime = !bodyProfile?.colorSeason;
      
      const errorMsg = isFirstTime 
        ? 'Let\'s try that again! Make sure the lighting is clear and your face, hair, and natural skin tone are visible in the photo.'
        : 'The image wasn\'t clear enough. Please try again with a well-lit selfie showing your face, natural hair, and skin.';
      
      setError(errorMsg);
      const now = new Date().toISOString();
      return {
        success: false,
        colorSeason: {
          season: 'autumn',
          bestColors: [],
          avoidColors: [],
          metallic: 'mixed',
          confidence: 0,
          analyzedAt: now,
        },
        skinTone: {
          name: 'Analysis Pending',
          depth: 'medium',
          undertone: 'neutral',
          hexApproximation: '#A0A0A0',
          description: isFirstTime 
            ? 'Ready to discover your perfect colors? A clear selfie helps us analyze your natural skin tone and find your seasonal color palette.'
            : 'We could not analyze your skin tone. Please try again with a well-lit photo showing your natural skin.',
          complementaryColors: [],
          analyzedAt: now,
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

    const apiKey = '';
    const bestModel = await getBestAvailableModel('text', apiKey, 'gpt-5.4');
    console.log(`Using text model: ${bestModel} for styling guide`);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: bestModel,
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
    hasSkinToneAnalysis,
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
