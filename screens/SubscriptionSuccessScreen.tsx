import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, CommonActions } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { apiService } from "@/services/ApiService";
import {
  BillingPlanId,
  getBillingPlanDisplayName,
  normalizeSubscriptionTier,
  tierToBillingPlan,
} from "@/utils/subscriptionTier";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

const LUXURY_COLORS = {
  gold: "#C9A87C",
  deepGold: "#A88B5C",
  teal: "#2A9D8F",
  emerald: "#059669",
  violet: "#9B7EBD",
  midnight: "#1A1A2E",
  champagne: "#F5E6D3",
};

const PRIMARY_PROMPT = "Build me a clean everyday outfit based on my style";
const GUIDED_PROMPT = "Create a smart casual outfit for this weekend";

const POLL_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 5000;
const AUTO_NAV_DELAY_MS = 1500;
const MIN_LOADING_MS = 600;

type TierContent = {
  headline: string;
  subtext: string;
  checklist: string[];
};

const TIER_CONTENT: Record<string, TierContent> = {
  style_chat: {
    headline: "Your Personal Stylist is ready",
    subtext: "Unlimited decisions and wardrobe-aware advice are unlocked",
    checklist: [
      "Unlimited stylist decisions",
      "3-way shopping compare",
      "Decision history & wardrobe memory",
      "Voice styling sessions",
    ],
  },
  personal_stylist: {
    headline: "Your personalised looks are ready",
    subtext: "Ruby, Max, Ace, or Ivy — your AI stylist is waiting",
    checklist: [
      "Personal AI stylist with extended voice",
      "Full wardrobe analysis",
      "Priority outfit recommendations",
      "Wardrobe-aware daily advice",
    ],
  },
  stylist_unlimited: {
    headline: "Full access unlocked — no limits",
    subtext: "Plan, pack, and prioritise with Stylist Unlimited",
    checklist: [
      "Outfit calendar & event planning",
      "Unlimited wardrobe & try-on",
      "Priority photo processing",
      "Priority support",
    ],
  },
  core_wardrobe: {
    headline: "Your core wardrobe setup is confirmed",
    subtext: "Our stylists will build your foundation wardrobe",
    checklist: [
      "Expert-curated core pieces",
      "Personalised wardrobe blueprint",
      "Mix-and-match outfit foundations",
      "One-time professional setup",
    ],
  },
  outfit_setup: {
    headline: "Your outfit setup is confirmed",
    subtext: "Tailored looks built around your lifestyle",
    checklist: [
      "Occasion-ready outfit plans",
      "Stylist-selected combinations",
      "Shoppable recommendations",
      "One-time professional setup",
    ],
  },
};

function resolveBillingPlan(plan?: string | null): BillingPlanId {
  if (!plan || plan === "free") return "style_chat";
  if (plan in TIER_CONTENT) return plan as BillingPlanId;
  const tier = normalizeSubscriptionTier(plan);
  const billing = tierToBillingPlan(tier);
  return billing === "free" ? "style_chat" : billing;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSessionIdFromWeb(): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("session_id") ?? undefined;
}

type Props = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "SubscriptionSuccess">;
  route: RouteProp<ProfileStackParamList, "SubscriptionSuccess">;
};

