import React, { useState, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius, LuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useTranslations } from '@/contexts/TranslationContext';
import type { ProfileStackParamList } from '@/navigation/ProfileStackNavigator';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type HelpScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, 'Help'>;
};

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: FAQItem[];
}

function getFaqData(t: (key: string) => string): FAQCategory[] {
  return [
    {
      id: 'general',
      title: t('help.category.general'),
      icon: 'info',
      items: [
        { id: 'g1', question: t('help.faq.g1.question'), answer: t('help.faq.g1.answer') },
        { id: 'g2', question: t('help.faq.g2.question'), answer: t('help.faq.g2.answer') },
        { id: 'g3', question: t('help.faq.g3.question'), answer: t('help.faq.g3.answer') },
        { id: 'g4', question: t('help.faq.g4.question'), answer: t('help.faq.g4.answer') },
        { id: 'g5', question: t('help.faq.g5.question'), answer: t('help.faq.g5.answer') },
      ],
    },
    {
      id: 'account',
      title: t('help.category.account'),
      icon: 'user',
      items: [
        { id: 'a1', question: t('help.faq.a1.question'), answer: t('help.faq.a1.answer') },
        { id: 'a2', question: t('help.faq.a2.question'), answer: t('help.faq.a2.answer') },
        { id: 'a3', question: t('help.faq.a3.question'), answer: t('help.faq.a3.answer') },
        { id: 'a4', question: t('help.faq.a4.question'), answer: t('help.faq.a4.answer') },
        { id: 'a5', question: t('help.faq.a5.question'), answer: t('help.faq.a5.answer') },
      ],
    },
    {
      id: 'subscription',
      title: t('help.category.subscription'),
      icon: 'credit-card',
      items: [
        { id: 's1', question: t('help.faq.s1.question'), answer: t('help.faq.s1.answer') },
        { id: 's2', question: t('help.faq.s2.question'), answer: t('help.faq.s2.answer') },
        { id: 's3', question: t('help.faq.s3.question'), answer: t('help.faq.s3.answer') },
        { id: 's4', question: t('help.faq.s4.question'), answer: t('help.faq.s4.answer') },
        { id: 's5', question: t('help.faq.s5.question'), answer: t('help.faq.s5.answer') },
        ...(!FEATURE_FLAGS.hideDfyPurchaseUi
          ? [{ id: 's6', question: t('help.faq.s6.question'), answer: t('help.faq.s6.answer') }]
          : []),
      ],
    },
    {
      id: 'ai-features',
      title: t('help.category.aiFeatures'),
      icon: 'cpu',
      items: [
        { id: 'ai1', question: t('help.faq.ai1.question'), answer: t('help.faq.ai1.answer') },
        { id: 'ai3', question: t('help.faq.ai3.question'), answer: t('help.faq.ai3.answer') },
        { id: 'ai4', question: t('help.faq.ai4.question'), answer: t('help.faq.ai4.answer') },
      ],
    },
    {
      id: 'privacy',
      title: t('help.category.privacy'),
      icon: 'shield',
      items: [
        { id: 'p1', question: t('help.faq.p1.question'), answer: t('help.faq.p1.answer') },
        { id: 'p2', question: t('help.faq.p2.question'), answer: t('help.faq.p2.answer') },
        { id: 'p3', question: t('help.faq.p3.question'), answer: t('help.faq.p3.answer') },
        { id: 'p4', question: t('help.faq.p4.question'), answer: t('help.faq.p4.answer') },
        { id: 'p5', question: t('help.faq.p5.question'), answer: t('help.faq.p5.answer') },
      ],
    },
    {
      id: 'troubleshooting',
      title: t('help.category.troubleshooting'),
      icon: 'tool',
      items: [
        { id: 't1', question: t('help.faq.t1.question'), answer: t('help.faq.t1.answer') },
        { id: 't2', question: t('help.faq.t2.question'), answer: t('help.faq.t2.answer') },
        { id: 't3', question: t('help.faq.t3.question'), answer: t('help.faq.t3.answer') },
        { id: 't4', question: t('help.faq.t4.question'), answer: t('help.faq.t4.answer') },
        { id: 't5', question: t('help.faq.t5.question'), answer: t('help.faq.t5.answer') },
        { id: 't6', question: t('help.faq.t6.question'), answer: t('help.faq.t6.answer') },
      ],
    },
  ];
}

