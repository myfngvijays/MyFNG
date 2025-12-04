import { useEffect } from 'react';
import { BackHandler } from 'react-native';

/**
 * Android Back Button Handler Component
 * Handles Android hardware back button press
 */
export default function AndroidBackHandler({ 
  onBack, 
  enabled = true 
}: { 
  onBack: () => void; 
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true; // Prevent default behavior
    });

    return () => backHandler.remove();
  }, [onBack, enabled]);

  return null;
}

