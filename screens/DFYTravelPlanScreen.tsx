import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dfyService, type StylistId } from '@/services/DFYService';
import { weatherService } from '@/services/WeatherService';
import { generateLiteLookbook } from '@/utils/dfyOutfitImages';
import {
  defaultTravelPlan,
  destinationForDisplay,
  formatTravelLookbookTitle,
  isPlaceholderDestination,
  tripLengthDays,
  type TravelActivity,
  type TravelPlan,
  type TravelVibe,
} from '@/utils/travelCapsule';
import {
  addLocalDays,
  LOOKBOOK_DEFAULT_TOTAL_DAYS,
  formatLocalDateKey,
  startOfLocalDay,
} from '@/utils/lookbookTripDay';
import { DatePartsInput } from '@/components/DatePartsInput';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { FallbackShopSection, type FallbackMissingItem } from '@/components/stylist/FallbackShopSection';
import { BorderRadius, LuxuryColors, Spacing } from '@/constants/theme';
import { apiService } from '@/services/ApiService';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from '@/contexts/TranslationContext';
import { useWardrobe } from '@/contexts/WardrobeContext';
import { useTheme } from '@/hooks/useTheme';

type TravelPlanRouteParams = {
  DFYTravelPlan: { mode?: 'create' | 'edit'; tripId?: string } | undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<Record<string, object | undefined>>;
};

const VIBES: { id: TravelVibe; label: string }[] = [
  { id: 'casual', label: 'Casual' },
  { id: 'mixed', label: 'Mixed' },
  { id: 'dressy', label: 'Dressy' },
];

const ACTIVITIES: { id: TravelActivity; label: string }[] = [
  { id: 'explore', label: 'Exploring' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'beach', label: 'Beach' },
  { id: 'nightlife', label: 'Nightlife' },
];

function todayIso(): string {
  return formatLocalDateKey(startOfLocalDay());
}

function buildPlanFromForm(
  destination: string,
  startDate: string,
  endDate: string,
  tripDays: number,
  vibe: TravelVibe,
  activities: TravelActivity[],
  geo: { name?: string; lat?: number; lon?: number } | null,
  createdAt?: string,
  tripId?: string,
): TravelPlan {
  const dest = destination.trim();
  const resolvedName = geo?.name && !isPlaceholderDestination(geo.name) ? geo.name : dest;
  return defaultTravelPlan({
    destination: resolvedName,
    startDate,
    endDate,
    tripDays,
    vibe,
    activities: activities.length ? activities : ['explore'],
    lat: geo?.lat,
    lon: geo?.lon,
    createdAt,
    tripId,
  });
}

