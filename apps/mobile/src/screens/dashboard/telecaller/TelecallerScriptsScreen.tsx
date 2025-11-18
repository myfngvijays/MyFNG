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
  Clipboard,
  Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

export default function TelecallerScriptsScreen() {
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedScript, setExpandedScript] = useState<string | null>(null);

  const categories = [
    { value: 'all', label: 'All', icon: 'view-grid' },
    { value: 'GREETING', label: 'Greeting', icon: 'hand-wave' },
    { value: 'INFORMATION_GATHERING', label: 'Info Gathering', icon: 'clipboard-text' },
    { value: 'CLOSING', label: 'Closing', icon: 'check-circle' },
    { value: 'FOLLOW_UP', label: 'Follow-up', icon: 'phone-forward' },
    { value: 'OBJECTION_HANDLING', label: 'Objections', icon: 'shield-alert' }
  ];

  useEffect(() => {
    fetchScripts();
  }, [selectedCategory, searchQuery]);

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
      setScripts(data || []);

    } catch (error) {
      console.error('Error fetching scripts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchScripts();
  };

  const handleCopyScript = (content: string, title: string) => {
    Clipboard.setString(content);
    Alert.alert('Copied!', `"${title}" copied to clipboard`);
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
      default: return COLORS.gray;
    }
  };

  const renderScript = (script: any) => {
    const isExpanded = expandedScript === script.id;
    const previewLength = 80;
    const shouldTruncate = script.script_content.length > previewLength;

    return (
      <TouchableOpacity
        key={script.id}
        style={styles.scriptCard}
        onPress={() => toggleExpand(script.id)}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.scriptHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.scriptTitle}>{script.script_title}</Text>
              {script.language === 'hi' && (
                <View style={styles.languageBadge}>
                  <Text style={styles.languageText}>हिंदी</Text>
                </View>
              )}
            </View>
            <View style={styles.tagsRow}>
              <View style={[
                styles.typeBadge,
                { backgroundColor: getScriptTypeColor(script.script_type) + '20' }
              ]}>
                <Text style={[
                  styles.typeText,
                  { color: getScriptTypeColor(script.script_type) }
                ]}>
                  {script.script_type}
                </Text>
              </View>
              {script.category && (
                <View style={styles.categoryBadge}>
                  <MaterialCommunityIcons
                    name={getCategoryIcon(script.category)}
                    size={12}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.categoryText}>{script.category}</Text>
                </View>
              )}
            </View>
          </View>
          <MaterialCommunityIcons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={COLORS.textSecondary}
          />
        </View>

        {/* Content */}
        <View style={styles.scriptContent}>
          <Text style={styles.scriptText}>
            {isExpanded || !shouldTruncate
              ? script.script_content
              : script.script_content.substring(0, previewLength) + '...'}
          </Text>
        </View>

        {/* Actions */}
        {isExpanded && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleCopyScript(script.script_content, script.script_title)}
            >
              <MaterialCommunityIcons name="content-copy" size={18} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>Copy Script</Text>
            </TouchableOpacity>
          </View>
        )}
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
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search scripts..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <View style={styles.categoriesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.value}
              style={[
                styles.categoryTab,
                selectedCategory === category.value && styles.categoryTabActive
              ]}
              onPress={() => setSelectedCategory(category.value)}
            >
              <MaterialCommunityIcons
                name={category.icon as any}
                size={18}
                color={selectedCategory === category.value ? '#fff' : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === category.value && styles.categoryTabTextActive
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Quick Info */}
      <View style={styles.infoCard}>
        <MaterialCommunityIcons name="information" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Tap any script to expand and copy. Use these scripts as a guide during calls.
        </Text>
      </View>

      {/* Scripts List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {scripts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="script-text-outline" size={64} color={COLORS.gray} />
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
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsText}>
                {scripts.length} script{scripts.length !== 1 ? 's' : ''} found
              </Text>
            </View>
            {scripts.map(renderScript)}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function getCategoryIcon(category: string): string {
  switch (category) {
    case 'GREETING': return 'hand-wave';
    case 'INFORMATION_GATHERING': return 'clipboard-text';
    case 'CLOSING': return 'check-circle';
    case 'FOLLOW_UP': return 'phone-forward';
    case 'OBJECTION_HANDLING': return 'shield-alert';
    default: return 'script-text';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    elevation: 2,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginRight: SPACING.sm,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
  },
  categoryTabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#fff',
    fontWeight: 'bold',
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
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 12,
    padding: SPACING.md,
    elevation: 2,
  },
  scriptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  scriptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 1,
  },
  languageBadge: {
    backgroundColor: COLORS.orange + '20',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  languageText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.orange,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.gray + '20',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  scriptContent: {
    marginBottom: SPACING.sm,
  },
  scriptText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  actionsContainer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '20',
    paddingTop: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary + '10',
    borderRadius: 8,
    gap: SPACING.xs,
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

