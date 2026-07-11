import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from "@/contexts/TranslationContext";
import {
  useSustainability,
  getEcoRatingColor,
  getEcoRatingLabel,
  EcoRating,
  SustainabilityTip,
  BrandSustainabilityInfo,
} from '@/contexts/SustainabilityContext';

type TabType = 'dashboard' | 'brands' | 'tips';

export default function SustainabilityScreen() {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuth();
  const {
    sustainablePurchases,
    carbonFootprint,
    goals,
    isLoading,
    getSustainabilityTips,
    getTopSustainableBrands,
    getEcoScoreBreakdown,
    refreshData,
    addGoal,
  } = useSustainability();

  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [refreshing, setRefreshing] = useState(false);
  const [tips, setTips] = useState<SustainabilityTip[]>([]);
  const [topBrands, setTopBrands] = useState<BrandSustainabilityInfo[]>([]);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState('');

  useFocusEffect(
    useCallback(() => {
      setTips(getSustainabilityTips());
      setTopBrands(getTopSustainableBrands());
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setTips(getSustainabilityTips());
    setTopBrands(getTopSustainableBrands());
    setRefreshing(false);
  }, [refreshData]);

  const [isAddingGoal, setIsAddingGoal] = useState(false);

  const handleAddGoal = useCallback(async () => {
    if (!newGoalTitle.trim()) {
      Alert.alert(t('sustainability.goalRequired'), t('sustainability.enterGoalTitle'));
      return;
    }
    const target = parseInt(newGoalTarget, 10);
    if (isNaN(target) || target <= 0) {
      Alert.alert(t('sustainability.invalidTarget'), t('sustainability.enterValidTarget'));
      return;
    }
    setIsAddingGoal(true);
    try {
      await addGoal({
        title: newGoalTitle.trim(),
        description: newGoalTitle.trim(),
        targetValue: target,
        unit: 'items',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setNewGoalTitle('');
      setNewGoalTarget('');
      setShowGoalModal(false);
    } catch (error) {
      Alert.alert(t('common.error'), t('sustainability.failedAddGoal'));
    } finally {
      setIsAddingGoal(false);
    }
  }, [newGoalTitle, newGoalTarget, addGoal]);

  const ecoScoreBreakdown = getEcoScoreBreakdown();

  const renderEcoScoreRing = () => {
    const score = carbonFootprint.ecoScore;
    const circumference = 2 * Math.PI * 45;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    const scoreColor = score >= 70 ? '#00B894' : score >= 40 ? '#C87941' : '#C94C5A';

    return (
      <View style={styles.scoreRingContainer}>
        <View style={styles.scoreRingOuter}>
          <View style={[styles.scoreRingBackground, { borderColor: theme.backgroundSecondary }]} />
          <View 
            style={[
              styles.scoreRingProgress, 
              { 
                borderColor: scoreColor,
                transform: [{ rotate: '-90deg' }],
              }
            ]} 
          />
          <View style={styles.scoreRingContent}>
            <ThemedText type="h1" style={{ color: scoreColor, fontSize: 34 }}>
              {score}
            </ThemedText>
            <ThemedText type="small" style={{ opacity: 0.7 }}>
              Eco Score
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  const renderStatCard = (icon: string, label: string, value: string | number, color: string) => (
    <View style={[styles.statCard, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={{ opacity: 0.7 }}>
        {label}
      </ThemedText>
    </View>
  );

  const renderMonthlyChart = () => {
    const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const maxValue = Math.max(...carbonFootprint.monthlyCarbon, 10);
    const currentMonth = new Date().getMonth();

    return (
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Feather name="trending-up" size={20} color={theme.link} />
          <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
            Carbon Saved by Month
          </ThemedText>
        </View>
        <View style={styles.chartContainer}>
          {carbonFootprint.monthlyCarbon.map((value, index) => {
            const height = maxValue > 0 ? (value / maxValue) * 80 : 0;
            const isCurrentMonth = index === currentMonth;
            
            return (
              <View key={index} style={styles.chartBarContainer}>
                <View 
                  style={[
                    styles.chartBar,
                    { 
                      height: Math.max(4, height),
                      backgroundColor: isCurrentMonth ? theme.link : theme.backgroundSecondary,
                    },
                  ]}
                />
                <ThemedText 
                  type="caption" 
                  style={{ 
                    marginTop: 4, 
                    opacity: isCurrentMonth ? 1 : 0.5,
                    fontWeight: isCurrentMonth ? '600' : '400',
                  }}
                >
                  {months[index]}
                </ThemedText>
              </View>
            );
          })}
        </View>
        <ThemedText type="small" style={{ opacity: 0.7, marginTop: Spacing.md, textAlign: 'center' }}>
          Total: {carbonFootprint.carbonSaved.toFixed(1)} kg CO2 saved this year
        </ThemedText>
      </Card>
    );
  };

  const renderGoalsSection = () => {
    if (goals.length === 0) {
      return (
        <Card style={styles.emptyGoalsCard}>
          <Feather name="target" size={32} color={theme.tabIconDefault} />
          <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7, textAlign: 'center' }}>
            Set sustainability goals to track your eco-friendly fashion journey
          </ThemedText>
          <Pressable
            onPress={() => setShowGoalModal(true)}
            style={({ pressed }) => [
              styles.addGoalButton,
              { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: '#FFFFFF', marginLeft: Spacing.xs }}>
              Add Goal
            </ThemedText>
          </Pressable>
        </Card>
      );
    }

    return (
      <Card style={styles.goalsCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Feather name="target" size={20} color={theme.link} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Your Goals
            </ThemedText>
          </View>
          <ThemedText type="small" style={{ opacity: 0.7 }}>
            {goals.filter(g => g.isCompleted).length}/{goals.length} completed
          </ThemedText>
        </View>
        {goals.slice(0, 3).map((goal) => {
          const progress = (goal.currentValue / goal.targetValue) * 100;
          return (
            <View key={goal.id} style={styles.goalItem}>
              <View style={styles.goalHeader}>
                <ThemedText type="body">{goal.title}</ThemedText>
                <ThemedText type="small" style={{ color: theme.link }}>
                  {goal.currentValue}/{goal.targetValue} {goal.unit}
                </ThemedText>
              </View>
              <View style={[styles.progressBarBackground, { backgroundColor: theme.backgroundSecondary }]}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${Math.min(100, progress)}%`,
                      backgroundColor: goal.isCompleted ? '#00B894' : theme.link,
                    },
                  ]} 
                />
              </View>
            </View>
          );
        })}
      </Card>
    );
  };

  const renderEcoRatingBadge = (rating: EcoRating) => {
    const color = getEcoRatingColor(rating);
    return (
      <View style={[styles.ecoRatingBadge, { backgroundColor: color }]}>
        <ThemedText type="small" style={{ color: '#FFFFFF', fontWeight: '700' }}>
          {rating}
        </ThemedText>
      </View>
    );
  };

  const renderBrandCard = (brand: BrandSustainabilityInfo) => (
    <Card key={brand.name} style={styles.brandCard}>
      <View style={styles.brandHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3">{brand.name}</ThemedText>
          <ThemedText type="small" style={{ color: getEcoRatingColor(brand.ecoRating), marginTop: 2 }}>
            {getEcoRatingLabel(brand.ecoRating)}
          </ThemedText>
        </View>
        {renderEcoRatingBadge(brand.ecoRating)}
      </View>

      <ThemedText type="body" style={{ opacity: 0.8, marginTop: Spacing.sm }}>
        {brand.description}
      </ThemedText>

      <View style={styles.certificationsRow}>
        {brand.certifications.slice(0, 3).map((cert, idx) => (
          <View key={idx} style={[styles.certBadge, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="caption">{cert}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.practicesRow}>
        {brand.ethicalLabor ? (
          <View style={styles.practiceItem}>
            <Feather name="users" size={14} color="#00B894" />
            <ThemedText type="caption" style={{ marginLeft: 4, color: '#00B894' }}>
              Ethical Labour
            </ThemedText>
          </View>
        ) : null}
        {brand.veganFriendly ? (
          <View style={styles.practiceItem}>
            <Feather name="heart" size={14} color="#00B894" />
            <ThemedText type="caption" style={{ marginLeft: 4, color: '#00B894' }}>
              Vegan
            </ThemedText>
          </View>
        ) : null}
        {brand.recycledMaterials ? (
          <View style={styles.practiceItem}>
            <Feather name="refresh-cw" size={14} color="#00B894" />
            <ThemedText type="caption" style={{ marginLeft: 4, color: '#00B894' }}>
              Recycled
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.carbonScoreRow}>
        <Feather name="activity" size={14} color={theme.link} />
        <ThemedText type="small" style={{ marginLeft: Spacing.xs }}>
          Carbon Footprint Score: {brand.carbonFootprintScore}/100
        </ThemedText>
      </View>
    </Card>
  );

  const getTipIcon = (category: SustainabilityTip['category']): string => {
    switch (category) {
      case 'shopping':
        return 'shopping-bag';
      case 'care':
        return 'droplet';
      case 'disposal':
        return 'trash-2';
      default:
        return 'info';
    }
  };

  const getImpactColor = (level: SustainabilityTip['impactLevel']): string => {
    switch (level) {
      case 'high':
        return '#00B894';
      case 'medium':
        return '#0077B6';
      default:
        return '#9BA1A6';
    }
  };

  const renderTipCard = (tip: SustainabilityTip) => (
    <Card key={tip.id} style={styles.tipCard}>
      <View style={styles.tipHeader}>
        <View style={[styles.tipIconContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name={getTipIcon(tip.category) as any} size={20} color={theme.link} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="h3">{tip.title}</ThemedText>
          <View style={styles.tipMeta}>
            <View style={[styles.impactBadge, { backgroundColor: getImpactColor(tip.impactLevel) + '20' }]}>
              <ThemedText type="caption" style={{ color: getImpactColor(tip.impactLevel), fontWeight: '600' }}>
                {tip.impactLevel.charAt(0).toUpperCase() + tip.impactLevel.slice(1)} Impact
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
      <ThemedText type="body" style={{ opacity: 0.8, marginTop: Spacing.sm }}>
        {tip.description}
      </ThemedText>
    </Card>
  );

  const renderDashboard = () => (
    <>
      <Card style={styles.scoreCard}>
        <View style={styles.scoreCardContent}>
          {renderEcoScoreRing()}
          <View style={styles.scoreDetails}>
            <ThemedText type="h3">Your Eco Journey</ThemedText>
            <ThemedText type="body" style={{ opacity: 0.7, marginTop: Spacing.xs }}>
              {carbonFootprint.ecoScore >= 70
                ? 'Outstanding! You are a sustainability champion.'
                : carbonFootprint.ecoScore >= 40
                ? 'Good progress! Keep making eco-conscious choices.'
                : 'Just getting started. Every sustainable choice counts!'}
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.statsGrid}>
        {renderStatCard('leaf', 'CO2 Saved', `${carbonFootprint.carbonSaved.toFixed(1)}kg`, '#00B894')}
        {renderStatCard('git-branch', 'Trees Equivalent', carbonFootprint.treesEquivalent, '#0077B6')}
        {renderStatCard('shopping-bag', 'Sustainable Items', carbonFootprint.sustainablePurchases, '#9B7EBD')}
        {renderStatCard('award', 'Eco Purchases', `${carbonFootprint.totalPurchases > 0 ? Math.round((carbonFootprint.sustainablePurchases / carbonFootprint.totalPurchases) * 100) : 0}%`, '#C87941')}
      </View>

      {renderMonthlyChart()}

      {renderGoalsSection()}

      <Card style={styles.breakdownCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <Feather name="pie-chart" size={20} color={theme.link} />
            <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
              Score Breakdown
            </ThemedText>
          </View>
        </View>
        {ecoScoreBreakdown.map((item, index) => (
          <View key={index} style={styles.breakdownItem}>
            <View style={styles.breakdownLabel}>
              <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
              <ThemedText type="body">{item.label}</ThemedText>
            </View>
            <View style={styles.breakdownBarContainer}>
              <View style={[styles.breakdownBarBackground, { backgroundColor: theme.backgroundSecondary }]}>
                <View 
                  style={[
                    styles.breakdownBarFill, 
                    { 
                      width: `${item.value}%`,
                      backgroundColor: item.color,
                    },
                  ]} 
                />
              </View>
              <ThemedText type="small" style={{ width: 40, textAlign: 'right' }}>
                {item.value}%
              </ThemedText>
            </View>
          </View>
        ))}
      </Card>

      {sustainablePurchases.length > 0 ? (
        <Card style={styles.recentPurchasesCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Feather name="clock" size={20} color={theme.link} />
              <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
                Recent Sustainable Purchases
              </ThemedText>
            </View>
          </View>
          {sustainablePurchases.slice(0, 3).map((purchase) => (
            <View key={purchase.id} style={styles.purchaseItem}>
              <View style={{ flex: 1 }}>
                <ThemedText type="body">{purchase.itemName}</ThemedText>
                <ThemedText type="small" style={{ opacity: 0.7 }}>
                  {purchase.brand} - {purchase.carbonSaved.toFixed(1)}kg CO2 saved
                </ThemedText>
              </View>
              {renderEcoRatingBadge(purchase.ecoRating)}
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );

  const renderBrandsTab = () => (
    <>
      <Card style={styles.brandsIntroCard}>
        <Feather name="award" size={24} color={theme.link} />
        <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
          Sustainable Fashion Leaders
        </ThemedText>
        <ThemedText type="body" style={{ opacity: 0.7, marginTop: Spacing.xs, textAlign: 'center' }}>
          Discover brands committed to ethical and eco-friendly fashion practices
        </ThemedText>
      </Card>

      <View style={styles.ratingLegend}>
        {(['A+', 'A', 'B', 'C'] as EcoRating[]).map((rating) => (
          <View key={rating} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: getEcoRatingColor(rating) }]} />
            <ThemedText type="caption">
              {rating}: {getEcoRatingLabel(rating)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.brandsContainer}>
        {topBrands.map(renderBrandCard)}
      </View>
    </>
  );

  const renderTipsTab = () => (
    <>
      <Card style={styles.tipsIntroCard}>
        <Feather name="book-open" size={24} color={theme.link} />
        <ThemedText type="h3" style={{ marginTop: Spacing.sm }}>
          Sustainable Fashion Tips
        </ThemedText>
        <ThemedText type="body" style={{ opacity: 0.7, marginTop: Spacing.xs, textAlign: 'center' }}>
          Simple changes that make a big difference for the planet
        </ThemedText>
      </Card>

      <View style={styles.tipsContainer}>
        {tips.map(renderTipCard)}
      </View>

      <Pressable
        onPress={() => setTips(getSustainabilityTips())}
        style={({ pressed }) => [
          styles.refreshTipsButton,
          { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Feather name="refresh-cw" size={18} color={theme.link} />
        <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.link }}>
          Show Different Tips
        </ThemedText>
      </Pressable>
    </>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
        <ThemedText type="body" style={{ marginTop: Spacing.md, opacity: 0.7 }}>
          Loading sustainability data...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScreenScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.link} />
      }
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Feather name="globe" size={24} color={theme.link} />
            <ThemedText type="h1" style={styles.title}>
              Sustainability
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.subtitle}>
            Track your eco-friendly fashion journey
          </ThemedText>
        </View>

        <View style={styles.tabsContainer}>
          {(['dashboard', 'brands', 'tips'] as TabType[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabButton,
                {
                  backgroundColor: activeTab === tab ? theme.link : theme.backgroundSecondary,
                },
              ]}
            >
              <Feather
                name={tab === 'dashboard' ? 'activity' : tab === 'brands' ? 'award' : 'book-open'}
                size={16}
                color={activeTab === tab ? '#FFFFFF' : theme.text}
              />
              <ThemedText
                type="small"
                style={{
                  marginLeft: Spacing.xs,
                  color: activeTab === tab ? '#FFFFFF' : theme.text,
                  fontWeight: activeTab === tab ? '600' : '400',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {activeTab === 'dashboard' ? renderDashboard() : null}
        {activeTab === 'brands' ? renderBrandsTab() : null}
        {activeTab === 'tips' ? renderTipsTab() : null}

        <Card style={styles.footerCard}>
          <Feather name="info" size={18} color={theme.link} />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, flex: 1, opacity: 0.7 }}>
            Sustainability ratings are based on publicly available information about brand practices, certifications, and environmental commitments.
          </ThemedText>
        </Card>
      </ThemedView>

      <Modal
        visible={showGoalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h2">Add Sustainability Goal</ThemedText>
              <Pressable onPress={() => setShowGoalModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <ThemedText type="body" style={{ marginBottom: Spacing.sm }}>
                Goal Title
              </ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.backgroundSecondary,
                  },
                ]}
                value={newGoalTitle}
                onChangeText={setNewGoalTitle}
                placeholder={t('common.egBuy5SustainableItems') || "e.g., Buy 5 sustainable items"}
                placeholderTextColor={theme.tabIconDefault}
              />

              <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                Target Number
              </ThemedText>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.backgroundSecondary,
                  },
                ]}
                value={newGoalTarget}
                onChangeText={setNewGoalTarget}
                placeholder={t('common.eg5') || "e.g., 5"}
                placeholderTextColor={theme.tabIconDefault}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowGoalModal(false)}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonSecondary,
                  { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <ThemedText type="body">Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleAddGoal}
                disabled={isAddingGoal}
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  { backgroundColor: theme.link, opacity: pressed || isAddingGoal ? 0.6 : 1 },
                ]}
              >
                {isAddingGoal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText type="body" style={{ color: '#FFFFFF' }}>
                    Add Goal
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    marginLeft: Spacing.xs,
  },
  subtitle: {
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  scoreCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  scoreCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreRingContainer: {
    marginRight: Spacing.lg,
  },
  scoreRingOuter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingBackground: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 8,
  },
  scoreRingProgress: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 8,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  scoreRingContent: {
    alignItems: 'center',
  },
  scoreDetails: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
  },
  chartBar: {
    width: '60%',
    borderRadius: BorderRadius.xs,
  },
  goalsCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emptyGoalsCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  addGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalItem: {
    marginBottom: Spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  breakdownItem: {
    marginBottom: Spacing.md,
  },
  breakdownLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  breakdownBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  breakdownBarBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  recentPurchasesCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  purchaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  ecoRatingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  brandsIntroCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  ratingLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.xs,
  },
  brandsContainer: {
    gap: Spacing.md,
  },
  brandCard: {
    padding: Spacing.md,
  },
  brandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  certificationsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  certBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  practicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  practiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carbonScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  tipsIntroCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  tipsContainer: {
    gap: Spacing.md,
  },
  tipCard: {
    padding: Spacing.md,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  tipIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipMeta: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  impactBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  refreshTipsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  footerCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalBody: {
    marginBottom: Spacing.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonSecondary: {},
  modalButtonPrimary: {},
});
