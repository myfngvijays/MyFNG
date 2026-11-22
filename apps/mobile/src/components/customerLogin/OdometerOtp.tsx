import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { OtpAnimStatus } from '../AnimatedOtpInput';

type Props = {
  value: string;
  onChange: (next: string) => void;
  onFilled?: (code: string) => void;
  status?: OtpAnimStatus;
  editable?: boolean;
  length?: number;
};

/**
 * Customer OTP as a car odometer: one dark dial per digit, plus a road bar where a
 * small car drives right as digits fill in. A hidden input takes typing and SMS autofill.
 */
export default function OdometerOtp({
  value,
  onChange,
  onFilled,
  status = 'idle',
  editable = true,
  length = 6,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const drive = useRef(new Animated.Value(0)).current;
  const [roadWidth, setRoadWidth] = React.useState(0);

  const digits = value.replace(/\D/g, '').slice(0, length);

  useEffect(() => {
    Animated.timing(drive, {
      toValue: digits.length / length,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [digits.length, drive, length]);

  useEffect(() => {
    if (status !== 'error') return;
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 0].map((x) =>
        Animated.timing(shake, { toValue: x, duration: 55, useNativeDriver: true }),
      ),
    ).start();
  }, [shake, status]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  const digitColor =
    status === 'success' ? '#4ADE80' : status === 'error' ? '#F87171' : '#F8FAFC';

  return (
    <View>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <Animated.View
          style={[
            styles.panel,
            status === 'error' && styles.panelError,
            status === 'success' && styles.panelSuccess,
            { transform: [{ translateX: shake }] },
          ]}
        >
          <View style={styles.panelHead}>
            <Text style={styles.panelLabel}>ODOMETER</Text>
            <Text style={styles.panelLabel}>KM</Text>
          </View>
          <View style={styles.row}>
            {Array.from({ length }).map((_, i) => {
              const d = digits[i];
              const active = i === digits.length && editable && status !== 'success';
              return (
                <View key={i} style={[styles.cell, active && styles.cellActive]}>
                  <View style={styles.cellShine} />
                  <Text style={[styles.digit, { color: d ? digitColor : '#475569' }]}>{d ?? '0'}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>
      </Pressable>

      <View style={styles.road} onLayout={(e) => setRoadWidth(e.nativeEvent.layout.width)}>
        <View style={styles.roadDash} />
        <Animated.View
          style={[
            styles.roadCar,
            {
              transform: [
                {
                  translateX: drive.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.max(0, roadWidth - 34)],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="car-sport" size={20} color={status === 'success' ? '#16A34A' : '#1E293B'} />
        </Animated.View>
      </View>

      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={(t) => {
          const next = t.replace(/\D/g, '').slice(0, length);
          onChange(next);
          if (next.length === length) onFilled?.(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        editable={editable}
        caretHidden
        style={styles.hiddenInput}
        accessibilityLabel="OTP"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    borderWidth: 2,
    borderColor: '#111827',
  },
  panelError: { borderColor: '#EF4444' },
  panelSuccess: { borderColor: '#22C55E' },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  panelLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  cell: {
    flex: 1,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellActive: { borderColor: '#60A5FA', backgroundColor: '#1E293B' },
  cellShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  digit: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  road: {
    marginTop: 14,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  roadDash: {
    position: 'absolute',
    left: 40,
    right: 12,
    height: 2,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FFFFFF',
  },
  roadCar: { position: 'absolute', left: 8 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0.01, left: 0, top: 0 },
});
