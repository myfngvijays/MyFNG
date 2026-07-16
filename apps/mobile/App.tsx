import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, Linking, Platform, Text as RNText, TextInput as RNTextInput } from 'react-native';

const TextInputWithDefaults = RNTextInput as typeof RNTextInput & {
  defaultProps?: Partial<React.ComponentProps<typeof RNTextInput>>;
};
TextInputWithDefaults.defaultProps = {
  ...TextInputWithDefaults.defaultProps,
  autoCorrect: false,
  spellCheck: false,
};

if (Platform.OS === 'ios') {
  try {
    const oldRender = (RNText as any).render;
    if (typeof oldRender === 'function') {
      const bumpFontSize = (style: any): any => {
        if (!style) return style;
        if (Array.isArray(style)) return style.map(bumpFontSize);
        if (typeof style === 'object' && typeof style.fontSize === 'number') {
          return { ...style, fontSize: style.fontSize + 2 };
        }
        return style;
      };
      (RNText as any).render = function (...args: any[]) {
        const origin = oldRender.apply(this, args);
        if (!origin || !React.isValidElement(origin)) return origin;
        return React.cloneElement(origin, {
          style: bumpFontSize((origin as any).props?.style),
        } as any);
      };
    }
  } catch (_e) {
    // If the Text internals change across RN versions, skip the font bump rather than crash.
  }
}
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import PublicBookServiceNowScreen from './src/screens/PublicBookServiceNowScreen';
import PublicHomeScreen from './src/screens/PublicHomeScreen';
import AIBookingScreen from './src/screens/AIBookingScreen';
import PublicServicePackagesScreen from './src/screens/PublicServicePackagesScreen';
import PublicWorkshopLocatorScreen from './src/screens/PublicWorkshopLocatorScreen';
import RoadsideAssistanceScreen from './src/screens/RoadsideAssistanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SmartToolWebScreen from './src/screens/smartTools/SmartToolWebScreen';
import CarHealthCheckScreen from './src/screens/smartTools/CarHealthCheckScreen';
import FuelCostCalculatorScreen from './src/screens/smartTools/FuelCostCalculatorScreen';
import AuthorisedPricingScreen from './src/screens/smartTools/AuthorisedPricingScreen';
import ResaleValueScreen from './src/screens/smartTools/ResaleValueScreen';
import CarQuizGameScreen from './src/screens/smartTools/CarQuizGameScreen';
import CarPartsPriceScreen from './src/screens/smartTools/CarPartsPriceScreen';
import CustomerRegistrationScreen from './src/screens/dashboard/customer/CustomerRegistrationScreen';
import CustomerOtpLoginScreen from './src/screens/CustomerOtpLoginScreen';
import SplashScreen from './src/screens/SplashScreen';
import DashboardNavigator from './src/navigation/DashboardNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { AppFooterProvider } from './src/context/AppFooterContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { supabase } from './src/lib/supabase';
import { ENV } from './src/config/environment';
import { getCustomerSessionToken } from './src/lib/customerSession';
import { storeReferralCode, checkPlayStoreReferrer } from './src/lib/referralDeepLink';
import { performCustomerLogout } from './src/lib/customerLogout';
import { preloadWalletRules } from './src/lib/wallet';
import { preloadMembershipTerms } from './src/lib/membershipTerms';
import { preloadPublicFaqs } from './src/lib/publicFaqs';
import {
  registerCustomerFcmPushToken,
  setupFcmNotificationHandlers,
  subscribeToFcmTokenRefresh,
} from './src/services/pushNotifications';
import { checkForceUpdate, type ForceUpdateResult } from './src/lib/forceUpdate';
import { notifyAppSessionIncompleteOnServer } from './src/lib/whatsappAutomationClient';
import { initializeClarity } from './src/lib/clarity';
import { initializeFirebaseAnalytics } from './src/lib/firebaseAnalytics';
import { trackScreen, trackEvent, setUserId } from './src/lib/trackEvent';
import ForceUpdateModal from './src/components/ForceUpdateModal';

const Stack = createNativeStackNavigator();

