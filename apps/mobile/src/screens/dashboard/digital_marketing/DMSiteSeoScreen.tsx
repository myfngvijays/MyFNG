import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../../../components/DashboardHeader';
import BottomNav from '../../../components/BottomNav';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type SeoTab = 'overview' | 'pages' | 'workshops' | 'blogs';

type SeoMissing = { label: string; fix: string };
type PageRow = {
  id: string;
  page_path: string;
  page_label: string;
  title: string;
  description: string;
  keywords?: string;
  noindex?: boolean;
  active?: boolean;
  seo_score?: number;
  seo_missing?: SeoMissing[];
};

type WorkshopRow = { slug: string; title?: string; name?: string; city?: string; preview_href?: string };
type BlogFaq = { question: string; answer: string };
type BlogRow = {
  id: string;
  slug: string;
  title?: string;
  description?: string;
  keywords?: string;
  keyphrase?: string;
  local_city?: string;
  robots_index?: boolean;
  schema_blogposting?: boolean;
  schema_faq?: boolean;
  eligible_ai_overview?: boolean;
  faqs?: BlogFaq[];
  status?: string;
  preview_href?: string;
  seo_score?: number;
  seo_missing?: SeoMissing[];
};

const TABS: Array<{ id: SeoTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'pages', label: 'Pages' },
  { id: 'workshops', label: 'Workshops' },
  { id: 'blogs', label: 'Blogs' },
];

