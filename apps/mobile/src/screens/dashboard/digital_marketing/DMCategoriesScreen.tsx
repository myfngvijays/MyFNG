import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: number;
};

export default function DMCategoriesScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<BlogCategory[]>([]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<any>('/api/blogs/categories?manage=1');
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? categories.filter((c) => `${c.name} ${c.slug} ${c.description || ''}`.toLowerCase().includes(q))
    : categories;

  return (
    <View style={styles.container}>
      <DashboardHeader title="Blog Categories" onBack={() => navigation.goBack()} />
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search categories…"
          placeholderTextColor={COLORS.textSecondary}
          style={styles.search}
        />
      </View>
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />
          }
        >
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No categories found</Text>
          ) : (
            filtered.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.badge}>{c.status === 1 ? 'Active' : 'Inactive'}</Text>
                </View>
                <Text style={styles.name} numberOfLines={2}>
                  {c.name}
                </Text>
                <Text style={styles.slug} numberOfLines={1}>
                  /{c.slug}
                </Text>
                {c.description ? (
                  <Text style={styles.desc} numberOfLines={2}>
                    {c.description}
                  </Text>
                ) : null}
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
  searchWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  search: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
    gap: 10,
  },
  card: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 12,
    minHeight: 120,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  badge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    backgroundColor: '#ECFDF5',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  name: { marginTop: 8, fontSize: 15, fontWeight: '800', color: '#023D95' },
  slug: { marginTop: 4, fontSize: 11, fontFamily: 'Courier', color: COLORS.textSecondary },
  desc: { marginTop: 6, fontSize: 12, color: COLORS.textSecondary },
  empty: { width: '100%', textAlign: 'center', color: COLORS.textSecondary, marginTop: 40 },
});