function FAQAccordion({
  category,
  theme,
}: {
  category: FAQCategory;
  theme: any;
}) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <View style={styles.categoryContainer}>
      <View style={styles.categoryHeader}>
        <View
          style={[
            styles.categoryIconContainer,
            { backgroundColor: theme.link + '15' },
          ]}
        >
          <Feather name={category.icon} size={18} color={theme.link} />
        </View>
        <ThemedText type="h3" style={styles.categoryTitle}>
          {category.title}
        </ThemedText>
      </View>
      <View style={styles.faqList}>
        {category.items.map((item) => {
          const isExpanded = expandedItems.has(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => toggleItem(item.id)}
              style={({ pressed }) => [
                styles.faqItem,
                {
                  backgroundColor: theme.backgroundSecondary,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.faqQuestionRow}>
                <ThemedText type="body" style={styles.faqQuestion}>
                  {item.question}
                </ThemedText>
                <Feather
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.tabIconDefault}
                />
              </View>
              {isExpanded ? (
                <ThemedText type="body" style={styles.faqAnswer}>
                  {item.answer}
                </ThemedText>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function HelpScreen({ navigation }: HelpScreenProps) {
  const { theme } = useTheme();
  const { t } = useTranslations();
  const faqData = getFaqData(t);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('help.screenTitle') });
  }, [navigation, t]);

  const handleChatWithJulia = () => {
    navigation.navigate('Support');
  };

  return (
    <ScreenScrollView>
      <Animated.View entering={FadeIn.duration(500)} style={styles.heroSection}>
        <View
          style={[
            styles.heroIconContainer,
            { backgroundColor: theme.link + '15' },
          ]}
        >
          <Feather name="heart" size={32} color={theme.link} />
        </View>
        <ThemedText type="h2" style={styles.heroTitle}>
          {t('help.heroTitleLine1')}{'\n'}{t('help.heroTitleLine2')}
        </ThemedText>
        <ThemedText type="h2" style={[styles.heroTitleItalic, { color: theme.link }]}>
          {t('help.heroTitleItalic')}
        </ThemedText>
        <ThemedText type="body" style={styles.heroSubtitle}>
          {t('help.heroSubtitle')}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <Card
          elevation={2}
          onPress={handleChatWithJulia}
          style={styles.juliaCard}
        >
          <View style={styles.juliaCardContent}>
            <View
              style={[
                styles.juliaAvatar,
                { backgroundColor: theme.link + '20' },
              ]}
            >
              <Feather name="message-circle" size={24} color={theme.link} />
            </View>
            <View style={styles.juliaInfo}>
              <ThemedText type="h3">{t('help.chatWithJulia')}</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                {t('help.chatWithJuliaSubtitle')}
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={24} color={theme.tabIconDefault} />
          </View>
        </Card>
      </Animated.View>

      <View style={styles.faqSection}>
        <ThemedText type="h2" style={styles.faqSectionTitle}>
          {t('help.faqSectionTitle')}
        </ThemedText>
        {faqData.map((category, index) => (
          <Animated.View
            key={category.id}
            entering={FadeInDown.delay(300 + index * 100).duration(400)}
          >
            <FAQAccordion category={category} theme={theme} />
          </Animated.View>
        ))}
      </View>

      <Animated.View
        entering={FadeInDown.delay(900).duration(400)}
        style={styles.bottomSection}
      >
        <ThemedText type="body" style={styles.bottomText}>
          {t('help.stillHaveQuestions')}
        </ThemedText>
        <Pressable
          onPress={handleChatWithJulia}
          style={({ pressed }) => [
            styles.chatButton,
            { backgroundColor: theme.link, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="message-circle" size={20} color="#FFFFFF" />
          <ThemedText type="body" style={styles.chatButtonText}>
            {t('help.chatWithJulia')}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    textAlign: 'center',
    lineHeight: 32,
  },
  heroTitleItalic: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  heroSubtitle: {
    textAlign: 'center',
    opacity: 0.8,
    paddingHorizontal: Spacing.lg,
    lineHeight: 24,
  },
  juliaCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  juliaCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  juliaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  juliaInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  faqSection: {
    marginTop: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  faqSectionTitle: {
    marginBottom: Spacing.lg,
  },
  categoryContainer: {
    marginBottom: Spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  categoryTitle: {
    flex: 1,
  },
  faqList: {
    gap: Spacing.sm,
  },
  faqItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontWeight: '500',
    paddingRight: Spacing.sm,
  },
  faqAnswer: {
    marginTop: Spacing.md,
    opacity: 0.85,
    lineHeight: 22,
  },
  bottomSection: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  bottomText: {
    marginBottom: Spacing.md,
    opacity: 0.8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  chatButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
