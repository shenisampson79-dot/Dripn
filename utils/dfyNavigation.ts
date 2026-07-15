import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DFYAccessStatus, DFYTier } from '@/services/DFYService';

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
    navigation.navigate('DFYStylePlan', options?.initialDay != null ? { initialDay: options.initialDay } : undefined);
    return;
  }
  navigation.navigate('DFYUpload', { type: 'core' });
}

/**
 * Lite users need Full Setup (core) for swap/remix. If they already have an active
 * Quick Start window, send them to paid checkout — not DFYStart (which only loops back).
 */
export function navigateToCoreFeatureUpgrade(
  navigation: DfyNavigation,
  accessStatus: DFYAccessStatus | null,
): void {
  if (accessStatus?.hasAccess && accessStatus.tier === 'lite') {
    navigation.navigate('DFYComparison', { selectedTier: 'core', paidAddOn: true, autoCheckout: true });
    return;
  }
  navigation.navigate('DFYStart');
}
