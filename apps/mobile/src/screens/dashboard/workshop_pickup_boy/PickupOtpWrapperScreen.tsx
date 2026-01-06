import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import OTPVerificationScreen from './OTPVerificationScreen';

export default function PickupOtpWrapperScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();

  const leadId = route?.params?.leadId as string | undefined;
  const otpType = (route?.params?.otpType as 'PICKUP' | 'DROP' | undefined) || 'PICKUP';

  if (!leadId) return null as any;

  return (
    <OTPVerificationScreen
      leadId={leadId}
      otpType={otpType}
      onBack={() => (navigation as any).goBack?.()}
      onSuccess={() => (navigation as any).goBack?.()}
    />
  );
}


