import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ENV } from '../config/environment';
import { COLORS } from '../constants/theme';

type Props = {
  label?: string;
  displayValue: string;
  selectedMake?: string;
  selectedModel?: string;
  onSelect: (
    make: string,
    model: string,
    display: string,
    meta?: { id?: string; variant?: string; class?: string },
  ) => void;
  onClear: () => void;
  placeholder?: string;
  variant?: 'default' | 'premium' | 'website';
};

export default function CarModelSearchField({
  label,
  displayValue,
  selectedMake,
  selectedModel,
  onSelect,
  onClear,
  placeholder = 'Enter Model (e.g. Swift, City, Creta)',
  variant = 'default',
}: Props) {
  const premium = variant === 'premium';
  const website = variant === 'website';
  const [query, setQuery] = useState(displayValue);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    setQuery(displayValue);
  }, [displayValue]);

  useEffect(() => {
    const q = query.trim();
    if (selectedMake && selectedModel && q === displayValue) {
      return;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${ENV.API_URL}/api/car-models/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data?.models) ? data.models : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedMake, selectedModel, displayValue]);

  const hasSelection = Boolean(selectedMake && selectedModel);
  const showSuggestions =
    focused &&
    suggestions.length > 0 &&
    (!hasSelection || query !== `${selectedMake} ${selectedModel}`.trim());

  return (
    <View style={styles.wrap}>
      {label ? (
        <View style={website ? styles.websiteLabelRow : undefined}>
          {website ? (
            <View style={styles.websiteIcon}>
              <Ionicons name="car-sport" size={18} color="#fff" />
            </View>
          ) : null}
          <Text style={[styles.label, premium ? styles.labelPremium : null, website ? styles.websiteLabel : null]}>
            {label}
          </Text>
        </View>
      ) : null}
      <View
        style={[
          styles.row,
          premium ? styles.rowPremium : null,
          website ? styles.rowWebsite : null,
          hasSelection && premium ? styles.rowPremiumSelected : null,
          hasSelection && website ? styles.rowWebsiteSelected : null,
        ]}
      >
        {website ? (
          <Ionicons name="search" size={20} color="#94A3B8" />
        ) : (
          <View style={[styles.iconWrap, premium ? styles.iconWrapPremium : null]}>
            <Ionicons name="car-sport" size={premium ? 18 : 16} color={COLORS.primary} />
          </View>
        )}
        <TextInput
          style={[styles.input, premium ? styles.inputPremium : null, website ? styles.inputWebsite : null]}
          value={hasSelection ? `${selectedMake} ${selectedModel}`.trim() : query}
          onChangeText={(t) => {
            if (hasSelection) onClear();
            setQuery(t);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 350)}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
        />
        {hasSelection ? (
          <Ionicons name="checkmark-circle" size={website ? 22 : 18} color="#22C55E" />
        ) : query ? (
          <TouchableOpacity
            onPress={() => {
              onClear();
              setQuery('');
              setSuggestions([]);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>
      {/* Selection shown via checkmark in the input row — no extra "Selected:" pill */}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching cars…</Text>
        </View>
      ) : null}
      {showSuggestions ? (
        <View style={[styles.suggestionBox, premium ? styles.suggestionBoxPremium : null, website ? styles.suggestionBoxWebsite : null]}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: website ? 280 : premium ? 220 : 200 }}>
            {suggestions.slice(0, 20).map((item, idx) => {
              const make = String(item?.make || '').trim();
              const model = String(item?.model_name || item?.model || '').trim();
              const display = [make, model].filter(Boolean).join(' ');
              return (
                <TouchableOpacity
                  key={String(item?.id || `${make}-${model}-${idx}`)}
                  style={[
                    styles.suggestionItem,
                    premium ? styles.suggestionItemPremium : null,
                    website ? styles.suggestionItemWebsite : null,
                  ]}
                  onPress={() => {
                    onSelect(make, model, display, {
                      id: item?.id ? String(item.id) : undefined,
                      variant: item?.variant ? String(item.variant) : undefined,
                      class: item?.vehicleClass || item?.class
                        ? String(item.vehicleClass || item.class)
                        : undefined,
                    });
                    setQuery(display);
                    setSuggestions([]);
                    setFocused(false);
                  }}
                >
                  {website ? (
                    <View style={styles.websiteSuggestionInner}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.websiteMake}>{make}</Text>
                        <Text style={styles.websiteModel}>
                          {model}
                          {item?.variant ? ` (${item.variant})` : ''}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.8)" />
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.suggestionTitle, premium ? styles.suggestionTitlePremium : null]}>{display}</Text>
                      {item?.variant ? <Text style={styles.suggestionMeta}>{String(item.variant)}</Text> : null}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelPremium: { fontSize: 12, fontWeight: '800', color: '#334155', textTransform: 'none' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    minHeight: 42,
  },
  rowPremium: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 50,
  },
  rowPremiumSelected: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  iconWrapPremium: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
  },
  input: { flex: 1, fontSize: 13, color: '#111', padding: 0 },
  inputPremium: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  selectedPillText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  loadingText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  suggestionBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionBoxPremium: {
    borderRadius: 14,
    borderColor: '#DBEAFE',
    ...{
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionItemPremium: { paddingHorizontal: 14, paddingVertical: 12 },
  suggestionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  suggestionTitlePremium: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  suggestionMeta: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  websiteLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  websiteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  websiteLabel: { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 0 },
  rowWebsite: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 54,
  },
  rowWebsiteSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '08',
  },
  inputWebsite: { fontSize: 16, fontWeight: '600', color: '#111827' },
  suggestionBoxWebsite: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#0A2540',
    backgroundColor: '#0A2540',
    marginTop: 8,
  },
  suggestionItemWebsite: {
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  websiteSuggestionInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  websiteMake: { fontSize: 15, fontWeight: '800', color: '#fff' },
  websiteModel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
