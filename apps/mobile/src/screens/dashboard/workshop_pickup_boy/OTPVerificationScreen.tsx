import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

interface Props {
  leadId: string;
  otpType: 'PICKUP' | 'DROP';
  onBack: () => void;
  onSuccess: () => void;
}

export default function OTPVerificationScreen({
  leadId,
  otpType,
  onBack,
  onSuccess,
}: Props) {
  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [onBack]);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = React.useRef<Array<TextInput | null>>([]);

  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    if (!/^\d*$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Error', 'Please enter complete 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${ENV.API_URL}/api/pickup/${leadId}/verify-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            otp_code: otpCode,
            otp_type: otpType,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to verify OTP');
      }

      Alert.alert('Success', 'OTP verified successfully!', [
        { text: 'OK', onPress: onSuccess },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    Alert.alert('Resend OTP', 'Contact admin to resend OTP');
    // TODO: Implement resend OTP functionality
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify OTP</Text>
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🔐</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          Ask customer for the {otpType === 'PICKUP' ? 'pickup' : 'delivery'} OTP
        </Text>

        {/* OTP Input */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputs.current[index] = ref)}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[
            styles.verifyButton,
            (loading || otp.join('').length !== 6) && styles.verifyButtonDisabled,
          ]}
          onPress={handleVerify}
          disabled={loading || otp.join('').length !== 6}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.verifyButtonText}>Verify OTP</Text>
          )}
        </TouchableOpacity>

        {/* Resend OTP */}
        <TouchableOpacity onPress={handleResendOTP} style={styles.resendButton}>
          <Text style={styles.resendButtonText}>Didn't receive OTP? Contact Admin</Text>
        </TouchableOpacity>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📋 Instructions:</Text>
          <Text style={styles.instructionText}>
            • Ask customer to provide the {otpType === 'PICKUP' ? 'pickup' : 'delivery'} OTP
          </Text>
          <Text style={styles.instructionText}>
            • OTP is 6 digits
          </Text>
          <Text style={styles.instructionText}>
            • If customer doesn't have OTP, contact admin
          </Text>
          <Text style={styles.instructionText}>
            • Never proceed without valid OTP verification
          </Text>
        </View>

        {/* Report Issue */}
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => {
            Alert.alert(
              'Report Issue',
              'What is the issue?',
              [
                { text: 'Wrong Customer', onPress: () => {} },
                { text: 'Customer Refused', onPress: () => {} },
                { text: 'Wrong Address', onPress: () => {} },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <Text style={styles.reportButtonText}>⚠️ Report Issue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  backButton: {
    padding: SPACING.sm,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginLeft: SPACING.sm,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  icon: {
    fontSize: 50,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
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
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginHorizontal: 4,
    backgroundColor: COLORS.white,
  },
  verifyButton: {
    width: '100%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  verifyButtonDisabled: {
    backgroundColor: COLORS.gray[300],
  },
  verifyButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  resendButton: {
    padding: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  resendButtonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  instructionsCard: {
    width: '100%',
    backgroundColor: COLORS.info + '20',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  instructionsTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
    marginBottom: SPACING.sm,
  },
  instructionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginBottom: 4,
  },
  reportButton: {
    width: '100%',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: 'center',
  },
  reportButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.danger,
  },
});

