import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { DFYTier, StylistId, dfyService, DFYLiteDelivery } from '@/services/DFYService';
import apiService from '@/services/ApiService';
import { useWardrobe, type WardrobeItem } from '@/contexts/WardrobeContext';
import {
  mapLookbookDeliveryToCalendarOutfits,
  mapApiLookbookToCalendarOutfits,
  mapDfyCalendarPayloadToOutfits,
  buildLocalCoreCalendarOutfits,
  DFYCalendarMappedOutfit,
} from '@/utils/dfyCalendarBridge';
import { buildLocalAlternatives, DFYAlternativeOutfit } from '@/utils/dfyOutfitImages';
import { enrichWardrobeItemForOutfitVisual } from '@/utils/wardrobeImage';
import { OutfitPiecesVisual, OutfitPieceVisual } from '@/components/OutfitPiecesVisual';
import { DFYPackageNameModal } from '@/components/outfit/DFYPackageNameModal';
import { useTranslations } from "@/contexts/TranslationContext";
import { wardrobeCanBuildCompleteOutfit } from '@/utils/completeOutfit';
import { laundryProfileFromUser } from '@/utils/wearRules';
import {
  buildClientCalendarSaveRequest,
  pickNewerCalendarSource,
} from '@/utils/coreCalendarSync';

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  obsidian: '#0D0B09',
};

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const EMBEDDED_OUTFIT_WIDTH = SCREEN_WIDTH - Spacing.xl * 2 - Spacing.lg * 2;
const MODAL_OUTFIT_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;

interface DFYCalendarOutfit extends DFYCalendarMappedOutfit {}

type ViewMode = 'calendar' | 'week' | 'list';

type DFYCalendarScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ DFYCalendar: { tier: DFYTier; packageId?: string } }, 'DFYCalendar'>;
};

