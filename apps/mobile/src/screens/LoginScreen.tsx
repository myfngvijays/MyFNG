import React, { useEffect, useRef, useState } from 'react';
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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { supabase } from '../lib/supabase';
import { ENV } from '../config/environment';
import { setCustomerSessionToken } from '../lib/customerSession';
import { registerCustomerFcmPushToken } from '../services/pushNotifications';
import { loadWalletRules } from '../lib/wallet';
import {
  prepareFirebasePhoneAuth,
  isDevSimulator,
  isFirebaseTestPhone,
  firebaseTestOtpHint,
  firebaseSmsUnavailableMessage,
} from '../lib/firebasePhoneAuth';
import {
  checkSmsOtpAllowed,
  sendSmsOtp,
  verifySmsOtp,
} from '../lib/backendSmsOtp';
import { WelcomeBonusCreditedModal } from '../components/WelcomeBonusModal';
import { ReferralCodeModal } from '../components/ReferralCodeModal';
import { getPendingReferralCode, clearPendingReferralCode } from '../lib/referralDeepLink';
import {
  AuthVerifyResponse,
  decideWelcomeCreditedPopup,
  getWelcomeBonusAmount,
  markWelcomeCreditedPopupShown,
  mobileCustomerHeaders,
  resolveCustomerIdFromAuth,
} from '../lib/welcomeBonus';

