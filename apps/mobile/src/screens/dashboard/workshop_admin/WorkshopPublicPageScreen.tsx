import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Switch,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DashboardHeader from '../../../components/DashboardHeader';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { ENV } from '../../../config/environment';

type Workshop = {
  id: string;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

type PublicPage = {
  id: string;
  workshop_id: string;
  slug: string;
  profile_image: string | null;
  cover_image: string | null;
  short_description: string | null;
  full_description: string | null;
  services_offered: string[] | null;
  business_hours: Record<string, string> | null;
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
};

export default function WorkshopPublicPageScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [page, setPage] = useState<PublicPage | null>(null);
  const [uploading, setUploading] = useState({
    profile: false,
    cover: false,
    gallery: false,
  });

  const [formData, setFormData] = useState({
    slug: '',
    profile_image: '',
    cover_image: '',
    short_description: '',
    full_description: '',
    services_offered: [] as string[],
    business_hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: '',
    },
    whatsapp_number: '',
    alternate_phone: '',
    website_url: '',
    facebook_url: '',
    instagram_url: '',
    youtube_url: '',
    google_maps_url: '',
    gallery_images: [] as string[],
    meta_title: '',
    meta_description: '',
    meta_keywords: [] as string[],
    is_published: false,
    is_featured: false,
  });

  const [serviceInput, setServiceInput] = useState('');
  const [galleryInput, setGalleryInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
    fetchData();
  }, []);

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  async function fetchData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile, error: profileError } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();
      if (profileError || !userProfile?.workshop_id) {
        throw new Error('Workshop not found');
      }

      const { data: workshopData } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', userProfile.workshop_id)
        .single();
      setWorkshop(workshopData || null);

      const { data: pageData } = await supabase
        .from('workshop_public_pages')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .single();

      if (pageData) {
        setPage(pageData);
        setFormData({
          slug: pageData.slug || '',
          profile_image: pageData.profile_image || '',
          cover_image: pageData.cover_image || '',
          short_description: pageData.short_description || '',
          full_description: pageData.full_description || '',
          services_offered: pageData.services_offered || [],
          business_hours: pageData.business_hours || {
            monday: '',
            tuesday: '',
            wednesday: '',
            thursday: '',
            friday: '',
            saturday: '',
            sunday: '',
          },
          whatsapp_number: pageData.whatsapp_number || '',
          alternate_phone: pageData.alternate_phone || '',
          website_url: pageData.website_url || '',
          facebook_url: pageData.facebook_url || '',
          instagram_url: pageData.instagram_url || '',
          youtube_url: pageData.youtube_url || '',
          google_maps_url: pageData.google_maps_url || '',
          gallery_images: pageData.gallery_images || [],
          meta_title: pageData.meta_title || '',
          meta_description: pageData.meta_description || '',
          meta_keywords: pageData.meta_keywords || [],
          is_published: !!pageData.is_published,
          is_featured: !!pageData.is_featured,
        });
      } else if (workshopData?.name) {
        setFormData((prev) => ({
          ...prev,
          slug: generateSlug(workshopData.name),
          whatsapp_number: workshopData.phone || '',
          alternate_phone: workshopData.phone || '',
        }));
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load public page');
    } finally {
      setLoading(false);
    }
  }

  function handleAddService() {
    const value = serviceInput.trim();
    if (!value) return;
    setFormData((prev) => ({ ...prev, services_offered: [...prev.services_offered, value] }));
    setServiceInput('');
  }

  function handleAddKeyword() {
    const value = keywordInput.trim();
    if (!value) return;
    setFormData((prev) => ({ ...prev, meta_keywords: [...prev.meta_keywords, value] }));
    setKeywordInput('');
  }

  function handleAddGalleryUrl() {
    const value = galleryInput.trim();
    if (!value) return;
    if (formData.gallery_images.length >= 25) {
      Alert.alert('Limit reached', 'Maximum 25 gallery images allowed');
      return;
    }
    setFormData((prev) => ({ ...prev, gallery_images: [...prev.gallery_images, value] }));
    setGalleryInput('');
  }

  async function pickAndUploadImage(type: 'profile' | 'cover' | 'gallery') {
    if (!workshop?.id) return;
    if (type === 'gallery' && formData.gallery_images.length >= 25) {
      Alert.alert('Limit reached', 'Maximum 25 gallery images allowed');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading((prev) => ({ ...prev, [type]: true }));
    try {
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop() || `${type}.jpg`;
      const filePath = `workshop-public-pages/${workshop.id}/${Date.now()}_${filename}`;

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error } = await supabase.storage
        .from('workshop-assets')
        .upload(filePath, blob, { contentType: 'image/jpeg' });
      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('workshop-assets')
        .getPublicUrl(filePath);

      if (type === 'profile') {
        setFormData((prev) => ({ ...prev, profile_image: publicUrlData.publicUrl }));
      } else if (type === 'cover') {
        setFormData((prev) => ({ ...prev, cover_image: publicUrlData.publicUrl }));
      } else {
        setFormData((prev) => ({
          ...prev,
          gallery_images: [...prev.gallery_images, publicUrlData.publicUrl],
        }));
      }
    } catch (error: any) {
      Alert.alert('Upload failed', error.message || 'Failed to upload image');
    } finally {
      setUploading((prev) => ({ ...prev, [type]: false }));
    }
  }

  async function handleSave() {
    if (!workshop?.id) return;
    if (!formData.slug.trim()) {
      Alert.alert('Missing slug', 'Please enter a URL slug');
      return;
    }
    if (formData.gallery_images.length < 2) {
      Alert.alert('Gallery required', 'Please add at least 2 gallery images');
      return;
    }
    if (formData.gallery_images.length > 25) {
      Alert.alert('Too many images', 'Maximum 25 gallery images allowed');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload: any = {
        workshop_id: workshop.id,
        slug: formData.slug,
        profile_image: formData.profile_image || null,
        cover_image: formData.cover_image || null,
        short_description: formData.short_description || null,
        full_description: formData.full_description || null,
        services_offered: formData.services_offered,
        business_hours: formData.business_hours,
        whatsapp_number: formData.whatsapp_number || null,
        alternate_phone: formData.alternate_phone || null,
        website_url: formData.website_url || null,
        facebook_url: formData.facebook_url || null,
        instagram_url: formData.instagram_url || null,
        youtube_url: formData.youtube_url || null,
        google_maps_url: formData.google_maps_url || null,
        gallery_images: formData.gallery_images,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        meta_keywords: formData.meta_keywords,
        is_published: formData.is_published,
        is_featured: formData.is_featured,
        updated_by: user.id,
        ...(page ? {} : { created_by: user.id }),
        ...(formData.is_published && !page ? { published_at: new Date().toISOString() } : {}),
      };

      if (page) {
        const { error } = await supabase
          .from('workshop_public_pages')
          .update(payload)
          .eq('id', page.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('workshop_public_pages')
          .insert(payload);
        if (error) throw error;
      }

      Alert.alert('Success', page ? 'Public page updated' : 'Public page created');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save public page');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!workshop) {
    return (
      <View style={styles.container}>
        <DashboardHeader title="Public Page" onBack={() => navigation.goBack()} />
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No workshop assigned to your account.</Text>
        </View>
      </View>
    );
  }

  const canViewPublic = formData.is_published && formData.slug;

  return (
    <View style={styles.container}>
      <DashboardHeader title="Public Page" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{workshop.name || 'Workshop'}</Text>
          <Text style={styles.headerSubtitle}>
            {workshop.address || ''} {workshop.city ? `• ${workshop.city}` : ''} {workshop.state ? `• ${workshop.state}` : ''}
          </Text>
          {canViewPublic && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => Linking.openURL(`${ENV.APP_URL}/workshop/${formData.slug}`)}
            >
              <Text style={styles.viewButtonText}>View Public Page</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.sectionTitle}>Basic Info</Text>
        <Text style={styles.label}>URL Slug</Text>
        <TextInput
          style={styles.input}
          value={formData.slug}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
          placeholder="workshop-slug"
        />

        <Text style={styles.label}>Short Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.short_description}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, short_description: v }))}
          placeholder="Short description"
          multiline
        />

        <Text style={styles.label}>Full Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.full_description}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, full_description: v }))}
          placeholder="Full description"
          multiline
        />

        <Text style={styles.sectionTitle}>Images</Text>
        <Text style={styles.label}>Profile Image</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={formData.profile_image}
            onChangeText={(v) => setFormData((prev) => ({ ...prev, profile_image: v }))}
            placeholder="Image URL"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => pickAndUploadImage('profile')}
            disabled={uploading.profile}
          >
            <Text style={styles.primaryText}>{uploading.profile ? 'Uploading...' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
        {formData.profile_image ? (
          <Image source={{ uri: formData.profile_image }} style={styles.preview} />
        ) : null}

        <Text style={styles.label}>Cover Image</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={formData.cover_image}
            onChangeText={(v) => setFormData((prev) => ({ ...prev, cover_image: v }))}
            placeholder="Image URL"
          />
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => pickAndUploadImage('cover')}
            disabled={uploading.cover}
          >
            <Text style={styles.primaryText}>{uploading.cover ? 'Uploading...' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
        {formData.cover_image ? (
          <Image source={{ uri: formData.cover_image }} style={styles.coverPreview} />
        ) : null}

        <Text style={styles.sectionTitle}>Services Offered</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={serviceInput}
            onChangeText={setServiceInput}
            placeholder="Add service"
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddService}>
            <Text style={styles.secondaryText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tagRow}>
          {formData.services_offered.map((service, index) => (
            <TouchableOpacity
              key={`${service}-${index}`}
              style={styles.tag}
              onPress={() =>
                setFormData((prev) => ({
                  ...prev,
                  services_offered: prev.services_offered.filter((_, i) => i !== index),
                }))
              }
            >
              <Text style={styles.tagText}>{service} ×</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Business Hours</Text>
        {Object.keys(formData.business_hours).map((day) => (
          <View key={day} style={styles.hoursRow}>
            <Text style={styles.hoursLabel}>{day}</Text>
            <TextInput
              style={[styles.input, styles.hoursInput]}
              value={formData.business_hours[day as keyof typeof formData.business_hours]}
              onChangeText={(v) =>
                setFormData((prev) => ({
                  ...prev,
                  business_hours: { ...prev.business_hours, [day]: v },
                }))
              }
              placeholder="9:00 AM - 6:00 PM"
            />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.label}>WhatsApp Number</Text>
        <TextInput
          style={styles.input}
          value={formData.whatsapp_number}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, whatsapp_number: v }))}
          placeholder="WhatsApp number"
        />
        <Text style={styles.label}>Alternate Phone</Text>
        <TextInput
          style={styles.input}
          value={formData.alternate_phone}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, alternate_phone: v }))}
          placeholder="Alternate phone"
        />

        <Text style={styles.sectionTitle}>Social Links</Text>
        {[
          { key: 'website_url', label: 'Website' },
          { key: 'facebook_url', label: 'Facebook' },
          { key: 'instagram_url', label: 'Instagram' },
          { key: 'youtube_url', label: 'YouTube' },
          { key: 'google_maps_url', label: 'Google Maps' },
        ].map((item) => (
          <View key={item.key}>
            <Text style={styles.label}>{item.label}</Text>
            <TextInput
              style={styles.input}
              value={(formData as any)[item.key]}
              onChangeText={(v) => setFormData((prev) => ({ ...prev, [item.key]: v }))}
              placeholder={`${item.label} URL`}
            />
          </View>
        ))}

        <Text style={styles.sectionTitle}>Gallery Images</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={galleryInput}
            onChangeText={setGalleryInput}
            placeholder="Image URL"
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddGalleryUrl}>
            <Text style={styles.secondaryText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => pickAndUploadImage('gallery')}
            disabled={uploading.gallery}
          >
            <Text style={styles.primaryText}>{uploading.gallery ? 'Uploading...' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>
          {formData.gallery_images.length}/25 images • Minimum 2 required
        </Text>
        <View style={styles.galleryGrid}>
          {formData.gallery_images.map((url, index) => (
            <View key={`${url}-${index}`} style={styles.galleryItem}>
              <Image source={{ uri: url }} style={styles.galleryImage} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() =>
                  setFormData((prev) => ({
                    ...prev,
                    gallery_images: prev.gallery_images.filter((_, i) => i !== index),
                  }))
                }
              >
                <Text style={styles.removeText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>SEO</Text>
        <Text style={styles.label}>Meta Title</Text>
        <TextInput
          style={styles.input}
          value={formData.meta_title}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, meta_title: v }))}
          placeholder="Meta title"
        />
        <Text style={styles.label}>Meta Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.meta_description}
          onChangeText={(v) => setFormData((prev) => ({ ...prev, meta_description: v }))}
          placeholder="Meta description"
          multiline
        />

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.rowInput]}
            value={keywordInput}
            onChangeText={setKeywordInput}
            placeholder="Add keyword"
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddKeyword}>
            <Text style={styles.secondaryText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.tagRow}>
          {formData.meta_keywords.map((keyword, index) => (
            <TouchableOpacity
              key={`${keyword}-${index}`}
              style={styles.tag}
              onPress={() =>
                setFormData((prev) => ({
                  ...prev,
                  meta_keywords: prev.meta_keywords.filter((_, i) => i !== index),
                }))
              }
            >
              <Text style={styles.tagText}>{keyword} ×</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Publish Page</Text>
          <Switch
            value={formData.is_published}
            onValueChange={(v) => setFormData((prev) => ({ ...prev, is_published: v }))}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Saving...' : page ? 'Update Page' : 'Create Page'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
  emptyCard: { padding: SPACING.lg, margin: SPACING.md, backgroundColor: COLORS.white, borderRadius: 10 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center' },
  headerCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  headerTitle: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.textHeading },
  headerSubtitle: { color: COLORS.textSecondary, marginTop: 4 },
  viewButton: { marginTop: SPACING.sm, alignSelf: 'flex-start', backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  viewButtonText: { color: COLORS.white, fontWeight: '600' },
  sectionTitle: { marginTop: SPACING.lg, marginBottom: SPACING.sm, fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  label: { color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.sm },
  rowInput: { flex: 1, marginBottom: 0 },
  primaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8 },
  primaryText: { color: COLORS.white, fontWeight: '600', fontSize: 12 },
  secondaryBtn: { backgroundColor: COLORS.gray[200], paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8 },
  secondaryText: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
  preview: { width: 100, height: 100, borderRadius: 10, marginBottom: SPACING.md },
  coverPreview: { width: '100%', height: 140, borderRadius: 10, marginBottom: SPACING.md },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  tag: { backgroundColor: COLORS.primary + '20', borderRadius: 16, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  tagText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
  hoursRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: SPACING.sm },
  hoursLabel: { width: 90, color: COLORS.textSecondary, textTransform: 'capitalize' },
  hoursInput: { flex: 1 },
  helperText: { color: COLORS.textSecondary, marginBottom: SPACING.sm, fontSize: 12 },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  galleryItem: { position: 'relative' },
  galleryImage: { width: 90, height: 90, borderRadius: 8 },
  removeBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.danger, borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: COLORS.white, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: SPACING.md },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: SPACING.md, borderRadius: 10, alignItems: 'center', marginTop: SPACING.md },
  saveText: { color: COLORS.white, fontWeight: '700' },
});