export default function DFYCalendarScreen({ navigation, route }: DFYCalendarScreenProps) {
  const tier = route.params?.tier || 'lite';
  const packageId = route.params?.packageId;
  const isHistorical = Boolean(packageId);
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const { items: wardrobeItems } = useWardrobe();
  const insets = useSafeAreaInsets();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showOutfitDetail, setShowOutfitDetail] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<DFYCalendarOutfit | null>(null);
  const [calendarOutfits, setCalendarOutfits] = useState<DFYCalendarOutfit[]>([]);
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [alternatives, setAlternatives] = useState<DFYAlternativeOutfit[]>([]);
  const [packageName, setPackageName] = useState<string | null>(null);
  const [showPackageNamePrompt, setShowPackageNamePrompt] = useState(false);
  const [packageNameDefault, setPackageNameDefault] = useState('');
  const [renamePackageId, setRenamePackageId] = useState<string | null>(null);

  const totalDays = tier === 'lite' ? 14 : 30;
  const startDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const tabBarClearance = insets.bottom + 100;

  const formatDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  const applyCalendarOutfits = (mapped: DFYCalendarOutfit[]) => {
    setCalendarOutfits(mapped);
    const todayKey = formatDateKey(new Date());
    const todayOutfit = mapped.find((o) => formatDateKey(new Date(o.date)) === todayKey);
    if (todayOutfit) {
      setSelectedOutfit(todayOutfit);
      setSelectedDate(new Date());
      return;
    }
    if (mapped[0]) {
      setSelectedOutfit(mapped[0]);
      setSelectedDate(new Date(mapped[0].date));
    }
  };

  const mapApiCalendarOutfits = (rawOutfits: any[]): DFYCalendarOutfit[] =>
    rawOutfits.map((outfit) => ({
      id: outfit.id,
      date: outfit.date,
      title: outfit.eventName || 'Curated Outfit',
      stylistNote: outfit.notes || '',
      stylistId: 'ruby' as StylistId,
      wasWorn: outfit.wasWorn,
      alternativesCount: 0,
      dayNumber: 0,
      itemIds: outfit.itemIds || [],
      items: (outfit.itemIds || [])
        .map((id: string) => wardrobeItems.find((w: WardrobeItem) => String(w.id) === String(id)))
        .filter((w: WardrobeItem | undefined): w is WardrobeItem => Boolean(w))
        .map((w: WardrobeItem) => ({
          id: String(w.id),
          name: w.name,
          imageUri: w.imageUri || w.enhancedImageUri,
          category: w.category,
          color: w.color,
        })),
    }));

  const loadLookbookCalendarOutfits = async (): Promise<DFYCalendarOutfit[]> => {
    if (!user?.id) return [];

    const saved = await dfyService.getDFYDelivery(user.id);
    if (saved?.tier === 'lite' && saved.outfits.some((o) => o.items && o.items.length > 0)) {
      return mapLookbookDeliveryToCalendarOutfits(saved as DFYLiteDelivery, startDate, wardrobeItems);
    }

    try {
      const remote = await apiService.getDFYLookbook();
      if (remote.success && remote.outfits && remote.outfits.length > 0) {
        return mapApiLookbookToCalendarOutfits(remote.outfits, startDate, wardrobeItems, 'ruby');
      }
    } catch (err) {
      console.log('[DFYCalendar] Remote lookbook fetch failed:', err);
    }

    return [];
  };

  const mapCachedRowsToOutfits = (
    rows: Array<{
      id: string;
      date: string;
      title: string;
      stylistNote: string;
      stylistId: StylistId;
      itemIds: string[];
      dayNumber: number;
    }>,
  ): DFYCalendarOutfit[] =>
    rows
      .map((row) => ({
        id: row.id,
        date: row.date,
        title: row.title,
        stylistNote: row.stylistNote,
        stylistId: row.stylistId,
        wasWorn: false,
        alternativesCount: 0,
        dayNumber: row.dayNumber,
        itemIds: row.itemIds,
        items: row.itemIds
          .map((id) => wardrobeItems.find((w) => String(w.id) === String(id)))
          .filter((w): w is WardrobeItem => Boolean(w))
          .map((w) => ({
            id: String(w.id),
            name: w.name,
            imageUri: w.imageUri || w.enhancedImageUri,
            category: w.category,
            color: w.color,
          })),
      }))
      .filter((o) => o.items.length > 0);

  const loadCoreCalendarOutfits = async (): Promise<DFYCalendarOutfit[]> => {
    let localMapped: DFYCalendarOutfit[] = [];
    let localGeneratedAt: string | null = null;

    if (user?.id) {
      try {
        const cached = await dfyService.getCoreCalendarCache(user.id);
        if (cached?.outfits?.length) {
          localGeneratedAt = cached.generatedAt || null;
          localMapped = mapCachedRowsToOutfits(cached.outfits);
        }
      } catch (err) {
        console.log('[DFYCalendar] Local Core cache read failed:', err);
      }
    }

    let remoteMapped: DFYCalendarOutfit[] = [];
    let remoteGeneratedAt: string | null = null;

    try {
      const remote = await apiService.getDFYCalendar();
      if (remote.success && remote.ready !== false) {
        remoteGeneratedAt = remote.generatedAt || null;
        remoteMapped = mapDfyCalendarPayloadToOutfits(
          remote,
          startDate,
          wardrobeItems,
          (remote.stylistId as StylistId) || 'ruby',
        );
      }
    } catch (err) {
      console.log('[DFYCalendar] Remote Core calendar fetch failed:', err);
    }

    const winner = pickNewerCalendarSource(localGeneratedAt, remoteGeneratedAt);
    if (winner === 'remote' && remoteMapped.length > 0) {
      console.log('[DFYCalendar] Using server calendar (newer than local cache)');
      return remoteMapped;
    }
    if (localMapped.length > 0) {
      if (winner === 'local') {
        console.log('[DFYCalendar] Using local cache (newer than server)');
      }
      return localMapped;
    }
    if (remoteMapped.length > 0) return remoteMapped;

    // Active Core package payload (historical / named packages)
    try {
      const active = await dfyService.getActiveDfyPackage('core');
      if (active?.id) {
        const pkg = await dfyService.getDfyPackage(active.id);
        if (pkg?.payload) {
          const mapped = mapDfyCalendarPayloadToOutfits(
            pkg.payload,
            startDate,
            wardrobeItems,
            (pkg.stylistId as StylistId) || 'ruby',
          );
          if (mapped.length > 0) {
            setPackageName(pkg.name);
            return mapped;
          }
        }
      }
    } catch (err) {
      console.log('[DFYCalendar] Active Core package fetch failed:', err);
    }

    return [];
  };

  const persistCoreCalendarInBackground = (
    outfits: DFYCalendarOutfit[],
    wardrobeForGen: WardrobeItem[],
  ) => {
    if (!user?.id || outfits.length === 0) return;

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays - 1);

    void (async () => {
      try {
        const saveRequest = await buildClientCalendarSaveRequest(outfits, wardrobeForGen, {
          startDate: formatDateKey(startDate),
          endDate: formatDateKey(endDate),
          stylistId: 'ruby',
        });

        const cachePayload = {
          outfits: outfits.map((o) => ({
            id: o.id,
            date: typeof o.date === 'string' ? o.date.slice(0, 10) : formatDateKey(new Date(o.date)),
            title: o.title,
            stylistNote: o.stylistNote,
            stylistId: o.stylistId,
            itemIds: o.itemIds,
            dayNumber: o.dayNumber,
          })),
          startDate: formatDateKey(startDate),
          totalDays,
          generatedAt: saveRequest.generatedAt,
          calendarHash: saveRequest.calendarHash,
          engineVersion: saveRequest.engineVersion,
        };

        await dfyService.saveCoreCalendarCache(user.id, cachePayload);
        console.log('[DFYCalendar] STEP 5: local cache saved');

        console.log('[DFYCalendar] STEP 6: syncing exact plan to server');
        const result = await apiService.saveClientCoreCalendar(saveRequest);
        if (result.skipped) {
          console.log('[DFYCalendar] STEP 6: server unchanged (hash match)');
        } else if (result.success) {
          console.log('[DFYCalendar] STEP 6: server persist complete', result.version);
        }
      } catch (persistErr: unknown) {
        const err = persistErr as { message?: string; conflict?: boolean };
        if (err?.message?.includes('409') || String(persistErr).includes('server_newer')) {
          console.warn('[DFYCalendar] STEP 6: server has newer calendar — keeping local until reload');
        } else {
          console.warn('[DFYCalendar] STEP 6: server sync failed (local cache kept):', persistErr);
        }
      }
    })();
  };

  const generateAndMapCoreCalendar = async (): Promise<DFYCalendarOutfit[]> => {
    const ownedItems = wardrobeItems.filter((item) => !item.origin || item.origin === 'owned');
    const wardrobeForGen = ownedItems.length >= 3 ? ownedItems : wardrobeItems;
    const laundryProfile = laundryProfileFromUser(user);

    console.log('[DFYCalendar] STEP 1: validate wardrobe', {
      total: wardrobeItems.length,
      forGen: wardrobeForGen.length,
    });

    if (!wardrobeCanBuildCompleteOutfit(wardrobeForGen)) {
      throw new Error('NEED_MORE_ITEMS');
    }

    console.log('[DFYCalendar] STEP 2: local guaranteed generation');
    const local = buildLocalCoreCalendarOutfits(
      wardrobeForGen,
      startDate,
      totalDays,
      'ruby',
      laundryProfile,
    );

    if (local.length >= totalDays) {
      console.log('[DFYCalendar] STEP 3: local success', { days: local.length });
      persistCoreCalendarInBackground(local, wardrobeForGen);
      return local;
    }

    throw new Error('GENERATE_EMPTY');
  };

  const maybePromptPackageName = async () => {
    try {
      const prompt = await dfyService.preparePackageNamePrompt(tier === 'core' ? 'core' : 'lite');
      if (prompt) {
        setRenamePackageId(prompt.packageId);
        setPackageNameDefault(prompt.defaultName);
        setShowPackageNamePrompt(true);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    const loadAllOutfits = async () => {
      try {
        setLoadingAll(true);

        if (packageId && user?.id) {
          const pkg = await dfyService.getDfyPackage(packageId);
          if (pkg) {
            setPackageName(pkg.name);
            const fromPayload = pkg.payload
              ? mapDfyCalendarPayloadToOutfits(
                  pkg.payload,
                  startDate,
                  wardrobeItems,
                  (pkg.stylistId as StylistId) || 'ruby',
                )
              : [];
            if (fromPayload.length > 0) {
              applyCalendarOutfits(fromPayload);
              return;
            }
            const liteDelivery = dfyService.mapPackagePayloadToLiteDelivery(
              user.id,
              pkg,
              'ruby',
            );
            if (liteDelivery) {
              const mapped = mapLookbookDeliveryToCalendarOutfits(
                liteDelivery,
                startDate,
                wardrobeItems,
              );
              if (mapped.length > 0) {
                applyCalendarOutfits(mapped);
                return;
              }
            }
          }
          return;
        }

        setPackageName(null);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + totalDays - 1);

        // Manual / SQL calendar entries (legacy mix & match pins)
        let result = await apiService.getCalendarOutfitsForRange(startDate, endDate);
        if (result.success && result.outfits && result.outfits.length > 0) {
          applyCalendarOutfits(mapApiCalendarOutfits(result.outfits));
          return;
        }

        if (tier === 'lite') {
          const lookbookOutfits = await loadLookbookCalendarOutfits();
          if (lookbookOutfits.length > 0) {
            applyCalendarOutfits(lookbookOutfits);
            return;
          }
        }

        if (tier === 'core') {
          const existing = await loadCoreCalendarOutfits();
          if (existing.length > 0) {
            applyCalendarOutfits(existing);
            return;
          }

          try {
            const generated = await generateAndMapCoreCalendar();
            if (generated.length > 0) {
              applyCalendarOutfits(generated);
              await maybePromptPackageName();
            }
          } catch (genErr) {
            console.warn('[DFYCalendar] Failed to generate outfits:', genErr);
          }
        }
      } catch (err) {
        console.log('[DFYCalendar] Error loading all outfits:', err);
        if (!packageId && tier === 'lite') {
          const lookbookOutfits = await loadLookbookCalendarOutfits();
          if (lookbookOutfits.length > 0) {
            applyCalendarOutfits(lookbookOutfits);
          }
        } else if (!packageId && tier === 'core') {
          try {
            const existing = await loadCoreCalendarOutfits();
            if (existing.length > 0) applyCalendarOutfits(existing);
          } catch {
            // ignore
          }
        }
      } finally {
        setLoadingAll(false);
      }
    };
    loadAllOutfits();
  }, [startDate, totalDays, tier, user?.id, wardrobeItems.length, packageId]);

  // Fetch outfit for a specific date from backend
  const fetchOutfitForDate = async (date: Date) => {
    try {
      setLoadingDate(formatDateKey(date));
      const result = await apiService.getOutfitForDate(date);
      if (result.success && result.outfits && result.outfits.length > 0) {
        const outfit = result.outfits[0];
        const dfiOutfit: DFYCalendarOutfit = mapApiCalendarOutfits([outfit])[0];
        setCalendarOutfits((prev) => {
          const idx = prev.findIndex((o) => o.id === dfiOutfit.id);
          if (idx >= 0) {
            const newList = [...prev];
            newList[idx] = dfiOutfit;
            return newList;
          }
          return [...prev, dfiOutfit];
        });
        return dfiOutfit;
      }

      if (tier === 'lite' && user?.id) {
        const dayOffset = Math.round((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        if (dayOffset >= 0 && dayOffset < totalDays) {
          const lookbookOutfits = await loadLookbookCalendarOutfits();
          const match = lookbookOutfits[dayOffset];
          if (match) {
            setCalendarOutfits((prev) => {
              const idx = prev.findIndex((o) => o.id === match.id);
              if (idx >= 0) return prev;
              return [...prev, match];
            });
            return match;
          }
        }
      }

      if (tier === 'core' && user?.id) {
        const coreOutfits = await loadCoreCalendarOutfits();
        const dateKey = formatDateKey(date);
        const match = coreOutfits.find((o) => formatDateKey(new Date(o.date)) === dateKey);
        if (match) {
          setCalendarOutfits((prev) => {
            const idx = prev.findIndex((o) => o.id === match.id);
            if (idx >= 0) return prev;
            return [...prev, match];
          });
          return match;
        }
      }
    } catch (err) {
      console.log('Error fetching outfit for date:', err);
    } finally {
      setLoadingDate(null);
    }
    return undefined;
  };

  const handleRegenerateCalendar = async () => {
    if (isHistorical) return;
    try {
      setLoadingAll(true);
      if (tier === 'lite') {
        const lookbookOutfits = await loadLookbookCalendarOutfits();
        if (lookbookOutfits.length > 0) {
          applyCalendarOutfits(lookbookOutfits);
          return;
        }
        await apiService.generateDFYDelivery({ tier: 'lite', stylistId: 'ruby' });
        const afterGen = await loadLookbookCalendarOutfits();
        if (afterGen.length > 0) {
          applyCalendarOutfits(afterGen);
          await maybePromptPackageName();
        }
        return;
      }

      // Core: always regenerate delivery, then hydrate from response / blob
      const generated = await generateAndMapCoreCalendar();
      if (generated.length > 0) {
        applyCalendarOutfits(generated);
        await maybePromptPackageName();
        return;
      }

      const existing = await loadCoreCalendarOutfits();
      if (existing.length > 0) {
        applyCalendarOutfits(existing);
        return;
      }

      throw new Error('GENERATE_EMPTY');
    } catch (err) {
      console.error('Failed to regenerate calendar:', err);
      const message = (err as Error)?.message || '';
      let body =
        tier === 'core'
          ? (t('dfy.calendar.generateFailed') || 'Could not generate your 30-day calendar. Add wardrobe items and try again.')
          : (t('dfy.calendar.generateFailedLite') || 'Could not load your lookbook calendar. Try again from My Lookbook.');

      if (message === 'NEED_MORE_ITEMS') {
        body =
          t('wardrobe.needMoreItemsAi')?.replace('{n}', '3')
          || 'Add tops, bottoms, and shoes to your wardrobe so we can build full outfits.';
      } else if (message === 'GENERATE_EMPTY') {
        body =
          t('dfy.calendar.generateEmpty') ||
          'We could not build outfits from your wardrobe right now. Try again in a moment.';
      } else if (message.includes('took too long')) {
        body = 'Generation is taking longer than usual. Pull to refresh in a moment, or try again.';
      } else if (message.includes('Network error')) {
        body = 'Check your connection and try again.';
      }

      Alert.alert(t('common.error') || 'Error', body);
    } finally {
      setLoadingAll(false);
    }
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [currentDate]);

  const getOutfitForDate = (date: Date): DFYCalendarOutfit | undefined => {
    const dateKey = formatDateKey(date);
    return calendarOutfits.find(o => {
      // Compare directly as YYYY-MM-DD strings to avoid timezone shifts
      const oDateKey = typeof o.date === 'string' ? o.date.substring(0, 10) : formatDateKey(new Date(o.date));
      return oDateKey === dateKey;
    });
  };

  const handleDayPress = async (day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    
    // First check if we already have this outfit in cache
    let outfit = getOutfitForDate(date);
    if (!outfit) {
      // If not, fetch from backend
      outfit = await fetchOutfitForDate(date);
    }
    if (outfit) {
      setSelectedOutfit(outfit);
    } else if (isInPlanRange(day)) {
      setSelectedOutfit(null);
    }
  };

  const handleOutfitPress = (outfit: DFYCalendarOutfit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedOutfit(outfit);
    setShowOutfitDetail(true);
  };

  const handleMarkWorn = () => {
    if (!selectedOutfit) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedOutfit({ ...selectedOutfit, wasWorn: true });
    setCalendarOutfits((prev) =>
      prev.map((o) => (o.id === selectedOutfit.id ? { ...o, wasWorn: true } : o)),
    );
  };

  const mapApiAlternatives = (raw: any[]): DFYAlternativeOutfit[] =>
    raw
      .map((alt, idx) => ({
        id: alt.id || `alt-${idx + 1}`,
        stylistNote: alt.stylistNote || alt.notes || `Alternative ${idx + 1}`,
        items: (alt.items || [])
          .map((it: any) => {
            const wardrobe = wardrobeItems.find((w) => String(w.id) === String(it.id));
            return {
              id: String(it.id),
              name: it.name || wardrobe?.name || 'Wardrobe item',
              category: it.category || wardrobe?.category || '',
              color: it.color || wardrobe?.color || '',
              imageUri:
                it.imageUri ||
                it.processedImageUrl ||
                it.imageUrl ||
                wardrobe?.imageUri ||
                wardrobe?.enhancedImageUri,
            };
          })
          .filter((it: { id: string }) => Boolean(it.id)),
      }))
      .filter((alt) => alt.items.length >= 2);

  const handleSeeAlternatives = async () => {
    if (!selectedOutfit || !selectedDate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAlternatives(true);
    setLoadingAlternatives(true);
    setAlternatives([]);

    const dateKey = formatDateKey(selectedDate);
    const currentIds = selectedOutfit.itemIds.length
      ? selectedOutfit.itemIds
      : (selectedOutfit.items || []).map((i) => i.id);

    try {
      const remote = await apiService.getDFYCalendarAlternatives(dateKey, String(selectedOutfit.stylistId));
      if (remote.success && remote.alternatives?.length) {
        const mapped = mapApiAlternatives(remote.alternatives);
        if (mapped.length > 0) {
          setAlternatives(mapped);
          return;
        }
      }

      const local = buildLocalAlternatives(
        currentIds,
        selectedOutfit.dayNumber || 1,
        wardrobeItems,
        2,
      );
      setAlternatives(local);
    } catch (err) {
      console.log('[DFYCalendar] Remote alternatives failed, using local:', err);
      const local = buildLocalAlternatives(
        currentIds,
        selectedOutfit.dayNumber || 1,
        wardrobeItems,
        2,
      );
      setAlternatives(local);
    } finally {
      setLoadingAlternatives(false);
    }
  };

  const handleSelectAlternative = async (alt: DFYAlternativeOutfit) => {
    if (!selectedOutfit || !selectedDate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const updated: DFYCalendarOutfit = {
      ...selectedOutfit,
      stylistNote: alt.stylistNote,
      itemIds: alt.items.map((i) => i.id),
      items: alt.items.map((i) => ({
        id: i.id,
        name: i.name,
        imageUri: i.imageUri,
        category: i.category,
        color: i.color,
      })),
      wasWorn: false,
    };

    setSelectedOutfit(updated);
    setCalendarOutfits((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setShowAlternatives(false);

    if (tier === 'lite' && user?.id) {
      try {
        const delivery = await dfyService.getDFYDelivery(user.id);
        if (delivery?.tier === 'lite') {
          const idx = delivery.outfits.findIndex(
            (o) => o.id === updated.id || o.dayNumber === updated.dayNumber,
          );
          if (idx >= 0) {
            delivery.outfits[idx] = {
              ...delivery.outfits[idx],
              items: alt.items,
              stylistNote: alt.stylistNote,
            };
            await dfyService.saveDFYDelivery(delivery);
          }
        }
      } catch (err) {
        console.log('[DFYCalendar] Failed to persist alternative to lookbook:', err);
      }
    }
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isInPlanRange = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays);
    return date >= startDate && date < endDate;
  };

  const tierGradient = tier === 'lite' 
    ? [LUXURY_COLORS.coral, '#C46A4F', LUXURY_COLORS.obsidian] as const
    : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold, LUXURY_COLORS.obsidian] as const;

  const renderCalendarDay = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const outfit = getOutfitForDate(date);
    const isSelected = selectedDate?.getDate() === day && 
                       selectedDate?.getMonth() === currentDate.getMonth();
    const inRange = isInPlanRange(day);

    return (
      <Pressable
        key={`day-${day}`}
        onPress={() => handleDayPress(day)}
        style={[
          styles.dayCell,
          isToday(day) && styles.todayCell,
          isSelected && styles.selectedCell,
          !inRange && styles.outOfRangeCell,
        ]}
      >
        <ThemedText
          type="body"
          style={[
            styles.dayText,
            isSelected && { color: '#FFFFFF' },
            !inRange && { opacity: 0.3 },
          ]}
        >
          {day}
        </ThemedText>
        {outfit && inRange && (
          <View style={[styles.outfitDot, { backgroundColor: outfit.wasWorn ? LUXURY_COLORS.emerald : tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]} />
        )}
      </Pressable>
    );
  };

  const getOutfitDisplayItems = (outfit: DFYCalendarOutfit) => {
    if (outfit.items?.length) return outfit.items;
    return (outfit.itemIds || [])
      .map((id) => {
        const w = wardrobeItems.find((i) => String(i.id) === String(id));
        if (!w) return null;
        return {
          id: String(w.id),
          name: w.name,
          imageUri: w.imageUri || w.enhancedImageUri,
          category: w.category,
          color: w.color,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  };

  const itemsToVisualPieces = (
    items: Array<{ id: string; name: string; category?: string; imageUri?: string }>,
  ): OutfitPieceVisual[] =>
    items.map((item) => {
      const wardrobe = wardrobeItems.find((w) => String(w.id) === String(item.id));
      const processedUri = wardrobe ? enrichWardrobeItemForOutfitVisual(wardrobe).imageUri : item.imageUri;
      return {
        wardrobeItemId: item.id,
        name: item.name,
        category: item.category || wardrobe?.category,
        imageUrl: processedUri || item.imageUri,
      };
    });

  const renderOutfitItemLegend = (
    items: Array<{ id: string; name: string }>,
  ) => (
    <View style={styles.outfitItemLegend}>
      {items.map((item) => (
        <View
          key={item.id}
          style={[styles.outfitItemPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
        >
          <ThemedText type="caption" style={{ textAlign: 'center', lineHeight: 16 }}>
            {item.name}
          </ThemedText>
        </View>
      ))}
    </View>
  );

  const renderOutfitStackVisual = (
    outfit: DFYCalendarOutfit,
    options?: { canvasWidth?: number; showLegend?: boolean },
  ) => {
    const displayItems = getOutfitDisplayItems(outfit);
    const pieces = itemsToVisualPieces(displayItems);
    if (!pieces.length) return null;

    return (
      <View style={styles.outfitVisualBlock}>
        <OutfitPiecesVisual
          pieces={pieces}
          wardrobeItems={wardrobeItems}
          label=""
          large
          canvasWidth={options?.canvasWidth ?? EMBEDDED_OUTFIT_WIDTH}
        />
        {options?.showLegend !== false ? renderOutfitItemLegend(displayItems) : null}
      </View>
    );
  };

  const formatOutfitCardDate = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const renderSelectedOutfitSummary = (
    outfit: DFYCalendarOutfit,
    date: Date,
    trailing?: React.ReactNode,
  ) => (
    <View style={[styles.selectedOutfitHeader, { marginBottom: Spacing.md }]}>
      <View style={{ flex: 1 }}>
        <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 4 }}>
          {formatOutfitCardDate(date)}
        </ThemedText>
        <ThemedText type="h3">{outfit.title}</ThemedText>
        {outfit.weatherNote ? (
          <ThemedText type="caption" style={{ opacity: 0.6, marginTop: 4 }}>
            {outfit.weatherNote}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  const renderAlternativeStackVisual = (alt: DFYAlternativeOutfit) => {
    const pieces = itemsToVisualPieces(alt.items);
    if (!pieces.length) return null;

    return (
      <View style={styles.outfitVisualBlock}>
        <OutfitPiecesVisual
          pieces={pieces}
          wardrobeItems={wardrobeItems}
          label=""
          large
          canvasWidth={MODAL_OUTFIT_WIDTH}
        />
        {renderOutfitItemLegend(alt.items)}
      </View>
    );
  };

  const renderWeekView = () => {
    const today = new Date();
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);
      return date;
    });

    return (
      <View style={styles.weekView}>
        <View style={styles.weekDaysRow}>
          {weekDays.map((date, index) => {
            const outfit = getOutfitForDate(date);
            const isSelected = selectedDate && formatDateKey(selectedDate) === formatDateKey(date);
            const isToday = formatDateKey(date) === formatDateKey(new Date());

            return (
              <Pressable
                key={index}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDate(date);
                  if (outfit) setSelectedOutfit(outfit);
                }}
                style={[
                  styles.weekDayCell,
                  isSelected && { backgroundColor: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold },
                ]}
              >
                <ThemedText type="caption" style={[styles.weekDayLabel, isSelected && { color: '#FFFFFF' }]}>
                  {DAYS_OF_WEEK[index]}
                </ThemedText>
                <ThemedText type="h3" style={[styles.weekDayNumber, isSelected && { color: '#FFFFFF' }]}>
                  {date.getDate()}
                </ThemedText>
                {outfit && (
                  <View style={[styles.weekOutfitIndicator, { backgroundColor: outfit.wasWorn ? LUXURY_COLORS.emerald : 'rgba(255,255,255,0.5)' }]} />
                )}
              </Pressable>
            );
          })}
        </View>
        {selectedDate && selectedOutfit && (
          <View
            style={[styles.selectedOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)' }]}
          >
            <Pressable onPress={() => handleOutfitPress(selectedOutfit)}>
              {renderSelectedOutfitSummary(
                selectedOutfit,
                selectedDate,
                <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />,
              )}
              {renderOutfitStackVisual(selectedOutfit)}

              {selectedOutfit.stylistNote ? (
                <ThemedText type="small" numberOfLines={3} style={{ opacity: 0.7, marginTop: Spacing.md, lineHeight: 18 }}>
                  {selectedOutfit.stylistNote}
                </ThemedText>
              ) : null}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderListView = () => (
    <FlatList
      data={calendarOutfits}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { paddingBottom: tabBarClearance }]}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => handleOutfitPress(item)}
          style={[styles.listOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' }]}
        >
          <View style={[styles.listDayBadge, { backgroundColor: tier === 'lite' ? LUXURY_COLORS.coral + '20' : LUXURY_COLORS.gold + '20' }]}>
            {getOutfitDisplayItems(item)[0]?.imageUri ? (
              <Image
                source={{ uri: getOutfitDisplayItems(item)[0].imageUri }}
                style={styles.listDayThumb}
                contentFit="cover"
              />
            ) : (
              <>
                <ThemedText type="h3" style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }}>
                  {item.dayNumber || index + 1}
                </ThemedText>
                <ThemedText type="caption" style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }}>
                  DAY
                </ThemedText>
              </>
            )}
          </View>
          <View style={styles.listOutfitInfo}>
            {item.date ? (
              <ThemedText type="caption" style={{ opacity: 0.5, marginBottom: 2 }}>
                {formatOutfitCardDate(new Date(item.date))}
              </ThemedText>
            ) : null}
            <ThemedText type="body" style={{ fontWeight: '600' }}>{item.title}</ThemedText>
            <ThemedText type="small" numberOfLines={2} style={{ opacity: 0.7, marginTop: 2 }}>
              {item.stylistNote}
            </ThemedText>
            {item.weatherNote && (
              <View style={styles.weatherNote}>
                <Feather name="cloud" size={12} color={theme.tabIconDefault} />
                <ThemedText type="caption" style={{ marginLeft: 4, opacity: 0.6 }}>{item.weatherNote}</ThemedText>
              </View>
            )}
          </View>
          <View style={styles.listOutfitMeta}>
            {item.wasWorn ? (
              <View style={[styles.wornBadge, { backgroundColor: LUXURY_COLORS.emerald }]}>
                <Feather name="check" size={10} color="#FFFFFF" />
              </View>
            ) : (
              <ThemedText type="caption" style={{ opacity: 0.5 }}>
                {item.alternativesCount} alt{item.alternativesCount > 1 ? 's' : ''}
              </ThemedText>
            )}
            <Feather name="chevron-right" size={18} color={theme.tabIconDefault} />
          </View>
        </Pressable>
      )}
    />
  );

  const renderAlternativesModal = () => (
    <Modal
      visible={showAlternatives}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowAlternatives(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => setShowAlternatives(false)} style={styles.modalCloseButton}>
            <Feather name="x" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">Alternatives</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {loadingAlternatives ? (
          <View style={styles.alternativesLoading}>
            <ActivityIndicator size="large" color={tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
              Finding other ways to wear your wardrobe...
            </ThemedText>
          </View>
        ) : alternatives.length === 0 ? (
          <View style={styles.alternativesLoading}>
            <Feather name="package" size={40} color={theme.tabIconDefault} />
            <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: 'center', opacity: 0.7 }}>
              Add more wardrobe items to unlock outfit alternatives.
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.alternativesList, { paddingBottom: insets.bottom + Spacing.xl }]}>
            {alternatives.map((alt, index) => (
              <View
                key={alt.id}
                style={[styles.alternativeCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' }]}
              >
                <ThemedText type="small" style={{ opacity: 0.6, marginBottom: Spacing.sm }}>
                  Option {index + 1}
                </ThemedText>
                {renderAlternativeStackVisual(alt)}
                <ThemedText type="body" style={{ marginTop: Spacing.md, lineHeight: 22 }}>
                  {alt.stylistNote}
                </ThemedText>
                <Pressable
                  onPress={() => handleSelectAlternative(alt)}
                  style={[styles.wearAltButton, { backgroundColor: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]}
                >
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: 6, fontWeight: '700' }}>
                    Wear This
                  </ThemedText>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );

  const renderOutfitDetail = () => (
    <Modal
      visible={showOutfitDetail}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowOutfitDetail(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={tier === 'lite' ? [LUXURY_COLORS.coral + '30', 'transparent'] : [LUXURY_COLORS.gold + '30', 'transparent']}
          style={styles.modalHeaderGradient}
        >
          <View style={[styles.modalHeader, { paddingTop: insets.top + Spacing.md }]}>
            <Pressable onPress={() => setShowOutfitDetail(false)} style={styles.modalCloseButton}>
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
            <ThemedText type="h3">{selectedOutfit?.title}</ThemedText>
            <View style={{ width: 40 }} />
          </View>
        </LinearGradient>

        <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
          <View style={styles.modalContent}>
            {(selectedOutfit?.items?.length || selectedOutfit?.itemIds?.length) ? (
              renderOutfitStackVisual(selectedOutfit, { canvasWidth: MODAL_OUTFIT_WIDTH, showLegend: true })
            ) : (
              <View style={[styles.outfitImagePlaceholder, { backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
                <LinearGradient
                  colors={tier === 'lite' ? [LUXURY_COLORS.coral + '40', '#C46A4F20'] : [LUXURY_COLORS.gold + '40', LUXURY_COLORS.deepGold + '20']}
                  style={styles.imagePlaceholderGradient}
                >
                  <Feather name="image" size={64} color={tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold} />
                  <ThemedText style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold, marginTop: Spacing.md }}>
                    Complete Outfit
                  </ThemedText>
                </LinearGradient>
              </View>
            )}

            {selectedOutfit?.stylistNote && (
              <View style={[styles.noteCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <LinearGradient
                  colors={[LUXURY_COLORS.rose, LUXURY_COLORS.berry]}
                  style={styles.noteAvatar}
                >
                  <Feather name="user" size={14} color="#FFFFFF" />
                </LinearGradient>
                <View style={styles.noteContent}>
                  <ThemedText type="small" style={{ color: LUXURY_COLORS.rose, fontWeight: '600' }}>
                    Stylist Note
                  </ThemedText>
                  <ThemedText style={{ marginTop: 4 }}>"{selectedOutfit.stylistNote}"</ThemedText>
                </View>
              </View>
            )}

            {selectedOutfit?.weatherNote && (
              <View style={[styles.weatherCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                <Feather name="cloud" size={18} color={LUXURY_COLORS.teal} />
                <ThemedText style={{ marginLeft: Spacing.sm }}>{selectedOutfit.weatherNote}</ThemedText>
              </View>
            )}

            {selectedOutfit && !selectedOutfit.wasWorn && (
              <LinearGradient
                colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
                style={styles.markWornButton}
              >
                <Pressable onPress={handleMarkWorn} style={styles.markWornButtonInner}>
                  <Feather name="check-circle" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: '#FFFFFF', fontWeight: '700', marginLeft: Spacing.sm }}>
                    Mark as Worn
                  </ThemedText>
                </Pressable>
              </LinearGradient>
            )}

            {selectedOutfit && (
              <Pressable
                onPress={handleSeeAlternatives}
                style={[styles.alternativesButton, { borderColor: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]}
              >
                <Feather name="shuffle" size={18} color={tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold} />
                <ThemedText type="body" style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold, marginLeft: Spacing.sm }}>
                  See Alternatives
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ScreenScrollView>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={tierGradient}
        locations={[0, 0.25, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCenter}>
          <ThemedText type="h2" style={{ color: '#FFFFFF' }} numberOfLines={1}>
            {isHistorical && packageName
              ? packageName
              : `${totalDays}-Day Calendar`}
          </ThemedText>
          <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {isHistorical
              ? (t('dfy.package.savedPlan') || 'Saved plan')
              : tier === 'lite'
                ? 'Travel Capsule'
                : 'Full Wardrobe Setup'}
          </ThemedText>
        </View>
        {!isHistorical ? (
          <Pressable 
            onPress={handleRegenerateCalendar} 
            disabled={loadingAll}
            style={[styles.backButton, { opacity: loadingAll ? 0.5 : 1 }]}
          >
            <Feather name="rotate-cw" size={20} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <View style={styles.viewToggle}>
        {(['calendar', 'week', 'list'] as ViewMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode(mode);
            }}
            style={[
              styles.viewToggleButton,
              viewMode === mode && { backgroundColor: 'rgba(255,255,255,0.2)' },
            ]}
          >
            <Feather
              name={mode === 'calendar' ? 'grid' : mode === 'week' ? 'columns' : 'list'}
              size={18}
              color={viewMode === mode ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
            />
          </Pressable>
        ))}
      </View>

      {loadingAll && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md }}>
          <LinearGradient
            colors={tier === 'lite' ? [LUXURY_COLORS.coral, '#C46A4F'] : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
            style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}
          >
            <Feather name="loader" size={24} color="#FFFFFF" />
          </LinearGradient>
          <ThemedText type="body" style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
            Loading your curated outfits...
          </ThemedText>
        </View>
      )}

      {!loadingAll && viewMode === 'calendar' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.calendarCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)' }]}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                <Feather name="chevron-left" size={24} color={theme.text} />
              </Pressable>
              <ThemedText type="h3">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </ThemedText>
              <Pressable onPress={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                <Feather name="chevron-right" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.weekLabels}>
              {DAYS_OF_WEEK.map((day, i) => (
                <View key={i} style={styles.weekLabelCell}>
                  <ThemedText type="caption" style={{ opacity: 0.5 }}>{day}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => renderCalendarDay(day, index))}
            </View>
          </View>

          {selectedDate && selectedOutfit && (
            <View
              style={[styles.selectedOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)' }]}
            >
              <Pressable onPress={() => handleOutfitPress(selectedOutfit)}>
                {renderSelectedOutfitSummary(
                  selectedOutfit,
                  selectedDate,
                  <View style={[styles.outfitStatus, { backgroundColor: selectedOutfit.wasWorn ? LUXURY_COLORS.emerald : tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]}>
                    <Feather name={selectedOutfit.wasWorn ? 'check' : 'eye'} size={20} color="#FFFFFF" />
                  </View>,
                )}
                {renderOutfitStackVisual(selectedOutfit)}

                {selectedOutfit.stylistNote && (
                  <View style={{ marginTop: Spacing.md }}>
                    <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 6 }}>
                      Stylist Note
                    </ThemedText>
                    <ThemedText type="body" style={{ lineHeight: 20 }}>
                      {selectedOutfit.stylistNote}
                    </ThemedText>
                  </View>
                )}

                {selectedOutfit.weatherNote && (
                  <View style={{ marginTop: Spacing.md }}>
                    <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 6 }}>
                      Weather
                    </ThemedText>
                    <ThemedText type="body">{selectedOutfit.weatherNote}</ThemedText>
                  </View>
                )}
              </Pressable>

              <View style={styles.outfitActions}>
                <Pressable
                  onPress={handleMarkWorn}
                  style={[styles.actionButton, { backgroundColor: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold, opacity: selectedOutfit.wasWorn ? 0.5 : 1 }]}
                  disabled={selectedOutfit.wasWorn}
                >
                  <Feather name="check" size={16} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: 6 }}>
                    Mark Worn
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSeeAlternatives}
                  style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}
                >
                  <Feather name="arrow-right" size={16} color={isDark ? '#FFFFFF' : theme.text} />
                  <ThemedText type="small" style={{ color: isDark ? '#FFFFFF' : theme.text, marginLeft: 6 }}>
                    See Alternatives
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {!loadingAll && calendarOutfits.length === 0 && (
            <View style={[styles.emptyStateCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)' }]}>
              <Feather name="calendar" size={28} color={tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold} />
              <ThemedText type="body" style={{ marginTop: Spacing.md, textAlign: 'center' }}>
                No outfits in your calendar yet.
              </ThemedText>
              <ThemedText type="small" style={{ marginTop: Spacing.sm, opacity: 0.7, textAlign: 'center' }}>
                {tier === 'lite'
                  ? 'Open My Lookbook to build your 14-day plan, then return here.'
                  : 'Generate your 30-day Full Wardrobe plan to fill this calendar.'}
              </ThemedText>
              <Pressable
                onPress={() => {
                  if (tier === 'lite') {
                    navigation.navigate('DFYLookbook');
                    return;
                  }
                  void handleRegenerateCalendar();
                }}
                style={[styles.emptyStateButton, { backgroundColor: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]}
              >
                <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {tier === 'lite' ? 'Go to My Lookbook' : 'Generate 30-day plan'}
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}

      {!loadingAll && viewMode === 'week' && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: tabBarClearance }}
          showsVerticalScrollIndicator={false}
        >
          {renderWeekView()}
        </ScrollView>
      )}
      {!loadingAll && viewMode === 'list' && renderListView()}

      {renderOutfitDetail()}
      {renderAlternativesModal()}

      <DFYPackageNameModal
        visible={showPackageNamePrompt}
        defaultName={packageNameDefault}
        onClose={() => setShowPackageNamePrompt(false)}
        onSave={async (name) => {
          if (!renamePackageId) return;
          try {
            await dfyService.renameDfyPackage(renamePackageId, name);
            setPackageName(name);
          } catch {
            Alert.alert(
              t('common.error') || 'Error',
              t('dfy.package.renameFailed') || 'Could not save the plan name. Please try again.',
            );
            throw new Error('rename failed');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.lg,
    gap: 4,
  },
  viewToggleButton: {
    width: 40,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCard: {
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  selectedOutfitCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  selectedOutfitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  outfitStatus: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  weekLabels: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekLabelCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCell: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LUXURY_COLORS.gold,
  },
  selectedCell: {
    borderRadius: 20,
    backgroundColor: LUXURY_COLORS.gold,
  },
  outOfRangeCell: {
    opacity: 0.3,
  },
  dayText: {
    fontWeight: '500',
  },
  outfitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  weekView: {
    paddingHorizontal: Spacing.xl,
  },
  weekDaysRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  weekDayLabel: {
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  weekDayNumber: {
    color: '#FFFFFF',
  },
  weekOutfitIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  outfitCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitCardInfo: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
    paddingBottom: 100,
  },
  listOutfitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  listDayBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listDayThumb: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  listOutfitInfo: {
    flex: 1,
  },
  listOutfitMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  weatherNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  outfitVisualBlock: {
    marginBottom: Spacing.sm,
    overflow: 'visible',
  },
  outfitItemLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  outfitItemPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    maxWidth: '48%',
    flexGrow: 1,
  },
  calendarItemThumb: {
    marginRight: Spacing.sm,
    alignItems: 'center',
  },
  calendarItemImage: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F0EDE8',
  },
  emptyStateCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  emptyStateButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  wornBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderGradient: {
    paddingBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    padding: Spacing.xl,
  },
  outfitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  outfitGridItem: {
    flex: 0.5,
    aspectRatio: 3 / 4,
  },
  outfitGridImage: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outfitImagePlaceholder: {
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  imagePlaceholderGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  noteAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteContent: {
    flex: 1,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  markWornButton: {
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  markWornButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  alternativesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  alternativesLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  alternativesList: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  alternativeCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  wearAltButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
});
