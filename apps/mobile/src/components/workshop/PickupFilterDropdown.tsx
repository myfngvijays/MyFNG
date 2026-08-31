import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';

export type PickupFilterOption = {
  key: string;
  label: string;
  count: number;
};

type Props = {
  activeKey: string;
  options: PickupFilterOption[];
  onChange: (key: string) => void;
  summary?: string;
};

export default function PickupFilterDropdown({ activeKey, options, onChange, summary }: Props) {
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.key === activeKey) || options[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {summary}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={styles.dropWrap}>
          <TouchableOpacity
            style={styles.dropBtn}
            onPress={() => setOpen((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={15} color={COLORS.primary} />
            <Text style={styles.dropBtnTxt} numberOfLines={1}>
              {active?.label} ({active?.count ?? 0})
            </Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={COLORS.primary} />
          </TouchableOpacity>
          {open ? (
            <View style={styles.dropMenu}>
              {options.map((item) => {
                const selected = item.key === activeKey;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.dropItem, selected && styles.dropItemOn]}
                    onPress={() => {
                      onChange(item.key);
                      setOpen(false);
                    }}
                  >
                    <Text style={[styles.dropItemTxt, selected && styles.dropItemTxtOn]}>
                      {item.label}
                    </Text>
                    <View style={styles.dropItemRight}>
                      <Text style={[styles.dropCount, selected && styles.dropItemTxtOn]}>
                        {item.count}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={15} color={COLORS.primary} />
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {options.map((item) => {
          const selected = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => onChange(item.key)}
            >
              <Text style={[styles.chipTxt, selected && styles.chipTxtOn]}>
                {item.label} ({item.count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  summary: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    lineHeight: 17,
    paddingTop: 8,
  },
  dropWrap: {
    minWidth: 150,
    maxWidth: '54%',
    zIndex: 11,
  },
  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    ...SHADOWS.small,
  },
  dropBtnTxt: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  dropMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    left: 0,
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[100],
  },
  dropItemOn: {
    backgroundColor: '#EFF6FF',
  },
  dropItemTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textBody,
  },
  dropItemTxtOn: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  dropItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dropCount: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  chipTxtOn: {
    color: '#fff',
  },
});
