import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS } from '../constants/theme';
import { apiFetch } from '../lib/api';

export type MyCouponItem = {
  id?: string;
  code?: string;
  description?: string;
  min_order_value?: number;
  assigned?: boolean;
  discount_mode?: string;
  discount_value?: number;
  coupon_kind?: string;
  valid_until?: string;
  ends_at?: string;
  end_at?: string;
  locked?: boolean;
  lock_reason?: 'profile' | 'service' | null;
  unlock_message?: string | null;
  can_use?: boolean;
  profile_ok?: boolean;
  service_unlocked?: boolean;
};

function describeCouponOffer(c: MyCouponItem): string {
  const mode = String(c?.discount_mode || '').toUpperCase();
  const val = Number(c?.discount_value || 0);
  if (c?.coupon_kind === 'FREE_SERVICE') return 'Free Service';
  if (mode === 'PERCENT' && val > 0) return `${val}% OFF`;
  if ((mode === 'AMOUNT' || mode === 'FLAT' || mode === 'FIXED') && val > 0) {
    return `₹${Math.round(val).toLocaleString('en-IN')} OFF`;
  }
  if (c?.description) return String(c.description);
  return 'Special Offer';
}

function formatExpiry(c: MyCouponItem): string | null {
  const raw = c.valid_until || c.ends_at || c.end_at;
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Props = {
  coupons: MyCouponItem[];
  loading: boolean;
  onUseInCart: (code: string, coupon?: MyCouponItem) => void;
  onLogin?: () => void;
  isLoggedIn: boolean;
  onWalletCouponApplied?: () => void;
};

function CouponTicket({
  coupon,
  onUseInCart,
}: {
  coupon: MyCouponItem;
  onUseInCart: (code: string, coupon?: MyCouponItem) => void;
}) {
  const code = String(coupon?.code || '').trim();
  const displayCode = code.toUpperCase();
  const offer = describeCouponOffer(coupon);
  const isAssigned = Boolean(coupon?.assigned);
  const isLocked = Boolean(coupon?.locked) || coupon?.can_use === false;
  const expiry = formatExpiry(coupon);
  const accent = isLocked ? '#64748B' : isAssigned ? '#B45309' : COLORS.primary;
  const accentSoft = isLocked ? '#F8FAFC' : isAssigned ? '#FFFBEB' : '#EFF6FF';
  const accentBorder = isLocked ? '#E2E8F0' : isAssigned ? '#FDE68A' : '#BFDBFE';

  const copyCode = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(displayCode);
    Alert.alert('Copied', `${displayCode} copied to clipboard.`);
  };

  const handleUse = () => {
    if (!code) return;
    if (isLocked) {
      Alert.alert(
        coupon.lock_reason === 'profile' ? 'Profile incomplete' : 'Coupon not active yet',
        String(
          coupon.unlock_message ||
            'Pehle profile complete karo aur ek service complete hone ke baad ye coupon active hoga.',
        ),
      );
      onUseInCart(displayCode, coupon);
      return;
    }
    onUseInCart(displayCode, coupon);
  };

  return (
    <View style={styles.ticketShadow}>
      <View style={styles.ticket}>
        <View style={[styles.ticketAccent, { backgroundColor: accent }]}>
          <View style={styles.ticketAccentInner}>
            <Ionicons
              name={isLocked ? 'lock-closed' : isAssigned ? 'star' : 'pricetag'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.ticketOffer} numberOfLines={3}>{offer}</Text>
          </View>
        </View>

        <View style={styles.ticketNotchTop} />
        <View style={styles.ticketNotchBottom} />
        <View style={[styles.ticketDivider, { borderColor: accentBorder }]} />

        <View style={styles.ticketBody}>
          <View style={styles.ticketTopRow}>
            {isLocked ? (
              <View style={[styles.forYouBadge, { backgroundColor: '#F1F5F9' }]}>
                <Ionicons name="lock-closed" size={11} color="#475569" />
                <Text style={[styles.forYouText, { color: '#475569' }]}>
                  {coupon.lock_reason === 'profile' ? 'PROFILE NEEDED' : 'UNLOCKED · INACTIVE'}
                </Text>
              </View>
            ) : isAssigned ? (
              <View style={styles.forYouBadge}>
                <Ionicons name="diamond-outline" size={11} color="#92400E" />
                <Text style={styles.forYouText}>EXCLUSIVE</Text>
              </View>
            ) : (
              <View style={styles.publicBadge}>
                <Text style={styles.publicBadgeText}>ACTIVE OFFER</Text>
              </View>
            )}
            {expiry ? (
              <Text style={styles.expiryText}>Valid till {expiry}</Text>
            ) : null}
          </View>

          <TouchableOpacity style={[styles.codePill, { backgroundColor: accentSoft, borderColor: accentBorder }]} onPress={copyCode} activeOpacity={0.8}>
            <Text style={[styles.codeText, { color: isAssigned || isLocked ? '#92400E' : COLORS.primaryDark }]}>{displayCode || '—'}</Text>
            <View style={styles.copyChip}>
              <Ionicons name="copy-outline" size={14} color={isAssigned || isLocked ? '#92400E' : COLORS.primary} />
              <Text style={[styles.copyChipText, { color: isAssigned || isLocked ? '#92400E' : COLORS.primary }]}>Copy</Text>
            </View>
          </TouchableOpacity>

          {coupon.description && offer !== String(coupon.description) ? (
            <Text style={styles.description} numberOfLines={2}>{String(coupon.description)}</Text>
          ) : null}

          {isLocked && coupon.unlock_message ? (
            <Text style={[styles.description, { color: '#64748B' }]} numberOfLines={4}>
              {String(coupon.unlock_message)}
            </Text>
          ) : null}

          {coupon.min_order_value ? (
            <View style={styles.minOrderChip}>
              <Ionicons name="cart-outline" size={12} color="#64748B" />
              <Text style={styles.minOrderText}>
                Min. order ₹{Number(coupon.min_order_value).toLocaleString('en-IN')}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.useBtn, { backgroundColor: accent, opacity: isLocked ? 0.92 : 1 }]}
            onPress={handleUse}
            activeOpacity={0.88}
          >
            <Text style={styles.useBtnText}>
              {isLocked
                ? coupon.lock_reason === 'profile'
                  ? 'Complete Profile'
                  : 'Locked till 1st service'
                : 'Use in Cart'}
            </Text>
            <Ionicons
              name={isLocked ? 'lock-closed' : 'arrow-forward'}
              size={16}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function RedeemInstallCodeCard({ onApplied }: { onApplied?: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [claimedCode, setClaimedCode] = useState<string | null>(null);
  const [canClaim, setCanClaim] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ can_claim?: boolean; already_claimed?: boolean; code?: string | null }>(
          '/api/customer/wallet/claim-install-coupon',
        );
        if (cancelled) return;
        setCanClaim(res?.can_claim !== false && !res?.already_claimed);
        if (res?.already_claimed) setClaimedCode(res.code || 'applied');
      } catch {
        if (!cancelled) setCanClaim(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const apply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      Alert.alert('Coupon', 'Enter a festive or society code');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{
        coupon_amount?: number;
        welcome_amount?: number;
        wallet_total?: number;
        coupon_code?: string;
      }>('/api/customer/wallet/claim-install-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const extra = Number(res?.coupon_amount || 0);
      const total = Number(res?.wallet_total || 0);
      setClaimedCode(res?.coupon_code || trimmed);
      setCanClaim(false);
      setCode('');
      Alert.alert(
        'Added to wallet',
        `₹${Math.round(extra).toLocaleString('en-IN')} added. Wallet total ₹${Math.round(total).toLocaleString('en-IN')}. Same wallet rules apply.`,
      );
      onApplied?.();
    } catch (e: any) {
      Alert.alert('Coupon', e?.message || 'Could not apply this coupon.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  if (!canClaim && claimedCode) {
    return (
      <View style={styles.redeemCard}>
        <View style={styles.redeemDoneRow}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={styles.redeemDoneText}>
            Wallet code applied{claimedCode && claimedCode !== 'applied' ? `: ${claimedCode}` : ''}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.redeemCard}>
      <Text style={styles.redeemTitle}>Have a festive or society code?</Text>
      <Text style={styles.redeemSub}>
        Missed it at login? Enter here — amount adds to your welcome wallet.
      </Text>
      <View style={styles.redeemRow}>
        <TextInput
          style={styles.redeemInput}
          value={code}
          onChangeText={setCode}
          placeholder="Enter code"
          placeholderTextColor="#94A3B8"
          autoCapitalize="characters"
          autoCorrect={false}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.redeemBtn, loading && { opacity: 0.7 }]}
          onPress={() => { void apply(); }}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.redeemBtnText}>Add</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MyCouponsContent({ coupons, loading, onUseInCart, onLogin, isLoggedIn, onWalletCouponApplied }: Props) {
  if (!isLoggedIn) {
    return (
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <View style={styles.heroOrbA} />
          <View style={styles.heroOrbB} />
          <Ionicons name="pricetag" size={28} color="#FFFFFF" />
          <Text style={styles.heroTitle}>Your Rewards</Text>
          <Text style={styles.heroSub}>Sign in to unlock personal coupons and app-only savings.</Text>
        </View>
        <View style={styles.loginCard}>
          <View style={styles.lockCircle}>
            <Ionicons name="lock-closed" size={28} color="#64748B" />
          </View>
          <Text style={styles.loginTitle}>Login Required</Text>
          <Text style={styles.loginSub}>Access coupons assigned to you and public checkout offers.</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={onLogin} activeOpacity={0.9}>
            <Text style={styles.loginBtnText}>Login Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={styles.heroOrbA} />
        <View style={styles.heroOrbB} />
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>MYFNG REWARDS</Text>
            <Text style={styles.heroTitle}>Offers & Coupons</Text>
            <Text style={styles.heroSub}>Enter a code to add wallet credit · Or use offers in cart</Text>
          </View>
          {!loading ? (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeNum}>{coupons.length}</Text>
              <Text style={styles.countBadgeLabel}>ACTIVE</Text>
            </View>
          ) : null}
        </View>
      </View>

      <RedeemInstallCodeCard onApplied={onWalletCouponApplied} />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your offers...</Text>
        </View>
      ) : coupons.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconRing}>
            <Ionicons name="pricetag-outline" size={34} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No coupons yet</Text>
          <Text style={styles.emptySub}>
            New offers appear here when assigned by our team or during seasonal campaigns.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {coupons.map((c, index) => (
            <CouponTicket
              key={String(c?.id || c?.code || `coupon-${index}`)}
              coupon={c}
              onUseInCart={onUseInCart}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  hero: {
    backgroundColor: '#0F2744',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F2744',
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 6 },
    }),
  },
  heroOrbA: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40,
    right: -20,
  },
  heroOrbB: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(96,165,250,0.12)',
    bottom: -24,
    left: -10,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '500',
  },
  countBadge: {
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  countBadgeNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  countBadgeLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
  },
  redeemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  redeemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  redeemSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
    fontWeight: '500',
  },
  redeemRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  redeemInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: 0.6,
  },
  redeemBtn: {
    minWidth: 72,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  redeemBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  redeemDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redeemDoneText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  list: {
    gap: 14,
  },
  ticketShadow: {
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 4 },
    }),
  },
  ticket: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EDF5',
    minHeight: 168,
  },
  ticketAccent: {
    width: 92,
    paddingVertical: 16,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  ticketAccentInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ticketOffer: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 18,
  },
  ticketDivider: {
    width: 1,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 12,
  },
  ticketNotchTop: {
    position: 'absolute',
    left: 86,
    top: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#E8EDF5',
    zIndex: 2,
  },
  ticketNotchBottom: {
    position: 'absolute',
    left: 86,
    bottom: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F0F7FF',
    borderWidth: 1,
    borderColor: '#E8EDF5',
    zIndex: 2,
  },
  ticketBody: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
    justifyContent: 'space-between',
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  forYouBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  forYouText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.6,
  },
  publicBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  publicBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  expiryText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 8,
  },
  minOrderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  minOrderText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 11,
  },
  useBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loginCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EDF5',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
    }),
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
  },
  loginSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