export default function DMSiteSeoScreen() {
  const navigation = useNavigation();
  const [tab, setTab] = useState<SeoTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState<any>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [selected, setSelected] = useState<PageRow | null>(null);
  const [selectedBlog, setSelectedBlog] = useState<BlogRow | null>(null);

  const load = useCallback(async () => {
    try {
      setError('');
      const [overviewRes, pagesRes, workshopRes, blogRes] = await Promise.all([
        apiFetch<any>('/api/super_admin/site-seo/overview'),
        apiFetch<any>('/api/super_admin/site-seo'),
        apiFetch<any>('/api/super_admin/site-seo/workshops'),
        apiFetch<any>('/api/super_admin/site-seo/blogs'),
      ]);
      setOverview(overviewRes?.data || overviewRes || null);
      setPages(Array.isArray(pagesRes?.data) ? pagesRes.data : []);
      setWorkshops(Array.isArray(workshopRes?.data) ? workshopRes.data : []);
      setBlogs(Array.isArray(blogRes?.data) ? blogRes.data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load on-page SEO');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filteredPages = useMemo(
    () =>
      q
        ? pages.filter((p) => `${p.page_label} ${p.page_path} ${p.title}`.toLowerCase().includes(q))
        : pages,
    [pages, q],
  );

  const handleNavigation = (screen: string) => {
    if (screen === 'DMSiteSeo') return;
    navigation.navigate(screen as never);
  };

  const saveBlog = async () => {
    if (!selectedBlog?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/super_admin/site-seo/blogs/${selectedBlog.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: selectedBlog.slug,
          title: selectedBlog.title,
          description: selectedBlog.description,
          keywords: selectedBlog.keywords || '',
          keyphrase: selectedBlog.keyphrase || '',
          local_city: selectedBlog.local_city || '',
          robots_index: selectedBlog.robots_index !== false,
          schema_blogposting: selectedBlog.schema_blogposting !== false,
          schema_faq: selectedBlog.schema_faq !== false,
          eligible_ai_overview: selectedBlog.eligible_ai_overview !== false,
          faqs: selectedBlog.faqs || [],
        }),
      });
      setBlogs((prev) => prev.map((b) => (b.id === selectedBlog.id ? selectedBlog : b)));
      setSelectedBlog(null);
      Alert.alert('Saved', 'Blog SEO updated');
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const savePage = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await apiFetch(`/api/super_admin/site-seo/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selected.title,
          description: selected.description,
          keywords: selected.keywords || '',
        }),
      });
      setPages((prev) => prev.map((p) => (p.id === selected.id ? selected : p)));
      setSelected(null);
      Alert.alert('Saved', 'On-page SEO updated');
    } catch (e: unknown) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const counts = overview?.counts || {};
  const issues: Array<{ message: string }> = Array.isArray(overview?.issues) ? overview.issues : [];

  const tabs = [
    { id: 'dashboard', label: 'Home', icon: 'home' },
    { id: 'DMContent', label: 'Blogs', icon: 'document' },
    { id: 'DMSiteSeo', label: 'SEO', icon: 'search' },
    { id: 'DMCategories', label: 'Categories', icon: 'tag' },
    { id: 'DMProfile', label: 'Profile', icon: 'account' },
  ];

  return (
    <View style={styles.container}>
      <DashboardHeader title="On-page SEO" onBack={() => navigation.goBack()} />
      <View style={styles.tabRow}>
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.tab, tab === item.id && styles.tabActive]}
            onPress={() => setTab(item.id)}
          >
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
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
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {tab === 'overview' ? (
            <>
              <View style={styles.chipGrid}>
                {[
                  ['Score', `${overview?.health_score ?? '—'}%`],
                  ['Pages avg', `${overview?.page_avg ?? '—'}`],
                  ['Blogs avg', `${overview?.blog_avg ?? '—'}`],
                  ['Blogs', String(counts.blogs_total ?? blogs.length)],
                ].map(([label, value]) => (
                  <View key={label} style={styles.chip}>
                    <Text style={styles.chipLabel}>{label}</Text>
                    <Text style={styles.chipValue}>{value}</Text>
                  </View>
                ))}
              </View>
              {issues.length ? (
                issues.slice(0, 8).map((issue) => (
                  <Text key={issue.message} style={styles.issue}>
                    {issue.message}
                  </Text>
                ))
              ) : (
                <Text style={styles.empty}>No SEO issues flagged</Text>
              )}
            </>
          ) : null}

          {tab === 'pages' ? (
            <>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search pages…"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.search}
              />
              {selected ? (
                <View style={styles.editor}>
                  <Text style={styles.editorTitle}>{selected.page_label || selected.page_path}</Text>
                  <Text style={styles.path}>{selected.page_path}</Text>
                  <Text style={styles.scoreLine}>SEO score {selected.seo_score ?? '—'}</Text>
                  {(selected.seo_missing || []).slice(0, 6).map((item) => (
                    <Text key={item.label} style={styles.missing}>
                      • {item.fix || item.label}
                    </Text>
                  ))}
                  <TextInput
                    value={selected.title}
                    onChangeText={(title) => setSelected({ ...selected, title })}
                    style={styles.input}
                    placeholder="Meta title"
                  />
                  <TextInput
                    value={selected.description}
                    onChangeText={(description) => setSelected({ ...selected, description })}
                    style={[styles.input, styles.textarea]}
                    placeholder="Meta description"
                    multiline
                  />
                  <View style={styles.editorActions}>
                    <TouchableOpacity style={styles.secondary} onPress={() => setSelected(null)}>
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primary} onPress={savePage} disabled={saving}>
                      <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              {filteredPages.map((page) => (
                <TouchableOpacity key={page.id} style={styles.row} onPress={() => setSelected(page)}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {page.page_label || page.page_path}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    Score {page.seo_score ?? '—'} · {page.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          {tab === 'workshops'
            ? workshops.slice(0, 40).map((w) => (
                <View key={w.slug} style={styles.row}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {w.title || w.name || w.slug}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {w.city || w.preview_href || w.slug}
                  </Text>
                </View>
              ))
            : null}

          {tab === 'blogs' ? (
            <>
              {selectedBlog ? (
                <View style={styles.editor}>
                  <Text style={styles.editorTitle}>{selectedBlog.title || selectedBlog.slug}</Text>
                  <Text style={styles.path}>{`/blogs/${selectedBlog.slug}`}</Text>
                  <Text style={styles.scoreLine}>SEO score {selectedBlog.seo_score ?? '—'}</Text>
                  {(selectedBlog.seo_missing || []).slice(0, 6).map((item) => (
                    <Text key={item.label} style={styles.missing}>
                      • {item.fix || item.label}
                    </Text>
                  ))}
                  <TextInput
                    value={selectedBlog.slug}
                    onChangeText={(slug) => setSelectedBlog({ ...selectedBlog, slug, preview_href: `/blogs/${slug}` })}
                    style={styles.input}
                    placeholder="URL slug"
                    autoCapitalize="none"
                  />
                  <TextInput
                    value={selectedBlog.title || ''}
                    onChangeText={(title) => setSelectedBlog({ ...selectedBlog, title })}
                    style={styles.input}
                    placeholder="Meta title"
                  />
                  <TextInput
                    value={selectedBlog.description || ''}
                    onChangeText={(description) => setSelectedBlog({ ...selectedBlog, description })}
                    style={[styles.input, styles.textarea]}
                    placeholder="Meta description"
                    multiline
                  />
                  <TextInput
                    value={selectedBlog.keywords || ''}
                    onChangeText={(keywords) => setSelectedBlog({ ...selectedBlog, keywords })}
                    style={styles.input}
                    placeholder="Keywords"
                  />
                  <TextInput
                    value={selectedBlog.local_city || ''}
                    onChangeText={(local_city) => setSelectedBlog({ ...selectedBlog, local_city })}
                    style={styles.input}
                    placeholder="Target city"
                  />
                  <Text style={styles.schemaLabel}>Schema builder</Text>
                  {(selectedBlog.faqs || []).map((faq, idx) => (
                    <View key={`faq-${idx}`} style={styles.faqCard}>
                      <TextInput
                        value={faq.question}
                        onChangeText={(question) => {
                          const faqs = [...(selectedBlog.faqs || [])];
                          faqs[idx] = { ...faqs[idx], question };
                          setSelectedBlog({ ...selectedBlog, faqs, schema_faq: true });
                        }}
                        style={styles.input}
                        placeholder={`FAQ ${idx + 1} question`}
                      />
                      <TextInput
                        value={faq.answer}
                        onChangeText={(answer) => {
                          const faqs = [...(selectedBlog.faqs || [])];
                          faqs[idx] = { ...faqs[idx], answer };
                          setSelectedBlog({ ...selectedBlog, faqs, schema_faq: true });
                        }}
                        style={[styles.input, styles.textarea]}
                        placeholder="Answer"
                        multiline
                      />
                      <TouchableOpacity
                        onPress={() =>
                          setSelectedBlog({
                            ...selectedBlog,
                            faqs: (selectedBlog.faqs || []).filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <Text style={styles.removeFaq}>Remove FAQ</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.secondary}
                    onPress={() =>
                      setSelectedBlog({
                        ...selectedBlog,
                        schema_faq: true,
                        faqs: [...(selectedBlog.faqs || []), { question: '', answer: '' }],
                      })
                    }
                  >
                    <Text style={styles.secondaryText}>Add FAQ</Text>
                  </TouchableOpacity>
                  <View style={styles.editorActions}>
                    <TouchableOpacity style={styles.secondary} onPress={() => setSelectedBlog(null)}>
                      <Text style={styles.secondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primary} onPress={saveBlog} disabled={saving}>
                      <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              {blogs
                .filter((b) =>
                  q ? `${b.title || ''} ${b.slug} ${b.keywords || ''}`.toLowerCase().includes(q) : true,
                )
                .slice(0, 60)
                .map((b) => (
                  <TouchableOpacity key={b.id || b.slug} style={styles.row} onPress={() => setSelectedBlog(b)}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {b.title || b.slug}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      Score {b.seo_score ?? '—'} · {b.preview_href || `/blogs/${b.slug}`}
                    </Text>
                  </TouchableOpacity>
                ))}
            </>
          ) : null}
        </ScrollView>
      )}

      <BottomNav activeTab="DMSiteSeo" onTabChange={handleNavigation} tabs={tabs} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabRow: { flexDirection: 'row', paddingHorizontal: SPACING.md, gap: 6, paddingBottom: 8 },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: COLORS.white },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  tabTextActive: { color: COLORS.white },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  body: { paddingHorizontal: SPACING.md, paddingBottom: 24 },
  error: { color: COLORS.danger, marginBottom: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipLabel: { fontSize: 11, color: COLORS.textSecondary },
  chipValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  issue: { fontSize: 12, color: COLORS.textSecondary, paddingVertical: 4 },
  empty: { fontSize: 12, color: COLORS.textSecondary, paddingVertical: 8 },
  search: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    color: COLORS.textPrimary,
  },
  editor: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  editorTitle: { fontSize: 14, fontWeight: '800', color: COLORS.heading },
  path: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 },
  scoreLine: { fontSize: 12, fontWeight: '800', color: COLORS.primary, marginBottom: 6 },
  missing: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 3 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    marginBottom: 8,
    color: COLORS.textPrimary,
  },
  textarea: { minHeight: 72, textAlignVertical: 'top' },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  primary: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  primaryText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  secondary: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  secondaryText: { color: COLORS.heading, fontWeight: '700', fontSize: 12 },
  schemaLabel: { fontSize: 12, fontWeight: '800', color: COLORS.heading, marginBottom: 6, marginTop: 4 },
  faqCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    backgroundColor: COLORS.background,
  },
  removeFaq: { color: COLORS.danger, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  row: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  rowMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
