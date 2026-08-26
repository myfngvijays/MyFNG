import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

export default function WebsiteImagesHubScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <DashboardHeader title="Website Images" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={styles.title}>Manage Website Images</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('Brands')}>
          <Text style={styles.cardTitle}>Car Brand Images</Text>
          <Text style={styles.cardMeta}>Logos with photo upload — same as web</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('HomeCarousel')}>
          <Text style={styles.cardTitle}>Home Carousel Images</Text>
          <Text style={styles.cardMeta}>Hero banners with preview + replace photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  title: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.md },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
});
