import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

type PublicHeaderProps = {
  city?: string;
  isLoggedIn?: boolean;
  userName?: string | null;
  onPressSearch?: () => void;
  onPressSettings?: () => void;
};

export default function PublicHeader({
  city = 'Mumbai, Maharashtra',
  onPressSearch,
  onPressSettings,
}: PublicHeaderProps) {

  return (
      <View style={styles.header}>
        <View style={styles.leftWrap}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
          <View>
            <View style={styles.cityRow}>
              <Ionicons name="location" size={11} color={COLORS.primary} />
              <Text style={styles.cityText}>{city}</Text>
            </View>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={onPressSearch} activeOpacity={0.85}>
            <Ionicons name="search" size={20} color="#525252" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onPressSettings} activeOpacity={0.85}>
            <Ionicons name="settings" size={20} color="#525252" />
          </TouchableOpacity>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    backgroundColor: 'rgba(255,255,255,0.80)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  logoWrap: {
    width: 92,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 92,
    height: 30,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
  },
  cityText: {
    fontSize: 10,
    color: '#737373',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
