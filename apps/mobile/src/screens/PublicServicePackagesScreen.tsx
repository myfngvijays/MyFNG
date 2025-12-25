import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../constants/theme';
import PublicPillNav, { type PublicPillNavTab } from '../components/PublicPillNav';

type Props = {
  navigation: any;
  route: any;
};

export default function PublicServicePackagesScreen({ navigation, route }: Props) {
  const city: string | undefined = route?.params?.city;
  const [supportOpen, setSupportOpen] = useState(false);

  const supportPhone = '+919167779696';
  const supportEmail = 'support@myfng.in';

  const packages = useMemo(
    () => [
      {
        title: 'Periodic Service',
        items: ['Basic service', 'Standard service', 'Premium service'],
        icon: 'calendar',
      },
      {
        title: 'AC Service',
        items: ['AC checkup', 'Gas refill', 'Cooling issue diagnosis'],
        icon: 'snow',
      },
      {
        title: 'Repairs',
        items: ['Brake service', 'Suspension', 'Engine diagnostics'],
        icon: 'build',
      },
      {
        title: 'Detailing',
        items: ['Interior cleaning', 'Exterior polish', 'Ceramic coating'],
        icon: 'sparkles',
      },
      {
        title: 'Roadside Assistance',
        items: ['Battery jumpstart', 'Towing', 'Tyre puncture support'],
        icon: 'car-sport',
      },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.primaryDark} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Service Packages</Text>
            <Text style={styles.subTitle}>{city ? `City: ${city}` : 'Browse packages'}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginBtn}>
            <Text style={styles.loginText}>Login</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Transparent pricing. Verified workshops.</Text>
            <Text style={styles.heroSub}>
              You can browse as guest. For booking, start with AI — it recommends the right package.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() =>
                navigation.navigate('AIBooking', { city, prefill: 'I want to view service packages and book.' })
              }
            >
              <Ionicons name="chatbubbles" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Chat & Book with AI</Text>
            </TouchableOpacity>
          </View>

          {packages.map((p) => (
            <View key={p.title} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name={p.icon as any} size={18} color="#fff" />
                </View>
                <Text style={styles.cardTitle}>{p.title}</Text>
              </View>

              {p.items.map((it) => (
                <View key={it} style={styles.row}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                  <Text style={styles.rowText}>{it}</Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.cardCta}
                onPress={() => navigation.navigate('AIBooking', { city, prefill: `I want ${p.title.toLowerCase()}.` })}
              >
                <Text style={styles.cardCtaText}>Get AI recommendation</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
            <Text style={styles.footerText}>
              MY FNG ensures quality-audited partner workshops and warranty-backed service.
            </Text>
          </View>
        </ScrollView>

        <PublicPillNav
          activeTab="search"
          onPressTab={(tab: PublicPillNavTab) => {
            if (tab === 'ai') navigation.navigate('AIBooking', { city });
            if (tab === 'search') navigation.navigate('PublicWorkshopLocator', { city });
            if (tab === 'profile') navigation.navigate('Login');
            if (tab === 'settings') setSupportOpen(true);
          }}
        />

        <Modal visible={supportOpen} transparent animationType="fade" onRequestClose={() => setSupportOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setSupportOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => undefined}>
              <Text style={styles.modalTitle}>Support</Text>
              <TouchableOpacity style={styles.modalRow} onPress={() => navigation.navigate('AIBooking', { city, prefill: 'I need help.' })}>
                <Text style={styles.modalRowText}>Chat with AI</Text>
                <Ionicons name="chatbubbles" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRow} onPress={() => Linking.openURL(`tel:${supportPhone}`)}>
                <Text style={styles.modalRowText}>Call Support</Text>
                <Ionicons name="call" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRow} onPress={() => Linking.openURL(`mailto:${supportEmail}`)}>
                <Text style={styles.modalRowText}>Email</Text>
                <Ionicons name="mail" size={18} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalLoginBtn}
                onPress={() => {
                  setSupportOpen(false);
                  navigation.navigate('Login');
                }}
              >
                <Text style={styles.modalLoginText}>Login</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.gray[50] },
  screen: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.gray[50],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  subTitle: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: COLORS.gray[600],
  },
  loginBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EEF6FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.16)',
  },
  loginText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  container: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 140,
  },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  heroSub: {
    marginTop: 8,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: SPACING.md,
    height: 52,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.md,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  rowText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[700],
  },
  cardCta: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.14)',
  },
  cardCtaText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  footerText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '900',
    color: COLORS.primaryDark,
    marginBottom: SPACING.md,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(17,24,39,0.06)',
  },
  modalRowText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    color: COLORS.black,
  },
  modalLoginBtn: {
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: 'rgba(0,136,232,0.18)',
    alignItems: 'center',
  },
  modalLoginText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
});


