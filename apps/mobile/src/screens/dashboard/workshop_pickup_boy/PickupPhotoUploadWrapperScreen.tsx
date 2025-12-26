import React from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import PhotoUploadScreen from './PhotoUploadScreen';

export default function PickupPhotoUploadWrapperScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();

  const leadId = route?.params?.leadId as string | undefined;
  const photoCategory = (route?.params?.photoCategory as 'PICKUP' | 'DROP' | undefined) || 'DROP';

  if (!leadId) {
    // Render nothing; navigation stack will show a blank screen if misused.
    return null as any;
  }

  return (
    <PhotoUploadScreen
      leadId={leadId}
      photoCategory={photoCategory}
      onBack={() => (navigation as any).goBack?.()}
      onComplete={() => (navigation as any).goBack?.()}
    />
  );
}


