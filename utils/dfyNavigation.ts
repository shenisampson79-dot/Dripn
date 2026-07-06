import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DFYTier } from '@/services/DFYService';

type DfyNavigation = NativeStackNavigationProp<Record<string, object | undefined>>;

/** Continue into the correct upload / plan flow after activating an included setup. */
export function navigateAfterDfyActivation(navigation: DfyNavigation, tier: DFYTier): void {
  if (tier === 'lite') {
    navigation.navigate('DFYStylePlan');
    return;
  }
  navigation.navigate('DFYUpload', { type: 'core' });
}
