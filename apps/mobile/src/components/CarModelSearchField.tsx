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
  onSelect: (make: string, model: string, display: string) => void;
  onClear: () => void;
  placeholder?: string;
};

export default function CarModelSearchField({
  label,
  displayValue,
  selectedMake,
  selectedModel,
  onSelect,
  onClear,
  placeholder = 'Search make or model (e.g. Tata Nexon)',
}: Props) {
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

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Ionicons name="car-sport" size={16} color={COLORS.primary} />
        <TextInput
          style={styles.input}
          value={hasSelection ? `${selectedMake} ${selectedModel}`.trim() : query}
          onChangeText={(t) => {
            if (hasSelection) onClear();
            setQuery(t);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 350)}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
        />
        {hasSelection || query ? (
          <TouchableOpacity
            onPress={() => {
              onClear();
              setQuery('');
              setSuggestions([]);
            }}
          >
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : null}
      {focused && suggestions.length > 0 ? (
        <View style={styles.suggestionBox}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 200 }}>
            {suggestions.slice(0, 20).map((item, idx) => {
              const make = String(item?.make || '').trim();
              const model = String(item?.model_name || item?.model || '').trim();
              const display = [make, model].filter(Boolean).join(' ');
              return (
                <TouchableOpacity
                  key={String(item?.id || `${make}-${model}-${idx}`)}
                  style={styles.suggestionItem}
                  onPress={() => {
                    onSelect(make, model, display);
                    setQuery(display);
                    setSuggestions([]);
                    setFocused(false);
                  }}
                >
                  <Text style={styles.suggestionTitle}>{display}</Text>
                  {item?.variant ? <Text style={styles.suggestionMeta}>{String(item.variant)}</Text> : null}
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
  label: { fontSize: 12, fontWeight: '700', color: '#475569' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  input: { flex: 1, fontSize: 14, color: '#111', padding: 0 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  loadingText: { fontSize: 12, color: '#64748B' },
  suggestionBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionTitle: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  suggestionMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
});
