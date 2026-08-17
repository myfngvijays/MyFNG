import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { apiFetch } from '../lib/api';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialCode?: string;
};

export function ReferralCodeModal({ visible, onClose, initialCode }: Props) {
  const [code, setCode] = useState(initialCode || '');
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');

  const onApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a referral code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await apiFetch('/api/customer/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral_code: trimmed }),
      });
      setApplied(true);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('already used')) {
        setError('You have already used a referral code');
      } else if (msg.includes('Self referral')) {
        setError('You cannot use your own referral code');
      } else if (msg.includes('Invalid')) {
        setError('Invalid referral code. Please check and try again.');
      } else {
        setError(msg || 'Failed to apply code');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  if (applied) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.card} onPress={() => undefined}>
            <View style={styles.iconWrap}>
              <View style={[styles.iconRingOuter, styles.iconRingOuterSuccess]}>
                <View style={[styles.iconRingInner, styles.iconRingInnerSuccess]}>
                  <Ionicons name="checkmark" size={40} color="#FFFFFF" />
                </View>
              </View>
            </View>
            <Text style={styles.title}>Referral Applied!</Text>
            <Text style={styles.subtitle}>
              Bonus has been added to your wallet. Enjoy your rewards!
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnSuccess]} onPress={onClose} activeOpacity={0.88}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Let's Go!</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.iconWrap}>
            <View style={styles.iconRingOuter}>
              <View style={styles.iconRingInner}>
                <Ionicons name="people" size={32} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Got a Referral Code?</Text>
          <Text style={styles.subtitle}>
            Enter your friend's referral code to get extra wallet bonus instantly!
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={code}
            onChangeText={(t) => { setCode(t); setError(''); }}
            placeholder="Enter referral code"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!loading}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={onApply}
            activeOpacity={0.88}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="gift-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Apply Code</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconWrap: { marginBottom: 16 },
  iconRingOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingOuterSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.18)' },
  iconRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingInnerSuccess: { backgroundColor: '#10B981' },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    marginTop: 18,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 1,
    textAlign: 'center',
  },
  inputError: { borderColor: '#EF4444' },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  primaryBtn: {
    marginTop: 18,
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnSuccess: { backgroundColor: '#10B981' },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: { marginTop: 12, paddingVertical: 8 },
  secondaryBtnText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
});
