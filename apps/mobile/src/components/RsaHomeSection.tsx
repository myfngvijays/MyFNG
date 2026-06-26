import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import SectionHeading from './SectionHeading';
import { RSA_PHONE, RSA_SERVICES, type RsaServiceDef } from '../constants/rsaServices';
import { openPhoneCall } from '../lib/phone';

type Props = {
  city?: string;
  navigation: any;
  /** Show all services or a compact subset on home */
  compact?: boolean;
};

export function RsaServiceIcon({ svc, size = 20 }: { svc: RsaServiceDef; size?: number }) {
  const iconColor = '#FFFFFF';

  return (
    <View style={[styles.serviceIcon, { backgroundColor: svc.bg }]}>
      {svc.iconKind === 'ion' ? (
        <Ionicons name={svc.iconName as keyof typeof Ionicons.glyphMap} size={size} color={iconColor} />
      ) : svc.iconKind === 'mci' ? (
        <MaterialCommunityIcons name={svc.iconName as any} size={size} color={iconColor} />
      ) : (
        <MaterialIcons name={svc.iconName as any} size={size} color={iconColor} />
      )}
    </View>
  );
}

export default function RsaHomeSection({ city, navigation, compact = false }: Props) {
  const services = compact ? RSA_SERVICES.slice(0, 4) : RSA_SERVICES;

  const onServicePress = (svc: RsaServiceDef) => {
    if (svc.action === 'book_periodic') {
      navigation.navigate('PublicBookServiceNow', {
        city,
        serviceCategory: 'PERIODIC',
      });
      return;
    }
    navigation.navigate('RoadsideAssistance', { city });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.emergencyStrip}>
        <View style={styles.emergencyLeft}>
          <View style={styles.emergencyPulse}>
            <View style={styles.emergencyDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>24/7 Emergency Help</Text>
            <Text style={styles.emergencySub}>Avg. response in 30–45 mins • Pan-India coverage</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.emergencyCallBtn}
          activeOpacity={0.85}
          onPress={() => openPhoneCall(RSA_PHONE)}
        >
          <Ionicons name="call" size={16} color="#FFFFFF" />
          <Text style={styles.emergencyCallText}>Call Now</Text>
        </TouchableOpacity>
      </View>

      <SectionHeading
        title="Our RSA Services"
        subtitle="Tap any service to get instant help."
        style={styles.servicesHeading}
      />

      <View style={styles.serviceGrid}>
        {services.map((svc) => (
          <TouchableOpacity
            key={svc.name}
            style={styles.serviceItem}
            activeOpacity={0.8}
            onPress={() => onServicePress(svc)}
          >
            <RsaServiceIcon svc={svc} />
            <Text style={styles.serviceName} numberOfLines={2}>
              {svc.name}
            </Text>
            <Text style={styles.serviceDesc} numberOfLines={2}>
              {svc.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {compact ? (
        <TouchableOpacity
          style={styles.viewAllBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('RoadsideAssistance', { city })}
        >
          <Text style={styles.viewAllBtnText}>View All RSA Services</Text>
          <Ionicons name="arrow-forward" size={14} color="#2563EB" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  emergencyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    shadowColor: '#DC2626',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 8,
  },
  emergencyLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emergencyPulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  emergencyTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  emergencySub: { marginTop: 2, fontSize: 10, color: '#6B7280', lineHeight: 14 },
  emergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emergencyCallText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  servicesHeading: { marginTop: 8 },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  serviceItem: {
    width: '48%' as any,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 9,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 13,
  },
  viewAllBtn: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  viewAllBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
});
