import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, FileText, User, Settings } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

// Screens
import HomeScreen from '../screens/dashboard/HomeScreen';
import LeadsScreen from '../screens/dashboard/LeadsScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import SettingsScreen from '../screens/dashboard/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function DashboardNavigator() {
  const { userProfile } = useAuthStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textGray,
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: userProfile?.role?.role_name || 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      
      <Tab.Screen
        name="Leads"
        component={LeadsScreen}
        options={{
          tabBarLabel: 'Leads',
          tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
        }}
      />
      
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
      
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

