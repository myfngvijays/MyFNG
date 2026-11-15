import React from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENV } from '../config/environment';
import type { RoleAccessKind } from '../config/appVariant';

type BlockedAccess = Exclude<RoleAccessKind, 'allowed'>;

type Props = {
  access: BlockedAccess;
  roleName?: string | null;
  onLogout: () => void;
};

const COPY: Record<BlockedAccess, { title: string; body: string }> = {
  partner_app: {
    title: 'My FNG Partner',
    body: 'This account uses the My FNG Partner app. Sign in there for telecaller, workshop, and field work.',
  },
  customer_app: {
    title: 'MyFNG',
    body: 'This account uses the MyFNG customer app. Bookings and service tracking stay in that app.',
  },
  website: {
    title: 'Open the website',
    body: 'This role signs in on the MyFNG website. The phone apps are for customers and field staff.',
  },
};

function customerStoreUrl(): string {
  return Platform.OS === 'ios' ? ENV.APPSTORE_URL : ENV.PLAYSTORE_URL;
}

export default function WrongAppScreen({ access, roleName, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const copy = COPY[access];
  const link =
    access === 'website'
      ? `${ENV.WEBSITE_URL.replace(/\/$/, '')}/dashboard`
      : access === 'customer_app'
        ? customerStoreUrl()
        : '';
  const linkLabel = access === 'website' ? 'Open dashboard' : 'Open MyFNG';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.card}>
        <Text style={styles.kicker}>MyFNG</Text>
        <Text style={styles.title}>{copy.title}</Text>
        {roleName ? <Text style={styles.role}>Signed in as {roleName}</Text> : null}
        <Text style={styles.body}>{copy.body}</Text>
        {link ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void Linking.openURL(link)}>
            <Text style={styles.primaryText}>{linkLabel}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
  kicker: {
    color: '#004AAD',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  title: {
    color: '#023D95',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  role: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 12,
  },
  body: {
    color: '#3A3F45',
    fontSize: 16,
    lineHeight: 24,
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: '#004AAD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  logoutBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#004AAD',
    fontSize: 16,
    fontWeight: '600',
  },
});