export default function SubscriptionSuccessScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user, refreshSubscriptionFromBackend } = useAuth();
  const { tier } = useSubscription();

  const [loading, setLoading] = useState(true);
  const [resolvedPlan, setResolvedPlan] = useState<BillingPlanId>("style_chat");

  const userInteractedRef = useRef(false);
  const autoNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionId = route.params?.sessionId ?? getSessionIdFromWeb();

  const markInteraction = useCallback(() => {
    userInteractedRef.current = true;
    if (autoNavTimerRef.current) {
      clearTimeout(autoNavTimerRef.current);
      autoNavTimerRef.current = null;
    }
  }, []);

  const goToAIStylist = useCallback(
    (prompt: string) => {
      markInteraction();
      navigation.dispatch(
        CommonActions.navigate({
          name: "StylistTab",
          params: {
            screen: "AIStylist",
            params: { initialPrompt: prompt },
          },
        })
      );
    },
    [markInteraction, navigation]
  );

  const goToUpgrade = useCallback(() => {
    markInteraction();
    navigation.navigate("Subscription", { highlightPlan: "stylist_unlimited" });
  }, [markInteraction, navigation]);

  useEffect(() => {
    let cancelled = false;

    async function verifyAndRefresh() {
      const started = Date.now();

      try {
        let status = await apiService.verifySubscription(sessionId).catch(() =>
          apiService.getSubscriptionStatus()
        );

        await refreshSubscriptionFromBackend(sessionId);

        if (!status.active || !status.plan || status.plan === "free") {
          for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
            if (cancelled) return;
            if (attempt > 0) await sleep(POLL_INTERVAL_MS);
            status = await apiService.getSubscriptionStatus().catch(() => status);
            await refreshSubscriptionFromBackend(sessionId);
            if (status.active && status.plan && status.plan !== "free") break;
          }
        }

        if (!cancelled) {
          const planKey = resolveBillingPlan(status.plan ?? user?.subscriptionTier ?? tier);
          setResolvedPlan(planKey);
        }
      } catch {
        if (!cancelled) {
          setResolvedPlan(resolveBillingPlan(user?.subscriptionTier ?? tier));
        }
      } finally {
        const elapsed = Date.now() - started;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
        await sleep(remaining);
        if (!cancelled) setLoading(false);
      }
    }

    verifyAndRefresh();
    return () => {
      cancelled = true;
    };
  }, [sessionId, refreshSubscriptionFromBackend, user?.subscriptionTier, tier]);

  useEffect(() => {
    if (loading) return;

    autoNavTimerRef.current = setTimeout(() => {
      if (!userInteractedRef.current) {
        goToAIStylist(PRIMARY_PROMPT);
      }
    }, AUTO_NAV_DELAY_MS);

    return () => {
      if (autoNavTimerRef.current) clearTimeout(autoNavTimerRef.current);
    };
  }, [loading, goToAIStylist]);

  const content = TIER_CONTENT[resolvedPlan];
  const planName = getBillingPlanDisplayName(resolvedPlan);
  const showUpsell = resolvedPlan !== "stylist_unlimited";

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={LUXURY_COLORS.gold} />
        <ThemedText type="body" style={styles.loadingText}>
          Activating your upgrade…
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.backgroundRoot }]}>
      <ScreenScrollView contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <ThemedText type="h2" style={styles.heroTitle}>
            ✅ You're all set. Your style upgrade is live.
          </ThemedText>
          <ThemedText type="body" style={styles.heroSubtext}>
            {content.headline}
          </ThemedText>
          <ThemedText type="small" style={styles.heroPlan}>
            {content.subtext} · {planName}
          </ThemedText>
        </LinearGradient>

        <View style={styles.section}>
          <Button
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              goToAIStylist(PRIMARY_PROMPT);
            }}
          >
            🔥 Start Styling Now
          </Button>
        </View>

        <Pressable
          onPress={() => goToAIStylist(GUIDED_PROMPT)}
          style={({ pressed }) => [
            styles.guidedCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Feather name="zap" size={18} color={LUXURY_COLORS.gold} />
          <View style={styles.guidedTextWrap}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Try this first
            </ThemedText>
            <ThemedText type="body">{GUIDED_PROMPT}</ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        <View style={[styles.checklistCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h3" style={styles.checklistTitle}>
            What's unlocked
          </ThemedText>
          {content.checklist.map((item) => (
            <View key={item} style={styles.checklistRow}>
              <Feather name="check-circle" size={18} color={LUXURY_COLORS.emerald} />
              <ThemedText type="body" style={styles.checklistItem}>
                {item}
              </ThemedText>
            </View>
          ))}
        </View>

        {showUpsell ? (
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              goToUpgrade();
            }}
            style={({ pressed }) => [styles.upsellCard, { opacity: pressed ? 0.95 : 1 }]}
          >
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upsellGradient}
            >
              <ThemedText type="h3" style={styles.upsellTitle}>
                🚀 Go Unlimited
              </ThemedText>
              <ThemedText type="small" style={styles.upsellBody}>
                Talk to your stylist by voice anytime — plus priority performance and VIP access
              </ThemedText>
              <View style={styles.upsellCta}>
                <ThemedText type="body" style={styles.upsellCtaText}>
                  Upgrade now
                </ThemedText>
                <Feather name="arrow-right" size={18} color={LUXURY_COLORS.midnight} />
              </View>
            </LinearGradient>
          </Pressable>
        ) : null}

        <View style={[styles.socialProof, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="users" size={20} color={LUXURY_COLORS.violet} />
          <ThemedText type="body" style={styles.socialProofText}>
            Join 1,000+ users improving their style daily
          </ThemedText>
        </View>

        <ThemedText type="small" style={[styles.urgency, { color: theme.textSecondary }]}>
          🔥 Most users upgrade within their first week
        </ThemedText>

        <View style={styles.footerSpacer} />
      </ScreenScrollView>

      <View
        style={[
          styles.stickyFooter,
          { backgroundColor: theme.backgroundRoot, borderTopColor: theme.border },
        ]}
      >
        <Button onPress={() => goToAIStylist(PRIMARY_PROMPT)}>Start Styling →</Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  loadingText: {
    opacity: 0.7,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    color: "#FFFFFF",
    marginBottom: Spacing.sm,
  },
  heroSubtext: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  heroPlan: {
    color: "rgba(255,255,255,0.8)",
  },
  section: {
    marginBottom: Spacing.lg,
  },
  guidedCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  guidedTextWrap: {
    flex: 1,
    gap: 2,
  },
  checklistCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  checklistTitle: {
    marginBottom: Spacing.xs,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  checklistItem: {
    flex: 1,
  },
  upsellCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  upsellGradient: {
    padding: Spacing.lg,
  },
  upsellTitle: {
    color: LUXURY_COLORS.midnight,
    marginBottom: Spacing.xs,
  },
  upsellBody: {
    color: "rgba(26,26,46,0.85)",
    marginBottom: Spacing.md,
  },
  upsellCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  upsellCtaText: {
    color: LUXURY_COLORS.midnight,
    fontWeight: "700",
  },
  socialProof: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  socialProofText: {
    flex: 1,
  },
  urgency: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  footerSpacer: {
    height: 80,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
