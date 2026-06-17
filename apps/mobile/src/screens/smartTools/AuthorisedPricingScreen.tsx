import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SmartToolShell, { PrimaryButton, ToolCard } from '../../components/smartTools/SmartToolShell';
import VehiclePickerCard from '../../components/smartTools/VehiclePickerCard';
import { COMPARE_SERVICE_CATEGORIES, COMPARE_USPS } from '../../constants/smartTools';
import { COLORS } from '../../constants/theme';
import { OTHER_SERVICE_COMPARE, PERIODIC_PACKAGES, formatInrRange } from '../../lib/smartToolsLogic';
import { fetchCustomerVehicles, vehicleLabel, type CustomerVehicle } from '../../lib/smartToolsVehicle';

type Props = { navigation: any };

export default function AuthorisedPricingScreen({ navigation }: Props) {
  const [vehicles, setVehicles] = useState<CustomerVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<CustomerVehicle | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  useEffect(() => {
    fetchCustomerVehicles().then((list) => {
      setVehicles(list);
      const def = list.find((v) => v.is_default) || list[0];
      if (def) setSelectedVehicle(def);
    });
  }, []);

  const carName = selectedVehicle ? vehicleLabel(selectedVehicle) : manualMode ? 'Your selected car' : 'Select your car';

  if (!selectedService) {
    return (
      <SmartToolShell title="Compare Service Cost" subtitle="Authorised vs MyFNG pricing" navigation={navigation}>
        <VehiclePickerCard
          vehicles={vehicles}
          selectedId={selectedVehicle?.id || (selectedVehicle ? vehicleLabel(selectedVehicle) : null)}
          onSelect={(v) => {
            setSelectedVehicle(v);
            setManualMode(false);
          }}
          onAddOther={() => {
            setManualMode(true);
            setSelectedVehicle(null);
          }}
        />

        <ToolCard>
          <Text style={styles.sectionTitle}>Selected Car</Text>
          <View style={styles.carPill}>
            <Ionicons name="car-sport" size={18} color={COLORS.primary} />
            <Text style={styles.carPillText}>{manualMode ? 'Another car (manual compare)' : carName}</Text>
          </View>
        </ToolCard>

        <Text style={styles.pickTitle}>Choose a service category</Text>
        <View style={styles.serviceGrid}>
          {COMPARE_SERVICE_CATEGORIES.map((svc) => (
            <TouchableOpacity
              key={svc.id}
              style={styles.serviceTile}
              onPress={() => setSelectedService(svc.id)}
              activeOpacity={0.88}
            >
              <View style={[styles.serviceIcon, { backgroundColor: svc.bg }]}>
                <Ionicons name={svc.icon} size={24} color={svc.color} />
              </View>
              <Text style={styles.serviceName}>{svc.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </SmartToolShell>
    );
  }

  if (selectedService === 'periodic') {
    return (
      <SmartToolShell title="Periodic Service" subtitle={carName} navigation={navigation}>
        <TouchableOpacity style={styles.backLink} onPress={() => setSelectedService(null)}>
          <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
          <Text style={styles.backLinkText}>Change service</Text>
        </TouchableOpacity>

        {PERIODIC_PACKAGES.map((pkg) => {
          const savingsLow = pkg.authorisedLow - pkg.myfngHigh;
          const savingsHigh = pkg.authorisedHigh - pkg.myfngLow;
          return (
            <View key={pkg.id} style={styles.packageCard}>
              <View style={styles.packageTop}>
                <View>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageMeta}>{pkg.checkpoints} checkpoints</Text>
                </View>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{pkg.discountLabel}</Text>
                </View>
              </View>

              <View style={styles.compareRow}>
                <View style={styles.priceCol}>
                  <Text style={styles.priceLabel}>Authorised</Text>
                  <Text style={styles.priceOld}>{formatInrRange(pkg.authorisedLow, pkg.authorisedHigh)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#9CA3AF" />
                <View style={styles.priceCol}>
                  <Text style={styles.priceLabel}>MyFNG</Text>
                  <Text style={styles.priceNew}>{formatInrRange(pkg.myfngLow, pkg.myfngHigh)}</Text>
                </View>
              </View>

              <Text style={styles.saveLine}>Estimated savings: {formatInrRange(Math.max(0, savingsLow), Math.max(0, savingsHigh))}</Text>

              <View style={styles.pointsWrap}>
                {pkg.highlights.map((h) => (
                  <View key={h} style={styles.pointRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.pointText}>{h}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <View style={styles.uspsCard}>
          {COMPARE_USPS.map((u) => (
            <View key={u.text} style={styles.uspItem}>
              <Ionicons name={u.icon} size={16} color={COLORS.primary} />
              <Text style={styles.uspText}>{u.text}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton label="Book Periodic Service" icon="calendar" onPress={() => navigation.navigate('PublicBookServiceNow', { serviceCategory: 'PERIODIC' })} />
      </SmartToolShell>
    );
  }

  const svc = OTHER_SERVICE_COMPARE[selectedService];
  if (!svc) return null;

  return (
    <SmartToolShell title={svc.name} subtitle={carName} navigation={navigation}>
      <TouchableOpacity style={styles.backLink} onPress={() => setSelectedService(null)}>
        <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
        <Text style={styles.backLinkText}>Change service</Text>
      </TouchableOpacity>

      <View style={styles.packageCard}>
        <View style={styles.compareRow}>
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>Authorised</Text>
            <Text style={styles.priceOld}>{formatInrRange(svc.authorisedLow, svc.authorisedHigh)}</Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#9CA3AF" />
          <View style={styles.priceCol}>
            <Text style={styles.priceLabel}>MyFNG</Text>
            <Text style={styles.priceNew}>{formatInrRange(svc.myfngLow, svc.myfngHigh)}</Text>
          </View>
        </View>
        <View style={styles.pointsWrap}>
          {svc.points.map((h) => (
            <View key={h} style={styles.pointRow}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.pointText}>{h}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.uspsCard}>
        {COMPARE_USPS.map((u) => (
          <View key={u.text} style={styles.uspItem}>
            <Ionicons name={u.icon} size={16} color={COLORS.primary} />
            <Text style={styles.uspText}>{u.text}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="Book This Service" onPress={() => navigation.navigate('PublicServicePackages')} />
    </SmartToolShell>
  );
}

const tileW = (Dimensions.get('window').width - 32 - 12) / 2;

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '900', color: '#111827', marginBottom: 8 },
  carPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  carPillText: { fontSize: 13, fontWeight: '800', color: COLORS.primary, flex: 1 },
  pickTitle: { fontSize: 14, fontWeight: '900', color: '#111827', marginBottom: 12 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  serviceTile: {
    width: tileW,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  serviceIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  serviceName: { fontSize: 12, fontWeight: '800', color: '#374151', textAlign: 'center' },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backLinkText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  packageCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  packageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 8 },
  packageName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  packageMeta: { marginTop: 2, fontSize: 11, fontWeight: '700', color: '#6B7280' },
  discountBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  discountText: { fontSize: 10, fontWeight: '900', color: '#059669' },
  compareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  priceCol: { flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 },
  priceOld: { fontSize: 14, fontWeight: '800', color: '#9CA3AF', textDecorationLine: 'line-through' },
  priceNew: { fontSize: 16, fontWeight: '900', color: '#2563EB' },
  saveLine: { fontSize: 11, fontWeight: '700', color: '#059669', marginBottom: 10 },
  pointsWrap: { gap: 6 },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pointText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#4B5563' },
  uspsCard: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  uspItem: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#E5E7EB' },
  uspText: { fontSize: 10, fontWeight: '800', color: '#374151' },
});
