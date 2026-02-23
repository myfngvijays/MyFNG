import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

export default function CustomerVehiclesScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vehicle_number: '',
    make: '',
    model: '',
    year: '',
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  async function fetchVehicles() {
    try {
      setLoading(true);
      const { vehicles: data } = await apiFetch<{ vehicles: any[] }>('/api/customer/vehicles');
      setVehicles(data || []);
    } catch (e) {
      console.error('Failed to load vehicles', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleAddVehicle() {
    const vehicleNumber = form.vehicle_number.trim().toUpperCase();
    if (!vehicleNumber) {
      Alert.alert('Required', 'Please enter vehicle number');
      return;
    }

    const yearNum = form.year.trim() ? Number(form.year.trim()) : undefined;
    if (yearNum && (!Number.isFinite(yearNum) || yearNum < 1980 || yearNum > 2100)) {
      Alert.alert('Invalid Year', 'Please enter a valid year');
      return;
    }

    try {
      setSaving(true);
      await apiFetch('/api/customer/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle_number: vehicleNumber,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          year: yearNum || null,
        }),
      });
      setForm({ vehicle_number: '', make: '', model: '', year: '' });
      setShowAddForm(false);
      await fetchVehicles();
      Alert.alert('Success', 'Vehicle added');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add vehicle');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Vehicles" onBack={() => navigation.goBack()} />
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading vehicles...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchVehicles} />}
        >
          <View style={styles.summaryCard}>
            <View>
              <Text style={styles.summaryLabel}>Registered Vehicles</Text>
              <Text style={styles.summaryValue}>{vehicles.length}</Text>
            </View>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="car-sport-outline" size={22} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.actionWrap}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setShowAddForm((prev) => !prev)}
              disabled={saving}
            >
              <Text style={styles.addBtnText}>{showAddForm ? 'Cancel' : '+ Add Vehicle'}</Text>
            </TouchableOpacity>
          </View>

          {showAddForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Add New Vehicle</Text>
              <TextInput
                style={styles.input}
                placeholder="Vehicle Number (e.g. MH12AB1234)"
                value={form.vehicle_number}
                onChangeText={(text) => setForm((s) => ({ ...s, vehicle_number: text }))}
                autoCapitalize="characters"
                editable={!saving}
              />
              <TextInput
                style={styles.input}
                placeholder="Make (optional)"
                value={form.make}
                onChangeText={(text) => setForm((s) => ({ ...s, make: text }))}
                editable={!saving}
              />
              <TextInput
                style={styles.input}
                placeholder="Model (optional)"
                value={form.model}
                onChangeText={(text) => setForm((s) => ({ ...s, model: text }))}
                editable={!saving}
              />
              <TextInput
                style={styles.input}
                placeholder="Year (optional)"
                value={form.year}
                onChangeText={(text) => setForm((s) => ({ ...s, year: text.replace(/\D/g, '') }))}
                keyboardType="number-pad"
                maxLength={4}
                editable={!saving}
              />
              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleAddVehicle} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Vehicle'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {vehicles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No vehicles found</Text>
              <Text style={styles.emptySubText}>Tap "Add Vehicle" to save your first vehicle.</Text>
            </View>
          ) : (
            vehicles.map((v, idx) => (
              <View key={`${v.id || v.vehicle_number || idx}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleWrap}>
                    <Ionicons name="car-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.cardTitle}>{v.vehicle_number || 'Vehicle'}</Text>
                  </View>
                  {v.is_default ? (
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>Default</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardMeta}>{(v.make || 'Unknown make')} {(v.model || 'Unknown model')}</Text>
                {v.year ? <Text style={styles.cardMeta}>Year: {v.year}</Text> : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.md, fontSize: SIZES.md, color: COLORS.textSecondary },
  scrollView: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  summaryCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { color: COLORS.textSecondary, fontSize: SIZES.sm, fontWeight: '700' },
  summaryValue: { marginTop: 4, color: COLORS.textHeading, fontWeight: '800', fontSize: 28 },
  summaryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  addBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: COLORS.white, fontWeight: '700', fontSize: SIZES.md },
  formCard: {
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: 8,
    padding: SPACING.md,
  },
  formTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading, marginBottom: SPACING.sm },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
    color: COLORS.textHeading,
    backgroundColor: COLORS.white,
  },
  saveBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 12,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: COLORS.white, fontWeight: '700' },
  emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: SIZES.md, color: COLORS.textSecondary, fontWeight: '700' },
  emptySubText: { marginTop: 6, fontSize: SIZES.sm, color: COLORS.textSecondary, textAlign: 'center' },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, marginBottom: SPACING.sm, borderRadius: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  defaultPill: { backgroundColor: '#ECFDF3', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  defaultPillText: { color: '#166534', fontSize: 11, fontWeight: '700' },
});
