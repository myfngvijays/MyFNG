import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import PublicBookServiceNowScreen from './src/screens/PublicBookServiceNowScreen';
import PublicHomeScreen from './src/screens/PublicHomeScreen';
import AIBookingScreen from './src/screens/AIBookingScreen';
import PublicServicePackagesScreen from './src/screens/PublicServicePackagesScreen';
import PublicWorkshopLocatorScreen from './src/screens/PublicWorkshopLocatorScreen';
import CustomerRegistrationScreen from './src/screens/dashboard/customer/CustomerRegistrationScreen';
import CustomerOtpLoginScreen from './src/screens/CustomerOtpLoginScreen';
import DashboardNavigator from './src/navigation/DashboardNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { supabase } from './src/lib/supabase';
import { ENV } from './src/config/environment';
import { clearCustomerSessionToken, getCustomerSessionToken } from './src/lib/customerSession';

const Stack = createNativeStackNavigator();

function AppContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
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
          console.log('No authenticated user');
        }
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setIsLoading(false);
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
      
      console.log('✅ User profile fetched:', data);
      console.log('✅ Role code:', data?.role?.role_code);
      
      setUserProfile(data);
      setUser({ id: userId });
    } catch (error) {
      console.error('Error fetching profile:', error);
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
      return true;
    } catch (_e) {
      return false;
    }
  };

  const handleLoginSuccess = (user: any, profile: any) => {
    setUser(user);
    setUserProfile(profile);
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
      console.error('Error logging out:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0088E8" />
        <Text style={styles.loadingText}>Loading MyFNG...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer onStateChange={() => { void checkUser(); }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user || !userProfile ? (
          <>
            {/* Public Home (marketing + navigation hub) */}
            <Stack.Screen name="PublicHome" component={PublicHomeScreen} />
            {/* Website-style Book Service Now wizard (opened via CTA button) */}
            <Stack.Screen name="PublicBookServiceNow" component={PublicBookServiceNowScreen} />
            <Stack.Screen name="AIBooking" component={AIBookingScreen} />
            <Stack.Screen name="PublicServicePackages" component={PublicServicePackagesScreen} />
            <Stack.Screen name="PublicWorkshopLocator" component={PublicWorkshopLocatorScreen} />
          <Stack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
            </Stack.Screen>
            <Stack.Screen name="CustomerSignup" component={CustomerRegistrationScreen} />
            <Stack.Screen name="CustomerOtpLogin" component={CustomerOtpLoginScreen} />
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
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#6B7280',
  },
});
