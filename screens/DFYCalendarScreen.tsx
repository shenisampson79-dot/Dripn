import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  FlatList,
  ScrollView,
  Modal,
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
import { DFYTier, StylistId } from '@/services/DFYService';
import apiService from '@/services/ApiService';

interface WardrobeItem {
  id: string;
  name: string;
  imageUri?: string;
  category?: string;
  color?: string;
}

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

interface DFYCalendarOutfit {
  id: string;
  date: string;
  title: string;
  stylistNote: string;
  stylistId: StylistId;
  weatherNote?: string;
  wasWorn: boolean;
  alternativesCount: number;
  itemIds?: string[];
  items?: WardrobeItem[];
}

type ViewMode = 'calendar' | 'week' | 'list';

type DFYCalendarScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  route: RouteProp<{ DFYCalendar: { tier: DFYTier } }, 'DFYCalendar'>;
};

export default function DFYCalendarScreen({ navigation, route }: DFYCalendarScreenProps) {
  const tier = route.params?.tier || 'lite';
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [showOutfitDetail, setShowOutfitDetail] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<DFYCalendarOutfit | null>(null);
  const [calendarOutfits, setCalendarOutfits] = useState<DFYCalendarOutfit[]>([]);
  const [loadingDate, setLoadingDate] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [items, setItems] = useState<WardrobeItem[]>([]);

  const totalDays = tier === 'lite' ? 14 : 30;
  const startDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Load wardrobe items and outfits on mount
  useEffect(() => {
    loadWardrobe();
  }, []);

  const loadWardrobe = async () => {
    try {
      const result = await apiService.getWardrobe();
      if (result.success && result.items) {
        setItems(result.items.map((i: any) => ({
          id: i.id,
          name: i.name,
          imageUri: i.imageUri || i.image_url,
          category: i.category,
          color: i.color,
        })));
      }
    } catch (err) {
      console.log('Error loading wardrobe:', err);
    }
  };

  // Bulk-load all outfits for the full plan range on mount
  useEffect(() => {
    const loadAllOutfits = async () => {
      try {
        setLoadingAll(true);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + totalDays - 1);
        let result = await apiService.getCalendarOutfitsForRange(startDate, endDate);
        
        // If no outfits found and tier is core, generate them
        if ((!result.success || !result.outfits || result.outfits.length === 0) && tier === 'core') {
          console.log('[DFYCalendar] No outfits found for core tier. Generating...');
          try {
            await apiService.request('/api/dfy/generate-delivery', {
              method: 'POST',
              body: JSON.stringify({ tier: 'core', stylistId: 'ruby' }),
            });
            console.log('[DFYCalendar] Outfits generated. Re-fetching...');
            // Re-fetch after generation
            result = await apiService.getCalendarOutfitsForRange(startDate, endDate);
          } catch (genErr) {
            console.warn('[DFYCalendar] Failed to generate outfits:', genErr);
          }
        }
        
        if (result.success && result.outfits && result.outfits.length > 0) {
          const mapped: DFYCalendarOutfit[] = result.outfits.map(outfit => ({
            id: outfit.id,
            date: outfit.date,
            title: outfit.eventName || 'Curated Outfit',
            stylistNote: outfit.notes || '',
            stylistId: 'ruby' as StylistId,
            wasWorn: outfit.wasWorn,
            alternativesCount: 0,
            itemIds: outfit.itemIds || [],
          }));
          setCalendarOutfits(mapped);
          // Auto-select today's outfit if available
          const todayKey = formatDateKey(new Date());
          const todayOutfit = mapped.find(o => formatDateKey(new Date(o.date)) === todayKey);
          if (todayOutfit) {
            setSelectedOutfit(todayOutfit);
          }
        }
      } catch (err) {
        console.log('[DFYCalendar] Error loading all outfits:', err);
      } finally {
        setLoadingAll(false);
      }
    };
    loadAllOutfits();
  }, [startDate, totalDays, tier]);

  // Fetch outfit for a specific date from backend
  const fetchOutfitForDate = async (date: Date) => {
    try {
      setLoadingDate(formatDateKey(date));
      const result = await apiService.getOutfitForDate(date);
      if (result.success && result.outfits && result.outfits.length > 0) {
        const outfit = result.outfits[0];
        const dfiOutfit: DFYCalendarOutfit = {
          id: outfit.id,
          date: outfit.date,
          title: outfit.eventName || 'Outfit',
          stylistNote: outfit.notes || '',
          stylistId: 'ruby' as StylistId,
          wasWorn: outfit.wasWorn,
          alternativesCount: 0,
          itemIds: outfit.itemIds || [],
        };
        setCalendarOutfits(prev => {
          const idx = prev.findIndex(o => o.id === dfiOutfit.id);
          if (idx >= 0) {
            const newList = [...prev];
            newList[idx] = dfiOutfit;
            return newList;
          }
          return [...prev, dfiOutfit];
        });
        return dfiOutfit;
      }
    } catch (err) {
      console.log('Error fetching outfit for date:', err);
    } finally {
      setLoadingDate(null);
    }
    return undefined;
  };

  // Format date as YYYY-MM-DD
  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Regenerate calendar
  const handleRegenerateCalendar = async () => {
    try {
      setLoadingAll(true);
      // Generate new outfits via the API
      await apiService.generateDFYDelivery({ tier: tier as 'lite' | 'core', stylistId: 'ruby' });
      // Re-fetch after generation
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + totalDays);
      const result = await apiService.getCalendarOutfitsForRange(startDate, endDate);
      if (result.success && result.outfits && result.outfits.length > 0) {
        const mapped: DFYCalendarOutfit[] = result.outfits.map(outfit => ({
          id: outfit.id,
          date: outfit.date,
          title: outfit.eventName || 'Curated Outfit',
          stylistNote: outfit.notes || '',
          stylistId: 'ruby' as StylistId,
          wasWorn: outfit.wasWorn,
          alternativesCount: 0,
          itemIds: outfit.itemIds || [],
        }));
        setCalendarOutfits(mapped);
        // Reset selected outfit
        setSelectedOutfit(null);
      }
    } catch (err) {
      console.error('Failed to regenerate calendar:', err);
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
          <Pressable
            onPress={() => handleOutfitPress(selectedOutfit)}
            style={[styles.selectedOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' }]}
          >
            <View style={styles.outfitCardHeader}>
              <LinearGradient
                colors={tier === 'lite' ? [LUXURY_COLORS.coral, '#C46A4F'] : [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
                style={styles.outfitCardIcon}
              >
                <Feather name="image" size={20} color={tier === 'lite' ? '#FFFFFF' : LUXURY_COLORS.midnight} />
              </LinearGradient>
              <View style={styles.outfitCardInfo}>
                <ThemedText type="h3">{selectedOutfit.title}</ThemedText>
                <ThemedText type="small" style={{ opacity: 0.7 }}>{selectedOutfit.stylistNote}</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.tabIconDefault} />
            </View>
          </Pressable>
        )}
      </View>
    );
  };

  const renderListView = () => (
    <FlatList
      data={calendarOutfits}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => handleOutfitPress(item)}
          style={[styles.listOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)' }]}
        >
          <View style={[styles.listDayBadge, { backgroundColor: tier === 'lite' ? LUXURY_COLORS.coral + '20' : LUXURY_COLORS.gold + '20' }]}>
            <ThemedText type="h3" style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }}>
              {index + 1}
            </ThemedText>
            <ThemedText type="caption" style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }}>
              DAY
            </ThemedText>
          </View>
          <View style={styles.listOutfitInfo}>
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
            {selectedOutfit?.itemIds && selectedOutfit.itemIds.length > 0 ? (
              <View style={styles.outfitGrid}>
                {selectedOutfit.itemIds.map((itemId) => {
                  const item = items.find(i => i.id === itemId);
                  return (
                    <View key={itemId} style={styles.outfitGridItem}>
                      <View style={[styles.outfitGridImage, { backgroundColor: isDark ? '#1A1A2E' : '#F8F4F0' }]}>
                        {item?.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                        ) : (
                          <Feather name="image" size={48} color={theme.tabIconDefault} />
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
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

            {selectedOutfit && selectedOutfit.alternativesCount > 0 && (
              <Pressable style={[styles.alternativesButton, { borderColor: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]}>
                <Feather name="shuffle" size={18} color={tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold} />
                <ThemedText type="body" style={{ color: tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold, marginLeft: Spacing.sm }}>
                  View {selectedOutfit.alternativesCount} Alternative{selectedOutfit.alternativesCount > 1 ? 's' : ''}
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
          <ThemedText type="h2" style={{ color: '#FFFFFF' }}>
            {totalDays}-Day Calendar
          </ThemedText>
          <ThemedText type="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
            {tier === 'lite' ? 'Outfit-Based Setup' : 'Core Wardrobe Setup'}
          </ThemedText>
        </View>
        <Pressable 
          onPress={handleRegenerateCalendar} 
          disabled={loadingAll}
          style={[styles.backButton, { opacity: loadingAll ? 0.5 : 1 }]}
        >
          <Feather name="rotate-cw" size={20} color="#FFFFFF" />
        </Pressable>
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
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
            <Pressable
              onPress={() => handleOutfitPress(selectedOutfit)}
              style={[styles.selectedOutfitCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.95)' }]}
            >
              <View style={styles.selectedOutfitHeader}>
                <View>
                  <ThemedText type="small" style={{ opacity: 0.6, marginBottom: 4 }}>
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short' })}
                  </ThemedText>
                  <ThemedText type="h3">
                    {selectedOutfit.title}
                  </ThemedText>
                  <ThemedText type="caption" style={{ opacity: 0.6, marginTop: 4 }}>
                    {selectedOutfit.alternativesCount} alternatives available
                  </ThemedText>
                </View>
                <View style={[styles.outfitStatus, { backgroundColor: selectedOutfit.wasWorn ? LUXURY_COLORS.emerald : tier === 'lite' ? LUXURY_COLORS.coral : LUXURY_COLORS.gold }]}>
                  <Feather name={selectedOutfit.wasWorn ? 'check' : 'eye'} size={20} color="#FFFFFF" />
                </View>
              </View>

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
                <Pressable style={[styles.actionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  <ThemedText type="small" style={{ color: '#FFFFFF', marginLeft: 6 }}>
                    See Alternatives
                  </ThemedText>
                </Pressable>
              </View>
            </Pressable>
          )}
        </ScrollView>
      )}

      {!loadingAll && viewMode === 'week' && renderWeekView()}
      {!loadingAll && viewMode === 'list' && renderListView()}

      {renderOutfitDetail()}
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
  selectedOutfitCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
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
});
