import React from 'react';
import { Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const PRIVACY_URL = 'https://myfng.in/privacy-policy';

type Props = {
  visible: boolean;
  onAgree: () => void;
  onDecline: () => void;
};

/**
 * Google Play User Data policy — Prominent Disclosure before BACKGROUND_LOCATION.
 * Must appear in-app, before the system permission dialog, and allow decline.
 */
export default function BackgroundLocationDisclosureModal({ visible, onAgree, onDecline }: Props) {
  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onDecline}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.iconWrap}>
            <Ionicons name="location" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Allow location in the background?</Text>
          <Text style={styles.lead}>
            This app collects location data to enable nearby workshop alerts even when the app is closed or not in use.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>How we use it</Text>
            <Text style={styles.bullet}>
              • Precise location is used only for nearby workshop alerts — to notify you when you are near a MyFNG service center so we can help with walk-in visits.
            </Text>
            <Text style={styles.bullet}>
              • This is optional. You can decline and still book services, find workshops, and use the rest of the app.
            </Text>
            <Text style={styles.bullet}>
              • You can turn it off anytime in Settings → Notifications → Nearby Workshop Alerts.
            </Text>
            <Text style={styles.bullet}>
              • We do not sell your location. See our Privacy Policy for details.
            </Text>
          </View>

          <Text style={styles.note}>
            If you tap I agree, Android will next ask you to allow location “All the time”. Choose that only if you want background alerts.
          </Text>

          <TouchableOpacity onPress={() => void Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.link}>Read Privacy Policy</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primary} onPress={onAgree} activeOpacity={0.88}>
            <Text style={styles.primaryText}>I agree</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={onDecline} activeOpacity={0.88}>
            <Text style={styles.secondaryText}>No thanks</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F7FF' },
  scroll: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 16 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 10,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.heading,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.text,
    marginBottom: 8,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  actions: {
    paddingHorizontal: 22,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
    backgroundColor: '#F0F7FF',
  },
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondary: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '700' },
});
