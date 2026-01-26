import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type Workshop = { id: string; name: string; city?: string | null; state?: string | null };
type PublicPage = {
  id: string;
  workshop_id: string;
  slug: string;
  profile_image: string | null;
  cover_image: string | null;
  short_description: string | null;
  full_description: string | null;
  services_offered: string[] | null;
  whatsapp_number: string | null;
  alternate_phone: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  google_maps_url: string | null;
  gallery_images: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  is_published: boolean;
  is_featured: boolean;
  workshop?: Workshop | null;
};

export default function WorkshopPublicPagesScreen({ navigation }: any) {
  const [pages, setPages] = useState<PublicPage[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PublicPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    workshop_id: '',
    slug: '',
    profile_image: '',
    cover_image: '',
    short_description: '',
    full_description: '',
    services_offered: '',
    whatsapp_number: '',
    alternate_phone: '',
    website_url: '',
    facebook_url: '',
    instagram_url: '',
    youtube_url: '',
    google_maps_url: '',
    gallery_images: '',
    meta_title: '',
    meta_description: '',
    meta_keywords: '',
    is_published: false,
    is_featured: false,
  });

  useEffect(() => {
    fetchPages();
    fetchWorkshops();
  }, []);

  async function fetchPages() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workshop_public_pages')
        .select('*, workshop:workshops(id, name, city, state)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPages(data || []);
    } catch (e) {
      console.error('Failed to load pages', e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWorkshops() {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, city, state')
        .eq('is_verified', true)
        .order('name');
      if (error) throw error;
      setWorkshops(data || []);
    } catch (e) {
      console.error('Failed to load workshops', e);
    }
  }

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) =>
      [p.slug, p.workshop?.name].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [pages, searchTerm]);

  function openCreate() {
    setEditing(null);
    setForm({
      workshop_id: '',
      slug: '',
      profile_image: '',
      cover_image: '',
      short_description: '',
      full_description: '',
      services_offered: '',
      whatsapp_number: '',
      alternate_phone: '',
      website_url: '',
      facebook_url: '',
      instagram_url: '',
      youtube_url: '',
      google_maps_url: '',
      gallery_images: '',
      meta_title: '',
      meta_description: '',
      meta_keywords: '',
      is_published: false,
      is_featured: false,
    });
    setShowModal(true);
  }

  function openEdit(page: PublicPage) {
    setEditing(page);
    setForm({
      workshop_id: page.workshop_id || '',
      slug: page.slug || '',
      profile_image: page.profile_image || '',
      cover_image: page.cover_image || '',
      short_description: page.short_description || '',
      full_description: page.full_description || '',
      services_offered: (page.services_offered || []).join(', '),
      whatsapp_number: page.whatsapp_number || '',
      alternate_phone: page.alternate_phone || '',
      website_url: page.website_url || '',
      facebook_url: page.facebook_url || '',
      instagram_url: page.instagram_url || '',
      youtube_url: page.youtube_url || '',
      google_maps_url: page.google_maps_url || '',
      gallery_images: (page.gallery_images || []).join(', '),
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      meta_keywords: (page.meta_keywords || []).join(', '),
      is_published: !!page.is_published,
      is_featured: !!page.is_featured,
    });
    setShowModal(true);
  }

  async function savePage() {
    setSaving(true);
    try {
      const payload: any = {
        workshop_id: form.workshop_id,
        slug: form.slug,
        profile_image: form.profile_image || null,
        cover_image: form.cover_image || null,
        short_description: form.short_description || null,
        full_description: form.full_description || null,
        services_offered: form.services_offered ? form.services_offered.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        whatsapp_number: form.whatsapp_number || null,
        alternate_phone: form.alternate_phone || null,
        website_url: form.website_url || null,
        facebook_url: form.facebook_url || null,
        instagram_url: form.instagram_url || null,
        youtube_url: form.youtube_url || null,
        google_maps_url: form.google_maps_url || null,
        gallery_images: form.gallery_images ? form.gallery_images.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        meta_title: form.meta_title || null,
        meta_description: form.meta_description || null,
        meta_keywords: form.meta_keywords ? form.meta_keywords.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        is_published: !!form.is_published,
        is_featured: !!form.is_featured,
      };
      if (!payload.workshop_id || !payload.slug) return;

      if (editing) {
        const { error } = await supabase
          .from('workshop_public_pages')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workshop_public_pages')
          .insert(payload);
        if (error) throw error;
      }
      setShowModal(false);
      await fetchPages();
    } catch (e) {
      console.error('Failed to save page', e);
    } finally {
      setSaving(false);
    }
  }

  const renderItem = ({ item }: { item: PublicPage }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.workshop?.name || 'Workshop'}</Text>
      <Text style={styles.cardMeta}>Slug: {item.slug}</Text>
      <Text style={styles.cardMeta}>Published: {item.is_published ? 'Yes' : 'No'}</Text>
      <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
        <Text style={styles.actionText}>Edit</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="Workshop Public Pages" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by slug or workshop"
            placeholderTextColor={COLORS.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={openCreate}>
            <Text style={styles.primaryText}>Add</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>

      <Modal visible={showModal} animationType="slide">
        <View style={styles.modalContainer}>
          <DashboardHeader title="Public Page" onBack={() => setShowModal(false)} />
          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Workshop</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {workshops.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.filterBtn, form.workshop_id === w.id && styles.filterBtnActive]}
                  onPress={() => setForm((p: any) => ({ ...p, workshop_id: w.id }))}
                >
                  <Text style={styles.filterText}>{w.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.label}>Slug</Text>
            <TextInput style={styles.input} value={form.slug} onChangeText={(v) => setForm((p: any) => ({ ...p, slug: v }))} />
            <Text style={styles.label}>Profile Image URL</Text>
            <TextInput style={styles.input} value={form.profile_image} onChangeText={(v) => setForm((p: any) => ({ ...p, profile_image: v }))} />
            <Text style={styles.label}>Cover Image URL</Text>
            <TextInput style={styles.input} value={form.cover_image} onChangeText={(v) => setForm((p: any) => ({ ...p, cover_image: v }))} />
            <Text style={styles.label}>Short Description</Text>
            <TextInput style={styles.input} value={form.short_description} onChangeText={(v) => setForm((p: any) => ({ ...p, short_description: v }))} />
            <Text style={styles.label}>Full Description</Text>
            <TextInput style={[styles.input, styles.textArea]} value={form.full_description} onChangeText={(v) => setForm((p: any) => ({ ...p, full_description: v }))} multiline />
            <Text style={styles.label}>Services Offered (comma separated)</Text>
            <TextInput style={styles.input} value={form.services_offered} onChangeText={(v) => setForm((p: any) => ({ ...p, services_offered: v }))} />
            <Text style={styles.label}>Gallery Images (comma separated URLs)</Text>
            <TextInput style={styles.input} value={form.gallery_images} onChangeText={(v) => setForm((p: any) => ({ ...p, gallery_images: v }))} />
            <Text style={styles.label}>Meta Title</Text>
            <TextInput style={styles.input} value={form.meta_title} onChangeText={(v) => setForm((p: any) => ({ ...p, meta_title: v }))} />
            <Text style={styles.label}>Meta Description</Text>
            <TextInput style={styles.input} value={form.meta_description} onChangeText={(v) => setForm((p: any) => ({ ...p, meta_description: v }))} />
            <Text style={styles.label}>Meta Keywords (comma separated)</Text>
            <TextInput style={styles.input} value={form.meta_keywords} onChangeText={(v) => setForm((p: any) => ({ ...p, meta_keywords: v }))} />
            <View style={styles.switchRow}>
              <Text style={styles.label}>Published</Text>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => setForm((p: any) => ({ ...p, is_published: !p.is_published }))}
              >
                <Text style={styles.toggleText}>{form.is_published ? 'Yes' : 'No'}</Text>
              </TouchableOpacity>
              <Text style={styles.label}>Featured</Text>
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() => setForm((p: any) => ({ ...p, is_featured: !p.is_featured }))}
              >
                <Text style={styles.toggleText}>{form.is_featured ? 'Yes' : 'No'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={savePage} disabled={saving}>
              <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  searchRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, backgroundColor: COLORS.white, color: COLORS.text },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.sm },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '600' },
  list: { paddingVertical: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  actionBtn: { marginTop: SPACING.sm, backgroundColor: COLORS.gray[100], padding: 6, borderRadius: 6 },
  actionText: { color: COLORS.primary, fontWeight: '600', textAlign: 'center' },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalBody: { padding: SPACING.md },
  label: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white, color: COLORS.text },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  filterBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: SPACING.sm, paddingVertical: 6, marginRight: SPACING.xs, backgroundColor: COLORS.white },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { color: COLORS.text, fontSize: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  toggleBtn: { backgroundColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6 },
  toggleText: { color: COLORS.text, fontWeight: '600' },
});
