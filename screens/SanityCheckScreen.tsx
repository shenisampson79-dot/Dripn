import React from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StylistDecisionFlow from '@/components/stylist/StylistDecisionFlow';
import type { UserStylistStackParamList } from '@/navigation/UserStylistStackNavigator';

type Props = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, 'SanityCheck'>;
};

export default function SanityCheckScreen({ navigation }: Props) {
  return <StylistDecisionFlow decisionType="sanity-check" navigation={navigation} />;
}
