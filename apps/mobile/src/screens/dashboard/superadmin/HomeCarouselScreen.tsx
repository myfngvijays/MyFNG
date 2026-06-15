import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type BannerRow = {
  id: string;
  title: string | null;
  image_url: string;
  route_name: string;
  route_params: any;
  display_order: number;
  is_active: boolean;
};

const ROUTES = [
  'PublicHome',
  'PublicServicePackages',
  'PublicBookServiceNow',
  'AIBooking',
  'PublicWorkshopLocator',
  'RoadsideAssistance',
  'Settings',
  'Settings__MyProfile',
  'Settings__Membership',
  'Settings__YourAddresses',
  'Settings__OrderHistory',
  'Settings__Cart',
  'Settings__Notifications',
  'Login',
  'CustomerSignup',
];

export default function HomeCarouselScreen({ navigation }: any) {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    route_name: 'AIBooking',
    route_params_text: '{}',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    fetchRows();
  }, []);

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: BannerRow[] }>('/api/super_admin/home-carousel');
      setRows(res.data || []);
    } catch (e) {
      console.error('Failed to load banners', e);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      title: '',
      image_url: '',
      route_name: 'AIBooking',
      route_params_text: '{}',
      display_order: String(rows.length + 1),
      is_active: true,
    });
    setShowModal(true);
  }

  function openEdit(row: BannerRow) {
    setEditing(row);
    setForm({
      title: row.title || '',
      image_url: row.image_url || '',
      route_name: row.route_name || 'AIBooking',
      route_params_text: JSON.stringify(row.route_params || {}, null, 2),
      display_order: String(row.display_order || 0),
      is_active: !!row.is_active,
    });
    setShowModal(true);
  }

  async function saveBanner() {
    setSaving(true);
    try {
      const payload = {
        title: form.title || null,
        image_url: form.image_url,
        route_name: form.route_name,
        route_params: JSON.parse(form.route_params_text || '{}'),
        display_order: Number(form.display_order || 0),
        is_active: !!form.is_active,
      };
      if (!payload.image_url) return;

      if (editing) {
        await apiFetch(`/api/super_admin/home-carousel/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/super_admin/home-carousel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      await fetchRows();
    } catch (e) {
      console.error('Failed to save banner', e);
    } finally {
      setSaving(false);
    }
  }

  async function deleteBanner(id: string) {
    try {
      await apiFetch(`/api/super_admin/home-carousel/${id}`, { method: 'DELETE' });
      await fetchRows();
    } catch (e) {
      console.error('Failed to delete banner', e);
    }
  }

  const renderItem = ({ item }: { item: BannerRow }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title || 'Banner'}</Text>
      <Text style={styles.cardMeta}>Route: {item.route_name}</Text>
      <Text style={styles.cardMeta}>Order: {item.display_order}</Text>
      <Text style={styles.cardMeta}>Active: {item.is_active ? 'Yes' : 'No'}</Text>
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteBanner(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="Home Carousel" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
          <Text style={styles.primaryText}>Add Banner</Text>
        </TouchableOpacity>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Banner' : 'Add Banner'}</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm((p) => ({ ...p, title: v }))} />
            <Text style={styles.label}>Image URL</Text>
            <TextInput style={styles.input} value={form.image_url} onChangeText={(v) => setForm((p) => ({ ...p, image_url: v }))} />
            <Text style={styles.label}>Route Name</Text>
            <TextInput
              style={styles.input}
              value={form.route_name}
              onChangeText={(v) => setForm((p) => ({ ...p, route_name: v }))}
            />
            <Text style={styles.label}>Route Params (JSON)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={form.route_params_text}
              onChangeText={(v) => setForm((p) => ({ ...p, route_params_text: v }))}
              multiline
            />
            <Text style={styles.label}>Display Order</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={form.display_order}
              onChangeText={(v) => setForm((p) => ({ ...p, display_order: v }))}
            />
            <Text style={styles.label}>Active</Text>
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
            >
              <Text style={styles.toggleText}>{form.is_active ? 'Active' : 'Inactive'}</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={saveBanner} disabled={saving}>
                <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  list: { paddingVertical: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  cardActions: { flexDirection: 'row', marginTop: SPACING.sm, gap: SPACING.sm },
  actionBtn: { backgroundColor: COLORS.gray[100], paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6 },
  actionText: { color: COLORS.primary, fontWeight: '600' },
  deleteBtn: { backgroundColor: COLORS.gray[100], paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6 },
  deleteText: { color: COLORS.danger, fontWeight: '600' },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '600' },
  secondaryBtn: { backgroundColor: COLORS.border, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  secondaryText: { color: COLORS.text, textAlign: 'center', fontWeight: '600' },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SPACING.md },
  modalContent: { backgroundColor: COLORS.white, borderRadius: 12, padding: SPACING.md },
  modalTitle: { fontSize: SIZES.lg, fontWeight: '700', marginBottom: SPACING.sm, color: COLORS.textHeading },
  label: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white, color: COLORS.text },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  toggleBtn: { backgroundColor: COLORS.border, padding: SPACING.sm, borderRadius: 6, marginTop: 4 },
  toggleText: { color: COLORS.text, fontWeight: '600' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.sm },
});
