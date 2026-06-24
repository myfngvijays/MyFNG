// Environment configuration for MyFNG Mobile App
import { Platform } from 'react-native';

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  // In dev, simulators should talk to local Next.js (has latest wallet/auth APIs).
  // Physical devices still need EXPO_PUBLIC_API_URL set to your machine IP or prod.
  if (__DEV__) {
    if (Platform.OS === 'android') return 'http://10.0.2.2:3000';
    return 'http://localhost:3000';
  }

  return 'https://myfng.in';
}

const API_URL = resolveApiUrl();

export const ENV = {
  SUPABASE_URL: 'https://cffommijlvicfjhbqyzk.supabase.co',
  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U',
  APP_URL: API_URL,
  API_URL,
};

if (__DEV__) {
  console.log('[MyFNG] API_URL =', ENV.API_URL);
}
