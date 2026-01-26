import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';

type Blog = {
  id: string;
  title: string;
  slug: string;
  status: string;
  created_at: string;
};

export default function DigitalAuthorBlogsScreen({ navigation }: any) {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBlogs();
  }, []);

  async function fetchBlogs() {
    setLoading(true);
    try {
      const res = await apiFetch<{ blogs: Blog[] }>(`/api/blogs?status=draft&limit=50&page=1`);
      setBlogs(res.blogs || []);
    } catch (e) {
      console.error('Failed to load blogs', e);
    } finally {
      setLoading(false);
    }
  }

  const renderItem = ({ item }: { item: Blog }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('DigitalAuthorBlogEditor', { blogId: item.id })}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>Slug: {item.slug}</Text>
      <Text style={styles.cardMeta}>Status: {item.status}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <DashboardHeader title="My Blogs" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('DigitalAuthorBlogEditor')}>
          <Text style={styles.primaryText}>Create Blog</Text>
        </TouchableOpacity>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={blogs}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, padding: SPACING.md },
  primaryBtn: { backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: 8, marginBottom: SPACING.sm },
  primaryText: { color: COLORS.white, fontWeight: '600', textAlign: 'center' },
  list: { paddingVertical: SPACING.sm },
  card: { backgroundColor: COLORS.white, padding: SPACING.md, borderRadius: 8, marginBottom: SPACING.sm },
  cardTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading },
  cardMeta: { fontSize: SIZES.sm, color: COLORS.textSecondary, marginTop: 4 },
  loading: { alignItems: 'center', marginTop: SPACING.lg },
  loadingText: { marginTop: SPACING.sm, color: COLORS.textSecondary },
});
