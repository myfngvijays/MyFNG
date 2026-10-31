import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch, apiUpload } from '../../../lib/api';
import { ENV } from '../../../config/environment';
import { COLORS, SPACING } from '../../../constants/theme';

function imageSrc(url?: string) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const base = String(ENV.API_URL || '').replace(/\/$/, '');
  return `${base}${value.startsWith('/') ? value : `/${value}`}`;
}

const IMAGE_SIZE = '1600 × 800 px (2:1)';

const PAGE_OPTIONS = [
  { id: 'all', label: 'All public pages' },
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'car-services', label: 'Car service pages' },
  { id: 'cities', label: 'City pages' },
  { id: 'workshops', label: 'Workshop pages' },
  { id: 'blogs', label: 'Blogs & news' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
  { id: 'faq', label: 'FAQ' },
  { id: 'rsa', label: 'Roadside assistance' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'brands', label: 'Popular brands' },
  { id: 'ads', label: 'Ads & campaign pages' },
  { id: 'book', label: 'Book service' },
  { id: 'other', label: 'Other public pages' },
];

const BUTTON_PAGES = [
  { label: 'Book service', href: '/book-service' },
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Car services', href: '/car-services' },
  { label: 'Workshop locator', href: '/workshop-locator' },
  { label: 'Blogs', href: '/blogs' },
  { label: 'About us', href: '/about-us' },
  { label: 'Contact us', href: '/contact-us' },
  { label: 'FAQ', href: '/faqs' },
  { label: 'Roadside assistance', href: '/roadside-assistance' },
  { label: 'Popular brands', href: '/popular-brands' },
  { label: 'Ads landing', href: '/car-service-and-repairs' },
  { label: 'Car loan', href: '/car-loan' },
];

const COLOR_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'card', label: 'Card' },
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'code_bg', label: 'Coupon background' },
  { key: 'code_text', label: 'Coupon text' },
  { key: 'offer_bg', label: 'Offer background' },
  { key: 'offer_text', label: 'Offer text' },
  { key: 'badge_bg', label: 'Badge background' },
  { key: 'badge_text', label: 'Badge text' },
  { key: 'button_bg', label: 'Button background' },
  { key: 'button_text', label: 'Button text' },
  { key: 'ring', label: 'Border' },
];

const TEXT_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'name', label: 'Name in admin' },
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Line under headline' },
  { key: 'coupon_code', label: 'Coupon code' },
  { key: 'offer_label', label: 'Offer label' },
  { key: 'badge_text', label: 'Badge' },
  { key: 'button_text', label: 'Button text' },
  { key: 'starts_at', label: 'Start (YYYY-MM-DDTHH:mm)' },
  { key: 'ends_at', label: 'Expiry (YYYY-MM-DDTHH:mm)' },
  { key: 'utm_source', label: 'UTM source' },
  { key: 'utm_medium', label: 'UTM medium' },
  { key: 'utm_campaign', label: 'UTM campaign' },
  { key: 'max_views', label: 'Show times per browser' },
];

type PopupConfig = {
  id: string;
  name: string;
  enabled: boolean;
  starts_at: string;
  ends_at: string;
  pages: string[];
  headline: string;
  subtitle: string;
  coupon_code: string;
  offer_label: string;
  badge_text: string;
  button_text: string;
  button_href: string;
  image_url: string;
  colors: Record<string, string>;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  max_views: number;
};

function newPopup(): PopupConfig {
  return {
    id: `popup-${Date.now().toString(36)}`,
    name: 'New popup',
    enabled: false,
    starts_at: '',
    ends_at: '',
    pages: [],
    headline: 'Flat 20% OFF',
    subtitle: 'Use code on car periodic service',
    coupon_code: '',
    offer_label: '20% OFF',
    badge_text: 'LIMITED TIME OFFER',
    button_text: 'Book Service',
    button_href: '/book-service',
    image_url: '',
    colors: {
      card: '#fff8ef',
      headline: '#5c1020',
      subtitle: '#c2410c',
      code_bg: '#6b1224',
      code_text: '#ffe14a',
      offer_bg: '#ffd000',
      offer_text: '#7a1020',
      badge_bg: '#ffe7a3',
      badge_text: '#9a3412',
      button_bg: '#6b1224',
      button_text: '#ffe14a',
      ring: '#e7c27a',
    },
    utm_source: 'popup',
    utm_medium: 'offer',
    utm_campaign: 'website',
    max_views: 2,
  };
}

