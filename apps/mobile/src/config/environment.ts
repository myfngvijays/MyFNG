// Environment configuration for MyFNG Mobile App

export const ENV = {
  SUPABASE_URL: 'https://cffommijlvicfjhbqyzk.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmZm9tbWlqbHZpY2ZqaGJxeXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDkxNjYsImV4cCI6MjA3ODc4NTE2Nn0.2RqHX4BynIrH_R3HVZ9JYph03sdzkL6bYN644Yl4l1U',
  // Override via EXPO_PUBLIC_API_URL (use your LAN IP on a physical device, e.g. http://192.168.1.5:3000).
  APP_URL: process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3000' : 'https://myfng.in'),
  API_URL: process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:3000' : 'https://myfng.in'),
};

