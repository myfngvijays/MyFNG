import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import SuperAdminDashboard from './src/screens/dashboard/SuperAdminDashboard';
import WorkshopAdminDashboard from './src/screens/dashboard/WorkshopAdminDashboard';
import WorkshopMechanicDashboard from './src/screens/dashboard/WorkshopMechanicDashboard';
import CustomerDashboard from './src/screens/dashboard/CustomerDashboard';
import TelecallerDashboard from './src/screens/dashboard/TelecallerDashboard';
import LeadManagerDashboard from './src/screens/dashboard/LeadManagerDashboard';
import DefaultDashboard from './src/screens/dashboard/DefaultDashboard';
import { supabase } from './src/lib/supabase';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        
        // Fetch user profile WITH role information
        supabase
          .from('users_login')
          .select(`
            *,
            role:roles!role_id(role_name, role_code)
          `)
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (data) {
              // Add role field based on role_code
              const profileWithRole = {
                ...data,
                role: data.role?.role_code || data.role?.role_name || 'USER'
              };
              setUserProfile(profileWithRole);
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        
        // Fetch user profile WITH role information
        supabase
          .from('users_login')
          .select(`
            *,
            role:roles!role_id(role_name, role_code)
          `)
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (data) {
              const profileWithRole = {
                ...data,
                role: data.role?.role_code || data.role?.role_name || 'USER'
              };
              setUserProfile(profileWithRole);
            }
          });
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getDashboard = () => {
    if (!userProfile) {
      return <DefaultDashboard userProfile={userProfile} onLogout={handleLogout} />;
    }
    
    const role = userProfile.role;
    
    switch (role) {
      case 'SUPER_ADMIN':
        return <SuperAdminDashboard />;
      case 'WORKSHOP_ADMIN':
        return <WorkshopAdminDashboard />;
      case 'WORKSHOP_MECHANIC':
        return <WorkshopMechanicDashboard />;
      case 'TELECALLER':
        return <TelecallerDashboard />;
      case 'LEAD_MANAGER':
        return <LeadManagerDashboard />;
      case 'CUSTOMER':
        return <CustomerDashboard />;
      default:
        return <DefaultDashboard userProfile={userProfile} onLogout={handleLogout} />;
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  const handleLoginSuccess = (userData, profileData) => {
    setUser(userData);
    setUserProfile(profileData);
  };

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
  }

  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        {!user ? (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        ) : (
          getDashboard()
        )}
      </View>
    </AuthProvider>
  );
}
