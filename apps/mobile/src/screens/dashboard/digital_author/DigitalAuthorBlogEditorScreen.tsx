import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

function slugify(text: string) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function DigitalAuthorBlogEditorScreen({ navigation }: any) {
  const route = useRoute<any>();
  const blogId = route?.params?.blogId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    meta_description: '',
  });

  useEffect(() => {
    if (blogId) {
      fetchBlog(blogId);
    }
  }, [blogId]);

  async function fetchBlog(id: string) {
    setLoading(true);
    try {
      const data = await apiFetch<{ blog: any }>(`/api/blogs/${id}`);
      const blog = data.blog;
      setForm({
        title: blog.title || '',
        slug: blog.slug || '',
        excerpt: blog.excerpt || '',
        content: blog.content || '',
        meta_description: blog.seo_data?.meta_description || '',
      });
    } catch (e) {
      console.error('Failed to load blog', e);
    } finally {
      setLoading(false);
    }
  }

  async function saveBlog() {
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt || null,
        content: form.content,
        status: 'draft',
        seo_data: {
          meta_description: form.meta_description || null,
        },
      };
      if (!payload.title || !payload.slug || !payload.content) return;

      if (blogId) {
        await apiFetch(`/api/blogs/${blogId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/blogs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      navigation.goBack();
    } catch (e) {
      console.error('Failed to save blog', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title={blogId ? 'Edit Blog' : 'Create Blog'} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.body}>
        {loading ? <Text style={styles.loadingText}>Loading...</Text> : null}
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={form.title} onChangeText={(v) => setForm((p) => ({ ...p, title: v, slug: p.slug || slugify(v) }))} />
        <Text style={styles.label}>Slug</Text>
        <TextInput style={styles.input} value={form.slug} onChangeText={(v) => setForm((p) => ({ ...p, slug: v }))} />
        <Text style={styles.label}>Excerpt</Text>
        <TextInput style={styles.input} value={form.excerpt} onChangeText={(v) => setForm((p) => ({ ...p, excerpt: v }))} />
        <Text style={styles.label}>Meta Description</Text>
        <TextInput style={styles.input} value={form.meta_description} onChangeText={(v) => setForm((p) => ({ ...p, meta_description: v }))} />
        <Text style={styles.label}>Content (HTML allowed)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.content}
          onChangeText={(v) => setForm((p) => ({ ...p, content: v }))}
          multiline
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={saveBlog} disabled={saving}>
          <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: SPACING.md },
  label: { marginTop: SPACING.sm, color: COLORS.textSecondary, fontSize: 12 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SPACING.sm, marginTop: 4, backgroundColor: COLORS.white, color: COLORS.text },
  textArea: { minHeight: 160, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginTop: SPACING.md },
  primaryText: { color: COLORS.white, textAlign: 'center', fontWeight: '600' },
  loadingText: { color: COLORS.textSecondary, marginBottom: SPACING.sm },
});
