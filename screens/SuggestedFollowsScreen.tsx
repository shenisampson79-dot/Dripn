import React, { useState, useMemo } from "react";
import { StyleSheet, View, Pressable, Image } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, SizeRange, BodyShape, BudgetRange } from "@/contexts/AuthContext";
import { useSocial, SAMPLE_USERS, UserSummary } from "@/contexts/SocialContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

type SuggestedFollowsScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "SuggestedFollows">;
};

interface SuggestedUser extends UserSummary {
  category: string;
  matchReason: string;
  followers: number;
  isPopular?: boolean;
}

const POPULAR_USERS: SuggestedUser[] = [
  { id: 'popular_1', name: 'Sophia Milano', tier: 'fashionGuru', category: 'Popular', matchReason: 'Top influencer this week', followers: 125000, isPopular: true },
  { id: 'popular_2', name: 'Marcus Chen', tier: 'styleExpert', category: 'Popular', matchReason: 'Rising star stylist', followers: 87000, isPopular: true },
  { id: 'popular_3', name: 'Amara Williams', tier: 'fashionGuru', category: 'Popular', matchReason: 'Most helpful this month', followers: 156000, isPopular: true },
];

const SIZE_MATCHED_USERS: Record<NonNullable<SizeRange>, SuggestedUser[]> = {
  'XS-S': [
    { id: 'size_xs_1', name: 'Emma Petite', tier: 'styleExpert', category: 'Your Size', matchReason: 'Styles XS-S perfectly', followers: 34000 },
    { id: 'size_xs_2', name: 'Lily Zhang', tier: 'fashionAdvisor', category: 'Your Size', matchReason: 'Petite fashion expert', followers: 28000 },
  ],
  'M-L': [
    { id: 'size_m_1', name: 'Jessica Monroe', tier: 'styleExpert', category: 'Your Size', matchReason: 'M-L styling specialist', followers: 45000 },
    { id: 'size_m_2', name: 'David Park', tier: 'fashionAdvisor', category: 'Your Size', matchReason: 'Classic fits expert', followers: 32000 },
  ],
  'XL-2X': [
    { id: 'size_xl_1', name: 'Mia Curves', tier: 'fashionGuru', category: 'Your Size', matchReason: 'Plus size champion', followers: 78000 },
    { id: 'size_xl_2', name: 'Tasha Johnson', tier: 'styleExpert', category: 'Your Size', matchReason: 'Celebrates every curve', followers: 52000 },
  ],
  '3X+': [
    { id: 'size_3x_1', name: 'Brianna Love', tier: 'fashionGuru', category: 'Your Size', matchReason: 'Extended size specialist', followers: 89000 },
    { id: 'size_3x_2', name: 'Keisha Bold', tier: 'styleExpert', category: 'Your Size', matchReason: 'Body positivity advocate', followers: 67000 },
  ],
};

const BODY_TYPE_USERS: Record<NonNullable<BodyShape>, SuggestedUser[]> = {
  'Hourglass': [
    { id: 'body_hg_1', name: 'Victoria Curves', tier: 'styleExpert', category: 'Your Body Type', matchReason: 'Hourglass styling pro', followers: 41000 },
  ],
  'Pear': [
    { id: 'body_pear_1', name: 'Ashley Balance', tier: 'fashionAdvisor', category: 'Your Body Type', matchReason: 'Pear shape expert', followers: 38000 },
  ],
  'Apple': [
    { id: 'body_apple_1', name: 'Christina Chic', tier: 'styleExpert', category: 'Your Body Type', matchReason: 'Apple shape stylist', followers: 35000 },
  ],
  'Rectangle': [
    { id: 'body_rect_1', name: 'Nicole Structure', tier: 'fashionAdvisor', category: 'Your Body Type', matchReason: 'Rectangle shape styling', followers: 29000 },
  ],
  'Athletic': [
    { id: 'body_ath_1', name: 'Jordan Fit', tier: 'styleExpert', category: 'Your Body Type', matchReason: 'Athletic build specialist', followers: 56000 },
  ],
  'Inverted Triangle': [
    { id: 'body_inv_1', name: 'Rachel Proportion', tier: 'fashionAdvisor', category: 'Your Body Type', matchReason: 'V-shape styling tips', followers: 31000 },
  ],
  'Trapezoid': [
    { id: 'body_trap_1', name: 'Michael Classic', tier: 'styleExpert', category: 'Your Body Type', matchReason: 'Trapezoid fit expert', followers: 27000 },
  ],
  'Oval': [
    { id: 'body_oval_1', name: 'Sarah Comfort', tier: 'fashionAdvisor', category: 'Your Body Type', matchReason: 'Oval shape stylist', followers: 33000 },
  ],
};

