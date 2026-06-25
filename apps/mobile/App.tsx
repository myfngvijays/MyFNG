import React, { useState, useEffect } from 'react';
import { Platform, Text as RNText, TextInput as RNTextInput } from 'react-native';

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
import { NavigationContainer } from '@react-navigation/native';
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
import { NotificationProvider } from './src/context/NotificationContext';
import { supabase } from './src/lib/supabase';
import { ENV } from './src/config/environment';
import { clearCustomerSessionToken, getCustomerSessionToken } from './src/lib/customerSession';
import { preloadWalletRules } from './src/lib/wallet';
import { registerCustomerExpoPushToken } from './src/services/pushNotifications';

const Stack = createNativeStackNavigator();

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const isCustomerSessionUser =
    user?.type === 'customer_session' && userProfile?.role?.role_code === 'CUSTOMER';

  const syncCustomerPushToken = async () => {
    try {
      const sessionToken = await getCustomerSessionToken();
      if (!sessionToken) return;
      await registerCustomerExpoPushToken(ENV.API_URL, sessionToken);
    } catch {
      // best-effort only
    }
  };

  useEffect(() => {
    if (!isCustomerSessionUser) return;
    void syncCustomerPushToken();
  }, [isCustomerSessionUser, user?.id]);

  useEffect(() => {
    void preloadWalletRules(ENV.API_URL);
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
    setUser(user);
    setUserProfile(profile);
    if (user?.type === 'customer_session' || profile?.role?.role_code === 'CUSTOMER') {
      void syncCustomerPushToken();
    }
  };

  const handleLogout = async () => {
    try {
      const customerToken = await getCustomerSessionToken();
      if (customerToken) {
        await fetch(`${ENV.API_URL}/api/customer/auth/logout`, {
          method: 'POST',
          headers: { 'x-customer-session': customerToken },
        }).catch(() => null);
      }
      await clearCustomerSessionToken();
      await supabase.auth.signOut();
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      if (__DEV__) console.error('Error logging out:', error);
    }
  };

  if (showSplash || !authReady) {
    return <SplashScreen durationMs={4000} onComplete={() => setShowSplash(false)} />;
  }

  const isLoggedIn = Boolean(user && userProfile);
  const roleCode = userProfile?.role?.role_code;
  const isConsumerCustomer = isCustomerSessionUser || roleCode === 'CUSTOMER';
  const initialRoute = isLoggedIn
    ? isConsumerCustomer
      ? 'PublicHome'
      : 'Dashboard'
    : 'Login';

  return (
    <NavigationContainer>
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
              options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }}
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
            <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
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
          <Stack.Screen name="Dashboard">
            {(props) => (
              <DashboardNavigator
                {...props}
                userProfile={userProfile}
                onLogout={handleLogout}
              />
            )}
          </Stack.Screen>
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
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
