import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch, apiUpload } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

type CarBrand = {
  id: string;
  name: string;
  logo_url: string;
  display_order: number;
  is_active: boolean;
};

export default function BrandsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brands, setBrands] = useState<CarBrand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CarBrand | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    logo_url: '',
    display_order: '0',
    is_active: true,
  });
  const [pickedUri, setPickedUri] = useState('');

  const load = async () => {
    try {
      const result = await apiFetch<{ data?: CarBrand[] }>('/api/super_admin/car-brands');
      setBrands(Array.isArray(result?.data) ? result.data : []);
    } catch (e: any) {
      Alert.alert('Brands', e?.message || 'Failed to load car brands');
      setBrands([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      logo_url: '',
      display_order: String(brands.length + 1),
      is_active: true,
    });
    setPickedUri('');
    setModalOpen(true);
  };

  const openEdit = (brand: CarBrand) => {
    setEditing(brand);
    setForm({
      name: brand.name || '',
      logo_url: brand.logo_url || '',
      display_order: String(brand.display_order || 0),
      is_active: brand.is_active !== false,
    });
    setPickedUri('');
    setModalOpen(true);
  };

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo library access to upload a brand logo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setPickedUri(result.assets[0].uri);
  };

  const uploadLogo = async (brandName: string, uri: string) => {
    setUploading(true);
    try {
      const name = uri.split('/').pop() || 'logo.jpg';
      const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const fd = new FormData();
      fd.append('file', { uri, name, type } as any);
      fd.append('brand_name', brandName || 'brand');
      const res = await apiUpload<{ logo_url?: string }>('/api/super_admin/car-brands/upload-logo', fd);
      return String(res.logo_url || '');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Brand name', 'Enter a brand name');
      return;
    }
    setSaving(true);
    try {
      let logoUrl = form.logo_url;
      if (pickedUri) {
        logoUrl = await uploadLogo(form.name.trim(), pickedUri);
      }
      if (!logoUrl) {
        Alert.alert('Logo required', 'Upload a logo photo first');
        return;
      }
      const payload = {
        name: form.name.trim(),
        logo_url: logoUrl,
        display_order: Number(form.display_order || 0),
        is_active: form.is_active,
      };
      if (editing) {
        await apiFetch(`/api/super_admin/car-brands/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/super_admin/car-brands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save brand');
    } finally {
      setSaving(false);
    }
  };

  const remove = (brand: CarBrand) => {
    Alert.alert('Delete brand', `Delete ${brand.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/super_admin/car-brands/${brand.id}`, { method: 'DELETE' });
            await load();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete');
          }
        },
      },
    ]);
  };

  const filtered = brands.filter((b) =>
    String(b.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );
  const preview = pickedUri || form.logo_url;

  return (
    <View style={styles.container}>
      <DashboardHeader title="Car Brand Images" onBack={() => navigation.goBack()} />
      <View style={styles.headerActions}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search brands..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No brands found</Text>
            </View>
          ) : (
            filtered.map((brand) => (
              <View key={brand.id} style={styles.brandCard}>
                {brand.logo_url ? (
                  <Image source={{ uri: brand.logo_url }} style={styles.logo} resizeMode="contain" />
                ) : (
                  <View style={[styles.logo, styles.logoEmpty]}>
                    <Text style={styles.logoEmptyTxt}>No photo</Text>
                  </View>
                )}
                <View style={styles.brandInfo}>
                  <Text style={styles.brandName}>{brand.name}</Text>
                  <Text style={styles.brandMeta}>Order {brand.display_order || 0}</Text>
                  <View style={[styles.brandBadge, { backgroundColor: brand.is_active ? '#D1FAE5' : '#E2E8F0' }]}>
                    <Text style={{ color: brand.is_active ? '#065F46' : '#475569', fontSize: 11, fontWeight: '800' }}>
                      {brand.is_active ? 'Active' : 'Hidden'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openEdit(brand)}>
                    <Text style={styles.editTxt}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => remove(brand)}>
                    <Text style={styles.deleteTxt}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editing ? 'Edit brand' : 'Add brand'}</Text>
            <Text style={styles.label}>Brand name</Text>
            <TextInput
              style={styles.formInput}
              value={form.name}
              onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Maruti Suzuki"
              placeholderTextColor={COLORS.textSecondary}
            />
            <Text style={styles.label}>Logo photo</Text>
            {preview ? <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" /> : null}
            <TouchableOpacity style={styles.uploadBtn} onPress={() => void pickLogo()} disabled={uploading}>
              <Text style={styles.uploadTxt}>{uploading ? 'Uploading…' : preview ? 'Replace photo' : 'Upload photo'}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Display order</Text>
            <TextInput
              style={styles.formInput}
              keyboardType="numeric"
              value={form.display_order}
              onChangeText={(v) => setForm((p) => ({ ...p, display_order: v }))}
            />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Active on app</Text>
              <Switch value={form.is_active} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
            </View>
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formButton, styles.cancelButton]} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formButton, styles.submitButton]} onPress={() => void save()} disabled={saving}>
                <Text style={styles.submitButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
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
  headerActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontSize: SIZES.sm,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  addButton: {
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  scrollView: { flex: 1 },
  emptyContainer: { padding: SPACING.xl, alignItems: 'center' },
  emptyText: { fontSize: SIZES.md, color: COLORS.textSecondary },
  brandCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logo: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#F8FAFC' },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },
  logoEmptyTxt: { fontSize: 10, color: '#94A3B8' },
  brandInfo: { flex: 1 },
  brandName: { fontSize: 16, fontWeight: '800', color: COLORS.textHeading },
  brandMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  brandBadge: { alignSelf: 'flex-start', marginTop: 6, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  cardActions: { gap: 10 },
  editTxt: { color: COLORS.primary, fontWeight: '800' },
  deleteTxt: { color: COLORS.danger, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textHeading, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginTop: 10 },
  formInput: {
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    color: COLORS.text,
  },
  preview: { width: '100%', height: 120, marginTop: 8, backgroundColor: '#F8FAFC', borderRadius: 10 },
  uploadBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  uploadTxt: { color: COLORS.primary, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  formButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: COLORS.gray[200] },
  submitButton: { backgroundColor: COLORS.primary },
  cancelButtonText: { color: COLORS.text, fontWeight: '700' },
  submitButtonText: { color: COLORS.white, fontWeight: '700' },
});
