import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import SuperAdminDashboard from '../screens/dashboard/SuperAdminDashboard';
import WorkshopAdminDashboard from '../screens/dashboard/WorkshopAdminDashboard';
import WorkshopSupervisorDashboard from '../screens/dashboard/WorkshopSupervisorDashboard';
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
    case 'WORKSHOP_SUPERVISOR':
      return WorkshopSupervisorDashboard;
    case 'CUSTOMER':
      return CustomerDashboard;
    case 'LEAD_MANAGER':
      return LeadManagerDashboard;
    case 'RSA_MANAGER':
      return RSAManagerDashboard;
    case 'HOME_SERVICE_MANAGER':
      return require('../screens/dashboard/home_service_manager/HSMDashboardScreen').default;
    case 'COMPANY_MECHANIC_RSA':
      return require('../screens/dashboard/company_mechanic_rsa/CMRSADashboardScreen').default;
    case 'COMPANY_VAN_TECHNICIAN':
      return require('../screens/dashboard/company_van_technician/CVTDashboardScreen').default;
    case 'COMPANY_VAN_DRIVER':
      return require('../screens/dashboard/company_van_driver/CVDDashboardScreen').default;
    case 'TELECALLER':
      return require('../screens/dashboard/TelecallerDashboard').default;
    case 'CUSTOMER_SERVICE_EXECUTIVE':
    case 'CSE':
      return require('../screens/dashboard/cse/CSEDashboardScreen').default;
    case 'AUDITOR':
      return require('../screens/dashboard/auditor/AuditorDashboardScreen').default;
    case 'SUB_ADMIN':
      return require('../screens/dashboard/subadmin/SubAdminDashboardScreen').default;
    case 'ACCOUNTS_TEAM':
    case 'BILLING':
      return require('../screens/dashboard/billing/BillingDashboardScreen').default;
    case 'FINANCE':
      return require('../screens/dashboard/finance/FinanceDashboardScreen').default;
    case 'DIGITAL_MARKETING':
      return DigitalMarketingDashboard;
    case 'DIGITAL_AUTHOR':
      return require('../screens/dashboard/digital_author/DigitalAuthorDashboardScreen').default;
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

