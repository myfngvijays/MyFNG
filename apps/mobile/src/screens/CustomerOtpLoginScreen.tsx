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
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ENV } from '../config/environment';
import { setCustomerSessionToken } from '../lib/customerSession';

type Step = 'phone' | 'otp';

// Phone numbers we register in Firebase Console as "Phone numbers for testing".
// Includes the App Store reviewer demo number so OTP works without APNs/SMS.
// Reviewer demo: phone 7007543565 / OTP 454545 (configured in Firebase Console).
const FIREBASE_TEST_PHONE_NUMBERS = ['7007543565'];

export default function CustomerOtpLoginScreen({ navigation, route }: any) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(route?.params?.initialPhone || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);

  useEffect(() => {
    const initialPhone = route?.params?.initialPhone;
    if (typeof initialPhone === 'string' && initialPhone.length > 0) {
      setPhone(initialPhone.replace(/\D/g, '').slice(0, 10));
    }
  }, [route?.params?.initialPhone]);

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      // Disable app verification for pre-registered Firebase test numbers
      // (App Store reviewer + dev). Prevents native iOS crash on devices
      // without APNs / cellular (e.g. iPad with no SIM).
      const isTestNumber = FIREBASE_TEST_PHONE_NUMBERS.includes(cleanPhone);
      if (__DEV__ || isTestNumber) {
        try {
          auth().settings.appVerificationDisabledForTesting = true;
        } catch {
          // settings may not be available in all environments
        }
      }
      const phoneWithCountry = `+91${cleanPhone}`;
      const result = await auth().signInWithPhoneNumber(phoneWithCountry);
      setConfirmation(result);
      setStep('otp');
      Alert.alert('OTP Sent', `OTP sent to ${phoneWithCountry}`);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/missing-client-identifier' || code === 'auth/app-not-authorized') {
        Alert.alert(
          'Verification Unavailable',
          'Phone verification is unavailable on this device. Please try a real iPhone with a SIM, or use email login.'
        );
      } else {
        Alert.alert('Send OTP Failed', error?.message || 'Unable to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Customer Login</Text>
          <Text style={styles.subtitle}>Login with mobile number and OTP</Text>

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
              <Text style={styles.label}>OTP</Text>
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
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>
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
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 18,
    fontSize: 14,
    color: '#6B7280',
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFF',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#0088E8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#0088E8',
    fontWeight: '600',
  },
});

