import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

type BotFaceProps = {
  size?: number;
  /** Robot scale inside the outer box (0–1). Keeps the bot centered with padding. */
  scale?: number;
  /** Background circle color — adds subtle contrast on white so the same bot stays visible. */
  surface?: 'blue' | 'white';
};

export default function BotFace({ size = 28, scale = 0.68, surface = 'blue' }: BotFaceProps) {
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const botSize = size * scale;
  const onWhiteSurface = surface === 'white';

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

  const eyeSize = botSize * 0.2;
  const faceWidth = botSize * 0.82;
  const faceHeight = botSize * 0.52;
  const antennaBall = botSize * 0.14;
  const antennaStemW = botSize * 0.06;
  const antennaStemH = botSize * 0.16;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: botSize, height: botSize, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: botSize * 0.02 }}>
          <View
            style={{
              width: antennaBall,
              height: antennaBall,
              borderRadius: antennaBall / 2,
              backgroundColor: 'rgba(255,255,255,0.85)',
            }}
          />
          <View
            style={{
              width: antennaStemW,
              height: antennaStemH,
              backgroundColor: 'rgba(255,255,255,0.55)',
              borderRadius: antennaStemW / 2,
            }}
          />
        </View>
        <View
          style={{
            width: faceWidth,
            height: faceHeight,
            borderRadius: faceHeight * 0.38,
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderWidth: onWhiteSurface ? 1 : 0,
            borderColor: '#DBEAFE',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: faceWidth * 0.16,
          }}
        >
          <Animated.View
            style={{
              width: eyeSize,
              height: eyeSize,
              borderRadius: eyeSize / 2,
              backgroundColor: '#2563EB',
              transform: [{ scaleY: blinkAnim }],
            }}
          />
          <Animated.View
            style={{
              width: eyeSize,
              height: eyeSize,
              borderRadius: eyeSize / 2,
              backgroundColor: '#2563EB',
              transform: [{ scaleY: blinkAnim }],
            }}
          />
        </View>
      </View>
    </View>
  );
}
