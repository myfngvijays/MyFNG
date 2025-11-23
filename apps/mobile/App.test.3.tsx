// Test 3: With Supabase
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from './src/lib/supabase';

console.log('✅ Test 3: Supabase import working');
console.log('Supabase client:', supabase ? 'Loaded' : 'Failed');

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Test 3: Supabase ✅</Text>
      <Text style={styles.small}>Check console for supabase status</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  text: { fontSize: 20, color: '#1F2937' },
  small: { fontSize: 12, color: '#6B7280', marginTop: 10 },
});