const BUDGET_USERS: Record<NonNullable<BudgetRange>, SuggestedUser[]> = {
  'Budget': [
    { id: 'budget_b_1', name: 'Thrifty Queen', tier: 'fashionAdvisor', category: 'Your Budget', matchReason: 'Budget-friendly finds', followers: 92000 },
    { id: 'budget_b_2', name: 'Deal Hunter', tier: 'styleContributor', category: 'Your Budget', matchReason: 'Best bargains expert', followers: 45000 },
  ],
  'Mid-Range': [
    { id: 'budget_m_1', name: 'Value Style', tier: 'styleExpert', category: 'Your Budget', matchReason: 'Mid-range specialist', followers: 58000 },
  ],
  'Premium': [
    { id: 'budget_p_1', name: 'Premium Picks', tier: 'fashionGuru', category: 'Your Budget', matchReason: 'Investment pieces pro', followers: 73000 },
  ],
  'Luxury': [
    { id: 'budget_l_1', name: 'Luxury Living', tier: 'fashionGuru', category: 'Your Budget', matchReason: 'Designer specialist', followers: 145000 },
    { id: 'budget_l_2', name: 'Haute Couture', tier: 'fashionGuru', category: 'Your Budget', matchReason: 'Luxury fashion curator', followers: 198000 },
  ],
};

const STYLE_USERS: SuggestedUser[] = [
  { id: 'style_1', name: 'Street Style Sam', tier: 'fashionGuru', category: 'Streetwear', matchReason: 'Urban fashion icon', followers: 112000 },
  { id: 'style_2', name: 'Boho Belle', tier: 'styleExpert', category: 'Bohemian', matchReason: 'Free spirit styles', followers: 67000 },
  { id: 'style_3', name: 'Corporate Chic', tier: 'fashionAdvisor', category: 'Business', matchReason: 'Workwear specialist', followers: 54000 },
  { id: 'style_4', name: 'Minimalist Max', tier: 'styleExpert', category: 'Minimalist', matchReason: 'Less is more philosophy', followers: 78000 },
];

