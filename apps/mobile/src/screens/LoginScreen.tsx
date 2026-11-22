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
import { rememberAccessToken, supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { ENV } from '../config/environment';
import { isLikelyNetworkError, staffLoginNetworkMessage } from '../lib/networkError';
import { setCustomerSessionToken } from '../lib/customerSession';
import { registerCustomerFcmPushToken } from '../services/pushNotifications';
import { loadWalletRules } from '../lib/wallet';
import {
  prepareFirebasePhoneAuth,
  isDevSimulator,
  isFirebaseTestPhone,
  firebaseTestOtpHint,
} from '../lib/firebasePhoneAuth';
import { sendSmsOtp, verifySmsOtp } from '../lib/backendSmsOtp';
import { WelcomeBonusCreditedModal } from '../components/WelcomeBonusModal';
import { ReferralCodeModal } from '../components/ReferralCodeModal';
import { InstallCouponModal } from '../components/InstallCouponModal';
import AnimatedOtpInput, { type OtpAnimStatus } from '../components/AnimatedOtpInput';
import OdometerOtp from '../components/customerLogin/OdometerOtp';
import { playLoginSound, preloadLoginSounds } from '../lib/loginSounds';
import { SideCar, Speedometer } from '../components/customerLogin/GarageArt';
import { getPendingReferralCode, clearPendingReferralCode } from '../lib/referralDeepLink';
import { getAppVariant, resolveRoleAccess } from '../config/appVariant';
import {
  AuthVerifyResponse,
  decideWelcomeCreditedPopup,
  getWelcomeBonusAmount,
  markWelcomeCreditedPopupQueued,
  markWelcomeCreditedPopupShown,
  mobileCustomerHeaders,
  resolveCustomerIdFromAuth,
} from '../lib/welcomeBonus';

export default function LoginScreen({ navigation, onLoginSuccess, onSkipPreview }: any) {
  const insets = useSafeAreaInsets();
  const partnerLogin = getAppVariant() === 'partner';
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>(
    partnerLogin ? 'email' : 'phone',
  );
  const [phoneOtpChannel, setPhoneOtpChannel] = useState<'sms' | 'whatsapp' | 'email'>('whatsapp');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpChannels, setOtpChannels] = useState({ sms_dlt: false, whatsapp: true, email: false });
  const [channelsReady, setChannelsReady] = useState(false);
  const [loginCodeSent, setLoginCodeSent] = useState(false);
  const [otpButtonPhase, setOtpButtonPhase] = useState<'idle' | 'sent' | 'submitted'>('idle');
  const waAutoPhone = useRef('');
  const emailAutoKey = useRef('');
  const deliveredRef = useRef({ whatsapp: false, email: false });
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
  const [installCouponVisible, setInstallCouponVisible] = useState(false);
  const [deepLinkReferralCode, setDeepLinkReferralCode] = useState('');
  const pendingHomeNavigationRef = useRef(false);
  const isNewCustomerRef = useRef(false);
  const pendingWelcomeCustomerIdRef = useRef<string | null>(null);
  const pendingWelcomePhoneRef = useRef<string | null>(null);
  const [otpAnim, setOtpAnim] = useState<OtpAnimStatus>('idle');
  const otpVerifyLock = useRef(false);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Phone numbers we register in Firebase Console as "Phone numbers for testing".
  // Includes the App Store reviewer demo number so OTP works without APNs/SMS.
  // Real users with real numbers go through the standard reCAPTCHA + SMS flow.
  // Reviewer demo: phone 7007543565 / OTP 454545 (configured in Firebase Console).
  useEffect(() => {
    prepareFirebasePhoneAuth();
  }, []);

  // Customer garage login sounds: load early, cough on a wrong OTP.
  useEffect(() => {
    if (!partnerLogin) preloadLoginSounds();
  }, [partnerLogin]);
  useEffect(() => {
    if (!partnerLogin && otpAnim === 'error') playLoginSound('stall');
  }, [otpAnim, partnerLogin]);

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
      markWelcomeCreditedPopupQueued(resolvedId, pendingWelcomePhoneRef.current);
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
        // Welcome → install coupon → referral. Delay so prior Modal unmounts first.
        setTimeout(() => setInstallCouponVisible(true), 350);
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

    // Notification then location — never together or location dialog is dropped.
    void import('../lib/launchPermissions').then(({ ensureNotificationThenLocation }) =>
      ensureNotificationThenLocation()
        .then(() => registerCustomerFcmPushToken(ENV.API_URL, sessionToken))
        .then((result) => {
          if (!result.ok) {
            console.warn('[push] login token register failed:', result);
          }
        }),
    );

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

  useEffect(() => {
    fetch(`${ENV.API_URL}/api/public/otp-channels`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => setOtpChannels({
        sms_dlt: Boolean(json?.sms_dlt),
        whatsapp: Boolean(json?.whatsapp),
        email: Boolean(json?.email),
      }))
      .catch(() => undefined)
      .finally(() => setChannelsReady(true));
  }, []);

  const handleEmailOtpStart = async (cleanPhone: string, emailValue: string, auto = false) => {
    if (!auto) setErrorText('');
    if (cleanPhone.length !== 10) {
      setErrorText('Enter your mobile number too.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setErrorText('Enter a valid email ID');
      return;
    }
    if (!auto) setLoading(true);
    setPhoneOtpChannel('email');
    try {
      const res = await fetch(`${ENV.API_URL}/api/booking/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mobile-client': 'true', 'X-App-Platform': Platform.OS },
        body: JSON.stringify({ phone: cleanPhone, email: emailValue, channel: 'EMAIL' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Unable to send email OTP');
      deliveredRef.current.email = true;
      setLoginCodeSent(true);
      setOtpButtonPhase('sent');
      setErrorText('');
      if (!auto) setCustomerStep('otp');
      setResendInSec(15);
    } catch (error: any) {
      emailAutoKey.current = '';
      setErrorText(error?.message || 'Unable to send email OTP');
    } finally {
      if (!auto) setLoading(false);
    }
  };

  const handleCustomerOtpStart = async () => {
    setErrorText('');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setPhoneOtpChannel('sms');
    try {
      await sendSmsOtp(cleanPhone);
      setCustomerConfirmation(null);
      setCustomerStep('otp');
      setResendInSec(15);
    } catch (error: any) {
      setErrorText(error?.message || 'Unable to send SMS OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppOtpStart = async (cleanPhone?: string, auto = false) => {
    if (!auto) setErrorText('');
    setPhoneOtpChannel('whatsapp');
    const phone = String(cleanPhone || customerPhone).replace(/\D/g, '');
    if (phone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!auto) setLoading(true);
    try {
      const payload = JSON.stringify({ phone });
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

      deliveredRef.current.whatsapp = true;
      setLoginCodeSent(true);
      setOtpButtonPhase('sent');
      setErrorText('');
      if (!auto) setCustomerStep('otp');
      if (!partnerLogin) playLoginSound('ignition');
      setResendInSec(15);
    } catch (error: any) {
      waAutoPhone.current = '';
      setErrorText(error?.message || 'Unable to send WhatsApp OTP');
    } finally {
      if (!auto) setLoading(false);
    }
  };

  // Customer taps GET OTP (garage login). No auto-send on the 10th digit any more.

  const sendWhatsappWhenReady = (phone: string) => {
    if (!channelsReady || loginMethod !== 'phone' || phone.length !== 10) return;
    if (waAutoPhone.current === phone) return;
    waAutoPhone.current = phone;
    if (!otpChannels.whatsapp) {
      setErrorText('WhatsApp OTP is turned off.');
      return;
    }
    void handleWhatsAppOtpStart(phone, true);
  };

  useEffect(() => {
    if (!channelsReady || loginMethod !== 'phone') return;
    const phone = customerPhone.replace(/\D/g, '');
    const emailValue = otpEmail.trim();
    const emailReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
    if (!emailReady) {
      emailAutoKey.current = '';
      return;
    }
    if (phone.length !== 10) {
      setErrorText('Enter your mobile number too.');
      return;
    }
    const key = `${phone}|${emailValue.toLowerCase()}`;
    if (emailAutoKey.current === key) return;
    const timer = setTimeout(() => {
      emailAutoKey.current = key;
      if (!otpChannels.email) {
        setErrorText('Email OTP is turned off.');
        return;
      }
      void handleEmailOtpStart(phone, emailValue, true);
    }, 700);
    return () => clearTimeout(timer);
  }, [channelsReady, customerPhone, loginMethod, otpChannels.email, otpEmail]);

  const handleCustomerOtpVerify = async (code?: string) => {
    setOtpButtonPhase('submitted');
    setErrorText('');
    const otp = (code ?? customerOtp).replace(/\D/g, '');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!customerConfirmation && !/^\d{6}$/.test(otp)) {
      return;
    }
    if (customerConfirmation && otp.length < 4) {
      return;
    }
    if (otpVerifyLock.current) return;
    otpVerifyLock.current = true;
    setOtpAnim('mixing');
    setLoading(true);
    const started = Date.now();
    try {
      const authResult = await verifySmsOtp(cleanPhone, otp, customerConfirmation);
      await sleep(Math.max(0, 1400 - (Date.now() - started)));
      setOtpAnim('success');
      await sleep(850);
      await persistSessionAndGoHome(authResult.session_token, authResult);
    } catch (error: any) {
      setOtpAnim('error');
      setOtpButtonPhase('sent');
      setErrorText(error?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
      otpVerifyLock.current = false;
    }
  };

  const handleWhatsAppOtpVerify = async (code?: string) => {
    setOtpButtonPhase('submitted');
    setErrorText('');
    const otp = (code ?? customerOtp).replace(/\D/g, '');
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorText('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      return;
    }
    if (otpVerifyLock.current) return;
    otpVerifyLock.current = true;
    setOtpAnim('mixing');
    setLoading(true);
    const started = Date.now();
    try {
      const payload = JSON.stringify({
        phone: cleanPhone,
        otp,
        channel: phoneOtpChannel === 'email' ? 'EMAIL' : 'WHATSAPP',
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

      if (!res.ok && deliveredRef.current.whatsapp && deliveredRef.current.email) {
        const other = phoneOtpChannel === 'email' ? 'WHATSAPP' : 'EMAIL';
        const retry = await fetch(`${ENV.API_URL}/api/customer/auth/whatsapp-verify`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: cleanPhone, otp, channel: other }),
        });
        const retryJson = await retry.json().catch(() => ({}));
        if (retry.ok && retryJson?.session_token) {
          res = retry;
          json = retryJson;
        }
      }

      if (!res.ok) {
        throw new Error(json?.error || `Verification failed (HTTP ${res.status})`);
      }
      if (!json?.session_token) {
        throw new Error('WhatsApp OTP verified, but login session endpoint is not available. Please deploy latest backend APIs.');
      }

      await sleep(Math.max(0, 1400 - (Date.now() - started)));
      setOtpAnim('success');
      await sleep(850);
      await persistSessionAndGoHome(String(json.session_token), json);
    } catch (error: any) {
      setOtpAnim('error');
      setOtpButtonPhase('sent');
      setErrorText(error?.message || 'Invalid WhatsApp OTP');
    } finally {
      setLoading(false);
      otpVerifyLock.current = false;
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
      rememberAccessToken(authData.session?.access_token);

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

      // Enter dashboard immediately — geo / login history / punch-in must not block the UI.
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(authData.user, profile);
      }

      void (async () => {
        try {
          let latitude: number | null = null;
          let longitude: number | null = null;
          let location_label: string | null = null;
          try {
            const { ensureNotificationThenLocation } = await import('../lib/launchPermissions');
            await ensureNotificationThenLocation();
            const Location = await import('expo-location');
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status === 'granted') {
              const last = await Location.getLastKnownPositionAsync().catch(() => null);
              const loc =
                last ||
                (await Promise.race([
                  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                  new Promise<null>((r) => setTimeout(() => r(null), 2500)),
                ]));
              if (loc?.coords) {
                latitude = loc.coords.latitude;
                longitude = loc.coords.longitude;
                location_label = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
              }
            }
          } catch {
            /* geo optional */
          }
          await apiFetch('/api/auth/record-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              platform: 'mobile',
              user_agent: 'MyFNG Mobile App',
              device_label: 'MyFNG Mobile App',
              latitude,
              longitude,
              location_label,
            }),
          });
        } catch (histErr) {
          console.warn('Login history write skipped', histErr);
        }

        try {
          const roleCode = String(
            (profile as any)?.role?.role_code || (profile as any)?.roles?.role_code || '',
          ).toUpperCase();
          if (resolveRoleAccess(roleCode).kind !== 'allowed') return;
          if (roleCode === 'TELECALLER' || roleCode === 'LEAD_MANAGER' || roleCode === 'APP_OPERATIONS') {
            await apiFetch('/api/telecaller/crm/attendance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'punch_in' }),
            });
          }
        } catch (punchErr) {
          console.warn('Auto punch-in skipped', punchErr);
        }
      })();
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert(
        'Login Failed',
        isLikelyNetworkError(error)
          ? staffLoginNetworkMessage()
          : error.message || 'Invalid email or password',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (loading || resendInSec > 0) return;
    if (phoneOtpChannel === 'whatsapp') {
      await handleWhatsAppOtpStart();
    } else if (phoneOtpChannel === 'email') {
      await handleEmailOtpStart(customerPhone.replace(/\D/g, ''), otpEmail.trim(), false);
    } else {
      await handleCustomerOtpStart();
    }
  };

  const resetPhoneOtpAndGoInput = () => {
    setCustomerStep('input');
    setCustomerOtp('');
    setCustomerConfirmation(null);
    setPhoneOtpChannel('sms');
    setLoginCodeSent(false);
    setOtpButtonPhase('idle');
    deliveredRef.current = { whatsapp: false, email: false };
    waAutoPhone.current = '';
    emailAutoKey.current = '';
    setErrorText('');
    setResendInSec(0);
    setOtpAnim('idle');
    otpVerifyLock.current = false;
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

  const sharedModals = (
    <>
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
            // Wait for Modal dismiss animation — opening next Modal/nav in the same tick
            // can leave an invisible iOS touch blocker (home swipe/scroll dies).
            setTimeout(() => finishLoginNavigation(), 400);
          }
        }}
      />
      <InstallCouponModal
        visible={installCouponVisible}
        welcomeAmount={creditedWelcomeAmount}
        onClose={() => {
          setInstallCouponVisible(false);
          setTimeout(() => setReferralModalVisible(true), 400);
        }}
      />
      <ReferralCodeModal
        visible={referralModalVisible}
        initialCode={deepLinkReferralCode}
        onClose={() => {
          setReferralModalVisible(false);
          setTimeout(() => navigation?.navigate?.('PublicHome'), 400);
        }}
      />
    </>
  );

  // ── Customer login: garage theme (number → OTP odometer). Partner login is below. ──
  if (!partnerLogin) {
    const phoneDigits = customerPhone.replace(/\D/g, '');
    const maskedPhone =
      phoneDigits.length === 10
        ? `+91 ${phoneDigits.slice(0, 5)} ${phoneDigits.slice(5)}`
        : `+91 ${phoneDigits}`;
    const resendClock = `00:${String(resendInSec).padStart(2, '0')}`;
    const startGarageOtp = () => {
      if (loading) return;
      if (phoneDigits.length !== 10) {
        setErrorText('Enter a 10-digit mobile number');
        return;
      }
      void handleWhatsAppOtpStart(phoneDigits, false);
    };

    return (
      <KeyboardAvoidingView
        style={gStyles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {customerStep === 'input' ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={[gStyles.hero, { paddingTop: insets.top + 12 }]}>
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={i} style={[gStyles.stripe, { top: 40 + i * 34 }]} />
              ))}
              <View style={gStyles.heroTop}>
                <View style={gStyles.logoPill}>
                  <Image source={require('../../assets/logo.png')} style={gStyles.logo} resizeMode="contain" />
                </View>
                <TouchableOpacity
                  style={gStyles.skipPill}
                  onPress={() => navigation?.navigate?.('PublicHome')}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={gStyles.skipText}>Skip</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={gStyles.heroTitle}>Garage ka darwaza{'\n'}khol do!</Text>
              <View style={gStyles.carRow}>
                <SideCar width={176} />
              </View>
              <View style={gStyles.road}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View key={i} style={gStyles.roadDash} />
                ))}
              </View>
            </View>

            <View style={gStyles.body}>
              <View style={gStyles.gaugeRow}>
                <Speedometer value={phoneDigits.length} max={10} size={92} />
                <View style={{ flex: 1 }}>
                  <Text style={gStyles.gaugeCount}>
                    {phoneDigits.length}
                    <Text style={gStyles.gaugeMax}>/10</Text>
                  </Text>
                  <Text style={gStyles.gaugeHint}>Number daalo, gaadi start karo</Text>
                </View>
              </View>

              <Text style={gStyles.fieldLabel}>Mobile number</Text>
              <View style={[gStyles.plate, errorText ? gStyles.plateError : null]}>
                <View style={gStyles.plateTag}>
                  <Text style={gStyles.plateTagText}>+91</Text>
                </View>
                <TextInput
                  style={gStyles.plateInput}
                  placeholder="98XXX XXXXX"
                  placeholderTextColor="#B6C2D9"
                  value={customerPhone}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 10);
                    setCustomerPhone(digits);
                    if (errorText) setErrorText('');
                    // 10th digit typed → send OTP straight away (GET OTP stays as a manual retry).
                    if (digits.length === 10 && !loading && waAutoPhone.current !== digits) {
                      waAutoPhone.current = digits;
                      void handleWhatsAppOtpStart(digits, false);
                    }
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  editable={!loading}
                />
              </View>
              {errorText ? <Text style={gStyles.error}>{errorText}</Text> : null}
              {__DEV__ && isDevSimulator() ? (
                <Text style={gStyles.hint}>
                  Simulator: real number par OTP nahi aayega. Test number 7007543565 (OTP 454545).
                </Text>
              ) : null}

              <View style={{ flex: 1, minHeight: 24 }} />
              <View style={gStyles.startWrap}>
                <TouchableOpacity
                  style={[gStyles.startBtn, phoneDigits.length === 10 && gStyles.startBtnReady]}
                  onPress={startGarageOtp}
                  activeOpacity={0.85}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="power" size={22} color="#FFFFFF" />
                      <Text style={gStyles.startText}>GET OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={gStyles.startHint}>PRESS TO START</Text>
              </View>

              <View style={{ flex: 1, minHeight: 24 }} />
              <Text style={gStyles.cities}>Mumbai · Thane · Navi Mumbai · Palghar · Pune</Text>
              <Text style={gStyles.terms}>
                By continuing you agree to our{' '}
                <Text style={gStyles.link} onPress={() => { void Linking.openURL('https://myfng.in/terms-and-conditions'); }}>
                  Terms
                </Text>{' '}
                &{' '}
                <Text style={gStyles.link} onPress={() => { void Linking.openURL('https://myfng.in/privacy-policy'); }}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={gStyles.otpScreen}
            contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={gStyles.otpTop}>
              <TouchableOpacity style={gStyles.backBtn} onPress={resetPhoneOtpAndGoInput} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={20} color="#0F172A" />
              </TouchableOpacity>
              <View style={gStyles.stepPill}>
                <Text style={gStyles.stepPillText}>STEP 2 OF 2 · IGNITION CHECK</Text>
              </View>
            </View>

            <Text style={gStyles.otpTitle}>Enter OTP,{'\n'}start your engine</Text>
            <Text style={gStyles.otpSub}>
              6-digit code sent to{' '}
              <Text style={gStyles.otpPhone}>{phoneOtpChannel === 'email' ? otpEmail : maskedPhone}</Text>
            </Text>
            <TouchableOpacity
              onPress={resetPhoneOtpAndGoInput}
              activeOpacity={0.8}
              style={gStyles.changeNumber}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="create-outline" size={15} color={G_BLUE} />
              <Text style={gStyles.changeNumberText}>Change number</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 20 }}>
              <OdometerOtp
                value={customerOtp}
                onChange={(next) => {
                  if (next.length > customerOtp.length) playLoginSound('tick');
                  setCustomerOtp(next);
                  if (otpAnim === 'error') setOtpAnim('idle');
                  setErrorText('');
                }}
                status={otpAnim}
                onFilled={(code) => { void submitOtp(code); }}
                editable={!loading && otpAnim !== 'success'}
              />
            </View>

            {errorText ? <Text style={[gStyles.error, { textAlign: 'center' }]}>{errorText}</Text> : null}
            {isFirebaseTestPhone(customerPhone) && firebaseTestOtpHint(customerPhone) ? (
              <Text style={[gStyles.hint, { textAlign: 'center' }]}>{firebaseTestOtpHint(customerPhone)}</Text>
            ) : null}

            <View style={gStyles.resendRow}>
              <Text style={gStyles.resendMuted}>Didn&apos;t get the code?</Text>
              {resendInSec > 0 ? (
                <Text style={gStyles.resendStrong}>Resend in {resendClock}</Text>
              ) : (
                <Text style={[gStyles.resendStrong, gStyles.link]} onPress={() => { void handleResendOtp(); }}>
                  Resend OTP
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[gStyles.verifyBtn, (loading || customerOtp.replace(/\D/g, '').length !== 6) && gStyles.verifyBtnDim]}
              onPress={() => { void submitOtp(); }}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={gStyles.verifyText}>VERIFY & DRIVE</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>

            <View style={{ flex: 1, minHeight: 24 }} />
            <TouchableOpacity
              style={gStyles.helpCard}
              activeOpacity={0.85}
              onPress={() => { void Linking.openURL('tel:+919152307030'); }}
            >
              <View style={gStyles.helpIcon}>
                <Ionicons name="construct-outline" size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={gStyles.helpText} numberOfLines={1}>
                  Need help? Our team is here for you
                </Text>
                <Text style={gStyles.helpPhone}>Call +91-9152307030</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        )}
        {sharedModals}
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, partnerLogin && styles.partnerContainer]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {partnerLogin ? (
        <View pointerEvents="none" style={styles.partnerBackdrop}>
          <View style={styles.partnerBlobTop} />
          <View style={styles.partnerBlobLeft} />
          <View style={styles.partnerBlobRight} />
          <View style={styles.partnerRing} />
          <View style={styles.partnerDotA} />
          <View style={styles.partnerDotB} />
          <View style={styles.partnerDotC} />
        </View>
      ) : null}
      {partnerLogin ? (
        <TouchableOpacity
          style={[styles.partnerSkipButton, { top: insets.top + 8 }]}
          onPress={() => onSkipPreview?.()}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.partnerSkipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={16} color="#1E4ED8" />
        </TouchableOpacity>
      ) : null}
      <View style={[styles.hero, partnerLogin && styles.partnerHero, { paddingTop: partnerLogin ? 0 : insets.top + 6 }]}>
        {partnerLogin ? null : (
          <>
            <View style={styles.heroBase} />
            <View style={styles.heroViolet} />
            <View style={styles.heroCyan} />
          </>
        )}
        {partnerLogin ? null : (
        <TouchableOpacity
          style={[styles.skipButton, { top: insets.top + 8 }]}
          onPress={() => navigation?.navigate?.('PublicHome')}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
        )}
        {partnerLogin ? null : (
          <View style={styles.logoPill}>
            <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
          </View>
        )}
      </View>

      <ScrollView style={[styles.sheetScroll, partnerLogin && styles.partnerSheetScroll]} contentContainerStyle={[styles.scrollContent, partnerLogin && styles.partnerScrollContent, partnerLogin && { paddingTop: insets.top + 64 }]} keyboardShouldPersistTaps="handled">
        {partnerLogin ? (
          <View style={styles.partnerHeader}>
            <Image source={require('../../assets/logo.png')} style={styles.partnerLogo} resizeMode="contain" />
            <View style={styles.partnerMascotWrap}>
              <View style={styles.partnerMascotCircle} />
              <Image source={require('../../assets/partner-mascot.png')} style={styles.partnerMascot} resizeMode="contain" />
            </View>
          </View>
        ) : null}
        <View style={[styles.sheet, partnerLogin && styles.partnerSheet]}>
          {partnerLogin ? <Text style={styles.partnerCardTitle}>Partner App Login</Text> : null}
          {partnerLogin ? null : (
          <Text style={[styles.brandTitle, loginMethod === 'email' && styles.partnerTitle]}>
            {loginMethod === 'email' ? 'Partner Login' : 'Welcome back'}
          </Text>
          )}
          {loginMethod === 'phone' ? (
            <Text style={styles.brandSubTitle}>Enter your mobile number to continue</Text>
          ) : null}

          <View style={styles.formArea}>
            {customerStep === 'input' || loginMethod === 'email' ? (
              <View style={styles.formSection}>
              {loginMethod === 'email' ? (
                <>
                  <View style={styles.partnerField}>
                    {partnerLogin ? null : <Text style={styles.partnerFieldLabel}>Email Address</Text>}
                    <View style={[styles.inputContainer, styles.staffInput, partnerLogin && styles.partnerInput]}>
                      <View style={partnerLogin ? styles.partnerIconBubble : undefined}>
                        <Ionicons name={partnerLogin ? 'person' : 'mail-outline'} size={partnerLogin ? 16 : 18} color={partnerLogin ? '#FFFFFF' : '#9CA3AF'} style={partnerLogin ? undefined : styles.fieldIcon} />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder={partnerLogin ? 'Email or Username' : 'your@email.com'}
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={(text) => setEmail(text.trim())}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        editable={!loading}
                      />
                    </View>
                  </View>
                  <View style={styles.partnerField}>
                    {partnerLogin ? null : <Text style={styles.partnerFieldLabel}>Password</Text>}
                    <View style={[styles.inputContainer, styles.passwordContainer, styles.staffInput, styles.partnerPasswordBox, partnerLogin && styles.partnerInput]}>
                      <View style={partnerLogin ? styles.partnerIconBubble : undefined}>
                        <Ionicons name={partnerLogin ? 'lock-closed' : 'lock-closed-outline'} size={partnerLogin ? 15 : 18} color={partnerLogin ? '#FFFFFF' : '#9CA3AF'} style={partnerLogin ? undefined : styles.fieldIcon} />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoComplete="password"
                        editable={!loading}
                      />
                      <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword((prev) => !prev)} activeOpacity={0.8}>
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#6B7280" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
              <View>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputContainer}>
                    <Text style={styles.countryCode}>+91</Text>
                  <TextInput
                    style={[styles.input, styles.phoneInput]}
                    placeholder="9152307030"
                    placeholderTextColor="#9CA3AF"
                    value={customerPhone}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '').slice(0, 10);
                      setCustomerPhone(digits);
                      if (digits.length === 10) sendWhatsappWhenReady(digits);
                    }}
                    keyboardType="phone-pad"
                    maxLength={10}
                    autoCapitalize="none"
                    autoComplete="tel"
                    editable={!loading}
                  />
                </View>
              </View>
              )}
                {errorText ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorText}</Text>
                  </View>
                ) : null}
                {__DEV__ && isDevSimulator() && loginMethod === 'phone' && customerStep === 'input' ? (
                  <Text style={styles.simulatorHint}>
                    Simulator: real number par SMS nahi aayega. Real phone use karein, ya test number 7007543565 (OTP 454545).
                  </Text>
                ) : null}
                {loginMethod === 'phone' ? (
                  <View style={styles.otpButtonsWrap}>
                    <Text style={styles.inputLabel}>Email ID</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={styles.fieldIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="you@email.com"
                        placeholderTextColor="#9CA3AF"
                        value={otpEmail}
                        onChangeText={setOtpEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        autoComplete="email"
                      />
                    </View>
                    {loginCodeSent ? (
                      <View>
                        <Text style={[styles.inputLabel, styles.otpLabel]}>Enter 6-Digit OTP</Text>
                        <AnimatedOtpInput
                          value={customerOtp}
                          onChange={(next) => {
                            setCustomerOtp(next);
                            if (otpAnim === 'error') setOtpAnim('idle');
                            setErrorText('');
                          }}
                          status={otpAnim}
                          onFilled={(code) => { void submitOtp(code); }}
                          editable={otpAnim !== 'success'}
                        />
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={[styles.primaryButton, styles.channelButton]}
                      onPress={() => {
                        if (otpButtonPhase === 'submitted' || loading) return;
                        if (customerOtp.replace(/\D/g, '').length === 6) {
                          void submitOtp();
                          return;
                        }
                        const digits = customerPhone.replace(/\D/g, '');
                        if (digits.length !== 10) {
                          setErrorText('Enter your mobile number');
                          return;
                        }
                        void handleWhatsAppOtpStart(digits, false);
                      }}
                      activeOpacity={0.9}
                    >
                      <Image pointerEvents="none" source={require('../../assets/logo-blue-gradient.png')} style={styles.btnGradient} resizeMode="stretch" />
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.primaryButtonText}>
                          {otpButtonPhase === 'submitted' ? 'SUBMITTED' : otpButtonPhase === 'sent' ? 'OTP SENT' : 'Continue'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryButton, partnerLogin && styles.partnerLoginButton, loading && styles.buttonDisabled]}
                    onPress={startEmailLogin}
                    disabled={loading}
                    activeOpacity={0.9}
                  >
                    {partnerLogin ? null : (
                      <Image pointerEvents="none" source={require('../../assets/logo-blue-gradient.png')} style={styles.btnGradient} resizeMode="stretch" />
                    )}
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Login</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.formSection}>
                <View style={styles.otpHelpWrap}>
                  <View style={styles.otpSentBadge}>
                    <Ionicons
                      name={phoneOtpChannel === 'whatsapp' ? 'logo-whatsapp' : phoneOtpChannel === 'email' ? 'mail-outline' : 'chatbox-ellipses'}
                      size={16}
                      color={phoneOtpChannel === 'whatsapp' ? '#25D366' : '#004AAD'}
                    />
                    <Text style={styles.otpHelp}>
                      OTP sent via {phoneOtpChannel === 'sms' ? 'SMS' : phoneOtpChannel === 'email' ? 'email' : 'WhatsApp'} to{' '}
                      {phoneOtpChannel === 'email' ? otpEmail : loginMethod === 'phone' ? `+91 ${customerPhone}` : email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={resetPhoneOtpAndGoInput}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.inputLabel, styles.otpLabel]}>Enter 6-Digit OTP</Text>
                <AnimatedOtpInput
                  value={customerOtp}
                  onChange={(next) => {
                    setCustomerOtp(next);
                    if (otpAnim === 'error') setOtpAnim('idle');
                    setErrorText('');
                  }}
                  status={otpAnim}
                  onFilled={(code) => {
                    void submitOtp(code);
                  }}
                  editable={!loading && otpAnim !== 'success'}
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

          <Text style={[styles.termsText, partnerLogin && styles.partnerTermsText]}>
            By continuing, you agree to MyFNG&apos;s{' '}
            <Text
              style={[styles.termsTextBold, partnerLogin && styles.partnerTermsBold]}
              onPress={() => { void Linking.openURL('https://myfng.in/terms-and-conditions'); }}
            >
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text
              style={[styles.termsTextBold, partnerLogin && styles.partnerTermsBold]}
              onPress={() => { void Linking.openURL('https://myfng.in/privacy-policy'); }}
            >
              Privacy Policy
            </Text>
          </Text>
        </View>
      </ScrollView>

      {sharedModals}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E4ECFF',
  },
  hero: {
    height: 268,
    backgroundColor: '#2457F5',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2457F5',
  },
  heroViolet: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#7C5CFF',
    opacity: 0.55,
    top: -110,
    right: -80,
  },
  heroCyan: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#3DB7FF',
    opacity: 0.42,
    bottom: -50,
    left: -70,
  },
  skipButton: {
    position: 'absolute',
    right: 18,
    top: 8,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  partnerContainer: {
    backgroundColor: '#D7EEFB',
  },
  partnerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  partnerBlobTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#B7DFF6',
    top: -70,
    left: -60,
  },
  partnerBlobLeft: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#C5E7FA',
    top: 280,
    left: -70,
  },
  partnerBlobRight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: '#B9DCF4',
    top: 120,
    right: -80,
  },
  partnerRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 8,
    borderColor: '#C3E4F8',
    backgroundColor: 'transparent',
    bottom: 90,
    right: 24,
  },
  partnerDotA: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#9FCFEF',
    top: 150,
    left: 28,
  },
  partnerDotB: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    top: 210,
    right: 36,
  },
  partnerDotC: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#A9D4F2',
    bottom: 48,
    left: 32,
  },
  partnerHero: {
    height: 8,
    backgroundColor: 'transparent',
  },
  partnerSkipButton: {
    position: 'absolute',
    right: 18,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  partnerSkipText: {
    color: '#1E4ED8',
    fontSize: 14,
    fontWeight: '700',
  },
  partnerScrollContent: {
    paddingTop: 4,
  },
  partnerHeader: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  partnerLogo: {
    width: 168,
    height: 46,
    backgroundColor: 'transparent',
  },
  partnerCardTitle: {
    color: '#1E4ED8',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  partnerMascotWrap: {
    width: 280,
    height: 250,
    marginTop: 2,
    marginBottom: -36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerMascotCircle: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#7EB6F0',
  },
  partnerMascot: {
    width: 280,
    height: 250,
  },
  partnerSheetScroll: {
    marginTop: 0,
  },
  partnerSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 22,
    borderWidth: 0,
    shadowColor: '#1E4ED8',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  partnerSubtitle: {
    textAlign: 'center',
    color: '#3B6FBF',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 0,
  },
  partnerIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2F6BFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  partnerInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E6EEF8',
    borderRadius: 28,
    minHeight: 54,
    shadowColor: '#1E4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  partnerLoginButton: {
    borderRadius: 28,
    backgroundColor: '#2F6BFF',
    marginTop: 8,
  },
  partnerTitleOnBlue: {
    color: '#0F172A',
  },
  partnerFieldLabelOnBlue: {
    color: '#374151',
  },
  partnerTermsText: {
    color: '#9CA3AF',
  },
  partnerTermsBold: {
    color: '#1F2937',
  },
  logoPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 64,
    zIndex: 2,
    shadowColor: '#102A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  sheetScroll: {
    flex: 1,
    marginTop: -36,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 16,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  brandLogo: {
    width: 142,
    height: 38,
  },
  brandTitle: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '800',
  },
  partnerTitle: {
    textAlign: 'center',
    fontSize: 22,
    marginBottom: 16,
  },
  partnerField: {
    marginBottom: 14,
  },
  partnerFieldLabel: {
    fontSize: 10,
    color: '#111827',
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  partnerPasswordBox: {
    marginTop: 0,
  },
  brandSubTitle: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 22,
  },
  methodToggle: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
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
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  staffInput: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
    borderRadius: 10,
  },
  fieldIcon: {
    marginRight: 8,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
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
  otpSentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF5FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 2,
  },
  otpLabel: {
    textAlign: 'center',
    marginTop: 4,
    marginLeft: 0,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E9F7',
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
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: '#023D95',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#023D95',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  btnGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
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
    zIndex: 1,
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
    marginTop: 0,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  simulatorHint: {
    marginTop: 8,
    fontSize: 10,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 14,
  },
  termsText: {
    marginTop: 28,
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

// Customer "garage" login (number → OTP odometer).
const G_BLUE = '#2457F5';
const gStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F7FD' },
  hero: {
    backgroundColor: G_BLUE,
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomLeftRadius: 0,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoPill: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  logo: { width: 112, height: 30 },
  skipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', lineHeight: 36, marginTop: 30 },
  carRow: { alignItems: 'center', marginTop: 34, marginBottom: 4, paddingLeft: 40 },
  road: {
    height: 14,
    marginHorizontal: -20,
    backgroundColor: '#1D46D1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  roadDash: { width: 26, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.75)' },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 28 },
  gaugeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  gaugeCount: { fontSize: 30, fontWeight: '900', color: '#0F172A' },
  gaugeMax: { fontSize: 14, fontWeight: '800', color: '#64748B' },
  gaugeHint: { fontSize: 13, color: '#475569', fontWeight: '600', marginTop: 2 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  plate: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 3,
    borderColor: '#0F172A',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    height: 62,
  },
  plateError: { borderColor: '#EF4444' },
  plateTag: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    backgroundColor: G_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  plateTagText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  plateInput: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 12,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 1.5,
    color: '#0F172A',
  },

  error: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginTop: 8 },
  hint: { color: '#64748B', fontSize: 12, marginTop: 8 },
  startWrap: { alignItems: 'center' },
  startBtn: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#1E293B',
    borderWidth: 5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  startBtnReady: { backgroundColor: '#0F172A', borderColor: G_BLUE },
  startText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  startHint: { marginTop: 10, fontSize: 11, fontWeight: '800', letterSpacing: 2, color: '#64748B' },
  cities: { textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 24 },
  terms: { textAlign: 'center', fontSize: 12, color: '#475569', marginTop: 4 },
  link: { color: G_BLUE, fontWeight: '800' },
  otpScreen: { flex: 1, backgroundColor: '#F4F7FD' },
  otpTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepPill: { backgroundColor: '#DCE6FF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  stepPillText: { color: G_BLUE, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  otpTitle: { fontSize: 28, fontWeight: '900', color: '#0F172A', lineHeight: 34, marginTop: 22 },
  otpSub: { fontSize: 14, color: '#475569', marginTop: 8, lineHeight: 20 },
  otpPhone: { color: '#0F172A', fontWeight: '900' },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  resendMuted: { fontSize: 13, color: '#64748B' },
  resendStrong: { fontSize: 13, color: '#0F172A', fontWeight: '800' },
  verifyBtn: {
    marginTop: 22,
    height: 56,
    borderRadius: 16,
    backgroundColor: G_BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  verifyBtnDim: { opacity: 0.55 },
  verifyText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5 },
  // Blue help card: white text and number on brand blue.
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: G_BLUE,
    borderRadius: 16,
    padding: 14,
  },
  helpIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpText: { fontSize: 13, color: '#DCE6FF' },
  helpPhone: { fontSize: 15, color: '#FFFFFF', fontWeight: '900', marginTop: 2 },
  changeNumber: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 8 },
  changeNumberText: { fontSize: 14, color: G_BLUE, fontWeight: '800' },
});
