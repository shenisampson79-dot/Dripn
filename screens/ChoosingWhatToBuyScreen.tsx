import React from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StylistDecisionFlow from '@/components/stylist/StylistDecisionFlow';
import type { UserStylistStackParamList } from '@/navigation/UserStylistStackNavigator';

type Props = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, 'ChoosingWhatToBuy'>;
};

export default function ChoosingWhatToBuyScreen({ navigation }: Props) {
  return <StylistDecisionFlow decisionType="shopping" navigation={navigation} />;
}
