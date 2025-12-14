import React, { useState } from 'react';
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

import { ScreenScrollView } from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import { Card } from '@/components/Card';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
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

const FAQ_DATA: FAQCategory[] = [
  {
    id: 'general',
    title: 'General',
    icon: 'info',
    items: [
      {
        id: 'g1',
        question: 'What is Dripn?',
        answer: 'Dripn is your personal fashion companion that helps you discover your unique style. Post outfit photos, get advice from our AI stylist and community, explore trends, and build confidence in your fashion choices.',
      },
      {
        id: 'g2',
        question: 'Which devices support Dripn?',
        answer: 'Dripn is available on iOS and Android devices through the Expo Go app, and also accessible via web browsers. For the best experience, we recommend using the mobile app.',
      },
      {
        id: 'g3',
        question: 'How do I get started?',
        answer: 'Simply create an account, complete our quick style quiz to help us understand your preferences, and start exploring! You can post your outfits, browse the community feed, or chat with your AI stylist right away.',
      },
      {
        id: 'g4',
        question: 'Is there a tutorial available?',
        answer: 'Yes! When you first open the app, you will see helpful tips. You can also retake the Style Quiz anytime from Settings to update your preferences.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: 'user',
    items: [
      {
        id: 'a1',
        question: 'How do I create an account?',
        answer: 'You can sign up using your Apple ID, Google account, or email address. Just tap "Get Started" on the welcome screen and choose your preferred method.',
      },
      {
        id: 'a2',
        question: 'I forgot my password. How do I reset it?',
        answer: 'On the login screen, tap "Forgot Password" and enter your email. You will receive a reset link within a few minutes. Check your spam folder if you do not see it.',
      },
      {
        id: 'a3',
        question: 'How do I change my email address?',
        answer: 'Go to Profile, then Settings, then Edit Profile. You can update your email there. You may need to verify the new email address.',
      },
      {
        id: 'a4',
        question: 'How do I delete my account?',
        answer: 'We are sad to see you go! To delete your account, go to Settings, then scroll to Account, then Delete Account. Please note this action is permanent and cannot be undone.',
      },
      {
        id: 'a5',
        question: 'Can I have multiple accounts?',
        answer: 'We recommend using one account to get the most personalized experience. Our AI learns your style preferences over time, so keeping one account helps us serve you better.',
      },
    ],
  },
  {
    id: 'subscription',
    title: 'Subscription & Billing',
    icon: 'credit-card',
    items: [
      {
        id: 's1',
        question: 'What subscription plans are available?',
        answer: 'We offer four tiers: Free (basic features), Basic (more uploads and AI advice), Premium (unlimited features and priority support), and VIP (everything plus personal stylist video sessions).',
      },
      {
        id: 's2',
        question: 'How do I upgrade my subscription?',
        answer: 'Go to Profile, then Settings, then Subscription to view all plans and upgrade. Payments are processed securely through your app store.',
      },
      {
        id: 's3',
        question: 'How do I cancel my subscription?',
        answer: 'You can cancel anytime through your device settings. On iOS, go to Settings, then your name, then Subscriptions. On Android, go to Google Play Store, then Subscriptions. You will keep access until the end of your billing period.',
      },
      {
        id: 's4',
        question: 'Will I get a refund if I cancel?',
        answer: 'Refunds are handled by Apple or Google based on their policies. For any billing concerns, please contact our support team through the Chat with Julia button below, and we will do our best to help.',
      },
      {
        id: 's5',
        question: 'My subscription features are not working. What should I do?',
        answer: 'First, try logging out and back in to refresh your account. If that does not work, go to Settings and tap "Restore Purchases." If you still have issues, contact Julia below.',
      },
      {
        id: 's6',
        question: 'Do you offer a free trial?',
        answer: 'Yes! New users can enjoy a 7-day free trial of Premium features. You can start your trial from the Subscription screen.',
      },
    ],
  },
  {
    id: 'ai-features',
    title: 'AI Features',
    icon: 'cpu',
    items: [
      {
        id: 'ai1',
        question: 'How does the AI stylist work?',
        answer: 'Our AI stylist analyzes your photos, considers your style preferences, body type, and the occasion to provide personalized outfit advice. The more you use it, the better it understands your taste!',
      },
      {
        id: 'ai2',
        question: 'What is Virtual Try-On?',
        answer: 'Virtual Try-On uses advanced AI to show you how clothes would look on your body. Upload a photo of yourself and a garment, and see the magic happen! This feature is available for Premium and VIP members.',
      },
      {
        id: 'ai3',
        question: 'How do voice comments work?',
        answer: 'You can record voice comments on posts instead of typing. Our AI automatically transcribes them so everyone can read along. Just tap the microphone icon when commenting.',
      },
      {
        id: 'ai4',
        question: 'What is Color Analysis?',
        answer: 'Color Analysis helps you discover which colors complement your skin tone, hair, and eyes. Our AI determines your color season (Spring, Summer, Autumn, or Winter) and recommends the most flattering shades for you.',
      },
      {
        id: 'ai5',
        question: 'Can I limit AI suggestions?',
        answer: 'Yes! In Settings, you can toggle Style Suggestions on or off. When off, you will only receive feedback from community members.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Data',
    icon: 'shield',
    items: [
      {
        id: 'p1',
        question: 'What data does Dripn collect?',
        answer: 'We collect information you provide (profile, photos, preferences) and usage data to improve your experience. We never sell your personal data. See our Privacy Policy for full details.',
      },
      {
        id: 'p2',
        question: 'Are my photos private?',
        answer: 'Photos you post to the community feed are visible to other users. Photos used for AI features (like Virtual Try-On) are processed securely and not shared publicly.',
      },
      {
        id: 'p3',
        question: 'How do I delete my data?',
        answer: 'You can delete individual posts from your profile. To delete all your data, you can request a full data deletion through Settings or by contacting our support team.',
      },
      {
        id: 'p4',
        question: 'Is my payment information secure?',
        answer: 'Absolutely. All payments are processed through Apple or Google, or our secure payment partner Stripe. We never see or store your full payment details.',
      },
      {
        id: 'p5',
        question: 'Can I download my data?',
        answer: 'Yes! You can request a copy of your data by contacting our support team. We will prepare your data export within 30 days.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: 'tool',
    items: [
      {
        id: 't1',
        question: 'The app is running slow. What can I do?',
        answer: 'Try these steps: Close and reopen the app, check your internet connection, clear the app cache in your phone settings, and make sure you have the latest app version installed.',
      },
      {
        id: 't2',
        question: 'My photos are not uploading. Help!',
        answer: 'First, check that Dripn has permission to access your photos (Settings on your phone). Then verify you have a stable internet connection. Try uploading a smaller photo first, and close other apps to free up memory.',
      },
      {
        id: 't3',
        question: 'I am not receiving notifications.',
        answer: 'Go to your phone Settings, find Dripn, and ensure notifications are enabled. Also check that Do Not Disturb is off. In the app, verify notification settings under Profile, then Settings.',
      },
      {
        id: 't4',
        question: 'The app crashed! What happened?',
        answer: 'We are sorry about that! Try force-closing and reopening the app. If crashes persist, try reinstalling the app. Your account data will be preserved. Please report ongoing issues to our support team.',
      },
      {
        id: 't5',
        question: 'Features look different on web vs mobile.',
        answer: 'The web version has some limitations compared to mobile. For the best experience with all features, we recommend using the iOS or Android app through Expo Go.',
      },
      {
        id: 't6',
        question: 'I cannot log in with Apple or Google.',
        answer: 'Make sure you are signed into your Apple or Google account on your device. Try logging out and back in to those accounts. If using web, some browsers may block sign-in popups, so check your popup settings.',
      },
    ],
  },
];

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
          Your style questions,{'\n'}answered with care.
        </ThemedText>
        <ThemedText type="h2" style={[styles.heroTitleItalic, { color: theme.link }]}>
          We have got you covered.
        </ThemedText>
        <ThemedText type="body" style={styles.heroSubtitle}>
          Find answers in our FAQ below, or chat with Julia,
          your friendly support companion who is always happy to help.
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
              <ThemedText type="h3">Chat with Julia</ThemedText>
              <ThemedText type="small" style={{ opacity: 0.7 }}>
                Your personal support assistant
              </ThemedText>
            </View>
            <Feather name="chevron-right" size={24} color={theme.tabIconDefault} />
          </View>
        </Card>
      </Animated.View>

      <View style={styles.faqSection}>
        <ThemedText type="h2" style={styles.faqSectionTitle}>
          Frequently Asked Questions
        </ThemedText>
        {FAQ_DATA.map((category, index) => (
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
          Still have questions?
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
            Chat with Julia
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
