import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
  Image,
  FlatList,
  Alert,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  SlideInUp,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/ApiService';
import * as FileSystem from 'expo-file-system';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenInsets } from '@/hooks/useScreenInsets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SPACING = Spacing.sm;
const NUM_COLUMNS = 2;
const ITEM_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - GRID_SPACING) / NUM_COLUMNS;

const VISUAL_SEARCH_USAGE_KEY = '@dripn_visual_search_usage';

interface SimilarItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  store: string;
  category: string;
  matchPercentage: number;
  color: string;
}

interface SearchState {
  status: 'idle' | 'uploading' | 'analyzing' | 'results';
  selectedImage: string | null;
  results: SimilarItem[];
  analyzedCategory: string | null;
  analyzedColor: string | null;
}

export default function VisualSearchScreen() {
  const { theme } = useTheme();
  const { limits, tier } = useSubscription();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { paddingTop } = useScreenInsets();
  const navigation = useNavigation();
  
  const isPaidTier = tier === 'basic' || tier === 'premium' || tier === 'vip';

  const [searchState, setSearchState] = useState<SearchState>({
    status: 'idle',
    selectedImage: null,
    results: [],
    analyzedCategory: null,
    analyzedColor: null,
  });
  const [searchesThisMonth, setSearchesThisMonth] = useState(0);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const navigateToSubscription = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ProfileTab',
        params: {
          screen: 'Subscription',
        },
      })
    );
  }, [navigation]);

  useEffect(() => {
    loadSearchUsage();
  }, []);

  const loadSearchUsage = async () => {
    try {
      const data = await AsyncStorage.getItem(VISUAL_SEARCH_USAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (parsed.month === currentMonth) {
          setSearchesThisMonth(parsed.count);
        } else {
          await AsyncStorage.setItem(VISUAL_SEARCH_USAGE_KEY, JSON.stringify({ month: currentMonth, count: 0 }));
          setSearchesThisMonth(0);
        }
      }
    } catch (error) {
      console.error('Failed to load search usage:', error);
    }
  };

  const incrementSearchUsage = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const newCount = searchesThisMonth + 1;
      await AsyncStorage.setItem(VISUAL_SEARCH_USAGE_KEY, JSON.stringify({ month: currentMonth, count: newCount }));
      setSearchesThisMonth(newCount);
    } catch (error) {
      console.error('Failed to increment search usage:', error);
    }
  };

  const canSearch = () => {
    if (limits.visualSearchPerMonth === Infinity) return true;
    return searchesThisMonth < limits.visualSearchPerMonth;
  };

  const getRemainingSearches = () => {
    if (limits.visualSearchPerMonth === Infinity) return Infinity;
    return Math.max(0, limits.visualSearchPerMonth - searchesThisMonth);
  };

  const handleTakePhoto = async () => {
    if (!canSearch()) {
      Alert.alert(
        'Search Limit Reached',
        'You have used all your visual searches this month. Upgrade your plan for more searches.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: navigateToSubscription },
        ]
      );
      return;
    }

    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      if (cameraPermission.status === 'denied' && !cameraPermission.canAskAgain) {
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Camera Access Required',
            'Please enable camera access in your device settings to use visual search.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Open Settings', 
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.error('Failed to open settings:', error);
                  }
                }
              },
            ]
          );
        }
        return;
      }
      const result = await requestCameraPermission();
      if (!result.granted) {
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
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSelectFromGallery = async () => {
    if (!canSearch()) {
      Alert.alert(
        'Search Limit Reached',
        'You have used all your visual searches this month. Upgrade your plan for more searches.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: navigateToSubscription },
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
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        processImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Failed to select image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const processImage = async (imageUri: string) => {
    setSearchState({
      status: 'uploading',
      selectedImage: imageUri,
      results: [],
      analyzedCategory: null,
      analyzedColor: null,
    });

    await incrementSearchUsage();

    setSearchState(prev => ({
      ...prev,
      status: 'analyzing',
    }));

    try {
      let imageBase64: string | undefined;
      
      if (imageUri.startsWith('file://') || imageUri.startsWith('/')) {
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });
        imageBase64 = `data:image/jpeg;base64,${base64}`;
      }

      const response = await apiService.visualSearchMarketplace({
        imageBase64,
        imageUrl: imageBase64 ? undefined : imageUri,
      });

      if (response.success && response.results) {
        setSearchState({
          status: 'results',
          selectedImage: imageUri,
          results: response.results.map(item => ({
            id: item.id,
            name: item.name,
            brand: item.brand,
            price: item.price,
            originalPrice: item.originalPrice,
            imageUrl: item.imageUrl,
            store: item.store,
            category: item.category,
            matchPercentage: item.matchPercentage,
            color: item.color,
          })),
          analyzedCategory: response.analyzedCategory || null,
          analyzedColor: response.analyzedColor || null,
        });
      } else {
        Alert.alert('Search Failed', 'Could not find similar items. Please try again.');
        setSearchState({
          status: 'idle',
          selectedImage: null,
          results: [],
          analyzedCategory: null,
          analyzedColor: null,
        });
      }
    } catch (error: any) {
      console.error('Visual search error:', error);
      Alert.alert('Error', error.message || 'Failed to search. Please try again.');
      setSearchState({
        status: 'idle',
        selectedImage: null,
        results: [],
        analyzedCategory: null,
        analyzedColor: null,
      });
    }
  };

  const handleClearSearch = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSearchState({
      status: 'idle',
      selectedImage: null,
      results: [],
      analyzedCategory: null,
      analyzedColor: null,
    });
  };

  const handleItemPress = (item: SimilarItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      item.name,
      `${item.brand}\n${item.store}\n\nPrice: ${item.originalPrice ? `Was ${item.originalPrice.toFixed(2)} - ` : ''}Now ${item.price.toFixed(2)}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Try It On', onPress: () => handleTryItOn(item) },
        { text: 'Shop Now', onPress: () => {} },
      ]
    );
  };

  const handleTryItOn = (item: SimilarItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    (navigation as any).navigate('VirtualTryOn', {
      garmentImageUrl: item.imageUrl,
      garmentDescription: `${item.brand} ${item.name} - ${item.color} ${item.category}`,
    });
  };

  const remainingSearches = getRemainingSearches();

  const renderUploadSection = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.uploadContainer}>
      <View style={[styles.uploadCard, { backgroundColor: theme.backgroundSecondary }]}>
        <LinearGradient
          colors={[`${theme.link}15`, `${theme.link}05`]}
          style={styles.uploadGradient}
        >
          <View style={[styles.uploadIconContainer, { backgroundColor: `${theme.link}20` }]}>
            <Feather name="search" size={48} color={theme.link} />
          </View>
          
          <ThemedText style={styles.uploadTitle}>
            Visual Search
          </ThemedText>
          
          <ThemedText style={[styles.uploadDescription, { color: theme.tabIconDefault }]}>
            Upload or take a photo to find similar fashion items from top retailers
          </ThemedText>

          <View style={styles.uploadButtonsRow}>
            <Pressable
              onPress={handleTakePhoto}
              disabled={!canSearch()}
              style={({ pressed }) => [
                styles.uploadButton,
                { 
                  backgroundColor: theme.link,
                  opacity: pressed ? 0.8 : canSearch() ? 1 : 0.5,
                },
              ]}
            >
              <Feather name="camera" size={20} color="#FFFFFF" />
              <ThemedText style={styles.uploadButtonText}>
                Take Photo
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={handleSelectFromGallery}
              disabled={!canSearch()}
              style={({ pressed }) => [
                styles.uploadButton,
                styles.uploadButtonSecondary,
                { 
                  backgroundColor: theme.backgroundTertiary,
                  opacity: pressed ? 0.8 : canSearch() ? 1 : 0.5,
                },
              ]}
            >
              <Feather name="image" size={20} color={theme.text} />
              <ThemedText style={[styles.uploadButtonText, { color: theme.text }]}>
                Gallery
              </ThemedText>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.tipsContainer}>
        <ThemedText style={[styles.tipsTitle, { color: theme.tabIconDefault }]}>
          Tips for best results
        </ThemedText>
        <View style={styles.tipsList}>
          {[
            { icon: 'sun', text: 'Use good lighting' },
            { icon: 'maximize-2', text: 'Center the item' },
            { icon: 'layers', text: 'Plain background works best' },
          ].map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <View style={[styles.tipIcon, { backgroundColor: `${theme.link}15` }]}>
                <Feather name={tip.icon as keyof typeof Feather.glyphMap} size={14} color={theme.link} />
              </View>
              <ThemedText style={[styles.tipText, { color: theme.tabIconDefault }]}>
                {tip.text}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {remainingSearches !== Infinity ? (
        <Animated.View 
          entering={FadeInUp.delay(200)}
          style={[styles.limitBanner, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="info" size={16} color={theme.tabIconDefault} />
          <ThemedText style={[styles.limitText, { color: theme.tabIconDefault }]}>
            {remainingSearches > 0
              ? `${remainingSearches} visual ${remainingSearches === 1 ? 'search' : 'searches'} remaining this month`
              : 'No searches remaining this month'}
          </ThemedText>
          {remainingSearches === 0 ? (
            <Pressable onPress={navigateToSubscription}>
              <ThemedText style={[styles.upgradeLink, { color: theme.link }]}>
                Upgrade
              </ThemedText>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );

  const renderLoadingSection = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.loadingContainer}>
      {searchState.selectedImage ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: searchState.selectedImage }}
            style={[styles.previewImage, { borderColor: theme.border }]}
          />
          <View style={[styles.analyzingOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <ThemedText style={styles.analyzingText}>
              {searchState.status === 'uploading' ? 'Uploading...' : 'Analyzing style...'}
            </ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.loadingTextContainer}>
        <ThemedText style={[styles.loadingTitle, { color: theme.text }]}>
          {searchState.status === 'uploading' ? 'Processing Image' : 'Finding Similar Items'}
        </ThemedText>
        <ThemedText style={[styles.loadingSubtitle, { color: theme.tabIconDefault }]}>
          {searchState.status === 'uploading' 
            ? 'Preparing your image for analysis...'
            : 'Searching across thousands of fashion items...'}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const renderResultItem = ({ item, index }: { item: SimilarItem; index: number }) => (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={styles.resultItemWrapper}
    >
      <Pressable
        onPress={() => handleItemPress(item)}
        style={({ pressed }) => [
          styles.resultItem,
          { 
            backgroundColor: theme.backgroundSecondary,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.resultImage, { backgroundColor: theme.backgroundTertiary }]}
        />
        
        <View style={[styles.matchBadge, { backgroundColor: theme.success }]}>
          <ThemedText style={styles.matchText}>{item.matchPercentage}%</ThemedText>
        </View>

        <View style={styles.resultInfo}>
          <ThemedText style={styles.resultBrand} numberOfLines={1}>
            {item.brand}
          </ThemedText>
          <ThemedText style={[styles.resultName, { color: theme.tabIconDefault }]} numberOfLines={1}>
            {item.name}
          </ThemedText>
          <View style={styles.resultPriceRow}>
            <ThemedText style={[styles.resultPrice, { color: theme.link }]}>
              {item.price.toFixed(2)}
            </ThemedText>
            {item.originalPrice ? (
              <ThemedText style={[styles.resultOriginalPrice, { color: theme.tabIconDefault }]}>
                {item.originalPrice.toFixed(2)}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={[styles.resultStore, { color: theme.tabIconDefault }]} numberOfLines={1}>
            {item.store}
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );

  const renderResultsHeader = () => (
    <View style={styles.resultsHeader}>
      <View style={styles.previewSmallContainer}>
        {searchState.selectedImage ? (
          <Image
            source={{ uri: searchState.selectedImage }}
            style={[styles.previewSmall, { borderColor: theme.border }]}
          />
        ) : null}
        <View style={styles.previewInfo}>
          <ThemedText style={styles.previewLabel}>Your photo</ThemedText>
          {searchState.analyzedCategory ? (
            <View style={styles.analyzedTags}>
              <View style={[styles.analyzedTag, { backgroundColor: `${theme.link}20` }]}>
                <ThemedText style={[styles.analyzedTagText, { color: theme.link }]}>
                  {searchState.analyzedCategory}
                </ThemedText>
              </View>
              {searchState.analyzedColor ? (
                <View style={[styles.analyzedTag, { backgroundColor: `${theme.success}20` }]}>
                  <ThemedText style={[styles.analyzedTagText, { color: theme.success }]}>
                    {searchState.analyzedColor}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={handleClearSearch}
          style={[styles.clearButton, { backgroundColor: theme.backgroundTertiary }]}
        >
          <Feather name="x" size={18} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.resultsCountRow}>
        <ThemedText style={styles.resultsCount}>
          {searchState.results.length} similar items found
        </ThemedText>
        <ThemedText style={[styles.resultsSortLabel, { color: theme.tabIconDefault }]}>
          Sorted by match
        </ThemedText>
      </View>
    </View>
  );

  const renderResultsSection = () => (
    <FlatList
      data={searchState.results}
      renderItem={renderResultItem}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      ListHeaderComponent={renderResultsHeader}
      contentContainerStyle={[
        styles.resultsListContent,
        { paddingTop: paddingTop, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      columnWrapperStyle={styles.resultsRow}
      showsVerticalScrollIndicator={false}
    />
  );

  if (!isPaidTier) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View
          style={[
            styles.content,
            { 
              paddingTop: paddingTop,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <Card style={styles.premiumCard}>
            <View style={[styles.premiumIconContainer, { backgroundColor: `${theme.link}15` }]}>
              <Feather name="star" size={32} color={theme.link} />
            </View>
            <ThemedText style={styles.premiumTitle}>Subscription Required</ThemedText>
            <ThemedText style={[styles.premiumDescription, { color: theme.tabIconDefault }]}>
              Upgrade to Basic or above to unlock AI-powered visual search and find similar items from top retailers
            </ThemedText>
            <Pressable
              onPress={navigateToSubscription}
              style={({ pressed }) => [styles.premiumUpgradeButton, { opacity: pressed ? 0.8 : 1 }]}
            >
              <LinearGradient
                colors={['#4facfe', '#00f2fe']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.premiumUpgradeGradient}
              >
                <ThemedText style={styles.premiumUpgradeText}>Upgrade Now</ThemedText>
              </LinearGradient>
            </Pressable>
          </Card>
        </View>
      </View>
    );
  }

  if (searchState.status === 'results') {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        {renderResultsSection()}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View
        style={[
          styles.content,
          { 
            paddingTop: paddingTop,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        {searchState.status === 'idle' ? renderUploadSection() : renderLoadingSection()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  uploadContainer: {
    flex: 1,
  },
  uploadCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  uploadGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  uploadIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  uploadTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  uploadDescription: {
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  uploadButtonsRow: {
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
    minWidth: 140,
  },
  uploadButtonSecondary: {},
  uploadButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tipsContainer: {
    marginTop: Spacing.xl,
  },
  tipsTitle: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  tipsList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tipItem: {
    alignItems: 'center',
    flex: 1,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  tipText: {
    fontSize: Typography.caption.fontSize,
    textAlign: 'center',
  },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  limitText: {
    fontSize: Typography.small.fontSize,
    flex: 1,
  },
  upgradeLink: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    position: 'relative',
    marginBottom: Spacing.xl,
  },
  previewImage: {
    width: 200,
    height: 200,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
    marginTop: Spacing.md,
  },
  loadingTextContainer: {
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  loadingSubtitle: {
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
  },
  resultsListContent: {
    paddingHorizontal: Spacing.lg,
  },
  resultsHeader: {
    marginBottom: Spacing.lg,
  },
  previewSmallContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  previewSmall: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  previewInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  previewLabel: {
    fontSize: Typography.small.fontSize,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  analyzedTags: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  analyzedTag: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  analyzedTagText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '500',
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
  },
  resultsSortLabel: {
    fontSize: Typography.small.fontSize,
  },
  resultsRow: {
    justifyContent: 'space-between',
    marginBottom: GRID_SPACING,
  },
  resultItemWrapper: {
    width: ITEM_WIDTH,
  },
  resultItem: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: ITEM_WIDTH * 1.2,
  },
  matchBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  matchText: {
    color: '#FFFFFF',
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
  },
  resultInfo: {
    padding: Spacing.sm,
  },
  resultBrand: {
    fontSize: Typography.small.fontSize,
    fontWeight: '600',
  },
  resultName: {
    fontSize: Typography.caption.fontSize,
    marginTop: 2,
  },
  resultPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  resultPrice: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
  },
  resultOriginalPrice: {
    fontSize: Typography.small.fontSize,
    textDecorationLine: 'line-through',
  },
  resultStore: {
    fontSize: Typography.caption.fontSize,
    marginTop: 2,
  },
  premiumCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  premiumIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  premiumTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  premiumDescription: {
    fontSize: Typography.body.fontSize,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  premiumUpgradeButton: {
    width: '100%',
  },
  premiumUpgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  premiumUpgradeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
