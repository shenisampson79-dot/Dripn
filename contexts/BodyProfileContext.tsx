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
  hasBodyProfile: boolean;
  error: string | null;
  
  saveBodyProfile: (profile: Partial<BodyProfile>) => Promise<void>;
  updateMeasurements: (measurements: Partial<BodyMeasurements>) => Promise<void>;
  scanBody: (imageBase64: string) => Promise<BodyScanResult>;
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
  const [error, setError] = useState<string | null>(null);

  const hasBodyProfile = bodyProfile !== null && (
    bodyProfile.bodyShape !== 'unknown' || 
    Object.keys(bodyProfile.measurements).length > 0
  );

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
    hasBodyProfile,
    error,
    saveBodyProfile,
    updateMeasurements,
    scanBody,
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
