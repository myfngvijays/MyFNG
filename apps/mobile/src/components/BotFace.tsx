import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

export default function BotFace({ size = 28 }: { size?: number }) {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const runBlink = () => {
      Animated.sequence([
        Animated.delay(2500 + Math.random() * 1500),
        Animated.timing(blinkAnim, { toValue: 0.1, duration: 100, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 120, easing: Easing.ease, useNativeDriver: true }),
      ]).start(() => runBlink());
    };
    runBlink();
  }, [blinkAnim]);

  const eyeSize = size * 0.22;
  const faceSize = size;

  return (
    <View style={{ width: faceSize, height: faceSize, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: faceSize * 0.85,
          height: faceSize * 0.65,
          borderRadius: faceSize * 0.2,
          backgroundColor: 'rgba(255,255,255,0.25)',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: faceSize * 0.18,
        }}
      >
        <Animated.View
          style={{
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeSize / 2,
            backgroundColor: '#FFFFFF',
            transform: [{ scaleY: blinkAnim }],
          }}
        />
        <Animated.View
          style={{
            width: eyeSize,
            height: eyeSize,
            borderRadius: eyeSize / 2,
            backgroundColor: '#FFFFFF',
            transform: [{ scaleY: blinkAnim }],
          }}
        />
      </View>
      <View
        style={{
          width: faceSize * 0.06,
          height: faceSize * 0.22,
          backgroundColor: 'rgba(255,255,255,0.3)',
          position: 'absolute',
          top: -faceSize * 0.15,
          borderRadius: faceSize * 0.04,
        }}
      />
      <View
        style={{
          width: faceSize * 0.15,
          height: faceSize * 0.15,
          borderRadius: faceSize * 0.08,
          backgroundColor: 'rgba(255,255,255,0.4)',
          position: 'absolute',
          top: -faceSize * 0.28,
        }}
      />
    </View>
  );
}
