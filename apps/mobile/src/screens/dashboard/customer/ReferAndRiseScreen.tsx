import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import ReferAndRiseInline from '../../../components/ReferAndRiseInline';

export default function ReferAndRiseScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <DashboardHeader title="Refer & Rise" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ReferAndRiseInline referralCode="" isLoggedIn={true} onLogin={() => navigation.navigate('Login')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F7FF' },
  content: { padding: 0 },
});
