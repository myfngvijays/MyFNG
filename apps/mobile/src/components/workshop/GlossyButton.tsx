import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

type Props = {
  label: string;
  color: string;
  onPress: () => void;
  flex?: number;
  disabled?: boolean;
};

export default function GlossyButton({ label, color, onPress, flex = 1, disabled }: Props) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.wrap, { backgroundColor: color, flex }, disabled && styles.disabled]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  label: { color: '#fff', fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.5 },
});