export default function WebsitePopupScreen({ navigation }: any) {
  const [popups, setPopups] = useState<PopupConfig[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [buttonOpen, setButtonOpen] = useState(false);

  const selected = popups.find((popup) => popup.id === selectedId) || popups[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiFetch<any>('/api/super_admin/website-popup');
      const next = Array.isArray(json?.popups) ? json.popups : [];
      setPopups(next);
      setSelectedId(next[0]?.id || '');
    } catch (error: any) {
      Alert.alert('Website popup', error?.message || 'Could not load popups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (partial: Partial<PopupConfig>) => {
    if (!selected) return;
    setPopups((prev) => prev.map((popup) => (popup.id === selected.id ? { ...popup, ...partial } : popup)));
  };

  const move = (direction: -1 | 1) => {
    if (!selected) return;
    setPopups((prev) => {
      const index = prev.findIndex((popup) => popup.id === selected.id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(nextIndex, 0, row);
      return next;
    });
  };

  const uploadImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos', 'Allow photo library access to upload a banner.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const name = asset.uri.split('/').pop() || 'popup.jpg';
      const ext = name.split('.').pop()?.toLowerCase() || 'jpg';
      const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const body = new FormData();
      body.append('file', { uri: asset.uri, name, type } as any);
      const json = await apiUpload<any>('/api/super_admin/website-popup/upload', body);
      if (!json?.url) throw new Error('Upload failed');
      patch({ image_url: json.url });
      Alert.alert('Banner', json.cropped ? `Uploaded and cropped to ${IMAGE_SIZE}` : `Uploaded ${IMAGE_SIZE}`);
    } catch (error: any) {
      Alert.alert('Banner', error?.message || 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const json = await apiFetch<any>('/api/super_admin/website-popup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popups }),
      });
      const next = Array.isArray(json?.popups) ? json.popups : popups;
      setPopups(next);
      if (!next.some((popup: PopupConfig) => popup.id === selectedId)) setSelectedId(next[0]?.id || '');
      Alert.alert('Website popup', 'Saved');
    } catch (error: any) {
      Alert.alert('Website popup', error?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const colors = selected?.colors || {};

  return (
    <View style={styles.screen}>
      <DashboardHeader title="Website Popup" onBack={() => navigation?.goBack?.()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {popups.map((popup) => (
              <TouchableOpacity
                key={popup.id}
                onPress={() => setSelectedId(popup.id)}
                style={[styles.tab, popup.id === selected?.id && styles.tabOn]}
              >
                <Text style={[styles.tabText, popup.id === selected?.id && styles.tabTextOn]} numberOfLines={1}>
                  {popup.enabled ? 'ON · ' : 'OFF · '}
                  {popup.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => { const next = newPopup(); setPopups((prev) => [...prev, next]); setSelectedId(next.id); }}>
              <Text style={styles.actionText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => move(-1)}><Text style={styles.actionText}>Up</Text></TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => move(1)}><Text style={styles.actionText}>Down</Text></TouchableOpacity>
            <TouchableOpacity
              style={styles.action}
              onPress={() => {
                if (!selected || popups.length < 2) {
                  Alert.alert('Website popup', 'Keep at least one popup');
                  return;
                }
                const remaining = popups.filter((popup) => popup.id !== selected.id);
                setPopups(remaining);
                setSelectedId(remaining[0]?.id || '');
              }}
            >
              <Text style={[styles.actionText, { color: '#B91C1C' }]}>Delete</Text>
            </TouchableOpacity>
          </View>

          {selected ? (
            <>
              <View style={[styles.preview, { backgroundColor: colors.card || '#fff8ef', borderColor: colors.ring || '#e7c27a' }]}>
                {selected.image_url ? <Image source={{ uri: imageSrc(selected.image_url) }} style={styles.previewImage} /> : null}
                <Text style={[styles.previewHeadline, { color: colors.headline || '#5c1020' }]}>{selected.headline}</Text>
                {selected.subtitle ? <Text style={{ color: colors.subtitle || '#c2410c', textAlign: 'center', marginTop: 4 }}>{selected.subtitle}</Text> : null}
                {selected.coupon_code ? (
                  <View style={styles.ticket}>
                    <Text style={[styles.ticketCode, { backgroundColor: colors.code_bg || '#6b1224', color: colors.code_text || '#ffe14a' }]}>{selected.coupon_code}</Text>
                    {selected.offer_label ? (
                      <Text style={[styles.ticketOffer, { backgroundColor: colors.offer_bg || '#ffd000', color: colors.offer_text || '#7a1020' }]}>{selected.offer_label}</Text>
                    ) : null}
                  </View>
                ) : null}
                <View style={[styles.previewButton, { backgroundColor: colors.button_bg || '#6b1224' }]}>
                  <Text style={{ color: colors.button_text || '#ffe14a', fontWeight: '800' }}>{selected.button_text}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <Text style={styles.label}>Popup on</Text>
                <Switch value={!!selected.enabled} onValueChange={(enabled) => patch({ enabled })} />
              </View>

              <Text style={styles.section}>Show on these pages</Text>
              <Text style={styles.hint}>Higher popup in the list is the one visitors see if two match the same page.</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setPagesOpen((open) => !open)}>
                <Text style={styles.dropdownText} numberOfLines={1}>
                  {PAGE_OPTIONS.filter((page) => selected.pages?.includes(page.id)).map((page) => page.label).join(', ') || 'Select pages'}
                </Text>
                <Text style={styles.dropdownCaret}>{pagesOpen ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {pagesOpen ? (
                <View style={styles.menu}>
                  {PAGE_OPTIONS.map((page) => {
                    const on = selected.pages?.includes(page.id);
                    return (
                      <TouchableOpacity
                        key={page.id}
                        style={styles.menuRow}
                        onPress={() => {
                          const pages = on ? selected.pages.filter((id) => id !== page.id) : [...(selected.pages || []), page.id];
                          patch({ pages });
                        }}
                      >
                        <Text style={styles.menuMark}>{on ? '✓' : ''}</Text>
                        <Text style={styles.menuLabel}>{page.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              <Text style={styles.section}>Button page</Text>
              <TouchableOpacity style={styles.dropdown} onPress={() => setButtonOpen((open) => !open)}>
                <Text style={styles.dropdownText} numberOfLines={1}>
                  {BUTTON_PAGES.find((page) => page.href === selected.button_href)?.label || selected.button_href || 'Select page'}
                </Text>
                <Text style={styles.dropdownCaret}>{buttonOpen ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {buttonOpen ? (
                <View style={styles.menu}>
                  {BUTTON_PAGES.map((page) => (
                    <TouchableOpacity
                      key={page.href}
                      style={styles.menuRow}
                      onPress={() => {
                        patch({ button_href: page.href });
                        setButtonOpen(false);
                      }}
                    >
                      <Text style={styles.menuMark}>{selected.button_href === page.href ? '✓' : ''}</Text>
                      <Text style={styles.menuLabel}>{page.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {TEXT_FIELDS.map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    value={String((selected as any)[field.key] ?? '')}
                    onChangeText={(value) =>
                      patch({ [field.key]: field.key === 'max_views' ? Number(value.replace(/\D/g, '') || 0) : value } as Partial<PopupConfig>)
                    }
                    style={styles.input}
                    autoCapitalize={field.key === 'coupon_code' ? 'characters' : 'sentences'}
                  />
                </View>
              ))}

              <Text style={styles.section}>Banner image</Text>
              <Text style={styles.hint}>Size {IMAGE_SIZE}. Other photos are center-cropped to 1600 × 800.</Text>
              {selected.image_url ? <Image source={{ uri: imageSrc(selected.image_url) }} style={styles.banner} /> : null}
              <View style={styles.actions}>
                <TouchableOpacity style={styles.action} onPress={uploadImage} disabled={uploading}>
                  <Text style={styles.actionText}>{uploading ? 'Uploading…' : 'Upload image'}</Text>
                </TouchableOpacity>
                {selected.image_url ? (
                  <TouchableOpacity style={styles.action} onPress={() => patch({ image_url: '' })}>
                    <Text style={styles.actionText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.section}>Colors</Text>
              {COLOR_FIELDS.map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <View style={styles.colorRow}>
                    <View style={[styles.swatch, { backgroundColor: colors[field.key] || '#ffffff' }]} />
                    <TextInput
                      value={String(colors[field.key] || '')}
                      onChangeText={(value) => patch({ colors: { ...colors, [field.key]: value } })}
                      style={[styles.input, { flex: 1 }]}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.save} onPress={save} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.save} onPress={() => { const next = newPopup(); setPopups([next]); setSelectedId(next.id); }}>
              <Text style={styles.saveText}>Add popup</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { padding: SPACING.md, paddingBottom: 48 },
  tabs: { gap: 8, paddingBottom: 12 },
  tab: { maxWidth: 180, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8 },
  tabOn: { borderColor: '#6B1224', backgroundColor: '#FFF7EA' },
  tabText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  tabTextOn: { color: '#6B1224' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  action: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontWeight: '700', color: '#0F172A', fontSize: 13 },
  preview: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
  previewImage: { width: '100%', height: 120, borderRadius: 12, marginBottom: 10 },
  previewHeadline: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  ticket: { flexDirection: 'row', marginTop: 10, borderRadius: 12, overflow: 'hidden' },
  ticketCode: { flex: 1, textAlign: 'center', paddingVertical: 10, fontWeight: '800', overflow: 'hidden' },
  ticketOffer: { width: '42%', textAlign: 'center', paddingVertical: 10, fontWeight: '800', overflow: 'hidden' },
  previewButton: { marginTop: 12, borderRadius: 12, alignItems: 'center', paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  section: { marginTop: 8, marginBottom: 6, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  hint: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  dropdownText: { flex: 1, color: '#0F172A', fontSize: 15 },
  dropdownCaret: { color: '#64748B', marginLeft: 8, fontSize: 12 },
  menu: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, marginBottom: 12, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  menuMark: { width: 18, color: '#6B1224', fontWeight: '800' },
  menuLabel: { color: '#0F172A', fontSize: 15 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#0F172A' },
  banner: { width: '100%', height: 140, borderRadius: 12, marginBottom: 8 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  save: { marginTop: 8, backgroundColor: '#6B1224', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#FFE14A', fontWeight: '800', fontSize: 16 },
});
