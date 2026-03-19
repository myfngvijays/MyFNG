import React, { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

type PublicHeaderProps = {
  city?: string;
  isLoggedIn?: boolean;
  userName?: string | null;
  onPressSearch?: () => void;
  onPressSettings?: () => void;
  onPressViewNotifications?: () => void;
};

export default function PublicHeader({
  city = 'Mumbai, Maharashtra',
  onPressSearch,
  onPressSettings,
  onPressViewNotifications,
}: PublicHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: '1', title: 'Service Reminder', message: 'Your service is due in 3 days.', time: '2h ago', unread: true },
    { id: '2', title: 'Offer Applied', message: 'Wallet offer has been applied successfully.', time: '5h ago', unread: true },
    { id: '3', title: 'Booking Confirmed', message: 'Workshop accepted your request.', time: '1d ago', unread: false },
  ];

  return (
    <>
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
          <TouchableOpacity
            style={[styles.actionButton, showNotifications && styles.actionButtonActive]}
            onPress={() => setShowNotifications((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Ionicons name="notifications" size={20} color={showNotifications ? '#FFFFFF' : '#525252'} />
            <View style={styles.dot} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={onPressSettings} activeOpacity={0.85}>
            <Ionicons name="settings" size={20} color="#525252" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showNotifications} transparent animationType="fade" onRequestClose={() => setShowNotifications(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowNotifications(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => undefined}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              <Text style={styles.sheetBadge}>2 New</Text>
            </View>
            <View style={styles.listWrap}>
              {notifications.map((item) => (
                <View key={item.id} style={[styles.itemRow, item.unread ? styles.itemRowUnread : null]}>
                  <View style={styles.itemTextWrap}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemBody}>{item.message}</Text>
                  </View>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => {
                setShowNotifications(false);
                onPressViewNotifications?.();
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.viewAllText}>View All Notifications</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
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
  actionButtonActive: {
    backgroundColor: COLORS.primary,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'flex-end',
    paddingTop: 96,
    paddingRight: 10,
  },
  sheet: {
    width: 300,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  sheetHeader: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sheetBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: '#EAF1FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    textTransform: 'uppercase',
  },
  listWrap: {
    maxHeight: 280,
  },
  itemRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemRowUnread: {
    backgroundColor: '#F5F9FF',
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  itemBody: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
  },
  itemTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  viewAllButton: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
