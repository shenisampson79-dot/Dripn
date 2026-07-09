/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Fashion Therapy system is proprietary to Dripn.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { apiService } from '@/services/ApiService';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { useTranslations } from "@/contexts/TranslationContext";

type FashionTherapyScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'FashionTherapy'>;
};

interface MoodOption {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  description: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { id: 'happy', label: 'Happy', icon: 'sun', color: '#F59E0B', description: 'Feeling joyful and energetic' },
  { id: 'confident', label: 'Confident', icon: 'star', color: '#10B981', description: 'Ready to conquer the world' },
  { id: 'calm', label: 'Calm', icon: 'feather', color: '#06B6D4', description: 'Peaceful and centered' },
  { id: 'anxious', label: 'Anxious', icon: 'cloud', color: '#8B5CF6', description: 'Feeling a bit overwhelmed' },
  { id: 'tired', label: 'Tired', icon: 'moon', color: '#6366F1', description: 'Low energy, need comfort' },
  { id: 'stressed', label: 'Stressed', icon: 'zap', color: '#EF4444', description: 'Under pressure' },
  { id: 'sad', label: 'Sad', icon: 'heart', color: '#EC4899', description: 'Need some self-care' },
  { id: 'motivated', label: 'Motivated', icon: 'trending-up', color: '#22C55E', description: 'Ready to take action' },
];

interface WellnessActivity {
  id: string;
  name: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
}

const WELLNESS_ACTIVITIES: WellnessActivity[] = [
  { id: 'yoga', name: 'Yoga', icon: 'activity', color: '#8B5CF6' },
  { id: 'meditation', name: 'Meditation', icon: 'eye', color: '#06B6D4' },
  { id: 'workout', name: 'Workout', icon: 'heart', color: '#EF4444' },
  { id: 'nature_walk', name: 'Nature Walk', icon: 'sun', color: '#10B981' },
  { id: 'self_care', name: 'Self Care', icon: 'smile', color: '#EC4899' },
  { id: 'journaling', name: 'Journaling', icon: 'book', color: '#F59E0B' },
];