export default function DFYTravelPlanScreen({ navigation }: Props) {
  const route = useRoute<RouteProp<TravelPlanRouteParams, 'DFYTravelPlan'>>();
  const isEditMode = route.params?.mode === 'edit';
  const routeTripId = route.params?.tripId;
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const { items: wardrobeItems } = useWardrobe();
  const insets = useSafeAreaInsets();

  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addLocalDays(todayIso(), LOOKBOOK_DEFAULT_TOTAL_DAYS - 1));
  const [vibe, setVibe] = useState<TravelVibe>('mixed');
  const [activities, setActivities] = useState<TravelActivity[]>(['explore']);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [packingSummary, setPackingSummary] = useState<
    import('@/utils/packingSummary').PackingSummary | null
  >(null);
  const [shoppingGaps, setShoppingGaps] = useState<FallbackMissingItem[] | null>(null);
  const [loadedPlan, setLoadedPlan] = useState<TravelPlan | null>(null);
  const [activeTripId, setActiveTripId] = useState<string | undefined>(routeTripId);
  const [hasExistingLooks, setHasExistingLooks] = useState(false);

  const tripDays = useMemo(
    () => tripLengthDays(startDate, endDate),
    [startDate, endDate],
  );

  const lookbookPreviewTitle = useMemo(
    () => formatTravelLookbookTitle({
      destination: destination.trim(),
      startDate,
    }),
    [destination, startDate],
  );

  useEffect(() => {
    if (!user?.id) return;
    // Create mode without tripId = brand-new trip (don't preload active)
    if (!isEditMode && !routeTripId) return;

    let cancelled = false;
    (async () => {
      if (routeTripId) {
        const record = await dfyService.getTravelTrip(user.id, routeTripId);
        if (cancelled || !record) return;
        const plan = record.delivery.travelPlan;
        if (!plan) return;
        setActiveTripId(record.id);
        setLoadedPlan(plan);
        setHasExistingLooks((record.delivery.outfits || []).some((o) => (o.items?.length || 0) > 0));
        setDestination(destinationForDisplay(plan.destination));
        const loadedStart = plan.startDate || todayIso();
        const loadedEnd = plan.endDate || addLocalDays(todayIso(), LOOKBOOK_DEFAULT_TOTAL_DAYS - 1);
        setStartDate(loadedStart);
        setEndDate(loadedEnd);
        setVibe(plan.vibe || 'mixed');
        setActivities(plan.activities?.length ? plan.activities : ['explore']);
        return;
      }

      const delivery = await dfyService.getDFYDelivery(user.id);
      if (cancelled || delivery?.tier !== 'lite') return;
      setHasExistingLooks((delivery.outfits?.length ?? 0) > 0
        && delivery.outfits.some((o) => (o.items?.length || 0) > 0));
      const plan = delivery.travelPlan;
      if (!plan) return;
      setActiveTripId(delivery.tripId || plan.tripId);
      setLoadedPlan(plan);
      setDestination(destinationForDisplay(plan.destination));
      const loadedStart = plan.startDate || todayIso();
      const loadedEnd = plan.endDate || addLocalDays(todayIso(), LOOKBOOK_DEFAULT_TOTAL_DAYS - 1);
      setStartDate(loadedStart);
      setEndDate(loadedEnd);
      setVibe(plan.vibe || 'mixed');
      setActivities(plan.activities?.length ? plan.activities : ['explore']);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isEditMode, routeTripId]);

  const toggleActivity = (id: TravelActivity) => {
    Haptics.selectionAsync();
    setActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const validateDestination = (): string | null => {
    const dest = destination.trim();
    if (!dest) {
      return t('dfy.travel.destinationRequired') || 'Add a destination to continue.';
    }
    return null;
  };

  const validateDates = (): boolean => {
    if (!startDate || !endDate) {
      setError(t('dfy.travel.invalidDates') || 'Enter dates as DD/MM/YYYY.');
      return false;
    }
    if (tripLengthDays(startDate, endDate) < 1 || endDate < startDate) {
      setError(t('dfy.travel.invalidDateRange') || 'End date must be on or after the start date.');
      return false;
    }
    setError(null);
    return true;
  };

  const saveTripDetails = async () => {
    if (!user?.id) return;
    if (!validateDates()) return;
    const validationError = validateDestination();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const dest = destination.trim();
      const geo = await weatherService.geocodeDestination(dest);
      const plan = buildPlanFromForm(
        dest,
        startDate,
        endDate,
        tripDays,
        vibe,
        activities,
        geo,
        loadedPlan?.createdAt,
        activeTripId,
      );

      const tripRecord = activeTripId
        ? await dfyService.getTravelTrip(user.id, activeTripId)
        : null;

      let existing =
        tripRecord?.delivery
        || (await dfyService.getDFYDelivery(user.id));
      if (!existing || existing.tier !== 'lite') {
        const stylistId = (user.stylistPreferences?.selectedStylistId || 'ruby') as StylistId;
        existing = await dfyService.createMockLiteDelivery(user.id, stylistId);
      }

      const title = formatTravelLookbookTitle(plan);
      const next = {
        ...existing,
        userId: user.id,
        travelPlan: plan,
        startDate: plan.startDate,
        tripId: activeTripId || existing.tripId,
        lookbookTitle: title,
      };

      await dfyService.saveDFYDelivery(next);
      const record = await dfyService.upsertTravelTripFromDelivery(next, {
        tripId: activeTripId || existing.tripId,
        activate: true,
        syncLooks: false,
      });
      if (record?.id) setActiveTripId(record.id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (err: any) {
      console.log('[DFYTravelPlan] save failed:', err);
      setError(err?.message || t('common.error') || 'Something went wrong. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const buildCapsule = async () => {
    if (!user?.id) return;
    if (!validateDates()) return;
    const validationError = validateDestination();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (wardrobeItems.length < 3) {
      setError(
        t('dfy.travel.needWardrobe')
        || 'Add a few wardrobe pieces first so we can pack your capsule.',
      );
      return;
    }

    const dest = destination.trim();
    setIsBuilding(true);
    setError(null);
    setShoppingGaps(null);
    setStatusLine(
      t('dfy.travel.buildingStatus')?.replace('{destination}', dest)
      || `Building your Travel Capsule for ${dest}…`,
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const stylistId = (user.stylistPreferences?.selectedStylistId || 'ruby') as StylistId;
      const geo = await weatherService.geocodeDestination(dest);
      const plan = buildPlanFromForm(
        dest,
        startDate,
        endDate,
        tripDays,
        vibe,
        activities,
        geo,
        loadedPlan?.createdAt,
        activeTripId,
      );

      setStatusLine(
        t('dfy.travel.weatherStatus')?.replace('{destination}', plan.destination)
        || `Checking weather in ${plan.destination}…`,
      );

      const forecast = await weatherService.getForecastForDestination(
        plan.destination,
        plan.lat,
        plan.lon,
      );

      const tripRecord = activeTripId
        ? await dfyService.getTravelTrip(user.id, activeTripId)
        : null;
      const existing = tripRecord?.delivery || (await dfyService.getDFYDelivery(user.id));

      // Edit / known trip: rebuild that capsule. Create mode: fresh generate.
      const existingForGenerate =
        (isEditMode || routeTripId) && existing?.tier === 'lite'
          ? existing
          : null;

      const generated = generateLiteLookbook({
        userId: user.id,
        wardrobeItems,
        stylistId,
        existing: existingForGenerate,
        forecast,
        travelPlan: plan,
        options: { force: true },
      });

      if (!generated) {
        setError(
          t('dfy.travel.buildFailed')
          || 'Could not pack a complete capsule yet. Add a top, bottom, and shoes, then try again.',
        );
        return;
      }

      const titled = {
        ...generated,
        tripId: activeTripId || generated.tripId,
        lookbookTitle: formatTravelLookbookTitle(plan),
        travelPlan: { ...plan, tripId: activeTripId || plan.tripId },
      };

      await dfyService.saveDFYDelivery(titled);
      const record = await dfyService.upsertTravelTripFromDelivery(titled, {
        tripId: activeTripId,
        forceNew: !isEditMode && !routeTripId && !activeTripId,
        activate: true,
        syncLooks: true,
      });
      if (record?.id) setActiveTripId(record.id);

      setPackingSummary(generated.packingSummary || null);
      setStatusLine(generated.packingSummary?.activityLine || generated.capsuleNotes?.[0] || null);

      // Regional shop chips when capsule lacks core categories for climate/occasion
      let enrichedGaps: FallbackMissingItem[] | null = null;
      try {
        const localGaps = generated.packingSummary?.shoppingGaps || [];
        if (localGaps.length || (generated.capsuleItemIds?.length || 0) < 6) {
          const shopResult = await apiService.enrichShopSuggestions({
            wardrobeItems: wardrobeItems.slice(0, 80).map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              color: item.color,
              brand: item.brand,
            })),
            missing: localGaps.length ? localGaps : undefined,
            occasion: plan.vibe || 'travel',
            stylistId,
          });
          if (shopResult?.missing?.length) {
            enrichedGaps = shopResult.missing as FallbackMissingItem[];
          } else if (localGaps.length) {
            enrichedGaps = localGaps;
          }
        }
      } catch (shopErr) {
        console.warn('[DFYTravelPlan] shop suggestions skipped:', shopErr);
        if (generated.packingSummary?.shoppingGaps?.length) {
          enrichedGaps = generated.packingSummary.shoppingGaps;
        }
      }
      setShoppingGaps(enrichedGaps);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (!generated.packingSummary) {
        navigation.replace('DFYStylePlan');
      }
    } catch (err: any) {
      console.log('[DFYTravelPlan] build failed:', err);
      setError(err?.message || t('dfy.travel.buildFailed') || 'Something went wrong. Try again.');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleRebuildPress = () => {
    if (isEditMode && hasExistingLooks) {
      Alert.alert(
        t('dfy.travel.rebuildConfirmTitle') || 'Rebuild your looks?',
        t('dfy.travel.rebuildConfirmMessage')
          || 'This repacks your capsule and regenerates all destination looks using your updated trip details.',
        [
          { text: t('common.cancel') || 'Cancel', style: 'cancel' },
          { text: t('dfy.travel.rebuildConfirmYes') || 'Rebuild looks', onPress: buildCapsule },
        ],
      );
      return;
    }
    buildCapsule();
  };

  const continueToPlan = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.replace('DFYStylePlan');
  };

  const dateFieldColors = {
    color: theme.text,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    placeholderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={isDark ? ['#1A1A2E', '#0F0F18'] : ['#F7F3EE', '#EDE6DC']}
        style={StyleSheet.absoluteFill}
      />
      <ScreenKeyboardAwareScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        bottomOffset={24}
        disableScrollOnKeyboardHide
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">
            {isEditMode
              ? (t('dfy.travel.editTitle') || 'Trip details')
              : (t('dfy.travel.title') || 'Plan Your Trip')}
          </ThemedText>
          <ThemedText type="body" style={{ opacity: 0.7, marginTop: Spacing.sm }}>
            {isEditMode
              ? (t('dfy.travel.editSubtitle')
                || 'Update destination, dates, vibe, and activities. Your looks stay as-is until you rebuild the capsule.')
              : (t('dfy.travel.subtitle')
                || "We'll pack a Travel Capsule and build one destination-ready look for each day of your trip.")}
          </ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF' }]}>
          <ThemedText type="caption" style={styles.label}>
            {t('dfy.travel.destinationLabel') || 'Destination'}
          </ThemedText>
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder={t('dfy.travel.destinationPlaceholder') || 'e.g. Barcelona, London, NYC'}
            placeholderTextColor={dateFieldColors.placeholderColor}
            style={[
              styles.input,
              {
                color: dateFieldColors.color,
                borderColor: dateFieldColors.borderColor,
                backgroundColor: dateFieldColors.backgroundColor,
              },
            ]}
            autoCapitalize="words"
            returnKeyType="done"
          />

          <ThemedText type="caption" style={[styles.label, { marginTop: Spacing.lg }]}>
            {t('dfy.travel.datesLabel') || 'Dates'}
          </ThemedText>
          <View style={styles.row}>
            <DatePartsInput
              value={startDate}
              onChangeIso={(iso) => {
                setStartDate(iso);
                if (endDate < iso) setEndDate(iso);
              }}
              onInvalidBlur={() =>
                setError(t('dfy.travel.invalidDates') || 'Enter dates as DD/MM/YYYY.')
              }
              textColor={dateFieldColors.color}
              borderColor={dateFieldColors.borderColor}
              backgroundColor={dateFieldColors.backgroundColor}
              placeholderColor={dateFieldColors.placeholderColor}
              accessibilityLabel={t('dfy.travel.startDatePlaceholder') || 'Start date DD/MM/YYYY'}
            />
            <DatePartsInput
              value={endDate}
              onChangeIso={setEndDate}
              onInvalidBlur={() =>
                setError(t('dfy.travel.invalidDates') || 'Enter dates as DD/MM/YYYY.')
              }
              textColor={dateFieldColors.color}
              borderColor={dateFieldColors.borderColor}
              backgroundColor={dateFieldColors.backgroundColor}
              placeholderColor={dateFieldColors.placeholderColor}
              accessibilityLabel={t('dfy.travel.endDatePlaceholder') || 'End date DD/MM/YYYY'}
            />
          </View>
          <ThemedText type="small" style={{ opacity: 0.6, marginTop: Spacing.sm }}>
            {(t('dfy.travel.tripLengthHint') || '{days}-day trip')
              .replace('{days}', String(tripDays))}
          </ThemedText>
          {destination.trim() ? (
            <ThemedText type="small" style={{ opacity: 0.55, marginTop: 4 }}>
              {lookbookPreviewTitle}
            </ThemedText>
          ) : null}

          <ThemedText type="caption" style={[styles.label, { marginTop: Spacing.lg }]}>
            {t('dfy.travel.vibeLabel') || 'Trip vibe'}
          </ThemedText>
          <View style={styles.chips}>
            {VIBES.map((option) => {
              const active = vibe === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setVibe(option.id);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? LuxuryColors.teal + '30'
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                      borderColor: active ? LuxuryColors.teal : 'transparent',
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: active ? LuxuryColors.teal : theme.text, fontWeight: '600' }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="caption" style={[styles.label, { marginTop: Spacing.lg }]}>
            {t('dfy.travel.activitiesLabel') || 'Activities (optional)'}
          </ThemedText>
          <View style={styles.chips}>
            {ACTIVITIES.map((option) => {
              const active = activities.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => toggleActivity(option.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? LuxuryColors.gold + '28'
                        : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)',
                      borderColor: active ? LuxuryColors.gold : 'transparent',
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: active ? LuxuryColors.deepGold : theme.text, fontWeight: '600' }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {statusLine ? (
          <View style={styles.statusRow}>
            {isBuilding ? <ActivityIndicator color={LuxuryColors.teal} /> : null}
            <ThemedText type="small" style={{ flex: 1, opacity: 0.8 }}>
              {statusLine}
            </ThemedText>
          </View>
        ) : null}

        {error ? (
          <ThemedText type="small" style={{ color: '#C45C5C', marginTop: Spacing.md }}>
            {error}
          </ThemedText>
        ) : null}

        {packingSummary ? (
          <View
            style={[
              styles.card,
              styles.summaryCard,
              { backgroundColor: isDark ? '#1E1E2E' : '#FFFFFF' },
            ]}
          >
            <ThemedText type="h3">{packingSummary.title}</ThemedText>
            <ThemedText type="small" style={{ opacity: 0.7, marginTop: Spacing.xs }}>
              {packingSummary.coverageText}
            </ThemedText>
            <ThemedText type="caption" style={{ color: LuxuryColors.teal, marginTop: Spacing.sm, fontWeight: '600' }}>
              {packingSummary.activityLine}
            </ThemedText>

            {packingSummary.groupedItems.map((group) => (
              <View key={group.key} style={{ marginTop: Spacing.md }}>
                <ThemedText type="caption" style={styles.label}>
                  {group.label}
                </ThemedText>
                {group.items.map((item) => (
                  <ThemedText key={item.id} type="small" style={{ opacity: 0.85, marginBottom: 2 }}>
                    · {item.name}
                  </ThemedText>
                ))}
              </View>
            ))}

            <ThemedText type="small" style={{ opacity: 0.75, marginTop: Spacing.md, fontStyle: 'italic' }}>
              {packingSummary.howItWorks}
            </ThemedText>

            {packingSummary.whyTheseItems.map((line, idx) => (
              <ThemedText key={idx} type="caption" style={{ opacity: 0.65, marginTop: 4 }}>
                • {line}
              </ThemedText>
            ))}

            {shoppingGaps?.length ? (
              <View style={{ marginTop: Spacing.md }}>
                <ThemedText type="small" style={{ opacity: 0.85, marginBottom: Spacing.xs }}>
                  You&apos;re very close — just one upgrade for this trip…
                </ThemedText>
                {shoppingGaps.map((gap, gapIdx) => (
                  <ThemedText
                    key={`shop-gap-${gap.role || gapIdx}-${gap.label || gap.name || gapIdx}`}
                    type="small"
                    style={{ opacity: 0.8, marginBottom: 2 }}
                  >
                    · {gap.label || gap.name || gap.role || 'Upgrade'} · recommended
                  </ThemedText>
                ))}
                <FallbackShopSection
                  missing={shoppingGaps}
                  headline="Shop the missing piece"
                />
              </View>
            ) : null}

            <Button onPress={continueToPlan} style={{ marginTop: Spacing.lg }}>
              {t('dfy.travel.seeLooksCta') || 'See my looks'}
            </Button>
          </View>
        ) : isEditMode ? (
          <View style={{ marginHorizontal: Spacing.xl, marginTop: Spacing.xl }}>
            <Button onPress={saveTripDetails} disabled={isSaving || isBuilding}>
              {isSaving
                ? (t('dfy.travel.savingCta') || 'Saving…')
                : (t('dfy.travel.saveCta') || 'Save trip details')}
            </Button>
            {hasExistingLooks ? (
              <ThemedText type="small" style={{ opacity: 0.65, marginTop: Spacing.md, textAlign: 'center' }}>
                {t('dfy.travel.rebuildNote')
                  || "Changing dates or destination won't refresh your looks automatically."}
              </ThemedText>
            ) : null}
            <Pressable
              onPress={handleRebuildPress}
              disabled={isBuilding || isSaving}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  opacity: pressed || isBuilding || isSaving ? 0.6 : 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
                },
              ]}
            >
              <ThemedText type="body" style={{ fontWeight: '600', color: LuxuryColors.teal }}>
                {isBuilding
                  ? (t('dfy.travel.buildingCta') || 'Packing your capsule…')
                  : (t('dfy.travel.rebuildCta') || 'Rebuild Travel Capsule')}
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Button
            onPress={buildCapsule}
            disabled={isBuilding}
            style={{ marginTop: Spacing.xl }}
          >
            {isBuilding
              ? (t('dfy.travel.buildingCta') || 'Packing your capsule…')
              : (t('dfy.travel.buildCta') || 'Build My Travel Capsule')}
          </Button>
        )}
      </ScreenKeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  card: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  summaryCard: {
    marginTop: Spacing.lg,
  },
  label: {
    opacity: 0.55,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  secondaryBtn: {
    marginTop: Spacing.md,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
});