export default function SuggestedFollowsScreen({ navigation }: SuggestedFollowsScreenProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { followUser } = useSocial();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const suggestedUsers = useMemo(() => {
    const suggestions: SuggestedUser[] = [...POPULAR_USERS];
    
    if (user?.sizeRange && SIZE_MATCHED_USERS[user.sizeRange]) {
      suggestions.push(...SIZE_MATCHED_USERS[user.sizeRange]);
    }
    
    if (user?.bodyShape && BODY_TYPE_USERS[user.bodyShape]) {
      suggestions.push(...BODY_TYPE_USERS[user.bodyShape]);
    }
    
    if (user?.budgetRange && BUDGET_USERS[user.budgetRange]) {
      suggestions.push(...BUDGET_USERS[user.budgetRange]);
    }
    
    const existingSample = Object.values(SAMPLE_USERS).slice(0, 3).map(u => ({
      ...u,
      category: 'Community',
      matchReason: 'Active community member',
      followers: Math.floor(Math.random() * 50000) + 5000,
    }));
    suggestions.push(...existingSample);
    
    suggestions.push(...STYLE_USERS.slice(0, 2));
    
    return suggestions;
  }, [user?.sizeRange, user?.bodyShape, user?.budgetRange]);

  const groupedUsers = useMemo(() => {
    const groups: Record<string, SuggestedUser[]> = {};
    suggestedUsers.forEach(user => {
      if (!groups[user.category]) {
        groups[user.category] = [];
      }
      groups[user.category].push(user);
    });
    return groups;
  }, [suggestedUsers]);

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    for (const userId of selectedUsers) {
      await followUser(userId);
    }
    navigation.replace("OnboardingQuiz" as any);
  };

  const handleSkip = () => {
    navigation.replace("OnboardingQuiz" as any);
  };

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const tierColors: Record<string, string> = {
    fashionGuru: '#FFD700',
    styleExpert: '#C0C0C0',
    fashionAdvisor: '#CD7F32',
    styleContributor: theme.link,
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <ThemedText type="h1" style={styles.title}>
          People You Might Like
        </ThemedText>
        <ThemedText type="body" style={styles.subtitle}>
          Follow stylists and members who match your preferences
        </ThemedText>
      </View>

      {Object.entries(groupedUsers).map(([category, users]) => (
        <View key={category} style={styles.categorySection}>
          <View style={styles.categoryHeader}>
            <ThemedText type="h3" style={styles.categoryTitle}>
              {category}
            </ThemedText>
            {category === 'Popular' ? (
              <View style={[styles.categoryBadge, { backgroundColor: theme.link }]}>
                <Feather name="trending-up" size={12} color="#FFFFFF" />
                <ThemedText type="small" style={styles.categoryBadgeText}>
                  Trending
                </ThemedText>
              </View>
            ) : null}
          </View>

          {users.map(suggestedUser => {
            const isSelected = selectedUsers.has(suggestedUser.id);
            const initials = suggestedUser.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Pressable
                key={suggestedUser.id}
                onPress={() => toggleUser(suggestedUser.id)}
                style={[
                  styles.userCard,
                  { 
                    backgroundColor: isSelected 
                      ? theme.link + '15' 
                      : theme.backgroundDefault,
                    borderColor: isSelected ? theme.link : theme.border,
                  },
                ]}
              >
                <View style={styles.userLeft}>
                  <View 
                    style={[
                      styles.avatar,
                      { backgroundColor: tierColors[suggestedUser.tier || 'styleContributor'] + '30' },
                    ]}
                  >
                    <ThemedText type="body" style={{ fontWeight: '600' }}>
                      {initials}
                    </ThemedText>
                  </View>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameRow}>
                      <ThemedText type="body" style={styles.userName}>
                        {suggestedUser.name}
                      </ThemedText>
                      {suggestedUser.isPopular ? (
                        <Feather name="award" size={14} color="#FFD700" />
                      ) : null}
                    </View>
                    <ThemedText type="small" style={styles.matchReason}>
                      {suggestedUser.matchReason}
                    </ThemedText>
                    <ThemedText type="small" style={[styles.followers, { color: theme.tabIconDefault }]}>
                      {formatFollowers(suggestedUser.followers)} followers
                    </ThemedText>
                  </View>
                </View>
                <View
                  style={[
                    styles.followButton,
                    {
                      backgroundColor: isSelected ? theme.link : 'transparent',
                      borderColor: theme.link,
                    },
                  ]}
                >
                  {isSelected ? (
                    <Feather name="check" size={18} color="#FFFFFF" />
                  ) : (
                    <Feather name="plus" size={18} color={theme.link} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <Button onPress={handleContinue} style={styles.continueButton}>
          {selectedUsers.size > 0 
            ? `Follow ${selectedUsers.size} & Continue`
            : 'Continue'
          }
        </Button>
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <ThemedText type="body" style={[styles.skipText, { color: theme.tabIconDefault }]}>
            Skip for now
          </ThemedText>
        </Pressable>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    opacity: 0.7,
  },
  categorySection: {
    marginBottom: Spacing.xl,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryTitle: {
    fontWeight: '600',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  userName: {
    fontWeight: '600',
  },
  matchReason: {
    opacity: 0.7,
    marginTop: 2,
  },
  followers: {
    marginTop: 2,
    fontSize: 11,
  },
  followButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  continueButton: {
    width: '100%',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipText: {
    textAlign: 'center',
  },
});
