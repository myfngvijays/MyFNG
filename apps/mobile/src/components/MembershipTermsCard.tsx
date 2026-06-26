import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getMembershipTerms, loadMembershipTerms, type MembershipTermType } from '../lib/membershipTerms';

type Props = {
  membershipType?: MembershipTermType;
  style?: object;
};

export default function MembershipTermsCard({ membershipType = 'RSA', style }: Props) {
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [terms, setTerms] = useState<string[]>(() => getMembershipTerms(membershipType));

  useEffect(() => {
    setTerms(getMembershipTerms(membershipType));
    void loadMembershipTerms(membershipType).then(setTerms);
  }, [membershipType]);

  if (!terms.length) return null;

  return (
    <View style={[styles.termsCard, style]}>
      <Text style={styles.termsTitle}>Terms & Conditions</Text>
      <View style={styles.termRow}>
        <Text style={styles.termBullet}>•</Text>
        <Text style={styles.termText}>{terms[0]}</Text>
      </View>
      {termsExpanded
        ? terms.slice(1).map((term, idx) => (
            <View key={`${idx + 1}-${term.slice(0, 24)}`} style={styles.termRow}>
              <Text style={styles.termBullet}>•</Text>
              <Text style={styles.termText}>{term}</Text>
            </View>
          ))
        : null}
      {terms.length > 1 ? (
        <TouchableOpacity
          style={styles.termsToggle}
          activeOpacity={0.85}
          onPress={() => setTermsExpanded((prev) => !prev)}
        >
          <Text style={styles.termsToggleText}>{termsExpanded ? 'Show less' : 'View all terms'}</Text>
          <Ionicons
            name={termsExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  termsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5EEF9',
    gap: 10,
  },
  termsTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  termRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  termBullet: { fontSize: 11, color: COLORS.primary, lineHeight: 16, fontStyle: 'italic' },
  termText: { flex: 1, fontSize: 11, fontWeight: '400', fontStyle: 'italic', color: '#475569', lineHeight: 16 },
  termsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 6,
  },
  termsToggleText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
