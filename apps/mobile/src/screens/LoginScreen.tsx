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
  Image,
} from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/environment';
import { setCustomerSessionToken } from '../lib/customerSession';

export default function LoginScreen({ navigation, onLoginSuccess }: any) {
  const [customerStep, setCustomerStep] = useState<'phone' | 'otp'>('phone');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOtp, setCustomerOtp] = useState('');
  const [customerConfirmation, setCustomerConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [partnerMode, setPartnerMode] = useState(false);

  useEffect(() => {
    // Emulator/testing stability: skip app verification challenge for Firebase test numbers.
    if (__DEV__) {
      auth().settings.appVerificationDisabledForTesting = true;
    }
  }, []);

  const handleCustomerOtpStart = async () => {
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const phoneWithCountry = `+91${cleanPhone}`;
      const result = await auth().signInWithPhoneNumber(phoneWithCountry);
      setCustomerConfirmation(result);
      setCustomerStep('otp');
      Alert.alert('OTP Sent', `OTP sent to ${phoneWithCountry}`);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/network-request-failed') {
        Alert.alert(
          'Send OTP Failed',
          'Network issue. Check emulator internet and Firebase Auth app setup (package name + SHA).'
        );
      } else {
        Alert.alert('Send OTP Failed', error?.message || 'Unable to send OTP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerOtpVerify = async () => {
    if (!customerConfirmation) {
      Alert.alert('Session Expired', 'Please request OTP again.');
      setCustomerStep('phone');
      return;
    }
    if (customerOtp.trim().length < 4) {
      Alert.alert('Invalid OTP', 'Please enter the OTP sent to your number');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await customerConfirmation.confirm(customerOtp.trim());
      if (!userCredential?.user) throw new Error('OTP verification failed');
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

      if (!json?.session_token) {
        throw new Error('Session token not received');
      }
      await setCustomerSessionToken(json.session_token);
      Alert.alert('Login Successful', 'You are now logged in as customer');
      navigation?.navigate?.('PublicHome');
    } catch (error: any) {
      Alert.alert('OTP Verification Failed', error?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      // Login
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('No user returned');
      }

      // ✅ FIX: Fetch profile with correct role join (like web)
      const { data: profile, error: profileError } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles!role_id(role_code, role_name)
        `)
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      // Success: AuthContext will react to the new session. If a callback is provided, call it.
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(authData.user, profile);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid email or password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image 
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Login Form */}
        <View style={styles.formSection}>
          <Text style={styles.formTitle}>Welcome Back! 👋</Text>
          <Text style={styles.formSubtitle}>Login with mobile OTP</Text>

          {customerStep === 'phone' ? (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📱</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  value={customerPhone}
                  onChangeText={(text) => setCustomerPhone(text.replace(/\D/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.customerPrimaryButton, loading && styles.loginButtonDisabled]}
                onPress={handleCustomerOtpStart}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.customerPrimaryButtonText}>Continue with OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔐</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter OTP"
                  value={customerOtp}
                  onChangeText={(text) => setCustomerOtp(text.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.customerPrimaryButton, loading && styles.loginButtonDisabled]}
                onPress={handleCustomerOtpVerify}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.customerPrimaryButtonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.changeNumberButton}
                disabled={loading}
                onPress={() => {
                  setCustomerStep('phone');
                  setCustomerOtp('');
                  setCustomerConfirmation(null);
                }}
              >
                <Text style={styles.changeNumberText}>Change Number</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>New customer?</Text>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('CustomerSignup')}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.partnerMiniButton}
            onPress={() => setPartnerMode((prev: boolean) => !prev)}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.partnerMiniButtonText}>
              {partnerMode ? 'Hide Partner Login' : 'Partner Login'}
            </Text>
          </TouchableOpacity>

          {partnerMode && (
            <>
              <View style={styles.partnerDivider}>
                <Text style={styles.partnerDividerText}>Partner Sign In</Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Partner Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Text style={{fontSize: 18}}>{showPassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Partner Sign In</Text>
                    <Text style={{fontSize: 18, color: '#FFF'}}>→</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.infoBox}>
                <Text style={{fontSize: 18, color: '#3B82F6'}}>ℹ️</Text>
                <Text style={styles.infoText}>
                  Use your registered partner credentials
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by MyFNG © 2025
          </Text>
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
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 200,
    height: 80,
  },
  formSection: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 5,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 25,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#0088E8',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    shadowColor: '#0088E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  signupRow: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  signupText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  signupLink: {
    fontSize: 13,
    color: '#0088E8',
    fontWeight: '800',
  },
  customerPrimaryButton: {
    marginTop: 8,
    backgroundColor: '#0088E8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#0088E8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  customerPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  partnerMiniButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  partnerMiniButtonText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '700',
  },
  partnerDivider: {
    marginTop: 14,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  partnerDividerText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    textAlign: 'center',
  },
  changeNumberButton: {
    marginTop: 10,
    alignItems: 'center',
  },
  changeNumberText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 30,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});
