import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export type OtpAnimStatus = 'idle' | 'mixing' | 'success' | 'error';

type Props = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  status?: OtpAnimStatus;
  onFilled?: (code: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
};

const BOX = 46;
const GAP = 8;
const RADIUS = 56;

export default function AnimatedOtpInput({
  value,
  onChange,
  length = 6,
  status = 'idle',
  onFilled,
  editable = true,
  autoFocus = true,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const filledSent = useRef('');
  const appear = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const caret = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const digits = useMemo(() => value.replace(/\D/g, '').slice(0, length), [value, length]);
  const [spin, setSpin] = useState(0);
  const [mix, setMix] = useState(0);
  const [shown, setShown] = useState(digits);

  useEffect(() => {
    appear.setValue(0);
    Animated.spring(appear, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0.15, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(caret, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [appear, caret]);

  useEffect(() => {
    if (digits.length === length && filledSent.current !== digits) {
      filledSent.current = digits;
      onFilled?.(digits);
    }
    if (digits.length < length) filledSent.current = '';
  }, [digits, length, onFilled]);

  useEffect(() => {
    if (status !== 'error') return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [status, shake]);

  useEffect(() => {
    if (status === 'success') {
      checkScale.setValue(0);
      Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    } else {
      checkScale.setValue(0);
    }
  }, [status, checkScale]);

  useEffect(() => {
    if (status !== 'mixing') {
      setMix(0);
      setSpin(0);
      setShown(digits);
      return;
    }
    let raf = 0;
    const start = Date.now();
    const tick = () => {
      const t = (Date.now() - start) / 1000;
      setMix(Math.min(1, t / 0.28));
      setSpin(t * 2.4);
      if (Math.floor(t * 12) % 2 === 0) {
        setShown(
          Array.from({ length }, () => String(Math.floor(Math.random() * 10))).join(''),
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, digits, length]);

  const mixing = status === 'mixing';
  const success = status === 'success';
  const canType = editable && !mixing && !success;

  const focusInput = () => {
    if (!canType) return;
    inputRef.current?.focus();
  };

  const stageW = length * BOX + (length - 1) * GAP;
  const stageH = mixing || success ? 168 : 54;

  return (
    <Pressable onPress={focusInput}>
      <Animated.View
        style={[
          styles.stage,
          {
            width: stageW,
            height: stageH,
            opacity: appear,
            transform: [
              { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              {
                translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }),
              },
            ],
          },
        ]}
      >
        {success ? (
          <Animated.View style={[styles.successWrap, { transform: [{ scale: checkScale }] }]}>
            <View style={styles.successRing}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Verified successfully</Text>
            <Text style={styles.successSub}>Your number is locked in</Text>
          </Animated.View>
        ) : (
          Array.from({ length }).map((_, i) => {
            const rowX = (i - (length - 1) / 2) * (BOX + GAP);
            const ang = spin + (i / length) * Math.PI * 2;
            const cx = Math.cos(ang) * RADIUS;
            const cy = Math.sin(ang) * RADIUS;
            const x = rowX + (cx - rowX) * mix;
            const y = (cy - 0) * mix;
            const filled = Boolean(digits[i]);
            const active = canType && digits.length === i;
            const label = mixing ? shown[i] || '' : digits[i] || '';
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  filled && styles.boxFilled,
                  active && styles.boxActive,
                  status === 'error' && styles.boxError,
                  mixing && styles.boxMix,
                  {
                    left: stageW / 2 - BOX / 2 + x,
                    top: (stageH - BOX) / 2 + y,
                  },
                ]}
              >
                {label ? (
                  <Text style={styles.digit}>{label}</Text>
                ) : active ? (
                  <Animated.View style={[styles.caret, { opacity: caret }]} />
                ) : null}
              </View>
            );
          })
        )}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={digits}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        editable={canType}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  box: {
    position: 'absolute',
    width: BOX,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  boxFilled: {
    borderColor: '#004AAD',
    backgroundColor: '#F0F7FF',
  },
  boxActive: {
    borderColor: '#004AAD',
    borderWidth: 2,
  },
  boxError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  boxMix: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
  },
  digit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#023D95',
  },
  caret: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: '#004AAD',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  successWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successRing: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successCheck: {
    fontSize: 34,
    color: '#16A34A',
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
  },
  successSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
});
