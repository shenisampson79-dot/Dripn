import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useWardrobe, WardrobeItem, PlannedOutfit, PlannedEventType } from '@/contexts/WardrobeContext';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';
import { apiService } from '@/services/ApiService';

type OutfitCalendarScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'OutfitCalendar'>;
};

const getSecondaryTextColor = (isDark: boolean) => isDark ? '#B0B0B0' : '#666666';
const getTertiaryTextColor = (isDark: boolean) => isDark ? '#707070' : '#999999';

const EVENT_TYPES: { value: PlannedEventType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'work', label: 'Work', icon: 'briefcase' },
  { value: 'casual', label: 'Casual', icon: 'coffee' },
  { value: 'date-night', label: 'Date Night', icon: 'heart' },
  { value: 'party', label: 'Party', icon: 'music' },
  { value: 'wedding', label: 'Wedding', icon: 'gift' },
  { value: 'formal', label: 'Formal Event', icon: 'star' },
  { value: 'workout', label: 'Workout', icon: 'activity' },
  { value: 'travel', label: 'Travel', icon: 'map-pin' },
  { value: 'everyday', label: 'Everyday', icon: 'sun' },
];

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function OutfitCalendarScreen({ navigation }: OutfitCalendarScreenProps) {
  const { theme, isDark } = useTheme();
  const secondaryTextColor = getSecondaryTextColor(isDark);
  const tertiaryTextColor = getTertiaryTextColor(isDark);
  const { 
    items, 
    plannedOutfits, 
    savedOutfits,
    planOutfit, 
    deletePlannedOutfit, 
    markPlannedOutfitWorn,
    getItemsByCategory 
  } = useWardrobe();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showItemSelector, setShowItemSelector] = useState(false);
  
  const [newEventName, setNewEventName] = useState('');
  const [newEventType, setNewEventType] = useState<PlannedEventType>('casual');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  
  const [showAIModal, setShowAIModal] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [generatingDays, setGeneratingDays] = useState<number>(7);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const plannedOutfitsByDate = useMemo(() => {
    const map: Record<string, PlannedOutfit[]> = {};
    plannedOutfits.forEach(outfit => {
      const dateKey = outfit.date.split('T')[0];
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(outfit);
    });
    return map;
  }, [plannedOutfits]);

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days: (number | null)[] = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  }, [currentDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDayPress = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
  };

  const getPlannedOutfitsForDay = (day: number): PlannedOutfit[] => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = formatDateKey(date);
    return plannedOutfitsByDate[dateKey] || [];
  };

  const selectedDateOutfits = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = formatDateKey(selectedDate);
    return plannedOutfitsByDate[dateKey] || [];
  }, [selectedDate, plannedOutfitsByDate]);

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isPastDate = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleAddOutfit = () => {
    setNewEventName('');
    setNewEventType('casual');
    setSelectedItems([]);
    setNotes('');
    setShowAddModal(true);
  };

  const handleSaveOutfit = async () => {
    if (!selectedDate) return;
    
    if (selectedItems.length === 0) {
      Alert.alert('No Items Selected', 'Please select at least one item for your outfit.');
      return;
    }

    try {
      await planOutfit({
        date: selectedDate.toISOString(),
        itemIds: selectedItems,
        eventName: newEventName || undefined,
        eventType: newEventType,
        notes: notes || undefined,
      });
      setShowAddModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save outfit plan.');
    }
  };

  const handleDeleteOutfit = (id: string) => {
    Alert.alert(
      'Delete Outfit Plan',
      'Are you sure you want to remove this planned outfit?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deletePlannedOutfit(id)
        },
      ]
    );
  };

  const handleMarkWorn = async (id: string) => {
    try {
      await markPlannedOutfitWorn(id);
      Alert.alert('Success', 'Outfit marked as worn! Wear counts updated.');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark outfit as worn.');
    }
  };

  const handleAICreateOutfits = () => {
    if (items.length < 3) {
      Alert.alert(
        "Need More Items",
        "Add at least 3 items to your wardrobe for AI to create outfit combinations.",
        [{ text: "OK" }]
      );
      return;
    }
    setShowAIModal(true);
  };

  const generateAIOutfitsForWeek = async () => {
    setIsGeneratingAI(true);
    try {
      const occasionTypes: Array<'todays_look' | 'work_outfit' | 'date_night' | 'casual_day'> = [
        'casual_day', 'work_outfit', 'casual_day', 'work_outfit', 
        'casual_day', 'date_night', 'casual_day'
      ];
      
      const today = new Date();
      let successCount = 0;
      
      for (let i = 0; i < generatingDays; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        
        const occasionType = occasionTypes[i % occasionTypes.length];
        
        try {
          const result = await apiService.generateOutfit({
            occasionType,
          });
          
          if (result.success && result.outfit && result.outfit.items.length > 0) {
            const itemIds = result.outfit.items.map((item: any) => item.id);
            
            const eventTypeMap: Record<string, PlannedEventType> = {
              'todays_look': 'everyday',
              'work_outfit': 'work',
              'date_night': 'date-night',
              'casual_day': 'casual',
            };
            
            await planOutfit({
              date: targetDate.toISOString(),
              itemIds,
              eventName: result.outfit.vibe || `AI ${occasionType.replace('_', ' ')}`,
              eventType: eventTypeMap[occasionType] || 'casual',
              notes: 'Created by AI Stylist',
            });
            successCount++;
          }
        } catch (err) {
          console.log(`Failed to generate outfit for day ${i + 1}:`, err);
        }
      }
      
      setShowAIModal(false);
      
      if (successCount > 0) {
        Alert.alert(
          "Outfits Created!",
          `AI created ${successCount} outfit${successCount > 1 ? 's' : ''} for the next ${generatingDays} days.`,
          [{ text: "View Calendar", onPress: () => setSelectedDate(today) }]
        );
      } else {
        Alert.alert("No Outfits Created", "AI couldn't create outfits. Try adding more variety to your wardrobe.");
      }
    } catch (error) {
      console.error('AI outfit generation error:', error);
      Alert.alert('Error', 'Failed to generate AI outfits. Please try again.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const getItemById = (itemId: string): WardrobeItem | undefined => {
    return items.find(item => item.id === itemId);
  };

  const getEventIcon = (eventType?: PlannedEventType): keyof typeof Feather.glyphMap => {
    if (!eventType) return 'calendar';
    const event = EVENT_TYPES.find(e => e.value === eventType);
    return event?.icon || 'calendar';
  };

  const getEventLabel = (eventType?: PlannedEventType): string => {
    if (!eventType) return '';
    const event = EVENT_TYPES.find(e => e.value === eventType);
    return event?.label || '';
  };

  const renderCalendarDay = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const outfitsForDay = getPlannedOutfitsForDay(day);
    const hasOutfits = outfitsForDay.length > 0;
    const isSelected = selectedDate?.getDate() === day && 
                       selectedDate?.getMonth() === currentDate.getMonth() &&
                       selectedDate?.getFullYear() === currentDate.getFullYear();
    const past = isPastDate(day);
    const wornOnDay = outfitsForDay.some(o => o.wasWorn);

    return (
      <Pressable
        key={`day-${day}`}
        onPress={() => handleDayPress(day)}
        style={[
          styles.dayCell,
          isToday(day) ? [styles.todayCell, { borderColor: theme.link }] : null,
          isSelected ? [styles.selectedCell, { backgroundColor: theme.link }] : null,
        ]}
      >
        <ThemedText
          type="body"
          style={[
            styles.dayText,
            isSelected ? { color: '#FFFFFF' } : null,
            past && !isSelected ? { opacity: 0.5 } : null,
          ]}
        >
          {day}
        </ThemedText>
        {hasOutfits ? (
          <View style={styles.dotsContainer}>
            {outfitsForDay.slice(0, 3).map((outfit, i) => (
              <View
                key={outfit.id}
                style={[
                  styles.outfitDot,
                  { backgroundColor: outfit.wasWorn ? theme.success : theme.link },
                ]}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderOutfitItem = ({ item }: { item: PlannedOutfit }) => {
    const outfitItems = item.itemIds.map(id => getItemById(id)).filter(Boolean) as WardrobeItem[];
    const eventLabel = getEventLabel(item.eventType);

    return (
      <Card elevation={1} style={styles.outfitCard}>
        <View style={styles.outfitCardHeader}>
          <View style={styles.outfitCardInfo}>
            <Feather 
              name={getEventIcon(item.eventType)} 
              size={20} 
              color={theme.link} 
            />
            <View style={styles.outfitCardText}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                {item.eventName || 'Planned Outfit'}
              </ThemedText>
              <ThemedText type="caption" style={{ color: secondaryTextColor }}>
                {eventLabel ? `${eventLabel} • ` : ''}{outfitItems.length} items
              </ThemedText>
            </View>
          </View>
          {item.wasWorn ? (
            <View style={[styles.wornBadge, { backgroundColor: theme.success }]}>
              <Feather name="check" size={12} color="#FFFFFF" />
              <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: 4 }}>
                Worn
              </ThemedText>
            </View>
          ) : null}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.outfitItemsScroll}
        >
          {outfitItems.map(wardrobeItem => (
            <View 
              key={wardrobeItem.id} 
              style={[styles.outfitItemThumb, { backgroundColor: theme.backgroundSecondary }]}
            >
              {wardrobeItem.imageUri ? (
                <Image
                  source={{ uri: wardrobeItem.imageUri }}
                  style={styles.outfitItemImage}
                  contentFit="cover"
                />
              ) : (
                <Feather name="image" size={24} color={tertiaryTextColor} />
              )}
            </View>
          ))}
        </ScrollView>

        {item.notes ? (
          <ThemedText type="caption" style={[styles.notesText, { color: secondaryTextColor }]}>
            {item.notes}
          </ThemedText>
        ) : null}

        <View style={styles.outfitCardActions}>
          {!item.wasWorn ? (
            <Pressable
              onPress={() => handleMarkWorn(item.id)}
              style={[styles.actionButton, { backgroundColor: theme.success }]}
            >
              <Feather name="check-circle" size={16} color="#FFFFFF" />
              <ThemedText type="caption" style={{ color: '#FFFFFF', marginLeft: 4 }}>
                Mark as Worn
              </ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => handleDeleteOutfit(item.id)}
            style={[styles.actionButton, { backgroundColor: theme.error }]}
          >
            <Feather name="trash-2" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      </Card>
    );
  };

  const renderWardrobeItem = ({ item }: { item: WardrobeItem }) => {
    const isSelected = selectedItems.includes(item.id);

    return (
      <Pressable
        onPress={() => toggleItemSelection(item.id)}
        style={[
          styles.wardrobeItemCard,
          { backgroundColor: theme.backgroundSecondary },
          isSelected ? { borderColor: theme.link, borderWidth: 2 } : null,
        ]}
      >
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.wardrobeItemImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.wardrobeItemPlaceholder, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather name="image" size={32} color={tertiaryTextColor} />
          </View>
        )}
        <View style={styles.wardrobeItemInfo}>
          <ThemedText type="caption" numberOfLines={1}>
            {item.name}
          </ThemedText>
          <ThemedText type="caption" style={{ color: tertiaryTextColor }}>
            {item.category}
          </ThemedText>
        </View>
        {isSelected ? (
          <View style={[styles.checkBadge, { backgroundColor: theme.link }]}>
            <Feather name="check" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2">Outfit Calendar</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <Card elevation={1} style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={goToPreviousMonth} style={styles.monthNavButton}>
            <Feather name="chevron-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h3">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </ThemedText>
          <Pressable onPress={goToNextMonth} style={styles.monthNavButton}>
            <Feather name="chevron-right" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.weekDaysRow}>
          {DAYS_OF_WEEK.map(day => (
            <View key={day} style={styles.weekDayCell}>
              <ThemedText type="caption" style={{ color: secondaryTextColor }}>
                {day}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => renderCalendarDay(day, index))}
        </View>
      </Card>

      <Pressable
        onPress={handleAICreateOutfits}
        style={styles.aiCreateButton}
      >
        <LinearGradient
          colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.aiCreateButtonGradient}
        >
          <Feather name="cpu" size={18} color="#FFFFFF" />
          <ThemedText type="body" style={styles.aiCreateButtonText}>
            Get Styled by Your AI Stylist
          </ThemedText>
          <Feather name="chevron-right" size={18} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>

      {selectedDate ? (
        <View style={styles.selectedDateSection}>
          <View style={styles.selectedDateHeader}>
            <ThemedText type="h3">
              {selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </ThemedText>
            <Pressable
              onPress={handleAddOutfit}
              style={[styles.addButton, { backgroundColor: theme.link }]}
            >
              <Feather name="plus" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          {selectedDateOutfits.length > 0 ? (
            <FlatList
              data={selectedDateOutfits}
              renderItem={renderOutfitItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.outfitsList}
            />
          ) : (
            <Card elevation={1} style={styles.emptyCard}>
              <Feather name="calendar" size={40} color={tertiaryTextColor} />
              <ThemedText type="body" style={[styles.emptyText, { color: secondaryTextColor }]}>
                No outfits scheduled for this day
              </ThemedText>
              <Pressable
                onPress={handleAddOutfit}
                style={[styles.planButton, { backgroundColor: theme.link }]}
              >
                <Feather name="plus" size={16} color="#FFFFFF" />
                <ThemedText type="body" style={{ color: '#FFFFFF', marginLeft: 8 }}>
                  Add Outfit
                </ThemedText>
              </Pressable>
            </Card>
          )}
        </View>
      ) : (
        <Card elevation={1} style={styles.selectDateCard}>
          <Feather name="calendar" size={40} color={tertiaryTextColor} />
          <ThemedText type="body" style={[styles.emptyText, { color: secondaryTextColor }]}>
            Select a date to view your outfits
          </ThemedText>
        </Card>
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAddModal(false)}>
              <ThemedText type="body" style={{ color: theme.link }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3">Plan Outfit</ThemedText>
            <Pressable onPress={handleSaveOutfit}>
              <ThemedText type="body" style={{ color: theme.link, fontWeight: '600' }}>
                Save
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Event Name (Optional)
            </ThemedText>
            <TextInput
              value={newEventName}
              onChangeText={setNewEventName}
              placeholder="e.g., Birthday Party, Work Meeting"
              placeholderTextColor={tertiaryTextColor}
              style={[
                styles.input,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Event Type
            </ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.eventTypesScroll}
            >
              {EVENT_TYPES.map(eventType => (
                <Pressable
                  key={eventType.value}
                  onPress={() => setNewEventType(eventType.value)}
                  style={[
                    styles.eventTypeChip,
                    { 
                      backgroundColor: newEventType === eventType.value 
                        ? theme.link 
                        : theme.backgroundSecondary,
                    },
                  ]}
                >
                  <Feather 
                    name={eventType.icon} 
                    size={16} 
                    color={newEventType === eventType.value ? '#FFFFFF' : theme.text} 
                  />
                  <ThemedText 
                    type="caption" 
                    style={{ 
                      color: newEventType === eventType.value ? '#FFFFFF' : theme.text,
                      marginLeft: 6,
                    }}
                  >
                    {eventType.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Select Outfit Items ({selectedItems.length} selected)
            </ThemedText>
            
            {items.length > 0 ? (
              <FlatList
                data={items}
                renderItem={renderWardrobeItem}
                keyExtractor={item => item.id}
                numColumns={3}
                scrollEnabled={false}
                contentContainerStyle={styles.wardrobeGrid}
                columnWrapperStyle={styles.wardrobeRow}
              />
            ) : (
              <Card elevation={2} style={styles.noItemsCard}>
                <Feather name="inbox" size={32} color={tertiaryTextColor} />
                <ThemedText type="body" style={{ color: secondaryTextColor, marginTop: 8 }}>
                  No items in your wardrobe yet
                </ThemedText>
                <Pressable
                  onPress={() => {
                    setShowAddModal(false);
                    navigation.navigate('AddWardrobeItem');
                  }}
                  style={[styles.addItemButton, { backgroundColor: theme.link }]}
                >
                  <ThemedText type="caption" style={{ color: '#FFFFFF' }}>
                    Add Items
                  </ThemedText>
                </Pressable>
              </Card>
            )}

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Notes (Optional)
            </ThemedText>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special notes for this outfit..."
              placeholderTextColor={tertiaryTextColor}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.notesInput,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
            />

            <View style={{ height: 100 }} />
          </ScrollView>
        </ThemedView>
      </Modal>

      <Modal
        visible={showAIModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIModal(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowAIModal(false)}>
              <ThemedText type="body" style={{ color: theme.link }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3">AI Outfit Planner</ThemedText>
            <View style={{ width: 50 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.aiModalHeader}>
              <LinearGradient
                colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
                style={styles.aiModalIcon}
              >
                <Feather name="cpu" size={32} color="#FFFFFF" />
              </LinearGradient>
              <ThemedText type="h3" style={{ marginTop: Spacing.md, textAlign: 'center' }}>
                Create Outfits for the Week
              </ThemedText>
              <ThemedText type="body" style={[styles.aiModalDescription, { color: secondaryTextColor }]}>
                AI will create {generatingDays} outfit combinations from your {items.length} wardrobe items
              </ThemedText>
            </View>

            <ThemedText type="caption" style={[styles.sectionLabel, { color: secondaryTextColor }]}>
              Number of Days
            </ThemedText>
            <View style={styles.daysSelector}>
              {[3, 5, 7].map(days => (
                <Pressable
                  key={days}
                  onPress={() => setGeneratingDays(days)}
                  style={[
                    styles.dayOption,
                    generatingDays === days 
                      ? { backgroundColor: theme.link } 
                      : { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }
                  ]}
                >
                  <ThemedText 
                    type="body" 
                    style={{ 
                      color: generatingDays === days ? '#FFFFFF' : theme.text,
                      fontWeight: '600' 
                    }}
                  >
                    {days} Days
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Card elevation={1} style={styles.aiInfoCard}>
              <Feather name="info" size={16} color={theme.link} />
              <ThemedText type="caption" style={[styles.aiInfoText, { color: secondaryTextColor }]}>
                AI will create a mix of work, casual, and date night outfits based on your Style DNA and wardrobe items.
              </ThemedText>
            </Card>

            <Pressable
              onPress={generateAIOutfitsForWeek}
              disabled={isGeneratingAI}
              style={[styles.generateButton, { opacity: isGeneratingAI ? 0.7 : 1 }]}
            >
              <LinearGradient
                colors={[LuxuryColors.violet, LuxuryColors.deepViolet]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateButtonGradient}
              >
                {isGeneratingAI ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <ThemedText type="body" style={styles.generateButtonText}>
                      Creating Outfits...
                    </ThemedText>
                  </>
                ) : (
                  <>
                    <Feather name="zap" size={20} color="#FFFFFF" />
                    <ThemedText type="body" style={styles.generateButtonText}>
                      Generate {generatingDays} Outfits
                    </ThemedText>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            <View style={{ height: 100 }} />
          </ScrollView>
        </ThemedView>
      </Modal>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
  },
  calendarCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  monthNavButton: {
    padding: Spacing.sm,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
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
    paddingVertical: Spacing.xs,
  },
  todayCell: {
    borderWidth: 2,
    borderRadius: BorderRadius.full,
  },
  selectedCell: {
    borderRadius: BorderRadius.full,
  },
  dayText: {
    fontSize: 14,
  },
  dotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 4,
    gap: 2,
  },
  outfitDot: {
    width: 5,
    height: 5,
    borderRadius: BorderRadius.full,
  },
  selectedDateSection: {
    paddingHorizontal: Spacing.lg,
  },
  selectedDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitsList: {
    gap: Spacing.md,
  },
  outfitCard: {
    marginBottom: Spacing.md,
  },
  outfitCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  outfitCardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  outfitCardText: {
    gap: 2,
  },
  wornBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  outfitItemsScroll: {
    marginBottom: Spacing.md,
  },
  outfitItemThumb: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  outfitItemImage: {
    width: '100%',
    height: '100%',
  },
  notesText: {
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },
  outfitCardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  emptyText: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  selectDateCard: {
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  input: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  eventTypesScroll: {
    marginVertical: Spacing.sm,
  },
  eventTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  wardrobeGrid: {
    paddingVertical: Spacing.md,
  },
  wardrobeRow: {
    justifyContent: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  wardrobeItemCard: {
    width: '31%',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  wardrobeItemImage: {
    width: '100%',
    aspectRatio: 1,
  },
  wardrobeItemPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardrobeItemInfo: {
    padding: Spacing.sm,
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noItemsCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  addItemButton: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  aiCreateButton: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  aiCreateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  aiCreateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  aiModalHeader: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  aiModalIcon: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiModalDescription: {
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  daysSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  dayOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  aiInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  aiInfoText: {
    flex: 1,
    lineHeight: 18,
  },
  generateButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  generateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
