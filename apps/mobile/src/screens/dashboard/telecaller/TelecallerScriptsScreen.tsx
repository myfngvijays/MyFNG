import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  BackHandler
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';
import { callScriptDisplayTitle, withMyfngCallScripts } from '../../../../../../shared/constants/myfngCallScripts';

export default function TelecallerScriptsScreen({ navigation, embedded = false }: any) {
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [language, setLanguage] = useState<'hi' | 'en'>('hi');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  const categories = [
    { value: 'all', label: 'All' },
    { value: 'GREETING', label: 'Open' },
    { value: 'INFORMATION_GATHERING', label: 'Pitch' },
    { value: 'CLOSING', label: 'Close' },
    { value: 'FOLLOW_UP', label: 'Follow-up' },
    { value: 'OBJECTION_HANDLING', label: 'Objections' },
  ];

  useEffect(() => {
    fetchScripts();
  }, [selectedCategory, searchQuery, language]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const fetchScripts = async () => {
    try {
      let query = supabase
        .from('telecaller_scripts')
        .select('*')
        .eq('is_active', true)
        .order('script_type', { ascending: true });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      if (searchQuery) {
        query = query.or(`script_title.ilike.%${searchQuery}%,script_content.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setScripts(filterVisibleScripts(data || []));

    } catch (error) {
      console.error('Error fetching scripts:', error);
      setScripts(filterVisibleScripts([]));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterVisibleScripts = (rows: any[]) => {
    const q = searchQuery.trim().toLowerCase();
    return withMyfngCallScripts(rows).filter((script) => {
      if (script.language && script.language !== language) return false;
      if (selectedCategory !== 'all' && script.category !== selectedCategory) return false;
      if (!q) return true;
      const title = String(script.script_title || '').toLowerCase();
      const body = String(script.script_content || '').toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchScripts();
  };

  const handleCopyScript = async (content: string, title: string) => {
    try {
      await Clipboard.setStringAsync(content);
      Alert.alert('Copied!', `"${title}" copied to clipboard`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy script');
    }
  };

  const toggleExpand = (scriptId: string) => {
    setExpandedScript(expandedScript === scriptId ? null : scriptId);
  };

  const getScriptTypeColor = (type: string) => {
    switch (type) {
      case 'OPENING': return COLORS.blue;
      case 'PICKUP_CONFIRMATION': return COLORS.purple;
      case 'SLOT_SUGGESTION': return COLORS.teal;
      case 'CLOSING': return COLORS.green;
      case 'FOLLOW_UP': return COLORS.orange;
      case 'REJECTION_HANDLING': return COLORS.red;
      default: return COLORS.gray[500];
    }
  };

  const renderScript = (script: any) => {
    const isExpanded = expandedScript === script.id;
    const accent = getScriptTypeColor(script.script_type);

    return (
      <TouchableOpacity
        key={script.id}
        style={[styles.scriptCard, { borderLeftColor: accent }]}
        onPress={() => toggleExpand(script.id)}
        activeOpacity={0.75}
      >
        <View style={styles.scriptHeader}>
          <Text style={styles.scriptTitle} numberOfLines={1}>
            {callScriptDisplayTitle(script.script_title)}
          </Text>
          <Icon
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={COLORS.textSecondary}
          />
        </View>

        <Text style={styles.scriptText} numberOfLines={isExpanded ? undefined : 2}>
          {script.script_content}
        </Text>

        {isExpanded ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleCopyScript(script.script_content, callScriptDisplayTitle(script.script_title))}
          >
            <Icon name="content-copy" size={16} color={COLORS.primary} />
            <Text style={styles.actionButtonText}>Copy</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading scripts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Back Button — skipped when embedded in CRM Engage tab */}
      {!embedded ? (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation?.goBack()}
          >
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Call Scripts</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#94A3B8"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.langTrack}>
          {([
            { id: 'hi' as const, label: 'हिंदी' },
            { id: 'en' as const, label: 'EN' },
          ]).map((item) => {
            const active = language === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.langOption, active && styles.langOptionActive]}
                onPress={() => setLanguage(item.id)}
                activeOpacity={0.85}
              >
                <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => {
          const active = selectedCategory === category.value;
          return (
            <TouchableOpacity
              key={category.value}
              style={styles.categoryTab}
              onPress={() => setSelectedCategory(category.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryTabText, active && styles.categoryTabTextActive]}>
                {category.label}
              </Text>
              <View style={[styles.categoryMark, active && styles.categoryMarkActive]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Scripts List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: embedded ? 100 : 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {scripts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="script-text-outline" size={64} color={COLORS.gray[500]} />
            <Text style={styles.emptyTitle}>No Scripts Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? `No scripts match "${searchQuery}"`
                : selectedCategory !== 'all'
                ? `No scripts in ${selectedCategory} category`
                : 'No call scripts available'}
            </Text>
          </View>
        ) : (
          <>
            {scripts.map(renderScript)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F2744',
    paddingVertical: 0,
  },
  langTrack: {
    flexDirection: 'row',
    backgroundColor: '#004AAD',
    borderRadius: 10,
    padding: 3,
  },
  langOption: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langOptionActive: {
    backgroundColor: '#FFFFFF',
  },
  langOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
  },
  langOptionTextActive: {
    color: '#004AAD',
  },
  categoriesContainer: {
    flexGrow: 0,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EDF8',
  },
  categoriesContent: {
    paddingHorizontal: 14,
    gap: 4,
  },
  categoryTab: {
    alignItems: 'stretch',
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  categoryTabText: {
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#94A3B8',
    fontWeight: '600',
  },
  categoryTabTextActive: {
    color: '#004AAD',
    fontWeight: '800',
  },
  categoryMark: {
    marginTop: 8,
    height: 2,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  categoryMarkActive: {
    backgroundColor: '#004AAD',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  resultsHeader: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  resultsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  scriptCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E6EDF8',
    borderLeftWidth: 3,
  },
  scriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scriptTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F2744',
  },
  languageBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  languageText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  languageBadgeEn: {
    backgroundColor: '#E8EEF8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  languageTextEn: {
    fontSize: 10,
    fontWeight: '800',
    color: '#004AAD',
  },
  scriptText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  actionButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#E8F0FE',
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
});

