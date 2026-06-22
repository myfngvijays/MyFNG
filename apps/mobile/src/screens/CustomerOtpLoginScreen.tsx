import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ENV } from '../config/environment';
import { setCustomerSessionToken } from '../lib/customerSession';
import {
  shouldSkipFirebaseSmsOnSimulator,
  sendFirebaseSmsOtp,
  isIosSimulator,
  isFirebaseIosClientError,
  firebaseTestOtpHint,
} from '../lib/firebasePhoneAuth';

type Step = 'phone' | 'otp';
type OtpChannel = 'sms' | 'whatsapp';

export default function CustomerOtpLoginScreen({ navigation, route }: any) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(route?.params?.initialPhone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpChannel, setOtpChannel] = useState<OtpChannel>('sms');
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  useEffect(() => {
    const initialPhone = route?.params?.initialPhone;
    if (typeof initialPhone === 'string' && initialPhone.length > 0) {
      setPhone(initialPhone.replace(/\D/g, '').slice(0, 10));
    }
  }, [route?.params?.initialPhone]);

  const handleSendWhatsAppOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setOtpChannel('whatsapp');
    setConfirmation(null);
    try {
      const payload = JSON.stringify({ phone: cleanPhone });
      const headers = {
        'Content-Type': 'application/json',
        'x-mobile-client': 'true',
      };

      let res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-otp`, {
        method: 'POST',
        headers,
        body: payload,
      });
      let json = await res.json().catch(() => ({}));

      if (res.status === 404) {
        res = await fetch(`${ENV.API_URL}/api/booking/send-otp`, {
          method: 'POST',
          headers,
          body: payload,
        });
        json = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        throw new Error(json?.error || `Unable to send WhatsApp OTP (HTTP ${res.status})`);
      }

      setStep('otp');
      Alert.alert('OTP Sent', `WhatsApp OTP sent to +91${cleanPhone}`);
    } catch (error: any) {
      Alert.alert('Send OTP Failed', error?.message || 'Unable to send WhatsApp OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSmsOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    if (shouldSkipFirebaseSmsOnSimulator(cleanPhone)) {
      Alert.alert(
        'Simulator SMS unavailable',
        'iOS Simulator par real SMS nahi aata. WhatsApp OTP bhej rahe hain.',
        [{ text: 'OK', onPress: () => handleSendWhatsAppOtp() }],
      );
      return;
    }

    setLoading(true);
    setOtpChannel('sms');
    try {
      const result = await sendFirebaseSmsOtp(cleanPhone);
      setConfirmation(result);
      setStep('otp');
      const testHint = firebaseTestOtpHint(cleanPhone);
      Alert.alert('OTP Sent', testHint || `OTP sent to +91${cleanPhone}`);
    } catch (error: any) {
      if (__DEV__ && isIosSimulator() && isFirebaseIosClientError(error)) {
        await handleSendWhatsAppOtp();
        return;
      }
      const code = error?.code as string | undefined;
      if (code === 'auth/missing-client-identifier' || code === 'auth/app-not-authorized') {
        Alert.alert(
          'SMS Unavailable',
          'SMS verification is unavailable on this device. Use WhatsApp OTP instead.',
          [
            { text: 'Use WhatsApp', onPress: () => handleSendWhatsAppOtp() },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      } else {
        Alert.alert('Send OTP Failed', error?.message || 'Unable to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySmsOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (otp.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your number');
      return;
    }

    setLoading(true);
    try {
      if (!confirmation) {
        throw new Error('OTP request expired. Please send OTP again.');
      }
      const userCredential = await confirmation.confirm(otp.trim());
      if (!userCredential?.user) {
        throw new Error('OTP verification failed');
      }
      const idToken = await userCredential.user.getIdToken();

      const verifyOtpUrl = `${ENV.API_URL}/api/customer/auth/verify-otp`;
      const res = await fetch(verifyOtpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mobile-client': 'true',
        },
        body: JSON.stringify({ idToken }),
      });
      const raw = await res.text();
      let json: any = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch (_e) {
        json = {};
      }
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Auth API not found at ${verifyOtpUrl}`);
        }
        throw new Error(json?.error || `Verification failed (HTTP ${res.status})`);
      }

      if (json?.session_token) {
        await setCustomerSessionToken(json.session_token);
      } else {
        throw new Error('Session token not received');
      }

      Alert.alert('Login Successful', 'You are now logged in as customer');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('OTP Verification Failed', error?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyWhatsAppOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP sent on WhatsApp');
      return;
    }

    setLoading(true);
    try {
      const payload = JSON.stringify({
        phone: cleanPhone,
        otp: otp.trim(),
      });
      const headers = {
        'Content-Type': 'application/json',
        'x-mobile-client': 'true',
      };

      let res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
        method: 'POST',
        headers,
        body: payload,
      });
      let json = await res.json().catch(() => ({}));

      if (res.status === 404) {
        const verifyRes = await fetch(`${ENV.API_URL}/api/booking/verify-otp`, {
          method: 'POST',
          headers,
          body: payload,
        });
        const verifyJson = await verifyRes.json().catch(() => ({}));
        if (!verifyRes.ok || !verifyJson?.verified) {
          throw new Error(verifyJson?.error || `Verification failed (HTTP ${verifyRes.status})`);
        }
        res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
          method: 'POST',
          headers,
          body: payload,
        });
        json = await res.json().catch(() => ({}));
      }

      if (!res.ok) {
        throw new Error(json?.error || `Verification failed (HTTP ${res.status})`);
      }
      if (!json?.session_token) {
        throw new Error('Session token not received');
      }

      await setCustomerSessionToken(String(json.session_token));
      Alert.alert('Login Successful', 'You are now logged in as customer');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('OTP Verification Failed', error?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = otpChannel === 'whatsapp' ? handleVerifyWhatsAppOtp : handleVerifySmsOtp;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Customer Login</Text>
          <Text style={styles.subtitle}>Login with mobile number and OTP</Text>

          {__DEV__ && isIosSimulator() && step === 'phone' ? (
            <Text style={styles.simulatorHint}>
              iOS Simulator: real SMS phone par nahi aayega. WhatsApp OTP use karein, ya test number 7007543565 (OTP 454545).
            </Text>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={styles.input}
              placeholder="9876543210"
              keyboardType="phone-pad"
              value={phone}
              maxLength={10}
              onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
              editable={!loading}
            />
          </View>

          {step === 'otp' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>OTP ({otpChannel === 'sms' ? 'SMS' : 'WhatsApp'})</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter OTP"
                keyboardType="number-pad"
                value={otp}
                maxLength={6}
                onChangeText={(text) => setOtp(text.replace(/\D/g, ''))}
                editable={!loading}
              />
            </View>
          )}

          {step === 'phone' ? (
            <>
              <TouchableOpacity
                style={[styles.button, loading && otpChannel === 'sms' && styles.buttonDisabled]}
                onPress={handleSendSmsOtp}
                disabled={loading}
              >
                {loading && otpChannel === 'sms' ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP via SMS</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.whatsappButton, loading && otpChannel === 'whatsapp' && styles.buttonDisabled]}
                onPress={handleSendWhatsAppOtp}
                disabled={loading}
              >
                {loading && otpChannel === 'whatsapp' ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP via WhatsApp</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                disabled={loading}
                onPress={() => {
                  setOtp('');
                  setConfirmation(null);
                  setOtpChannel('sms');
                  setStep('phone');
                }}
              >
                <Text style={styles.linkText}>Change Number</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  simulatorHint: {
    marginBottom: 12,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFF',
  },
  button: {
    backgroundColor: '#004AAD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  linkText: {
    color: '#004AAD',
    fontSize: 14,
    fontWeight: '600',
  },
});
