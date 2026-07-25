import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import TelecallerFollowUpsScreen from '../telecaller/TelecallerFollowUpsScreen';
import TelecallerScriptsScreen from '../telecaller/TelecallerScriptsScreen';
import TelecallerRSAScreen from '../telecaller/TelecallerRSAScreen';
import { COLORS, SPACING } from '../../../constants/theme';

type Props = {
  navigation: any;
  initialSegment?: string;
};

export default function CrmEngageTab({ navigation, initialSegment = 'followups' }: Props) {
  const [segment, setSegment] = useState(initialSegment);

  useEffect(() => {
    if (initialSegment) setSegment(initialSegment);
  }, [initialSegment]);

  const nestedNav = {
    ...navigation,
    goBack: () => setSegment('followups'),
    navigate: (screen: string, params?: any) => {
      if (screen === 'followups' || screen === 'TelecallerFollowUps') {
        setSegment('followups');
        return;
      }
      if (screen === 'scripts' || screen === 'TelecallerScripts') {
        setSegment('scripts');
        return;
      }
      if (screen === 'telecallerRsa' || screen === 'TelecallerRSA') {
        setSegment('rsa');
        return;
      }
      navigation?.navigate?.(screen, params);
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.segRow}>
        {[
          { id: 'followups', label: 'Follow-ups' },
          { id: 'scripts', label: 'Scripts' },
          { id: 'rsa', label: 'RSA / Pay' },
        ].map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.seg, segment === s.id && styles.segActive]}
            onPress={() => setSegment(s.id)}
          >
            <Text style={[styles.segText, segment === s.id && styles.segTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.body}>
        {segment === 'followups' && (
          <TelecallerFollowUpsScreen
            navigation={nestedNav}
            route={{ params: {} }}
            embedded
          />
        )}
        {segment === 'scripts' && <TelecallerScriptsScreen navigation={nestedNav} embedded />}
        {segment === 'rsa' && <TelecallerRSAScreen navigation={nestedNav} embedded />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  segRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: 2,
    paddingBottom: 6,
  },
  seg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  segText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  segTextActive: { color: '#fff' },
  body: { flex: 1, minHeight: 0 },
});