export default function FashionTherapyScreen({ navigation }: FashionTherapyScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const { tier } = useSubscription();
  const insets = useSafeAreaInsets();
  
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyAffirmation, setDailyAffirmation] = useState<string | null>(null);
  const [moodOutfit, setMoodOutfit] = useState<any>(null);
  const [bodyPositivity, setBodyPositivity] = useState<any>(null);
  const [confidenceRitual, setConfidenceRitual] = useState<any>(null);
  const [wellnessOutfit, setWellnessOutfit] = useState<any>(null);
  const [capsuleWardrobe, setCapsuleWardrobe] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    fetchDailyAffirmation();
  }, []);

  const fetchDailyAffirmation = async () => {
    if (!apiService.isConfigured()) {
      setDailyAffirmation(null);
      return;
    }
    try {
      const data = await apiService.getLifestyleAffirmation();
      setDailyAffirmation(data.affirmation);
    } catch (error) {
      setDailyAffirmation(null);
    }
  };

  const handleMoodSelect = (moodId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedMood(moodId);
  };

  const handleActivitySelect = (activityId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectedActivity(activityId);
  };

  const fetchMoodOutfit = async () => {
    if (!selectedMood) {
      Alert.alert('Select a Mood', 'Please select how you are feeling first');
      return;
    }

    if (!apiService.isConfigured()) {
      Alert.alert('Not Available', 'Fashion therapy features require a backend connection. Please try again later.');
      return;
    }

    setIsLoading(true);
    setActiveSection('mood');

    try {
      const data = await apiService.getMoodOutfit({
        mood: selectedMood,
        gender: user?.gender || 'unspecified',
        style: user?.stylePreference || 'casual',
      });
      setMoodOutfit(data);
    } catch (error) {
      Alert.alert('Error', 'Unable to get outfit recommendation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBodyPositivity = async () => {
    if (!apiService.isConfigured()) {
      Alert.alert('Not Available', 'Fashion therapy features require a backend connection. Please try again later.');
      return;
    }

    setIsLoading(true);
    setActiveSection('bodyPositivity');

    try {
      const data = await apiService.getBodyPositivity({
        bodyType: user?.bodyShape || 'unspecified',
        concerns: [],
        gender: user?.gender || 'unspecified',
      });
      setBodyPositivity(data);
    } catch (error) {
      Alert.alert('Error', 'Unable to load content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfidenceRitual = async () => {
    if (!apiService.isConfigured()) {
      Alert.alert('Not Available', 'Fashion therapy features require a backend connection. Please try again later.');
      return;
    }

    setIsLoading(true);
    setActiveSection('confidence');

    try {
      const data = await apiService.getConfidenceRitual({
        occasion: 'daily',
        style: user?.stylePreference || 'classic',
        gender: user?.gender || 'unspecified',
      });
      setConfidenceRitual(data);
    } catch (error) {
      Alert.alert('Error', 'Unable to load ritual. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWellnessOutfit = async () => {
    if (!selectedActivity) {
      Alert.alert('Select an Activity', 'Please select a wellness activity first');
      return;
    }

    if (!apiService.isConfigured()) {
      Alert.alert('Not Available', 'Fashion therapy features require a backend connection. Please try again later.');
      return;
    }

    setIsLoading(true);
    setActiveSection('wellness');

    try {
      const data = await apiService.getWellnessOutfit({
        activity: selectedActivity,
        gender: user?.gender || 'unspecified',
        style: user?.stylePreference || 'athletic',
      });
      setWellnessOutfit(data);
    } catch (error) {
      Alert.alert('Error', 'Unable to get outfit recommendation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCapsuleWardrobe = async () => {
    if (!apiService.isConfigured()) {
      Alert.alert('Not Available', 'Fashion therapy features require a backend connection. Please try again later.');
      return;
    }

    setIsLoading(true);
    setActiveSection('capsule');

    try {
      const data = await apiService.getCapsuleWardrobe({
        lifestyle: 'professional',
        climate: 'temperate',
        gender: user?.gender || 'unspecified',
        style: user?.stylePreference || 'minimalist',
      });
      setCapsuleWardrobe(data);
    } catch (error) {
      Alert.alert('Error', 'Unable to load capsule wardrobe. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMoodResult = () => {
    if (!moodOutfit?.data) return null;
    const data = moodOutfit.data;
    
    return (
      <Animated.View entering={FadeInUp.duration(400)}>
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Feather name="check-circle" size={20} color={theme.link} />
            <ThemedText type="h3" style={styles.resultTitle}>
              Your Mood Outfit
            </ThemedText>
          </View>
          
          {data.moodAnalysis?.currentState ? (
            <ThemedText type="body" style={styles.resultText}>
              {data.moodAnalysis.currentState}
            </ThemedText>
          ) : null}
          
          {data.outfit?.overallEffect ? (
            <ThemedText type="body" style={[styles.resultText, { fontStyle: 'italic', marginTop: Spacing.sm }]}>
              "{data.outfit.overallEffect}"
            </ThemedText>
          ) : null}
          
          {data.outfit?.pieces?.map((piece: { item: string; reason: string }, index: number) => (
            <View key={index} style={styles.recommendationItem}>
              <Feather name="chevron-right" size={16} color={theme.link} />
              <ThemedText type="body" style={styles.recommendationText}>
                {piece.item}: {piece.reason}
              </ThemedText>
            </View>
          ))}
          
          {data.outfit?.colorPalette ? (
            <View style={styles.colorPaletteContainer}>
              <ThemedText type="caption" style={styles.colorLabel}>
                Suggested Colors:
              </ThemedText>
              <View style={styles.colorChips}>
                {data.outfit.colorPalette.map((color: string, index: number) => (
                  <View key={index} style={[styles.colorChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="small">{color}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          
          {data.selfCareTip ? (
            <View style={[styles.tipBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="info" size={14} color={theme.link} />
              <ThemedText type="caption" style={styles.tipText}>
                {data.selfCareTip}
              </ThemedText>
            </View>
          ) : null}
          
          {data.affirmation ? (
            <ThemedText type="body" style={[styles.ritualAffirmation, { color: theme.link, marginTop: Spacing.md }]}>
              "{data.affirmation}"
            </ThemedText>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderBodyPositivityResult = () => {
    if (!bodyPositivity?.data) return null;
    const data = bodyPositivity.data;
    
    return (
      <Animated.View entering={FadeInUp.duration(400)}>
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Feather name="heart" size={20} color="#EC4899" />
            <ThemedText type="h3" style={styles.resultTitle}>
              Body Positivity
            </ThemedText>
          </View>
          
          {data.affirmations?.length ? (
            <ThemedText type="body" style={[styles.resultText, styles.affirmationText]}>
              "{data.affirmations[0]}"
            </ThemedText>
          ) : null}
          
          {data.celebrateFeatures?.length ? (
            <>
              <ThemedText type="caption" style={styles.sectionLabel}>
                Celebrate Your Features:
              </ThemedText>
              {data.celebrateFeatures.map((item: { feature: string; howToStyle: string }, index: number) => (
                <View key={index} style={styles.tipItem}>
                  <Feather name="check" size={14} color="#10B981" />
                  <ThemedText type="body" style={styles.tipItemText}>
                    {item.feature}: {item.howToStyle}
                  </ThemedText>
                </View>
              ))}
            </>
          ) : null}
          
          {data.mindsetShift ? (
            <View style={[styles.celebrateBox, { backgroundColor: '#FDF2F8' }]}>
              <ThemedText type="caption" style={{ color: '#9D174D', marginBottom: Spacing.xs }}>
                Mindset Shift:
              </ThemedText>
              <ThemedText type="body" style={{ color: '#9D174D', textAlign: 'center' }}>
                {data.mindsetShift.newPerspective}
              </ThemedText>
            </View>
          ) : null}
          
          {data.dailyPractice ? (
            <View style={[styles.tipBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="sun" size={14} color={theme.link} />
              <ThemedText type="caption" style={styles.tipText}>
                Daily Practice: {data.dailyPractice}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderConfidenceRitualResult = () => {
    if (!confidenceRitual?.data) return null;
    const data = confidenceRitual.data;
    
    return (
      <Animated.View entering={FadeInUp.duration(400)}>
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Feather name="star" size={20} color="#F59E0B" />
            <ThemedText type="h3" style={styles.resultTitle}>
              Confidence Ritual
            </ThemedText>
          </View>
          
          {data.occasionAnalysis?.whatToExpect ? (
            <ThemedText type="body" style={styles.resultText}>
              {data.occasionAnalysis.whatToExpect}
            </ThemedText>
          ) : null}
          
          {data.powerOutfit?.pieces?.length ? (
            <>
              <ThemedText type="caption" style={styles.sectionLabel}>
                Power Outfit:
              </ThemedText>
              {data.powerOutfit.pieces.map((piece: { item: string; reason: string }, index: number) => (
                <View key={index} style={styles.stepItem}>
                  <View style={[styles.stepNumber, { backgroundColor: theme.link }]}>
                    <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText type="body" style={styles.stepText}>
                    {piece.item}: {piece.reason}
                  </ThemedText>
                </View>
              ))}
            </>
          ) : null}
          
          {data.powerPose ? (
            <View style={[styles.outfitElementBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="award" size={16} color={theme.link} />
              <ThemedText type="body" style={styles.outfitElementText}>
                Power Pose: {data.powerPose}
              </ThemedText>
            </View>
          ) : null}
          
          {data.mantra ? (
            <ThemedText type="body" style={[styles.ritualAffirmation, { color: theme.link }]}>
              "{data.mantra}"
            </ThemedText>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderWellnessResult = () => {
    if (!wellnessOutfit?.data) return null;
    const data = wellnessOutfit.data;
    
    return (
      <Animated.View entering={FadeInUp.duration(400)}>
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Feather name="activity" size={20} color="#10B981" />
            <ThemedText type="h3" style={styles.resultTitle}>
              Wellness Outfit
            </ThemedText>
          </View>
          
          {data.wellnessAssessment?.physicalNeeds ? (
            <ThemedText type="body" style={styles.resultText}>
              {data.wellnessAssessment.physicalNeeds}
            </ThemedText>
          ) : null}
          
          {data.outfit?.pieces?.map((piece: { item: string; wellnessBenefit: string }, index: number) => (
            <View key={index} style={styles.recommendationItem}>
              <Feather name="chevron-right" size={16} color={theme.link} />
              <ThemedText type="body" style={styles.recommendationText}>
                {piece.item}: {piece.wellnessBenefit}
              </ThemedText>
            </View>
          ))}
          
          {data.colorWellness ? (
            <View style={[styles.mindfulBox, { backgroundColor: '#ECFDF5' }]}>
              <Feather name="feather" size={14} color="#059669" />
              <ThemedText type="caption" style={{ color: '#065F46', flex: 1, marginLeft: Spacing.sm }}>
                {data.colorWellness}
              </ThemedText>
            </View>
          ) : null}
          
          {data.selfCareReminders?.length ? (
            <View style={[styles.tipBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="sun" size={14} color={theme.link} />
              <ThemedText type="caption" style={styles.tipText}>
                {data.selfCareReminders[0]}
              </ThemedText>
            </View>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  const renderCapsuleResult = () => {
    if (!capsuleWardrobe?.data) return null;
    const data = capsuleWardrobe.data;
    
    return (
      <Animated.View entering={FadeInUp.duration(400)}>
        <Card style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Feather name="grid" size={20} color="#6366F1" />
            <ThemedText type="h3" style={styles.resultTitle}>
              Your Capsule Wardrobe
            </ThemedText>
          </View>
          
          {data.capsulePlan?.targetSize ? (
            <ThemedText type="body" style={[styles.resultText, { fontStyle: 'italic' }]}>
              Target: {data.capsulePlan.targetSize} pieces
            </ThemedText>
          ) : null}
          
          {data.capsulePlan?.essentials?.map((category: { category: string; quantity: number; purpose: string }, index: number) => (
            <View key={index} style={styles.capsuleCategory}>
              <ThemedText type="caption" style={styles.capsuleCategoryLabel}>
                {category.category} ({category.quantity}):
              </ThemedText>
              <ThemedText type="small" style={{ marginLeft: Spacing.sm, opacity: 0.7 }}>
                {category.purpose}
              </ThemedText>
            </View>
          ))}
          
          {data.capsulePlan?.coreColors ? (
            <View style={styles.colorPaletteContainer}>
              <ThemedText type="caption" style={styles.colorLabel}>
                Core Colors:
              </ThemedText>
              <View style={styles.colorChips}>
                {data.capsulePlan.coreColors.map((color: string, index: number) => (
                  <View key={index} style={[styles.colorChip, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="small">{color}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          
          {data.outfitFormulas?.length ? (
            <View style={[styles.tipBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="info" size={14} color={theme.link} />
              <ThemedText type="caption" style={styles.tipText}>
                Outfit Formula: {data.outfitFormulas[0]}
              </ThemedText>
            </View>
          ) : null}
          
          {data.mindfulnessTask ? (
            <ThemedText type="body" style={[styles.ritualAffirmation, { color: theme.link, marginTop: Spacing.md }]}>
              Task: {data.mindfulnessTask}
            </ThemedText>
          ) : null}
        </Card>
      </Animated.View>
    );
  };

  return (
    <ScreenScrollView>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Fashion Therapy</ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      {dailyAffirmation ? (
        <Animated.View entering={FadeIn.duration(600)}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.affirmationCard}
          >
            <Feather name="sunrise" size={24} color="#FFFFFF" />
            <ThemedText type="caption" style={styles.affirmationLabel}>
              Daily Affirmation
            </ThemedText>
            <ThemedText type="body" style={styles.affirmationContent}>
              {dailyAffirmation}
            </ThemedText>
          </LinearGradient>
        </Animated.View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          How are you feeling?
        </ThemedText>
        <ThemedText type="caption" style={styles.sectionSubtitle}>
          Select your current mood for personalized outfit recommendations
        </ThemedText>
        
        <View style={styles.moodGrid}>
          {MOOD_OPTIONS.map((mood) => (
            <Pressable
              key={mood.id}
              onPress={() => handleMoodSelect(mood.id)}
              style={({ pressed }) => [
                styles.moodOption,
                {
                  backgroundColor: selectedMood === mood.id ? mood.color : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                  borderWidth: selectedMood === mood.id ? 0 : 1,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather
                name={mood.icon}
                size={24}
                color={selectedMood === mood.id ? '#FFFFFF' : mood.color}
              />
              <ThemedText
                type="small"
                style={{
                  color: selectedMood === mood.id ? '#FFFFFF' : theme.text,
                  fontWeight: selectedMood === mood.id ? '600' : '400',
                  marginTop: Spacing.xs,
                }}
              >
                {mood.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        
        <Pressable
          onPress={fetchMoodOutfit}
          disabled={isLoading && activeSection === 'mood'}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.link, opacity: pressed || (isLoading && activeSection === 'mood') ? 0.8 : 1 },
          ]}
        >
          {isLoading && activeSection === 'mood' ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="zap" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={styles.actionButtonText}>
                Get Mood-Based Outfit
              </ThemedText>
            </>
          )}
        </Pressable>
        
        {renderMoodResult()}
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Body Positivity
        </ThemedText>
        <ThemedText type="caption" style={styles.sectionSubtitle}>
          Embrace your unique beauty with personalized styling affirmations
        </ThemedText>
        
        <Pressable
          onPress={fetchBodyPositivity}
          disabled={isLoading && activeSection === 'bodyPositivity'}
          style={({ pressed }) => [
            styles.featureCard,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed || (isLoading && activeSection === 'bodyPositivity') ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#FDF2F8' }]}>
            {isLoading && activeSection === 'bodyPositivity' ? (
              <ActivityIndicator color="#EC4899" size="small" />
            ) : (
              <Feather name="heart" size={24} color="#EC4899" />
            )}
          </View>
          <View style={styles.featureContent}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              Get Body Positive Styling Tips
            </ThemedText>
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              Personalized affirmations and styling advice
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
        </Pressable>
        
        {renderBodyPositivityResult()}
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Confidence Ritual
        </ThemedText>
        <ThemedText type="caption" style={styles.sectionSubtitle}>
          Build a daily dressing ritual that boosts your confidence
        </ThemedText>
        
        <Pressable
          onPress={fetchConfidenceRitual}
          disabled={isLoading && activeSection === 'confidence'}
          style={({ pressed }) => [
            styles.featureCard,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed || (isLoading && activeSection === 'confidence') ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#FEF3C7' }]}>
            {isLoading && activeSection === 'confidence' ? (
              <ActivityIndicator color="#F59E0B" size="small" />
            ) : (
              <Feather name="star" size={24} color="#F59E0B" />
            )}
          </View>
          <View style={styles.featureContent}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              Create My Confidence Ritual
            </ThemedText>
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              A personalized morning dressing routine
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
        </Pressable>
        
        {renderConfidenceRitualResult()}
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Wellness Wardrobe
        </ThemedText>
        <ThemedText type="caption" style={styles.sectionSubtitle}>
          What wellness activity are you planning?
        </ThemedText>
        
        <View style={styles.activityGrid}>
          {WELLNESS_ACTIVITIES.map((activity) => (
            <Pressable
              key={activity.id}
              onPress={() => handleActivitySelect(activity.id)}
              style={({ pressed }) => [
                styles.activityOption,
                {
                  backgroundColor: selectedActivity === activity.id ? activity.color : theme.backgroundDefault,
                  opacity: pressed ? 0.8 : 1,
                  borderWidth: selectedActivity === activity.id ? 0 : 1,
                  borderColor: theme.border,
                },
              ]}
            >
              <Feather
                name={activity.icon}
                size={20}
                color={selectedActivity === activity.id ? '#FFFFFF' : activity.color}
              />
              <ThemedText
                type="small"
                style={{
                  color: selectedActivity === activity.id ? '#FFFFFF' : theme.text,
                  fontWeight: selectedActivity === activity.id ? '600' : '400',
                  marginTop: Spacing.xs,
                  textAlign: 'center',
                }}
              >
                {activity.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        
        <Pressable
          onPress={fetchWellnessOutfit}
          disabled={isLoading && activeSection === 'wellness'}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: '#10B981', opacity: pressed || (isLoading && activeSection === 'wellness') ? 0.8 : 1 },
          ]}
        >
          {isLoading && activeSection === 'wellness' ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Feather name="activity" size={18} color="#FFFFFF" />
              <ThemedText type="body" style={styles.actionButtonText}>
                Get Wellness Outfit
              </ThemedText>
            </>
          )}
        </Pressable>
        
        {renderWellnessResult()}
      </View>

      <View style={styles.section}>
        <ThemedText type="h3" style={styles.sectionTitle}>
          Capsule Wardrobe
        </ThemedText>
        <ThemedText type="caption" style={styles.sectionSubtitle}>
          Build a minimalist wardrobe that works for your lifestyle
        </ThemedText>
        
        <Pressable
          onPress={fetchCapsuleWardrobe}
          disabled={isLoading && activeSection === 'capsule'}
          style={({ pressed }) => [
            styles.featureCard,
            {
              backgroundColor: theme.backgroundDefault,
              opacity: pressed || (isLoading && activeSection === 'capsule') ? 0.8 : 1,
            },
          ]}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#EEF2FF' }]}>
            {isLoading && activeSection === 'capsule' ? (
              <ActivityIndicator color="#6366F1" size="small" />
            ) : (
              <Feather name="grid" size={24} color="#6366F1" />
            )}
          </View>
          <View style={styles.featureContent}>
            <ThemedText type="body" style={{ fontWeight: '600' }}>
              Plan My Capsule Wardrobe
            </ThemedText>
            <ThemedText type="caption" style={{ opacity: 0.7 }}>
              Essential pieces for a versatile wardrobe
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
        </Pressable>
        
        {renderCapsuleResult()}
      </View>

      <View style={{ height: Spacing.xl }} />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  affirmationCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius['2xl'],
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  affirmationLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  affirmationContent: {
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 24,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    opacity: 0.7,
    marginBottom: Spacing.lg,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  moodOption: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  activityOption: {
    width: '31%',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: {
    marginTop: Spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  resultTitle: {
    flex: 1,
  },
  resultText: {
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  recommendationText: {
    flex: 1,
    lineHeight: 22,
  },
  colorPaletteContainer: {
    marginTop: Spacing.md,
  },
  colorLabel: {
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  colorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  colorChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
  sectionLabel: {
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipItemText: {
    flex: 1,
    lineHeight: 22,
  },
  celebrateBox: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    lineHeight: 22,
  },
  outfitElementBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  outfitElementText: {
    flex: 1,
    lineHeight: 22,
  },
  ritualAffirmation: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: Spacing.lg,
    lineHeight: 24,
  },
  mindfulBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  capsuleCategory: {
    marginBottom: Spacing.md,
  },
  capsuleCategoryLabel: {
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  capsuleItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  capsuleItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  affirmationText: {
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
