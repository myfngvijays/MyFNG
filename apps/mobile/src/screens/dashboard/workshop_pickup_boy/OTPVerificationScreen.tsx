import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, SHADOWS } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

interface Props {
  leadId: string;
  otpType: 'PICKUP' | 'DROP';
  onBack: () => void;
  onSuccess: () => void;
  hideChrome?: boolean;
}

type OtpPhase = 'entry' | 'verifying' | 'success_boxes' | 'done';

export default function OTPVerificationScreen({
  leadId,
  otpType,
  onBack,
  onSuccess,
  hideChrome = false,
}: Props) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [phase, setPhase] = useState<OtpPhase>('entry');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [successBoxes, setSuccessBoxes] = useState<boolean[]>(() => Array(6).fill(false));
  const inputs = useRef<Array<TextInput | null>>([]);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.3)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;
  const lockPulse = useRef(new Animated.Value(1)).current;
  const boxAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const verifySpin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'done' || phase === 'success_boxes') return true;
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [onBack, phase]);

  useEffect(() => {
    if (phase !== 'entry') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(lockPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [lockPulse, phase]);

  useEffect(() => {
    if (phase !== 'verifying') return;
    const spin = Animated.loop(
      Animated.timing(verifySpin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spin.start();
    return () => {
      spin.stop();
      verifySpin.setValue(0);
    };
  }, [phase, verifySpin]);

  const runShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  const pulseBox = (index: number) => {
    Animated.sequence([
      Animated.timing(boxAnims[index], { toValue: 1.15, duration: 90, useNativeDriver: true }),
      Animated.spring(boxAnims[index], { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const runBoxSuccessSequence = () => {
    setPhase('success_boxes');
    setSuccessBoxes(Array(6).fill(false));
    otp.forEach((_, i) => {
      setTimeout(() => {
        setSuccessBoxes((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
        pulseBox(i);
      }, i * 120);
    });
    setTimeout(() => runFinalSuccess(), 950);
  };

  const runFinalSuccess = () => {
    setPhase('done');
    ringScale.setValue(0.4);
    ringOpacity.setValue(0.85);
    successScale.setValue(0.2);
    successOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(ringScale, { toValue: 2.2, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(ringOpacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => onSuccess(), 1200);
    });
  };

  const handleOtpChange = (text: string, index: number) => {
    if (phase !== 'entry') return;
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text.slice(-1);
    setOtp(newOtp);

    if (text) {
      pulseBox(index);
      if (index < 5) {
        inputs.current[index + 1]?.focus();
        setFocusedIndex(index + 1);
      }
    }

    const joined = newOtp.join('');
    if (joined.length === 6 && newOtp.every((d) => d)) {
      setTimeout(() => void handleVerify(joined), 150);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (phase !== 'entry') return;
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    const otpCode = codeOverride || otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter complete 6-digit OTP');
      return;
    }

    setPhase('verifying');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(`${ENV.API_URL}/api/pickup/tasks/${leadId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ otp: otpCode, otp_type: otpType }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to verify OTP');

      runBoxSuccessSequence();
    } catch (error: any) {
      setPhase('entry');
      runShake();
      setOtp(['', '', '', '', '', '']);
      setSuccessBoxes(Array(6).fill(false));
      inputs.current[0]?.focus();
      setFocusedIndex(0);
      Alert.alert('Invalid OTP', error.message || 'Please check OTP and try again');
    }
  };

  const handleResendOTP = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const response = await fetch(`${ENV.API_URL}/api/pickup/${leadId}/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ otp_type: otpType }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to resend OTP');
      }

      Alert.alert('Sent', 'OTP has been resent to the customer.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend OTP. Contact advisor.');
    }
  };

  const spin = verifySpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (phase === 'done' || phase === 'success_boxes') {
    return (
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.successOverlay,
            { opacity: phase === 'done' ? successOpacity : 1 },
          ]}
        >
          {phase === 'success_boxes' ? (
            <>
              <Text style={styles.title}>Verifying…</Text>
              <Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnim }] }]}>
                {otp.map((digit, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.otpBoxWrap,
                      { transform: [{ scale: boxAnims[index] }] },
                    ]}
                  >
                    <View
                      style={[
                        styles.otpInput,
                        successBoxes[index] ? styles.otpInputSuccess : styles.otpInputFilled,
                      ]}
                    >
                      <Text style={styles.otpDigit}>{digit}</Text>
                    </View>
                  </Animated.View>
                ))}
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View
                style={[
                  styles.successRing,
                  { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />
              <Animated.View
                style={[styles.successCircle, { transform: [{ scale: successScale }] }]}
              >
                <Text style={styles.successCheck}>✓</Text>
              </Animated.View>
              <Animated.Text style={[styles.successTitle, { opacity: successOpacity }]}>
                Verified!
              </Animated.Text>
              <Animated.Text style={[styles.successSub, { opacity: successOpacity }]}>
                {otpType === 'PICKUP' ? 'Pickup OTP confirmed' : 'Delivery OTP confirmed'}
              </Animated.Text>
            </>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!hideChrome && (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verify OTP</Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hideChrome ? (
          <TouchableOpacity onPress={onBack} style={styles.shellBack}>
            <Text style={styles.shellBackTxt}>← Back</Text>
          </TouchableOpacity>
        ) : null}

        <Animated.View style={[styles.iconContainer, { transform: [{ scale: lockPulse }] }]}>
          {phase === 'verifying' ? (
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <Text style={styles.icon}>⏳</Text>
            </Animated.View>
          ) : (
            <Text style={styles.icon}>🔐</Text>
          )}
        </Animated.View>

        <Text style={styles.title}>
          {phase === 'verifying' ? 'Checking OTP…' : 'Enter OTP'}
        </Text>
        <Text style={styles.subtitle}>
          Ask customer for the {otpType === 'PICKUP' ? 'pickup' : 'delivery'} OTP
        </Text>

        <Animated.View style={[styles.otpContainer, { transform: [{ translateX: shakeAnim }] }]}>
          {otp.map((digit, index) => (
            <Animated.View
              key={index}
              style={{ transform: [{ scale: boxAnims[index] }] }}
            >
              <TextInput
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  focusedIndex === index && styles.otpInputFocused,
                  digit ? styles.otpInputFilled : null,
                  phase === 'verifying' && styles.otpInputVerifying,
                ]}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={phase === 'entry'}
              />
            </Animated.View>
          ))}
        </Animated.View>

        {phase === 'verifying' ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: SPACING.lg }} />
        ) : (
          <TouchableOpacity
            style={[
              styles.verifyButton,
              otp.join('').length !== 6 && styles.verifyButtonDisabled,
            ]}
            onPress={() => handleVerify()}
            disabled={otp.join('').length !== 6}
            activeOpacity={0.85}
          >
            <Text style={styles.verifyButtonText}>Verify OTP</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleResendOTP} style={styles.resendButton} disabled={phase === 'verifying'}>
          <Text style={styles.resendButtonText}>Didn't receive OTP? Resend</Text>
        </TouchableOpacity>

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 Instructions</Text>
          <Text style={styles.instructionText}>
            • Ask customer to provide the {otpType === 'PICKUP' ? 'pickup' : 'delivery'} OTP
          </Text>
          <Text style={styles.instructionText}>• OTP is 6 digits</Text>
          <Text style={styles.instructionText}>• If customer doesn't have OTP, contact advisor</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: { padding: SPACING.sm },
  backButtonText: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '800' },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    color: COLORS.heading,
    marginLeft: SPACING.sm,
  },
  shellBack: { alignSelf: 'flex-start', paddingHorizontal: 4, paddingBottom: 8 },
  shellBackTxt: { fontSize: FONT_SIZES.md, color: COLORS.primary, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl + 48,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.small,
  },
  icon: { fontSize: 44 },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.bodyText,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    gap: 6,
  },
  otpBoxWrap: {},
  otpInput: {
    width: 46,
    height: 56,
    borderWidth: 2,
    borderColor: COLORS.gray[300],
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: COLORS.white,
    color: COLORS.heading,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: { fontSize: 22, fontWeight: '800', color: COLORS.white, textAlign: 'center', lineHeight: 52 },
  otpInputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '08' },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  otpInputVerifying: { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
  otpInputSuccess: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.success,
    justifyContent: 'center',
  },
  verifyButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  verifyButtonDisabled: { backgroundColor: COLORS.gray[300] },
  verifyButtonText: { fontSize: FONT_SIZES.md, fontWeight: '800', color: COLORS.white },
  resendButton: { padding: SPACING.sm, marginBottom: SPACING.lg },
  resendButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  instructionsCard: {
    width: '100%',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    ...SHADOWS.small,
  },
  instructionsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  instructionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginBottom: 6,
    lineHeight: 20,
  },
  successOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  successRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.success,
  },
  successCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.small,
  },
  successCheck: { fontSize: 52, color: COLORS.white, fontWeight: '800' },
  successTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
  },
  successSub: { fontSize: FONT_SIZES.md, color: COLORS.bodyText, textAlign: 'center' },
});
