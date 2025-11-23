// Test 1: Basic imports only
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

console.log('✅ Test 1: Basic imports working');

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Test 1: Basic ✅</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  text: { fontSize: 20, color: '#1F2937' },
});