export default function LoginScreen({ navigation, onLoginSuccess }: any) {
  const insets = useSafeAreaInsets();
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [phoneOtpChannel, setPhoneOtpChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [customerStep, setCustomerStep] = useState<'input' | 'otp'>('input');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOtp, setCustomerOtp] = useState('');
  const [customerConfirmation, setCustomerConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [resendInSec, setResendInSec] = useState(0);
  const [creditedWelcomeVisible, setCreditedWelcomeVisible] = useState(false);
  const [creditedWelcomeAmount, setCreditedWelcomeAmount] = useState(getWelcomeBonusAmount());
  const [referralModalVisible, setReferralModalVisible] = useState(false);
  const [deepLinkReferralCode, setDeepLinkReferralCode] = useState('');
  const pendingHomeNavigationRef = useRef(false);
  const isNewCustomerRef = useRef(false);
  const pendingWelcomeCustomerIdRef = useRef<string | null>(null);
  const pendingWelcomePhoneRef = useRef<string | null>(null);

  // Phone numbers we register in Firebase Console as "Phone numbers for testing".
  // Includes the App Store reviewer demo number so OTP works without APNs/SMS.
  // Real users with real numbers go through the standard reCAPTCHA + SMS flow.
  // Reviewer demo: phone 7007543565 / OTP 454545 (configured in Firebase Console).
  useEffect(() => {
    prepareFirebasePhoneAuth();
  }, []);

  useEffect(() => {
    if (resendInSec <= 0) return;
    const timer = setInterval(() => {
      setResendInSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendInSec]);

  const maybeShowCreditedPopup = async (
    sessionToken: string,
    authResponse?: AuthVerifyResponse | null,
    customerId?: string | null,
  ) => {
    const decision = await decideWelcomeCreditedPopup(
      sessionToken,
      customerId,
      authResponse,
      authResponse?.customer?.phone || customerPhone,
    );
    if (decision.show) {
      const resolvedId =
        resolveCustomerIdFromAuth(authResponse, customerId) ||
        (customerId ? String(customerId) : null);
      pendingWelcomeCustomerIdRef.current = resolvedId;
      pendingWelcomePhoneRef.current = authResponse?.customer?.phone || customerPhone || null;
      setCreditedWelcomeAmount(decision.amount);
      setCreditedWelcomeVisible(true);
      return true;
    }
  };

  const finishLoginNavigation = () => {
    if (isNewCustomerRef.current) {
      isNewCustomerRef.current = false;
      getPendingReferralCode().then((pendingCode) => {
        if (pendingCode) {
          setDeepLinkReferralCode(pendingCode);
          void clearPendingReferralCode();
        }
        setReferralModalVisible(true);
      });
      return;
    }
    navigation?.navigate?.('PublicHome');
  };

  const persistSessionAndGoHome = async (token?: string, authResponse?: AuthVerifyResponse | null) => {
    const fallbackToken = `mobile-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const sessionToken = token && token.trim() ? token : fallbackToken;
    await setCustomerSessionToken(sessionToken);
    void loadWalletRules(ENV.API_URL).catch(() => {});

    // Register FCM token immediately after session is saved (RPC — no VPS push-token API needed).
    void registerCustomerFcmPushToken(ENV.API_URL, sessionToken).then((result) => {
      if (!result.ok) {
        console.warn('[push] login token register failed:', result);
      }
    });

    isNewCustomerRef.current = authResponse?.is_new_customer === true;

    let customerProfile: any = null;
    try {
      const res = await fetch(`${ENV.API_URL}/api/customer/auth/me`, {
        headers: mobileCustomerHeaders(sessionToken),
      });
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        customerProfile = json?.customer || null;
      }
    } catch (_e) {
      // Fall back to minimal profile below.
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    const customerId = resolveCustomerIdFromAuth(authResponse, customerProfile?.id);

    if (await maybeShowCreditedPopup(sessionToken, authResponse, customerId)) {
      pendingHomeNavigationRef.current = true;
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(
          { id: customerProfile?.id || cleanPhone, type: 'customer_session' },
          {
            id: customerProfile?.id || cleanPhone,
            full_name: customerProfile?.full_name || 'Customer',
            email: customerProfile?.email || null,
            phone: customerProfile?.phone || cleanPhone,
            role: { role_code: 'CUSTOMER', role_name: 'Customer' },
          },
        );
      }
      return;
    }

    if (typeof onLoginSuccess === 'function') {
      onLoginSuccess(
        { id: customerProfile?.id || cleanPhone, type: 'customer_session' },
        {
          id: customerProfile?.id || cleanPhone,
          full_name: customerProfile?.full_name || 'Customer',
          email: customerProfile?.email || null,
          phone: customerProfile?.phone || cleanPhone,
          role: { role_code: 'CUSTOMER', role_name: 'Customer' },
        },
      );
    }
    finishLoginNavigation();
  };

  const handleCustomerOtpStart = async () => {
    setErrorText('');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }
    const smsCheck = await checkSmsOtpAllowed();
    if (!smsCheck.allowed) {
      setPhoneOtpChannel('sms');
      setErrorText(smsCheck.message);
      return;
    }

    setLoading(true);
    setPhoneOtpChannel('sms');
    try {
      const result = await sendSmsOtp(cleanPhone);
      setCustomerConfirmation(result.confirmation);
      setCustomerStep('otp');
      setResendInSec(30);
    } catch (error: any) {
      setErrorText(firebaseSmsUnavailableMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppOtpStart = async () => {
    setErrorText('');
    setPhoneOtpChannel('whatsapp');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const payload = JSON.stringify({ phone: cleanPhone });
      const headers = {
        'Content-Type': 'application/json',
        'x-mobile-client': 'true',
        'X-App-Platform': Platform.OS,
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

      setErrorText('');
      setCustomerStep('otp');
      setResendInSec(30);
    } catch (error: any) {
      setErrorText(error?.message || 'Unable to send WhatsApp OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerOtpVerify = async () => {
    setErrorText('');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!customerConfirmation && !/^\d{6}$/.test(customerOtp.trim())) {
      setErrorText('Please enter the 6-digit OTP sent to your number');
      return;
    }
    if (customerConfirmation && customerOtp.trim().length < 4) {
      setErrorText('Please enter the OTP sent to your number');
      return;
    }

    setLoading(true);
    try {
      const authResult = await verifySmsOtp(cleanPhone, customerOtp.trim(), customerConfirmation);
      await persistSessionAndGoHome(authResult.session_token, authResult);
    } catch (error: any) {
      setErrorText(error?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppOtpVerify = async () => {
    setErrorText('');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!/^\d{6}$/.test(customerOtp.trim())) {
      setErrorText('Please enter the 6-digit OTP sent on WhatsApp');
      return;
    }

    setLoading(true);
    try {
      const payload = JSON.stringify({
        phone: cleanPhone,
        otp: customerOtp.trim(),
      });
      const headers = {
        'Content-Type': 'application/json',
        'x-mobile-client': 'true',
        'X-App-Platform': Platform.OS,
      };

      let res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
        method: 'POST',
        headers,
        body: payload,
      });
      let json = await res.json().catch(() => ({}));

      // Fallback for servers where new auth route is not deployed yet.
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

        // Second attempt to create a real customer session.
        res = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
          method: 'POST',
          headers,
          body: payload,
        });
        json = await res.json().catch(() => ({}));

        if (res.status === 404) {
          throw new Error(
            'WhatsApp OTP verified, but login session is unavailable. Please use SMS OTP or update the app.',
          );
        }
      }

      if (!res.ok) {
        throw new Error(json?.error || `Verification failed (HTTP ${res.status})`);
      }
      if (!json?.session_token) {
        throw new Error('WhatsApp OTP verified, but login session endpoint is not available. Please deploy latest backend APIs.');
      }

      await persistSessionAndGoHome(String(json.session_token), json);
    } catch (error: any) {
      setErrorText(error?.message || 'Invalid WhatsApp OTP');
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

  const handleResendOtp = async () => {
    if (loading || resendInSec > 0) return;
    if (phoneOtpChannel === 'whatsapp') {
      await handleWhatsAppOtpStart();
    } else {
      await handleCustomerOtpStart();
    }
  };

  const switchToPhoneLogin = () => {
    setLoginMethod('phone');
  };

  const switchToEmailLogin = () => {
    setLoginMethod('email');
    if (customerStep === 'otp') {
      setCustomerStep('input');
      setCustomerOtp('');
      setCustomerConfirmation(null);
      setPhoneOtpChannel('sms');
      setErrorText('');
      setResendInSec(0);
    }
  };

  const resetPhoneOtpAndGoInput = () => {
    setCustomerStep('input');
    setCustomerOtp('');
    setCustomerConfirmation(null);
    setPhoneOtpChannel('sms');
    setErrorText('');
    setResendInSec(0);
  };

  const submitOtp = phoneOtpChannel === 'sms' ? handleCustomerOtpVerify : handleWhatsAppOtpVerify;

  const startPhoneOtp = () => {
    if (loading) return;
    setPhoneOtpChannel('sms');
    void handleCustomerOtpStart();
  };

  const startEmailLogin = () => {
    if (loading) return;
    setErrorText('');
    if (!email.trim().includes('@')) {
      setErrorText('Please enter a valid email address');
      return;
    }
    if (!password.trim()) {
      setErrorText('Please enter password');
      return;
    }
    void handleLogin();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity
        style={[styles.skipButton, { top: insets.top + 14 }]}
        onPress={() => navigation?.navigate?.('PublicHome')}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.centerWrap}>
          <View style={styles.brandWrap}>
            <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
          <Text style={styles.brandTitle}>Welcome to MyFNG</Text>
          <Text style={styles.brandSubTitle}>Your car&apos;s best friend is just a login away</Text>

          {customerStep === 'input' && (
            <View style={styles.methodToggle}>
              <TouchableOpacity
                style={[styles.methodButton, loginMethod === 'phone' && styles.methodButtonActive]}
                onPress={switchToPhoneLogin}
                activeOpacity={0.85}
              >
                <Text style={[styles.methodButtonText, loginMethod === 'phone' && styles.methodButtonTextActive]}>Phone Number</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.methodButton, loginMethod === 'email' && styles.methodButtonActive]}
                onPress={switchToEmailLogin}
                activeOpacity={0.85}
              >
                <Text style={[styles.methodButtonText, loginMethod === 'email' && styles.methodButtonTextActive]}>Email Address</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.formArea}>
            {customerStep === 'input' || loginMethod === 'email' ? (
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>{loginMethod === 'phone' ? 'Phone Number' : 'Email Address'}</Text>
                <View style={styles.inputContainer}>
                  {loginMethod === 'phone' && <Text style={styles.countryCode}>+91</Text>}
                  <TextInput
                    style={[styles.input, loginMethod === 'phone' && styles.phoneInput]}
                    placeholder={loginMethod === 'phone' ? '9152307030' : 'name@example.com'}
                    placeholderTextColor="#9CA3AF"
                    value={loginMethod === 'phone' ? customerPhone : email}
                    onChangeText={(text) =>
                      loginMethod === 'phone'
                        ? setCustomerPhone(text.replace(/\D/g, ''))
                        : setEmail(text.trim())
                    }
                    keyboardType={loginMethod === 'phone' ? 'phone-pad' : 'email-address'}
                    maxLength={loginMethod === 'phone' ? 10 : 80}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
                {loginMethod === 'email' && (
                  <View style={[styles.inputContainer, styles.passwordContainer]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter password"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword((prev) => !prev)} activeOpacity={0.8}>
                      <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
                {__DEV__ && isDevSimulator() && loginMethod === 'phone' && customerStep === 'input' ? (
                  <Text style={styles.simulatorHint}>
                    Simulator: real number par SMS nahi aayega. Real phone use karein, ya test number 7007543565 (OTP 454545).
                  </Text>
                ) : null}
                {loginMethod === 'phone' ? (
                  <View style={styles.otpButtonsWrap}>
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.channelButton, loading && styles.buttonDisabled]}
                      onPress={startPhoneOtp}
                      disabled={loading}
                      activeOpacity={0.9}
                    >
                      {loading && phoneOtpChannel === 'sms' ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.primaryButtonRow}>
                          <Ionicons name="chatbox-ellipses-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.primaryButtonText}>Send OTP via SMS</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.whatsappButton, styles.channelButton, loading && styles.buttonDisabled]}
                      onPress={handleWhatsAppOtpStart}
                      disabled={loading}
                      activeOpacity={0.9}
                    >
                      {loading && phoneOtpChannel === 'whatsapp' ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.primaryButtonRow}>
                          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                          <Text style={styles.primaryButtonText}>Send OTP via WhatsApp</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={startEmailLogin}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <View style={styles.primaryButtonRow}>
                        <Text style={styles.primaryButtonText}>Login</Text>
                        <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.formSection}>
                <View style={styles.otpHelpWrap}>
                  <Text style={styles.otpHelp}>
                    OTP sent via {loginMethod === 'phone' ? (phoneOtpChannel === 'sms' ? 'SMS' : 'WhatsApp') : 'Email'} to{' '}
                    {loginMethod === 'phone' ? `+91 ${customerPhone}` : email}
                  </Text>
                  <TouchableOpacity
                    onPress={resetPhoneOtpAndGoInput}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.inputLabel, styles.otpLabel]}>Enter 6-Digit OTP</Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="123456"
                  placeholderTextColor="#9CA3AF"
                  value={customerOtp}
                  onChangeText={(text) => setCustomerOtp(text.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                  textAlign="center"
                />
                {errorText ? <Text style={[styles.errorText, { textAlign: 'center' }]}>{errorText}</Text> : null}
                {isFirebaseTestPhone(customerPhone) && firebaseTestOtpHint(customerPhone) ? (
                  <Text style={[styles.simulatorHint, { textAlign: 'center' }]}>
                    {firebaseTestOtpHint(customerPhone)}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={[styles.verifyButton, loading && styles.buttonDisabled]}
                  onPress={submitOtp}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.verifyButtonText}>Verify & Continue</Text>}
                </TouchableOpacity>
                <Text style={styles.resendText}>
                  Didn&apos;t receive OTP?{' '}
                  {resendInSec > 0 ? (
                    <Text style={styles.resendLink}>Resend in {resendInSec}s</Text>
                  ) : (
                    <Text style={styles.resendLink} onPress={() => { void handleResendOtp(); }}>
                      Resend OTP
                    </Text>
                  )}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.termsText}>
            By continuing, you agree to MyFNG&apos;s{' '}
            <Text
              style={styles.termsTextBold}
              onPress={() => { void Linking.openURL('https://myfng.in/terms-and-conditions'); }}
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={styles.termsTextBold}
              onPress={() => { void Linking.openURL('https://myfng.in/privacy-policy'); }}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>

      <WelcomeBonusCreditedModal
        visible={creditedWelcomeVisible}
        amount={creditedWelcomeAmount}
        onClose={async () => {
          setCreditedWelcomeVisible(false);
          const customerId = pendingWelcomeCustomerIdRef.current;
          const phone = pendingWelcomePhoneRef.current;
          if (customerId || phone) {
            await markWelcomeCreditedPopupShown(customerId || '', phone);
            pendingWelcomeCustomerIdRef.current = null;
            pendingWelcomePhoneRef.current = null;
          }
          if (pendingHomeNavigationRef.current) {
            pendingHomeNavigationRef.current = false;
            finishLoginNavigation();
          }
        }}
      />
      <ReferralCodeModal
        visible={referralModalVisible}
        initialCode={deepLinkReferralCode}
        onClose={() => {
          setReferralModalVisible(false);
          navigation?.navigate?.('PublicHome');
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  skipButton: {
    position: 'absolute',
    right: 20,
    zIndex: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  skipText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandWrap: {
    width: 200,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  brandLogo: {
    width: 200,
    height: 54,
  },
  brandTitle: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '700',
  },
  brandSubTitle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
    marginBottom: 40,
    textAlign: 'center',
  },
  methodToggle: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
  },
  methodButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  methodButtonActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  methodButtonText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  methodButtonTextActive: {
    color: '#004AAD',
  },
  formArea: {
    width: '100%',
    maxWidth: 448,
  },
  formSection: {
    gap: 8,
  },
  otpButtonsWrap: {
    marginTop: 14,
    gap: 10,
  },
  channelButton: {
    marginTop: 0,
  },
  primaryButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otpHelpWrap: {
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  otpLabel: {
    textAlign: 'center',
    marginTop: 4,
    marginLeft: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingHorizontal: 14,
  },
  countryCode: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 14,
    color: '#111827',
  },
  phoneInput: {
    paddingLeft: 0,
  },
  otpHelp: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  changeText: {
    marginTop: 4,
    marginBottom: 10,
    textAlign: 'center',
    color: '#004AAD',
    fontSize: 12,
    fontWeight: '700',
  },
  otpInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
    color: '#111827',
    marginBottom: 14,
  },
  eyeIcon: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  eyeText: {
    color: '#004AAD',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#004AAD',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#004AAD',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  whatsappButton: {
    borderRadius: 16,
    backgroundColor: '#16A34A',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  verifyButton: {
    borderRadius: 16,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resendText: {
    marginTop: 10,
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  resendLink: {
    color: '#004AAD',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    marginTop: 8,
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
  },
  simulatorHint: {
    marginTop: 8,
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 14,
  },
  termsText: {
    marginTop: 48,
    textAlign: 'center',
    fontSize: 10,
    color: '#9CA3AF',
    maxWidth: 340,
    paddingHorizontal: 32,
  },
  termsTextBold: {
    color: '#4B5563',
    fontWeight: '700',
  },
  passwordContainer: {
    marginTop: 10,
  },
});
