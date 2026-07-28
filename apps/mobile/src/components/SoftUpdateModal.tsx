import React from 'react';
import { Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

type SoftUpdateModalProps = {
  visible: boolean;
  message: string;
  storeUrl: string;
  latestVersion?: string;
  onLater: () => void;
};

export default function SoftUpdateModal({
  visible,
  message,
  storeUrl,
  latestVersion,
  onLater,
}: SoftUpdateModalProps) {
  const handleUpdate = () => {
    if (!storeUrl) return;
    void Linking.openURL(storeUrl).catch(() => null);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles-outline" size={34} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.title}>Update Available</Text>
          {latestVersion ? (
            <Text style={styles.versionText}>Latest version: {latestVersion}</Text>
          ) : null}
          <Text style={styles.message}>
            {message ||
              'A new version of MyFNG is available. Update now for the latest features and fixes.'}
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleUpdate} activeOpacity={0.88}>
            <Ionicons name="arrow-up-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Update Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.laterBtn} onPress={onLater} activeOpacity={0.85}>
            <Text style={styles.laterBtnText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
  },
  logoWrap: {
    marginBottom: 12,
  },
  logo: {
    width: 92,
    height: 30,
  },
  iconWrap: {
    marginBottom: 14,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  laterBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  laterBtnText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '700',
  },
});
