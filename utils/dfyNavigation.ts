import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DFYAccessStatus, DFYTier } from '@/services/DFYService';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

type DfyNavigation = NativeStackNavigationProp<Record<string, object | undefined>>;

export type DfyStylePlanParams = { initialDay?: number };

/** Map a 1-based day number to a safe outfit index. */
export function outfitIndexForDay(outfitCount: number, day: number): number {
  if (outfitCount <= 0) return 0;
  return Math.max(0, Math.min(outfitCount - 1, day - 1));
}

/** Continue into the correct upload / plan flow after activating an included setup. */
export function navigateAfterDfyActivation(
  navigation: DfyNavigation,
  tier: DFYTier,
  options?: DfyStylePlanParams,
): void {
  if (tier === 'lite') {
    // Travel Capsule: collect trip details before generating the lookbook
    navigation.navigate('DFYTravelPlan');
    return;
  }
  if (FEATURE_FLAGS.hideDfyPurchaseUi) {
    // Full Wardrobe Setup path soft-gated — keep Travel Capsule usable.
    navigation.navigate('DFYTravelPlan');
    return;
  }
  navigation.navigate('DFYUpload', { type: 'core' });
}

/**
 * Lite users need Full Setup (core) for swap/remix. If they already have an active
 * Travel Capsule window, send them to paid checkout — not DFYStart (which only loops back).
 * When DFY purchase UI is hidden, send them to Subscription (plans only) instead.
 */
export function navigateToCoreFeatureUpgrade(
  navigation: DfyNavigation,
  accessStatus: DFYAccessStatus | null,
): void {
  if (FEATURE_FLAGS.hideDfyPurchaseUi) {
    navigation.navigate('Subscription');
    return;
  }
  if (accessStatus?.hasAccess && accessStatus.tier === 'lite') {
    navigation.navigate('DFYComparison', { selectedTier: 'core', paidAddOn: true, autoCheckout: true });
    return;
  }
  navigation.navigate('DFYStart');
}
