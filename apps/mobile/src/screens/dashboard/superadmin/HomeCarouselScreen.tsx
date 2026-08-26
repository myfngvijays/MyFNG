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
  Image,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch, apiUpload } from '../../../lib/api';
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
  { value: 'PublicHome', label: 'Home' },
  { value: 'PublicServicePackages', label: 'Services' },
  { value: 'PublicBookServiceNow', label: 'Book Service Now' },
  { value: 'AIBooking', label: 'AI Chatbot' },
  { value: 'PublicWorkshopLocator', label: 'Workshop Locator' },
  { value: 'RoadsideAssistance', label: 'Roadside Assistance' },
  { value: 'Settings__Membership', label: 'Membership' },
];

export default function HomeCarouselScreen({ navigation }: any) {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [pickedUri, setPickedUri] = useState('');
  const [form, setForm] = useState({
    title: '',
    image_url: '',
    route_name: 'AIBooking',
    display_order: '0',
    is_active: true,
  });

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: BannerRow[] }>('/api/super_admin/home-carousel');
      setRows(res.data || []);
    } catch (e: any) {
      Alert.alert('Home Carousel', e?.message || 'Failed to load banners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRows();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      title: '',
      image_url: '',
      route_name: 'AIBooking',
      display_order: String(rows.length + 1),
      is_active: true,
    });
    setPickedUri('');
    setShowModal(true);
  }

  function openEdit(row: BannerRow) {
    setEditing(row);
    setForm({
      title: row.title || '',
      image_url: row.image_url || '',
      route_name: row.route_name || 'AIBooking',
      display_order: String(row.display_order || 0),
      is_active: !!row.is_active,
    });
    setPickedUri('');
    setShowModal(true);
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo library access to upload a banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    setPickedUri(result.assets[0].uri);
  }

  async function uploadImage(uri: string, title: string) {
    setUploading(true);
    try {
      const name = uri.split('/').pop() || 'banner.jpg';
      const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const fd = new FormData();
      fd.append('file', { uri, name, type } as any);
      fd.append('title', title || 'banner');
      const res = await apiUpload<{ image_url?: string }>('/api/super_admin/home-carousel/upload-image', fd);
      return String(res.image_url || '');
    } finally {
      setUploading(false);
    }
  }

  async function saveBanner() {
    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (pickedUri) {
        imageUrl = await uploadImage(pickedUri, form.title);
      }
      if (!imageUrl) {
        Alert.alert('Photo required', 'Upload a banner photo first');
        return;
      }
      const payload = {
        title: form.title || null,
        image_url: imageUrl,
        route_name: form.route_name,
        route_params: { city: '__CITY__' },
        display_order: Number(form.display_order || 0),
        is_active: !!form.is_active,
      };
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
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save banner');
    } finally {
      setSaving(false);
    }
  }

  function deleteBanner(id: string) {
    Alert.alert('Delete banner', 'Remove this carousel image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/super_admin/home-carousel/${id}`, { method: 'DELETE' });
            await fetchRows();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete');
          }
        },
      },
    ]);
  }

  const preview = pickedUri || form.image_url;

  return (
    <View style={styles.container}>
      <DashboardHeader title="Home Carousel" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
          <Text style={styles.primaryText}>Add Banner</Text>
        </TouchableOpacity>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.primary} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.banner} resizeMode="cover" />
                ) : (
                  <View style={[styles.banner, styles.bannerEmpty]}>
                    <Text style={styles.emptyTxt}>No photo</Text>
                  </View>
                )}
                <Text style={styles.cardTitle}>{item.title || 'Banner'}</Text>
                <Text style={styles.cardMeta}>
                  {ROUTES.find((r) => r.value === item.route_name)?.label || item.route_name} · Order {item.display_order}
                </Text>
                <Text style={styles.cardMeta}>{item.is_active ? 'Active' : 'Hidden'}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
                    <Text style={styles.actionText}>Edit / Replace photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteBanner(item.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.emptyTxt}>No carousel banners yet.</Text>}
          />
        )}
      </View>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Banner' : 'Add Banner'}</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm((p) => ({ ...p, title: v }))} />
            <Text style={styles.label}>Banner photo</Text>
            {preview ? <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" /> : null}
            <TouchableOpacity style={styles.uploadBtn} onPress={() => void pickImage()} disabled={uploading}>
              <Text style={styles.uploadTxt}>{uploading ? 'Uploading…' : preview ? 'Replace photo' : 'Upload photo'}</Text>
            </TouchableOpacity>
            <Text style={styles.label}>Opens</Text>
            <View style={styles.routeWrap}>
              {ROUTES.map((route) => {
                const on = form.route_name === route.value;
                return (
                  <TouchableOpacity
                    key={route.value}
                    style={[styles.routeChip, on && styles.routeChipOn]}
                    onPress={() => setForm((p) => ({ ...p, route_name: route.value }))}
                  >
                    <Text style={[styles.routeTxt, on && styles.routeTxtOn]}>{route.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.label}>Display order</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={form.display_order}
              onChangeText={(v) => setForm((p) => ({ ...p, display_order: v }))}
            />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Active</Text>
              <Switch value={form.is_active} onValueChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => void saveBanner()} disabled={saving}>
                <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  list: { paddingVertical: SPACING.sm, paddingBottom: 40 },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 12, marginBottom: SPACING.sm, borderWidth: 1, borderColor: '#E2E8F0' },
  banner: { width: '100%', height: 140, borderRadius: 10, backgroundColor: '#F1F5F9', marginBottom: 10 },
  bannerEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: SIZES.md, fontWeight: '800', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  cardActions: { flexDirection: 'row', marginTop: SPACING.sm, gap: SPACING.sm },
  actionBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { color: COLORS.primary, fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  deleteText: { color: COLORS.danger, fontWeight: '700' },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '700' },
  secondaryBtn: { backgroundColor: COLORS.border, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm, flex: 1 },
  secondaryText: { color: COLORS.text, textAlign: 'center', fontWeight: '700' },
  emptyTxt: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: SPACING.md, paddingBottom: 36 },
  modalTitle: { fontSize: SIZES.lg, fontWeight: '800', marginBottom: SPACING.sm, color: COLORS.textHeading },
  label: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white, color: COLORS.text },
  preview: { width: '100%', height: 140, borderRadius: 10, marginTop: 8, backgroundColor: '#F1F5F9' },
  uploadBtn: { marginTop: 8, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  uploadTxt: { color: COLORS.primary, fontWeight: '800' },
  routeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  routeChip: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  routeChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  routeTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  routeTxtOn: { color: '#fff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
});
