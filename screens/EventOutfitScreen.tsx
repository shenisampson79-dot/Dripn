import React from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import StylistDecisionFlow from '@/components/stylist/StylistDecisionFlow';
import type { UserStylistStackParamList } from '@/navigation/UserStylistStackNavigator';

type Props = {
  navigation: NativeStackNavigationProp<UserStylistStackParamList, 'EventOutfit'>;
};

export default function EventOutfitScreen({ navigation }: Props) {
  return <StylistDecisionFlow decisionType="event-outfit" navigation={navigation} />;
}
