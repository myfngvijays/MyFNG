import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

/** CRM-style page strip: white card, navy title (Lead Manager / Telecaller). */
export default function WorkshopPageBanner({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.banner}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#004AAD',
    opacity: 0.7,
  },
  title: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textHeading,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
});
