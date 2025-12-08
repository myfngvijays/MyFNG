import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SuperAdminDashboard from '../screens/dashboard/SuperAdminDashboard';
import WorkshopAdminDashboard from '../screens/dashboard/WorkshopAdminDashboard';
import WorkshopMechanicDashboard from '../screens/dashboard/WorkshopMechanicDashboard';
import WorkshopPickupBoyDashboard from '../screens/dashboard/WorkshopPickupBoyDashboard';
import CustomerDashboard from '../screens/dashboard/CustomerDashboard';
import LeadManagerDashboard from '../screens/dashboard/LeadManagerDashboard';
import RSAManagerDashboard from '../screens/dashboard/RSAManagerDashboard';
import DigitalMarketingDashboard from '../screens/dashboard/DigitalMarketingDashboard';
import DefaultDashboard from '../screens/dashboard/DefaultDashboard';
import { useAuth } from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const getDashboardForRole = (role: string | null) => {
  switch (role) {
    case 'SUPER_ADMIN':
      return SuperAdminDashboard;
    case 'WORKSHOP_ADMIN':
      return WorkshopAdminDashboard;
    case 'WORKSHOP_MECHANIC':
      return WorkshopMechanicDashboard;
    case 'WORKSHOP_PICKUP_BOY':
      return WorkshopPickupBoyDashboard;
    case 'CUSTOMER':
      return CustomerDashboard;
    case 'LEAD_MANAGER':
      return LeadManagerDashboard;
    case 'RSA_MANAGER':
      return RSAManagerDashboard;
    case 'WORKSHOP_SUPERVISOR':
      return WorkshopAdminDashboard; // Using Workshop Admin for now
    case 'DIGITAL_MARKETING':
      return DigitalMarketingDashboard;
    default:
      return DefaultDashboard;
  }
};

export default function AppNavigator() {
  const { user, role } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <Stack.Screen
            name="Dashboard"
            component={getDashboardForRole(role)}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