function AppContent() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [updateCheckDone, setUpdateCheckDone] = useState(__DEV__);
  const [forceUpdate, setForceUpdate] = useState<ForceUpdateResult | null>(null);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loginScreenKey, setLoginScreenKey] = useState(0);
  const isCustomerSessionUser =
    user?.type === 'customer_session' && userProfile?.role?.role_code === 'CUSTOMER';
  const isLoggedInConsumer =
    Boolean(user && userProfile) &&
    (isCustomerSessionUser || userProfile?.role?.role_code === 'CUSTOMER');
  const appSessionStartedAtRef = useRef<number | null>(null);

  const syncCustomerPushToken = async (source = 'app') => {
    try {
      const sessionToken = await getCustomerSessionToken();
      if (!sessionToken) {
        if (__DEV__) console.warn('[push] skip sync — no session', source);
        return;
      }

      const result = await registerCustomerFcmPushToken(ENV.API_URL, sessionToken);
      if (!result.ok) {
        console.warn('[push] customer token sync failed:', source, result);
      } else {
        console.warn('[push] customer token registered:', source, result.token.slice(0, 12));
      }
    } catch (error) {
      console.warn('[push] customer token sync error:', source, error);
    }
  };

  useEffect(() => {
    initializeClarity();
    void initializeFirebaseAnalytics();
  }, []);

  useEffect(() => {
    const unsubscribeHandlers = setupFcmNotificationHandlers();
    const unsubscribeTokenRefresh = subscribeToFcmTokenRefresh(() => {
      void syncCustomerPushToken();
    });
    return () => {
      unsubscribeHandlers();
      unsubscribeTokenRefresh();
    };
  }, []);

  useEffect(() => {
    if (!isCustomerSessionUser) return;
    void syncCustomerPushToken();
  }, [isCustomerSessionUser, user?.id]);

  // Deep link handling — capture referral code from myfng.in/refer/CODE
  useEffect(() => {
    // Check Play Store install referrer (Android)
    void checkPlayStoreReferrer();

    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      // Match /refer/CODE or ?code=CODE
      const pathMatch = url.match(/\/refer\/([A-Za-z0-9]+)/);
      const queryMatch = url.match(/[?&]code=([^&]+)/);
      const code = pathMatch?.[1] || queryMatch?.[1];
      if (code) {
        void storeReferralCode(code);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => { subscription.remove(); };
  }, []);

  const runForceUpdateCheck = useCallback(async () => {
    if (__DEV__) {
      setForceUpdate(null);
      setUpdateCheckDone(true);
      return;
    }

    const result = await checkForceUpdate();
    setForceUpdate(result.required ? result : null);
    setUpdateCheckDone(true);
  }, []);

  useEffect(() => {
    void runForceUpdateCheck();
  }, [runForceUpdateCheck]);

  useEffect(() => {
    if (__DEV__) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        trackEvent('app_foregrounded');
        void runForceUpdateCheck();
        if (isCustomerSessionUser) {
          void syncCustomerPushToken();
        }
        if (isLoggedInConsumer && authReady && !showSplash) {
          appSessionStartedAtRef.current = Date.now();
        }
        return;
      }

      if (nextState === 'background' || nextState === 'inactive') {
        const startedAt = appSessionStartedAtRef.current;
        appSessionStartedAtRef.current = null;
        if (!startedAt || !isLoggedInConsumer) return;
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        if (durationSec <= 10) {
          void notifyAppSessionIncompleteOnServer(durationSec);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [runForceUpdateCheck, isCustomerSessionUser, isLoggedInConsumer, authReady, showSplash]);

  useEffect(() => {
    void preloadWalletRules(ENV.API_URL);
    void preloadMembershipTerms(ENV.API_URL);
    void preloadPublicFaqs();
    checkUser();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          const hasCustomerSession = await fetchCustomerSessionProfile();
          if (!hasCustomerSession) {
            setUser(null);
            setUserProfile(null);
          }
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await fetchUserProfile(session.user.id);
      } else {
        const hasCustomerSession = await fetchCustomerSessionProfile();
        if (!hasCustomerSession) {
          if (__DEV__) console.log('No authenticated user');
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Error checking user:', error);
    } finally {
      setAuthReady(true);
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      // ✅ FIX: Fetch profile with correct role join (like web)
      const { data, error } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles!role_id(role_code, role_name)
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      if (__DEV__) {
        console.log('User profile fetched:', data?.id);
        console.log('Role code:', data?.role?.role_code);
      }
      
      setUserProfile(data);
      setUser({ id: userId });
    } catch (error) {
      if (__DEV__) console.error('Error fetching profile:', error);
    }
  };

  const fetchCustomerSessionProfile = async (): Promise<boolean> => {
    try {
      const customerToken = await getCustomerSessionToken();
      if (!customerToken) return false;
      const res = await fetch(`${ENV.API_URL}/api/customer/auth/me`, {
        headers: {
          'x-customer-session': customerToken,
        },
      });
      if (!res.ok) return false;
      const json = await res.json().catch(() => ({}));
      const customer = json?.customer;
      if (!customer?.id) return false;
      setUser({ id: customer.id, type: 'customer_session' });
      setUserProfile({
        id: customer.id,
        full_name: customer.full_name || 'Customer',
        email: customer.email || null,
        phone: customer.phone || null,
        role: {
          role_code: 'CUSTOMER',
          role_name: 'Customer',
        },
      });
      void syncCustomerPushToken();
      return true;
    } catch (_e) {
      return false;
    }
  };

  const handleLoginSuccess = (user: any, profile: any) => {
    trackEvent('login_success', { role: profile?.role?.role_code || 'unknown' });
    setUserId(user?.id || null);
    setUser(user);
    setUserProfile(profile);
    if (user?.type === 'customer_session' || profile?.role?.role_code === 'CUSTOMER') {
      void syncCustomerPushToken();
    }
  };

  const handleLogout = async () => {
    trackEvent('logout_tapped');
    setUserId(null);
    try {
      await performCustomerLogout(ENV.API_URL);
      setUser(null);
      setUserProfile(null);
      setLoginScreenKey((key) => key + 1);
    } catch (error) {
      if (__DEV__) console.error('Error logging out:', error);
    }
  };

  if (showSplash || !authReady || !updateCheckDone) {
    return <SplashScreen durationMs={5000} onComplete={() => setShowSplash(false)} />;
  }

  if (forceUpdate?.required) {
    trackEvent('force_update_shown', { min_version: forceUpdate.minVersion || '' });
    return (
      <ForceUpdateModal
        visible
        message={forceUpdate.message || ''}
        storeUrl={forceUpdate.storeUrl || ''}
        latestVersion={forceUpdate.minVersion}
      />
    );
  }

  const isLoggedIn = Boolean(user && userProfile);
  const roleCode = userProfile?.role?.role_code;
  const isConsumerCustomer = isCustomerSessionUser || roleCode === 'CUSTOMER';
  const initialRoute = isLoggedIn
    ? isConsumerCustomer
      ? 'PublicHome'
      : 'Dashboard'
    : 'Login';

  const onNavigationStateChange = () => {
    const route = navigationRef.current?.getCurrentRoute();
    if (route?.name) {
      trackScreen(route.name);
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onStateChange={onNavigationStateChange}>
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        {!user || !userProfile || isCustomerSessionUser ? (
          <>
            {/* Public Home (marketing + navigation hub) */}
            <Stack.Screen name="PublicHome" component={PublicHomeScreen} />
            {/* Website-style Book Service Now wizard (opened via CTA button) */}
            <Stack.Screen name="PublicBookServiceNow" component={PublicBookServiceNowScreen} />
            <Stack.Screen
              name="AIBooking"
              component={AIBookingScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                headerShown: false,
                contentStyle: { backgroundColor: '#F9FAFB' },
              }}
            />
            <Stack.Screen name="PublicServicePackages" component={PublicServicePackagesScreen} />
            <Stack.Screen name="PublicWorkshopLocator" component={PublicWorkshopLocatorScreen} />
            <Stack.Screen name="RoadsideAssistance" component={RoadsideAssistanceScreen} />
            <Stack.Screen name="SmartToolWeb" component={SmartToolWebScreen} />
            <Stack.Screen name="CarHealthCheck" component={CarHealthCheckScreen} />
            <Stack.Screen name="FuelCostCalculator" component={FuelCostCalculatorScreen} />
            <Stack.Screen name="AuthorisedPricing" component={AuthorisedPricingScreen} />
            <Stack.Screen name="ResaleValue" component={ResaleValueScreen} />
            <Stack.Screen name="CarQuizGame" component={CarQuizGameScreen} />
            <Stack.Screen name="CarPartsPrice" component={CarPartsPriceScreen} />
            <Stack.Screen name="Settings">
              {(props) => <SettingsScreen {...props} onCustomerLogout={handleLogout} />}
            </Stack.Screen>
          <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen
                  key={`login-${loginScreenKey}`}
                  {...props}
                  onLoginSuccess={handleLoginSuccess}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="CustomerSignup" component={CustomerRegistrationScreen} />
            <Stack.Screen name="CustomerOtpLogin" component={CustomerOtpLoginScreen} />
            {isCustomerSessionUser ? (
              <Stack.Screen name="Dashboard">
                {(props) => (
                  <DashboardNavigator
                    {...props}
                    userProfile={userProfile}
                    onLogout={handleLogout}
                  />
                )}
              </Stack.Screen>
            ) : null}
          </>
        ) : (
          <>
            <Stack.Screen name="Dashboard">
              {(props) => (
                <DashboardNavigator
                  {...props}
                  userProfile={userProfile}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AIBooking"
              component={AIBookingScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                headerShown: false,
                contentStyle: { backgroundColor: '#F9FAFB' },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <AppFooterProvider>
            <AppContent />
          </AppFooterProvider>
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
