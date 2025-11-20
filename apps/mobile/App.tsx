import React, { useState, useEffect } from 'react';
import { View, Text, StatusBar, StyleSheet } from 'react-native';
// Temporarily comment out imports to find the issue
// import LoginScreen from './src/screens/LoginScreen';
// import SuperAdminDashboard from './src/screens/dashboard/SuperAdminDashboard';
// import WorkshopAdminDashboard from './src/screens/dashboard/WorkshopAdminDashboard';
// import WorkshopMechanicDashboard from './src/screens/dashboard/WorkshopMechanicDashboard';
// import CustomerDashboard from './src/screens/dashboard/CustomerDashboard';
// import TelecallerDashboard from './src/screens/dashboard/TelecallerDashboard';
// import LeadManagerDashboard from './src/screens/dashboard/LeadManagerDashboard';
// import DefaultDashboard from './src/screens/dashboard/DefaultDashboard';
// import { supabase } from './src/lib/supabase';
// import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  return (
    <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0088E8" />
      <View style={styles.content}>
        <Text style={styles.title}>🚀 MyFNG App</Text>
        <Text style={styles.subtitle}>Testing Basic Setup</Text>
        <Text style={styles.message}>
          If you see this, the app is loading successfully! ✅
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0088E8',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});
