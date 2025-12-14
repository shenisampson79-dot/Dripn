/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Virtual Try-On feature using IDM-VTON via Replicate.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInUp, FadeIn, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { virtualTryOnService } from '@/services/VirtualTryOnService';
import type { DiscoverStackParamList } from '@/navigation/DiscoverStackNavigator';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type VirtualTryOnScreenProps = {
  navigation: NativeStackNavigationProp<DiscoverStackParamList, 'VirtualTryOn'>;
  route: RouteProp<DiscoverStackParamList, 'VirtualTryOn'>;
};

type TryOnStep = 'upload_body' | 'select_garment' | 'processing' | 'result';

export default function VirtualTryOnScreen({ navigation, route }: VirtualTryOnScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { tier, limits } = useSubscription();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<TryOnStep>('upload_body');
  const [bodyImageUri, setBodyImageUri] = useState<string | null>(null);
  const [garmentImageUrl, setGarmentImageUrl] = useState<string | null>(route.params?.garmentImageUrl || null);
  const [garmentDescription, setGarmentDescription] = useState<string>(route.params?.garmentDescription || '');
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  useEffect(() => {
    fetchUsage();
    if (route.params?.garmentImageUrl) {
      setGarmentImageUrl(route.params.garmentImageUrl);
      setGarmentDescription(route.params.garmentDescription || '');
    }
  }, [route.params]);

  const fetchUsage = async () => {
    const usage = await virtualTryOnService.checkUsage();
    if (usage) {
      setUsageInfo({
        used: usage.used,
        limit: usage.limit === -1 ? Infinity : usage.limit,
        remaining: usage.remaining === -1 ? Infinity : usage.remaining,
      });
    }
  };

  const canTryOn = () => {
    if (limits.virtualTryOnPerMonth === 0) return false;
    if (limits.virtualTryOnPerMonth === Infinity) return true;
    if (usageInfo === null) return true;
    return usageInfo.remaining > 0;
  };

  const handleUploadBodyPhoto = async () => {
    if (!canTryOn()) {
      Alert.alert(
        'Upgrade Required',
        tier === 'free' 
          ? 'Virtual Try-On is available for Basic subscribers and above. Upgrade to try on clothes virtually!'
          : 'You have used all your virtual try-ons this month. Upgrade for more!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('Subscription' as any) },
        ]
      );
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBodyImageUri(result.assets[0].uri);
        if (garmentImageUrl) {
          setStep('select_garment');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    if (!canTryOn()) {
      Alert.alert('Upgrade Required', 'Virtual Try-On requires a Basic subscription or higher.');
      return;
    }

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to take a photo.');
        return;
      }
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBodyImageUri(result.assets[0].uri);
        if (garmentImageUrl) {
          setStep('select_garment');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSelectGarment = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setGarmentImageUrl(result.assets[0].uri);
        setGarmentDescription('A fashionable garment');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select garment. Please try again.');
    }
  };

  const handleGenerateTryOn = async () => {
    if (!bodyImageUri || !garmentImageUrl) {
      Alert.alert('Missing Images', 'Please upload both a body photo and a garment image.');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setStep('processing');
    setIsLoading(true);
    setProcessingProgress(0);

    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 1000);

    try {
      const response = await virtualTryOnService.generateTryOn(
        {
          humanImageUri: bodyImageUri,
          garmentImageUrl: garmentImageUrl,
          garmentDescription: garmentDescription || 'A fashionable garment',
        },
      );

      clearInterval(progressInterval);
      setProcessingProgress(100);

      if (response.success && response.resultImageUrl) {
        setResultImageUrl(response.resultImageUrl);
        setStep('result');
        fetchUsage();
      } else {
        Alert.alert('Error', response.error || 'Failed to generate try-on image. Please try again.');
        setStep('select_garment');
      }
    } catch (error) {
      clearInterval(progressInterval);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setStep('select_garment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setStep('upload_body');
    setBodyImageUri(null);
    setGarmentImageUrl(route.params?.garmentImageUrl || null);
    setResultImageUrl(null);
    setProcessingProgress(0);
  };

  const renderUploadBodyStep = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.stepContainer}>
      <LinearGradient
        colors={[`${theme.link}15`, `${theme.link}05`]}
        style={[styles.uploadCard, { backgroundColor: theme.backgroundSecondary }]}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${theme.link}20` }]}>
          <Feather name="user" size={48} color={theme.link} />
        </View>

        <ThemedText style={styles.stepTitle}>Upload Your Photo</ThemedText>
        <ThemedText style={[styles.stepDescription, { color: theme.tabIconDefault }]}>
          Upload a full-body photo to see how clothes look on you
        </ThemedText>

        <View style={styles.buttonRow}>
          <Pressable
            onPress={handleTakePhoto}
            disabled={!canTryOn()}
            style={({ pressed }) => [
              styles.uploadButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : canTryOn() ? 1 : 0.5 },
            ]}
          >
            <Feather name="camera" size={20} color="#FFFFFF" />
            <ThemedText style={styles.uploadButtonText}>Take Photo</ThemedText>
          </Pressable>

          <Pressable
            onPress={handleUploadBodyPhoto}
            disabled={!canTryOn()}
            style={({ pressed }) => [
              styles.uploadButton,
              { backgroundColor: theme.backgroundTertiary, opacity: pressed ? 0.8 : canTryOn() ? 1 : 0.5 },
            ]}
          >
            <Feather name="image" size={20} color={theme.text} />
            <ThemedText style={[styles.uploadButtonText, { color: theme.text }]}>Gallery</ThemedText>
          </Pressable>
        </View>

        {bodyImageUri ? (
          <Animated.View entering={FadeInUp.duration(300)} style={styles.previewContainer}>
            <Image source={{ uri: bodyImageUri }} style={styles.previewImage} />
            <View style={[styles.checkBadge, { backgroundColor: theme.success }]}>
              <Feather name="check" size={16} color="#FFFFFF" />
            </View>
          </Animated.View>
        ) : null}
      </LinearGradient>

      {usageInfo && limits.virtualTryOnPerMonth !== Infinity ? (
        <Animated.View 
          entering={FadeInUp.delay(200)}
          style={[styles.usageBanner, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="info" size={16} color={theme.tabIconDefault} />
          <ThemedText style={[styles.usageText, { color: theme.tabIconDefault }]}>
            {usageInfo.remaining > 0
              ? `${usageInfo.remaining} virtual ${usageInfo.remaining === 1 ? 'try-on' : 'try-ons'} remaining`
              : 'No try-ons remaining this month'}
          </ThemedText>
        </Animated.View>
      ) : null}

      <View style={styles.tipsSection}>
        <ThemedText style={[styles.tipsTitle, { color: theme.tabIconDefault }]}>Tips for Best Results</ThemedText>
        {[
          { icon: 'user', text: 'Full body visible from head to toe' },
          { icon: 'sun', text: 'Good lighting, plain background' },
          { icon: 'maximize-2', text: 'Stand straight facing the camera' },
        ].map((tip, index) => (
          <View key={index} style={styles.tipItem}>
            <View style={[styles.tipIcon, { backgroundColor: `${theme.link}15` }]}>
              <Feather name={tip.icon as any} size={14} color={theme.link} />
            </View>
            <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>{tip.text}</ThemedText>
          </View>
        ))}
      </View>

      {bodyImageUri && garmentImageUrl ? (
        <Pressable
          onPress={() => setStep('select_garment')}
          style={[styles.continueButton, { backgroundColor: theme.link }]}
        >
          <ThemedText style={styles.continueButtonText}>Continue</ThemedText>
          <Feather name="arrow-right" size={20} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </Animated.View>
  );

  const renderSelectGarmentStep = () => (
    <Animated.View entering={SlideInRight.duration(400)} style={styles.stepContainer}>
      <View style={styles.imagesRow}>
        <View style={styles.imageColumn}>
          <ThemedText style={styles.imageLabel}>Your Photo</ThemedText>
          {bodyImageUri ? (
            <Image source={{ uri: bodyImageUri }} style={styles.selectedImage} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
              <Feather name="user" size={32} color={theme.tabIconDefault} />
            </View>
          )}
          <Pressable onPress={handleUploadBodyPhoto} style={styles.changeButton}>
            <ThemedText style={[styles.changeButtonText, { color: theme.link }]}>Change</ThemedText>
          </Pressable>
        </View>

        <View style={styles.arrowContainer}>
          <Feather name="plus" size={24} color={theme.tabIconDefault} />
        </View>

        <View style={styles.imageColumn}>
          <ThemedText style={styles.imageLabel}>Garment</ThemedText>
          {garmentImageUrl ? (
            <Image source={{ uri: garmentImageUrl }} style={styles.selectedImage} />
          ) : (
            <Pressable 
              onPress={handleSelectGarment}
              style={[styles.imagePlaceholder, { backgroundColor: theme.backgroundTertiary }]}
            >
              <Feather name="plus" size={32} color={theme.link} />
              <ThemedText style={[styles.addText, { color: theme.link }]}>Add Garment</ThemedText>
            </Pressable>
          )}
          {garmentImageUrl ? (
            <Pressable onPress={handleSelectGarment} style={styles.changeButton}>
              <ThemedText style={[styles.changeButtonText, { color: theme.link }]}>Change</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>

      {bodyImageUri && garmentImageUrl ? (
        <Pressable
          onPress={handleGenerateTryOn}
          style={[styles.generateButton, { backgroundColor: theme.link }]}
        >
          <Feather name="zap" size={20} color="#FFFFFF" />
          <ThemedText style={styles.generateButtonText}>Try It On</ThemedText>
        </Pressable>
      ) : null}

      <Pressable onPress={handleReset} style={styles.resetButton}>
        <ThemedText style={[styles.resetButtonText, { color: theme.tabIconDefault }]}>Start Over</ThemedText>
      </Pressable>
    </Animated.View>
  );

  const renderProcessingStep = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.processingContainer}>
      <View style={[styles.processingCard, { backgroundColor: theme.backgroundSecondary }]}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText style={styles.processingTitle}>Creating Your Look</ThemedText>
        <ThemedText style={[styles.processingDescription, { color: theme.tabIconDefault }]}>
          Our AI is virtually trying on the garment for you. This may take up to 30 seconds...
        </ThemedText>
        
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { backgroundColor: theme.link, width: `${processingProgress}%` }
            ]} 
          />
        </View>
        <ThemedText style={[styles.progressText, { color: theme.tabIconDefault }]}>
          {Math.round(processingProgress)}%
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderResultStep = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.resultContainer}>
      <ThemedText style={styles.resultTitle}>Your Virtual Try-On</ThemedText>
      
      <View style={styles.comparisonContainer}>
        <View style={styles.comparisonColumn}>
          <ThemedText style={[styles.comparisonLabel, { color: theme.tabIconDefault }]}>Before</ThemedText>
          {bodyImageUri ? (
            <Image source={{ uri: bodyImageUri }} style={styles.comparisonImage} />
          ) : null}
        </View>
        
        <View style={styles.comparisonColumn}>
          <ThemedText style={[styles.comparisonLabel, { color: theme.tabIconDefault }]}>After</ThemedText>
          {resultImageUrl ? (
            <Image source={{ uri: resultImageUrl }} style={styles.comparisonImage} />
          ) : null}
        </View>
      </View>

      <View style={styles.resultActions}>
        <Pressable
          onPress={handleReset}
          style={[styles.actionButton, { backgroundColor: theme.backgroundTertiary }]}
        >
          <Feather name="refresh-cw" size={20} color={theme.text} />
          <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>Try Another</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      {step === 'upload_body' && renderUploadBodyStep()}
      {step === 'select_garment' && renderSelectGarmentStep()}
      {step === 'processing' && renderProcessingStep()}
      {step === 'result' && renderResultStep()}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  stepContainer: {
    gap: Spacing.lg,
  },
  uploadCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  stepTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  previewContainer: {
    marginTop: Spacing.lg,
    position: 'relative',
  },
  previewImage: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.lg,
  },
  checkBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  usageText: {
    fontSize: Typography.caption.fontSize,
    flex: 1,
  },
  tipsSection: {
    gap: Spacing.sm,
  },
  tipsTitle: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tipIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    fontSize: Typography.caption.fontSize,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  imagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  imageColumn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  imageLabel: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  selectedImage: {
    width: (SCREEN_WIDTH - Spacing.lg * 4) / 2.5,
    height: ((SCREEN_WIDTH - Spacing.lg * 4) / 2.5) * 1.33,
    borderRadius: BorderRadius.lg,
  },
  imagePlaceholder: {
    width: (SCREEN_WIDTH - Spacing.lg * 4) / 2.5,
    height: ((SCREEN_WIDTH - Spacing.lg * 4) / 2.5) * 1.33,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  addText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  changeButton: {
    padding: Spacing.xs,
  },
  changeButtonText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  arrowContainer: {
    padding: Spacing.sm,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  resetButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  resetButtonText: {
    fontSize: Typography.caption.fontSize,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  processingCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    width: '100%',
  },
  processingTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: Typography.h3.fontWeight,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  processingDescription: {
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.caption.fontSize,
    marginTop: Spacing.sm,
  },
  resultContainer: {
    gap: Spacing.lg,
  },
  resultTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    textAlign: 'center',
  },
  comparisonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  comparisonColumn: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  comparisonLabel: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  comparisonImage: {
    width: (SCREEN_WIDTH - Spacing.lg * 3) / 2,
    height: ((SCREEN_WIDTH - Spacing.lg * 3) / 2) * 1.33,
    borderRadius: BorderRadius.lg,
  },
  resultActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
});
