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
import { formatWelcomeBonusAmount } from '../lib/welcomeBonus';

type Props = {
  visible: boolean;
  onClose: () => void;
  welcomeAmount?: number;
};

type ApplyResult = {
  coupon_amount?: number;
  welcome_amount?: number;
  wallet_total?: number;
  coupon_code?: string;
  society?: boolean;
};

export function InstallCouponModal({ visible, onClose, welcomeAmount = 1000 }: Props) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [error, setError] = useState('');

  const onApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a coupon or society code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<ApplyResult>('/api/customer/wallet/claim-install-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      setApplied(res || { coupon_code: trimmed });
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.toLowerCase().includes('already')) {
        setError('A first-login coupon was already applied on this account.');
      } else {
        setError(msg || 'Could not apply this coupon.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  if (applied) {
    const extra = Number(applied.coupon_amount || 0);
    const welcome = Number(applied.welcome_amount || welcomeAmount);
    const total = Number(applied.wallet_total || welcome + extra);
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
            <Text style={styles.title}>Coupon added!</Text>
            <View style={styles.amountPill}>
              <Ionicons name="wallet-outline" size={14} color="#047857" />
              <Text style={styles.amountPillText}>
                {formatWelcomeBonusAmount(total)} in wallet
              </Text>
            </View>
            <Text style={styles.subtitle}>
              Welcome {formatWelcomeBonusAmount(welcome)} + {applied.coupon_code || 'coupon'}{' '}
              {formatWelcomeBonusAmount(extra)}. Same wallet rules apply on the full balance.
              {applied.society ? ' Society member tagged.' : ''}
            </Text>
            <TouchableOpacity style={[styles.primaryBtn, styles.primaryBtnSuccess]} onPress={onClose} activeOpacity={0.88}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Continue</Text>
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
                <Ionicons name="pricetag" size={30} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <Text style={styles.title}>Have a coupon?</Text>
          <Text style={styles.subtitle}>
            You already have {formatWelcomeBonusAmount(welcomeAmount)} welcome bonus.
            Add a festive or society code and it stacks in the same wallet.
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={code}
            onChangeText={(t) => { setCode(t); setError(''); }}
            placeholder="DIWALI26 or society code"
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
                <Ionicons name="wallet-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Add to wallet</Text>
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
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingOuterSuccess: { backgroundColor: 'rgba(16, 185, 129, 0.18)' },
  iconRingInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F59E0B',
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
    textAlign: 'center',
  },
  amountPill: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amountPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
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
