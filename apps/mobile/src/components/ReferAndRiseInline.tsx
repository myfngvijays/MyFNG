import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Modal,
  Linking,
  Platform,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { apiFetch } from '../lib/api';
import { ENV } from '../config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_REFERRAL_VOUCHER_KEY } from '../lib/referralVoucher';
import {
  FAMILY_ORDER,
  MAX_REFERRALS,
  normalizeFamilyKey,
  type FamilyKey,
  type Milestone,
  isReferralTestReferrerPhone,
} from '../constants/referAndRise';
import { useReferAndRiseConfig } from '../hooks/useReferAndRiseConfig';
import MembershipTermsCard from './MembershipTermsCard';
import {
  getContactsAccessState,
  isContactsNativeModuleAvailable,
  loadDeviceContacts,
  openAddMoreContactsPicker,
  requestContactsPermission,
  showContactsPermissionAlert,
  showContactsUnavailableAlert,
  type ParsedContact,
} from '../lib/contactsPermission';

const BRAND = '#004AAD';
const BRAND_LIGHT = '#E8F1FD';
const BRAND_BG = '#F0F7FF';

type Props = {
  referralCode: string;
  customerPhone?: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onViewChange?: (title: string) => void;
};

export type ReferAndRiseHandle = {
  handleBack: () => boolean;
  getViewTitle: () => string;
};

type ViewName = 'home' | 'milestones' | 'garageShelf' | 'history' | 'share' | 'dashboard' | 'contacts';

const VIEW_TITLES: Record<ViewName, string> = {
  home: 'Refer & Rise',
  milestones: 'Milestones',
  garageShelf: 'My Garage Shelf',
  history: 'Referral History',
  share: 'Share Referral',
  dashboard: 'Referral Dashboard',
  contacts: 'Invite Contacts',
};

type HistoryItem = {
  id: string;
  name: string;
  date: string;
  reward: string;
  status: 'completed' | 'pending';
  statusLabel?: string;
};

type ReferralEventRow = {
  id: string;
  status: string;
  created_at: string;
  first_order_lead_id?: string | null;
  referee?: { full_name?: string | null; phone?: string | null } | null;
};

type ReferralStats = {
  total_referred: number;
  total_rewarded: number;
  total_pending: number;
  total_invites_sent: number;
  total_earned: number;
};

function formatReferralDate(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function maskReferralPhone(phone: string | null | undefined) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length < 10) return digits || 'Friend';
  return `${digits.slice(0, 2)}****${digits.slice(-4)}`;
}

function mapReferralEventsToHistory(events: ReferralEventRow[]): HistoryItem[] {
  return events.map((event) => {
    const name = String(event.referee?.full_name || '').trim() || maskReferralPhone(event.referee?.phone);
    const joinedDate = formatReferralDate(event.created_at);

    if (event.status === 'REWARDED') {
      return {
        id: event.id,
        name,
        date: joinedDate ? `Completed on ${joinedDate}` : 'Completed',
        reward: 'Reward earned',
        status: 'completed',
      };
    }

    if (event.status === 'REJECTED') {
      return {
        id: event.id,
        name,
        date: joinedDate ? `Rejected · ${joinedDate}` : 'Rejected',
        reward: '',
        status: 'pending',
        statusLabel: 'Referral rejected',
      };
    }

    return {
      id: event.id,
      name,
      date: event.first_order_lead_id ? 'Booked service' : 'Joined MyFNG',
      statusLabel: event.first_order_lead_id ? 'Waiting for service completion' : `Joined on ${joinedDate || '—'}`,
      reward: '',
      status: 'pending',
    };
  });
}

const ReferAndRiseInline = forwardRef(function ReferAndRiseInline({ referralCode, customerPhone, isLoggedIn, onLogin, onViewChange }: Props, ref: React.Ref<ReferAndRiseHandle>) {
  const [currentView, setCurrentView] = useState<ViewName>('home');
  const remoteConfig = useReferAndRiseConfig();
  const activeMilestones = remoteConfig.milestones;
  const activeFamilies = remoteConfig.families;
  const FAMILIES = activeFamilies;
  const MILESTONES = activeMilestones;
  const activeMaxReferrals = activeMilestones.length > 0 ? activeMilestones[activeMilestones.length - 1].referralCount : MAX_REFERRALS;

  const changeView = (view: ViewName) => {
    setCurrentView(view);
    onViewChange?.(VIEW_TITLES[view]);
  };
  const [referrals, setReferrals] = useState(0);
  const [referralEvents, setReferralEvents] = useState<ReferralEventRow[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStats>({
    total_referred: 0,
    total_rewarded: 0,
    total_pending: 0,
    total_invites_sent: 0,
    total_earned: 0,
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [picks, setPicks] = useState<Record<number, FamilyKey>>({});
  const [pendingMilestone, setPendingMilestone] = useState<Milestone | null>(null);
  const [selectedReward, setSelectedReward] = useState<FamilyKey | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsData, setCongratsData] = useState<{ milestone: Milestone; family: FamilyKey } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);
  const [historyTab, setHistoryTab] = useState<'completed' | 'pending'>('completed');
  const [contactsList, setContactsList] = useState<ParsedContact[]>([]);
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsAccessDenied, setContactsAccessDenied] = useState(false);
  const [contactsLimited, setContactsLimited] = useState(false);
  const [contactsCanAskAgain, setContactsCanAskAgain] = useState(true);
  const [dismissedMilestones, setDismissedMilestones] = useState<Set<number>>(new Set());
  const isTestReferrer = isReferralTestReferrerPhone(customerPhone || '');

  const dismissMilestonePicker = (milestoneCount?: number) => {
    if (milestoneCount != null) {
      setDismissedMilestones((prev) => new Set(prev).add(milestoneCount));
    }
    setPendingMilestone(null);
    setSelectedReward(null);
  };

  const refreshReferralStats = async (opts?: { historyOnly?: boolean }) => {
    if (opts?.historyOnly) setHistoryLoading(true);
    try {
      const res = await apiFetch<any>('/api/customer/referral');
      if (res?.stats?.total_rewarded != null) setReferrals(Number(res.stats.total_rewarded) || 0);
      if (res?.stats) {
        setReferralStats({
          total_referred: Number(res.stats.total_referred) || 0,
          total_rewarded: Number(res.stats.total_rewarded) || 0,
          total_pending: Number(res.stats.total_pending) || 0,
          total_invites_sent: Number(res.stats.total_invites_sent) || 0,
          total_earned: Number(res.stats.total_earned) || 0,
        });
      }
      if (Array.isArray(res?.events)) setReferralEvents(res.events);
      if (res?.refer_and_rise?.picks) {
        const normalized: Record<number, FamilyKey> = {};
        for (const [k, v] of Object.entries(res.refer_and_rise.picks)) {
          const fam = normalizeFamilyKey(String(v));
          if (fam) normalized[Number(k)] = fam;
        }
        setPicks(normalized);
      }
      return res;
    } catch {
      return null;
    } finally {
      if (opts?.historyOnly) setHistoryLoading(false);
    }
  };

  const logInviteSent = async (channel: string, friend?: { name?: string; phone?: string }) => {
    if (!isLoggedIn) return;
    try {
      const res = await apiFetch<any>('/api/customer/referral/log-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          friend_name: friend?.name || null,
          friend_phone: friend?.phone || null,
          referral_code: referralCode,
        }),
      });
      if (res?.stats?.total_invites_sent != null) {
        setReferralStats((prev) => ({
          ...prev,
          total_invites_sent: Number(res.stats.total_invites_sent) || prev.total_invites_sent,
        }));
      }
    } catch {
      // Non-blocking
    }
  };

  const simulateTestInvite = async (friendName?: string, friendPhone?: string) => {
    if (!isTestReferrer || pendingMilestone || referrals >= activeMaxReferrals) return;
    try {
      const res = await apiFetch<any>('/api/customer/referral/simulate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          friend_name: friendName,
          friend_phone: friendPhone,
          referral_code: referralCode,
        }),
      });
      if (res?.stats?.total_rewarded != null) {
        setReferrals(Number(res.stats.total_rewarded) || 0);
      } else {
        await refreshReferralStats();
      }
    } catch {
      // Non-blocking — invite message still goes out
    }
  };

  useImperativeHandle(ref, () => ({
    handleBack: () => {
      if (currentView !== 'home') {
        changeView('home');
        return true;
      }
      return false;
    },
    getViewTitle: () => VIEW_TITLES[currentView],
  }), [currentView]);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshReferralStats();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (currentView === 'history' || currentView === 'dashboard') {
      refreshReferralStats({ historyOnly: currentView === 'history' });
    }
  }, [currentView, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn || referrals <= 0) return;
    const unclaimed = MILESTONES.find(
      (m) =>
        referrals >= m.referralCount &&
        !picks[m.referralCount] &&
        !dismissedMilestones.has(m.referralCount),
    );
    if (unclaimed && !pendingMilestone) {
      setPendingMilestone(unclaimed);
    }
  }, [isLoggedIn, referrals, picks, MILESTONES, pendingMilestone, dismissedMilestones]);

  const currentIdx = (() => { for (let i = MILESTONES.length - 1; i >= 0; i--) { if (referrals >= MILESTONES[i].referralCount) return i; } return -1; })();
  const nextMilestone = MILESTONES.find((m) => m.referralCount > referrals) || null;
  const progressPct = (referrals / activeMaxReferrals) * 100;
  const referralsToNext = nextMilestone ? nextMilestone.referralCount - referrals : 0;

  const inviteLink = `${ENV.REFERRAL_LINK_BASE}/${encodeURIComponent(referralCode || 'MYFNG')}`;
  const appDownloadLink = ENV.APP_DOWNLOAD_URL || (Platform.OS === 'ios' ? ENV.APPSTORE_URL : ENV.PLAYSTORE_URL);
  const referralLink = inviteLink;

  const shareMessage = remoteConfig.content.shareMessage
    ? remoteConfig.content.shareMessage
        .replace(/\{\{CODE\}\}/g, referralCode || 'MYFNG')
        .replace(/\{\{LINK\}\}/g, inviteLink)
    : `🚗 Great cars deserve great care!\n\nJoin MyFNG and let's keep your car always performing at its best.\n\nUse my referral code *${referralCode || 'MYFNG'}* to get ₹1,500 wallet bonus instantly.\n\n👉 ${inviteLink}\n\nDownload: ${appDownloadLink}`;

  const simulateReferral = () => {
    if (pendingMilestone || referrals >= activeMaxReferrals) return;
    const next = referrals + 1;
    setReferrals(next);
    const unlocked = MILESTONES.find((m) => m.referralCount === next) || null;
    if (unlocked) {
      setPendingMilestone(unlocked);
    }
  };

  const shareOnWhatsApp = () => {
    void logInviteSent('whatsapp');
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareMessage)}`).catch(() => {
      Share.share({ message: shareMessage, url: inviteLink });
    });
  };

  const shareInviteLink = () => {
    void logInviteSent('share');
    Share.share({ message: shareMessage, url: inviteLink });
  };

  const copyInviteLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyShareMessage = async () => {
    await Clipboard.setStringAsync(shareMessage);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const refreshContactsScreen = async (promptPermission = false) => {
    if (!isContactsNativeModuleAvailable()) {
      showContactsUnavailableAlert();
      return;
    }

    setContactsLoading(true);
    try {
      let access = await getContactsAccessState();
      if (promptPermission && !access.granted) {
        access = await requestContactsPermission();
      }

      setContactsAccessDenied(!access.granted);
      setContactsLimited(access.limited);
      setContactsCanAskAgain(access.canAskAgain);

      if (!access.granted) {
        setContactsList([]);
        if (promptPermission) {
          showContactsPermissionAlert(access.canAskAgain);
        }
        return;
      }

      const parsed = await loadDeviceContacts();
      setContactsList(parsed);
    } catch {
      setContactsAccessDenied(true);
      setContactsList([]);
      Alert.alert(
        'Contacts unavailable',
        'Could not load contacts. Please allow contacts access and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
    } finally {
      setContactsLoading(false);
    }
  };

  const inviteFromContacts = async () => {
    if (isTestReferrer) {
      await simulateTestInvite('Test Friend');
      return;
    }

    changeView('contacts');
    setContactsSearch('');
    await refreshContactsScreen(true);
  };

  const handleAllowContactsPress = async () => {
    await refreshContactsScreen(true);
  };

  const handleAddMoreContacts = async () => {
    const added = await openAddMoreContactsPicker();
    if (added) {
      await refreshContactsScreen(false);
    }
  };

  const inviteContact = (phone: string, name?: string) => {
    void logInviteSent('contacts', { name, phone });
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    const whatsappUrl = `whatsapp://send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(shareMessage)}`;
    Linking.openURL(whatsappUrl).catch(() => {
      const smsUrl = Platform.OS === 'ios' ? `sms:${phone}&body=${encodeURIComponent(shareMessage)}` : `sms:${phone}?body=${encodeURIComponent(shareMessage)}`;
      Linking.openURL(smsUrl).catch(() => Share.share({ message: shareMessage }));
    });
  };

  const filteredContacts = contactsSearch
    ? contactsList.filter((c) => c.name.toLowerCase().includes(contactsSearch.toLowerCase()) || c.phone.includes(contactsSearch))
    : contactsList;

  const copyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmReward = async () => {
    if (!pendingMilestone || !selectedReward) return;
    const ms = pendingMilestone;
    const family = selectedReward;
    const milestoneCount = ms.referralCount;
    setPendingMilestone(null);
    setSelectedReward(null);
    setCongratsData({ milestone: ms, family });
    setShowCongrats(true);
    try {
      const res = await apiFetch<any>('/api/customer/referral/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCount: milestoneCount, family }),
      });
      setPicks((p) => ({ ...p, [milestoneCount]: family }));
      setDismissedMilestones((prev) => {
        const next = new Set(prev);
        next.delete(milestoneCount);
        return next;
      });
      await refreshReferralStats();
      if (res?.membership_activated) {
        // Membership rewards activate immediately — no booking voucher to attach.
      } else if (res?.claim?.id) {
        try {
          await AsyncStorage.setItem(PENDING_REFERRAL_VOUCHER_KEY, String(res.claim.id));
        } catch {
          // ignore
        }
      }
    } catch {
      setCongratsData(null);
      setShowCongrats(false);
      setPicks((p) => {
        const next = { ...p };
        delete next[milestoneCount];
        return next;
      });
      setPendingMilestone(ms);
    }
  };

  const closeCongrats = () => { setShowCongrats(false); setCongratsData(null); };

  const referralHistory = mapReferralEventsToHistory(referralEvents);
  const completedHistory = referralHistory.filter((h) => h.status === 'completed');
  const pendingHistory = referralHistory.filter((h) => h.status === 'pending');

  const categoryCounts = FAMILY_ORDER.reduce((acc, key) => {
    acc[key] = Object.values(picks).filter((p) => p === key).length;
    return acc;
  }, {} as Record<FamilyKey, number>);
  const totalPicks = Object.values(picks).length;

  // ─── BACK HEADER ───
  // No internal back header - parent handles navigation

  // ═══════════════ HOME VIEW ═══════════════
  const renderHome = () => (
    <View>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerTextWrap}>
          <Text style={s.headerLabel}>MYFNG</Text>
          <Text style={s.headerTitle}>{remoteConfig.content.heroTitle || 'Refer & Rise'}</Text>
          {remoteConfig.content.heroSubtitle ? <Text style={s.headerSub}>{remoteConfig.content.heroSubtitle}</Text> : null}
        </View>
        <View style={s.headerBadge}>
          <Ionicons name="sparkles" size={12} color={BRAND} />
          <Text style={s.headerBadgeText} numberOfLines={1}>
            {currentIdx >= 0 ? `${MILESTONES[currentIdx].referralCount} Referrals` : 'Get Started'}
          </Text>
        </View>
      </View>

      {/* Progress Card */}
      <View style={s.progressCard}>
        <View style={s.progressTop}>
          <View>
            <Text style={s.progressBig}>{referrals}</Text>
            <Text style={s.progressLabel}>Referrals</Text>
          </View>
          <View style={s.progressCircle}>
            <Text style={s.progressPct}>{Math.round(progressPct)}%</Text>
          </View>
        </View>
        <Text style={s.progressHint}>
          {nextMilestone
            ? `Only ${referralsToNext} more referrals to unlock your next reward.`
            : "You've completed all milestones!"}
        </Text>
        {/* Milestone dots */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dotsScroll} contentContainerStyle={s.dotsRow}>
          {MILESTONES.map((m) => m.referralCount).map((count) => (
            <View key={count} style={[s.dot, referrals >= count && s.dotFilled, nextMilestone?.referralCount === count && s.dotNext]}>
              <Text style={[s.dotText, referrals >= count && s.dotTextFilled]}>{count}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Invite Button */}
      {isTestReferrer ? (
        <View style={s.testBanner}>
          <Ionicons name="flask-outline" size={14} color="#7C3AED" />
          <Text style={s.testBannerText}>Test mode: invite counts instantly as referred</Text>
        </View>
      ) : null}
      <TouchableOpacity style={s.inviteBtn} onPress={inviteFromContacts} activeOpacity={0.85} disabled={!!pendingMilestone || referrals >= activeMaxReferrals}>
        <Ionicons name="people" size={16} color="#FFFFFF" />
        <Text style={s.inviteBtnText}>Invite Friends</Text>
      </TouchableOpacity>

      {/* Referral Code Box */}
      <View style={s.codeBox}>
        <Text style={s.codeLabel}>YOUR REFERRAL CODE</Text>
        <Text style={s.codeValue}>{referralCode || 'MYFNG'}</Text>
        <View style={s.codeActions}>
          <TouchableOpacity style={s.copyBtn} onPress={copyCode} activeOpacity={0.8}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={BRAND} />
            <Text style={s.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.contactsBtn} onPress={inviteFromContacts} activeOpacity={0.8}>
            <Ionicons name="people-outline" size={14} color={BRAND} />
            <Text style={s.contactsBtnText}>Contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareWhatsapp} onPress={shareOnWhatsApp} activeOpacity={0.8}>
            <Ionicons name="logo-whatsapp" size={15} color="#FFFFFF" />
            <Text style={s.shareWhatsappText}>WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={s.quickRow}>
        {[
          { view: 'milestones' as ViewName, icon: 'flag-outline', label: 'Milestones' },
          { view: 'garageShelf' as ViewName, icon: 'trophy-outline', label: 'My Rewards' },
          { view: 'history' as ViewName, icon: 'time-outline', label: 'History' },
          { view: 'dashboard' as ViewName, icon: 'stats-chart-outline', label: 'Dashboard' },
        ].map((item) => (
          <TouchableOpacity key={item.view} style={s.quickItem} onPress={() => changeView(item.view)} activeOpacity={0.8}>
            <View style={s.quickIcon}>
              <Ionicons name={item.icon as any} size={18} color={BRAND} />
            </View>
            <Text style={s.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Next Milestone Preview */}
      {nextMilestone && (
        <View style={s.upcomingCard}>
          <Text style={s.upcomingTitle}>Next Milestone</Text>
          <View style={[s.upcomingRow, s.upcomingRowFeatured]}>
            <View style={s.upcomingRowHeader}>
              <View style={s.upcomingDot}>
                <Text style={s.upcomingDotText}>{nextMilestone.referralCount}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.upcomingRowTitle}>{nextMilestone.referralCount} Referrals</Text>
                <Text style={s.upcomingRowDesc}>
                  Only {referralsToNext} more · pick one of 4 tracks
                </Text>
              </View>
              <Ionicons name="lock-closed-outline" size={14} color="#B8D4F0" />
            </View>
            <View style={s.upcomingRewardsList}>
              {FAMILY_ORDER.map((key) => (
                <View key={key} style={s.upcomingRewardLine}>
                  <View style={[s.upcomingRewardIcon, { backgroundColor: FAMILIES[key].color + '18' }]}>
                    <Ionicons name={FAMILIES[key].icon} size={11} color={FAMILIES[key].color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.upcomingRewardTrack, { color: FAMILIES[key].color }]}>{FAMILIES[key].name}</Text>
                    <Text style={s.upcomingRewardText}>{nextMilestone.rewards[key]}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={() => changeView('milestones')} style={s.viewAllLink} activeOpacity={0.8}>
            <Text style={s.viewAllText}>View all milestones</Text>
            <Ionicons name="chevron-forward" size={14} color={BRAND} />
          </TouchableOpacity>
        </View>
      )}

      {/* Terms & Conditions */}
      {remoteConfig.content.tnc.length > 0 ? (
        <MembershipTermsCard terms={remoteConfig.content.tnc} style={s.tncCardWrap} />
      ) : null}
    </View>
  );

  // ═══════════════ MILESTONES VIEW ═══════════════
  const renderMilestones = () => (
    <View>
      <Text style={ms.subtitle}>Refer more. Unlock more.{'\n'}Choose rewards you love.</Text>

      {/* Current milestone highlight */}
      {nextMilestone && !picks[nextMilestone.referralCount] && (
        <View style={ms.currentCard}>
          <View style={ms.currentTop}>
            <Text style={ms.currentTitle}>Milestone #{nextMilestone.referralCount}</Text>
            <Ionicons name="flag" size={16} color={BRAND} />
          </View>
          <Text style={ms.currentDesc}>{nextMilestone.referralCount} Successful Referrals</Text>
          <Text style={ms.currentChoose}>Choose ONE reward from any category</Text>
          <View style={ms.currentIcons}>
            {FAMILY_ORDER.map((key) => (
              <View key={key} style={ms.currentIconWrap}>
                <View style={[ms.currentIconCircle, { backgroundColor: FAMILIES[key].color + '18' }]}>
                  <Ionicons name={FAMILIES[key].icon} size={18} color={FAMILIES[key].color} />
                </View>
                <Text style={ms.currentIconLabel}>{FAMILIES[key].tag.split(' ').slice(0, 2).join('\n')}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* All milestones list */}
      {MILESTONES.map((m) => {
        const unlocked = referrals >= m.referralCount;
        const picked = picks[m.referralCount];
        const isNext = nextMilestone?.referralCount === m.referralCount;
        const canClaim = unlocked && !picked;
        const isExpanded = expandedMilestone === m.referralCount || isNext;
        const isLocked = !unlocked && !isNext;
        return (
          <TouchableOpacity
            key={m.referralCount}
            style={[ms.row, isLocked && { opacity: 0.5 }]}
            onPress={() => {
              if (canClaim) { setPendingMilestone(m); setSelectedReward(null); }
              else if (!isLocked) { setExpandedMilestone(isExpanded && !isNext ? null : m.referralCount); }
            }}
            activeOpacity={isLocked ? 1 : 0.7}
          >
            <View style={[ms.node, unlocked && ms.nodeUnlocked, isNext && ms.nodeNext]}>
              {unlocked ? (
                picked ? <Ionicons name={FAMILIES[picked].icon} size={14} color="#FFFFFF" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : isNext ? (
                <Text style={ms.nodeText}>{m.referralCount}</Text>
              ) : (
                <Ionicons name="lock-closed" size={12} color="#9CA3AF" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.rowTitle, unlocked && ms.rowTitleUnlocked]}>{m.referralCount} Referrals</Text>
              <Text style={ms.rowDesc} numberOfLines={isNext && !unlocked ? 2 : 1}>
                {picked
                  ? `${FAMILIES[picked].name} claimed`
                  : unlocked
                    ? 'Tap to claim reward'
                    : isNext
                      ? FAMILY_ORDER.map((key) => `${FAMILIES[key].tag}: ${m.rewards[key]}`).join(' · ')
                      : `${m.referralCount - referrals} more to unlock`}
              </Text>
              {/* Expanded reward details - only for unlocked/next milestone */}
              {isExpanded && !isLocked && (
                <View style={ms.expandedRewards}>
                  {FAMILY_ORDER.map((key) => (
                    <View key={key} style={ms.expandedRow}>
                      <View style={[ms.expandedIcon, { backgroundColor: FAMILIES[key].color + '15' }]}>
                        <Ionicons name={FAMILIES[key].icon} size={12} color={FAMILIES[key].color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={ms.expandedName}>{FAMILIES[key].name}</Text>
                        <Text style={ms.expandedReward}>{m.rewards[key]}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {/* Reward preview icons - only for claimed or next */}
              {!picked && !isExpanded && !isLocked && (
                <View style={ms.rewardPreview}>
                  {FAMILY_ORDER.map((key) => (
                    <View key={key} style={[ms.rewardMini, { backgroundColor: FAMILIES[key].color + '12' }]}>
                      <Ionicons name={FAMILIES[key].icon} size={9} color={FAMILIES[key].color} />
                    </View>
                  ))}
                  <Text style={ms.rewardPreviewText} numberOfLines={1}>
                    {m.rewards.myfngSave}
                  </Text>
                </View>
              )}
            </View>
            {unlocked && picked && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
            {unlocked && !picked && <Ionicons name="gift-outline" size={16} color={BRAND} />}
            {isNext && !unlocked && <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={BRAND} />}
            {isLocked && <Ionicons name="lock-closed" size={14} color="#D1D5DB" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ═══════════════ REWARD PICKER (Bottom Sheet Style) ═══════════════
  const renderRewardPicker = () => (
    <Modal
      visible={!!pendingMilestone}
      transparent
      animationType="slide"
      onRequestClose={() => dismissMilestonePicker(pendingMilestone?.referralCount)}
    >
      <View style={rp.overlay}>
        <TouchableOpacity
          style={rp.scrim}
          activeOpacity={1}
          onPress={() => dismissMilestonePicker(pendingMilestone?.referralCount)}
        />
        <View style={rp.sheet}>
          <View style={rp.handle} />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={rp.sheetScroll}>
          {pendingMilestone && (
            <>
              <View style={rp.headerRow}>
                <Text style={rp.title}>Milestone #{pendingMilestone.referralCount} Unlocked</Text>
              </View>
              <Text style={rp.desc}>Pick <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>one</Text> reward — it tells us what you care about.</Text>

              <View style={rp.list}>
                {FAMILY_ORDER.map((key) => {
                  const f = FAMILIES[key];
                  const reward = pendingMilestone.rewards[key];
                  const isSelected = selectedReward === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        rp.listCard,
                        { borderColor: f.color + '55' },
                        isSelected && { borderColor: '#4DA6FF', backgroundColor: '#004AAD55', borderWidth: 2.5 },
                      ]}
                      onPress={() => setSelectedReward(key)}
                      activeOpacity={0.85}
                    >
                      <View style={rp.listCardTop}>
                        <View style={[rp.cardIcon, { backgroundColor: f.color + '1A' }]}>
                          <Ionicons name={f.icon} size={18} color={f.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={rp.listCardTitleRow}>
                            <Text style={rp.cardName}>{f.name}</Text>
                            <Text style={[rp.cardTag, { color: f.color }]}>{f.tag}</Text>
                          </View>
                          <Text style={rp.listCardReward}>{reward}</Text>
                        </View>
                        {isSelected ? <Ionicons name="checkmark-circle" size={22} color={BRAND} /> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[rp.confirmBtn, !selectedReward && { opacity: 0.4 }]}
                onPress={handleConfirmReward}
                disabled={!selectedReward}
                activeOpacity={0.85}
              >
                <Text style={rp.confirmText}>Confirm Selection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={rp.laterBtn}
                onPress={() => dismissMilestonePicker(pendingMilestone.referralCount)}
                activeOpacity={0.8}
              >
                <Text style={rp.laterText}>I'll choose later</Text>
              </TouchableOpacity>

              <View style={rp.friendNote}>
                <Ionicons name="checkmark-circle" size={14} color="#34D399" />
                <Text style={rp.friendNoteText}>
                  Your friend gets wallet bonus on signup when they use your referral code.
                </Text>
              </View>
            </>
          )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ═══════════════ CONGRATULATIONS ═══════════════
  const renderCongrats = () => (
    <Modal visible={showCongrats} transparent animationType="fade" onRequestClose={closeCongrats}>
      <View style={cg.overlay}>
        <View style={cg.card}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#0066FF20', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Ionicons name="sparkles" size={28} color="#4DA6FF" />
          </View>
          <Text style={cg.title}>Congratulations!</Text>
          {congratsData && (
            <>
              <Text style={cg.subtitle}>You've unlocked</Text>
              <Text style={[cg.familyTag, { color: FAMILIES[congratsData.family].color }]}>
                {FAMILIES[congratsData.family].tag}
              </Text>
              <Text style={cg.rewardText}>
                {congratsData.milestone.rewards[congratsData.family]}
              </Text>
              <Text style={cg.ready}>Your reward is ready to use.</Text>

              <TouchableOpacity style={cg.primaryBtn} onPress={() => { closeCongrats(); changeView('garageShelf'); }} activeOpacity={0.85}>
                <Text style={cg.primaryBtnText}>View My Rewards</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cg.secondaryBtn} onPress={() => { closeCongrats(); changeView('share'); }} activeOpacity={0.85}>
                <Text style={cg.secondaryBtnText}>Invite More Friends</Text>
              </TouchableOpacity>

              <View style={cg.keepGoing}>
                <Text style={cg.keepGoingText}>Keep going!</Text>
                <Text style={cg.keepGoingSub}>
                  {nextMilestone ? `${referralsToNext} more referrals to next milestone` : 'All milestones done!'}
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ═══════════════ GARAGE SHELF ═══════════════
  const renderGarageShelf = () => {
    const earned = Object.entries(picks).map(([count, fam]) => ({
      count: Number(count),
      fam,
      reward: MILESTONES.find((m) => m.referralCount === Number(count))?.rewards[fam] || '',
    }));
    const unclaimed = MILESTONES.filter((m) => referrals >= m.referralCount && !picks[m.referralCount]);
    const locked = MILESTONES.filter((m) => referrals < m.referralCount);
    const totalValue = earned.filter((e) => e.fam === 'myfngSave').reduce((sum, e) => {
      const match = String(e.reward || '').match(/₹([\d,]+)/);
      return sum + (match ? Number(match[1].replace(/,/g, '')) : 0);
    }, 0);

    return (
      <View>
        <Text style={gs.subtitle}>Your earned rewards</Text>

        {earned.length > 0 ? (
          <View style={gs.grid}>
            {earned.map((e) => (
              <View key={e.count} style={[gs.card, { borderColor: FAMILIES[e.fam].color + '40' }]}>
                <View style={[gs.cardIcon, { backgroundColor: FAMILIES[e.fam].color + '18' }]}>
                  <Ionicons name={FAMILIES[e.fam].icon} size={22} color={FAMILIES[e.fam].color} />
                </View>
                <Text style={gs.cardLabel} numberOfLines={2}>{e.reward}</Text>
                <Text style={gs.cardEarned}>Earned</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={gs.empty}>
            <Ionicons name="trophy-outline" size={40} color="#4DA6FF" />
            <Text style={gs.emptyText}>No rewards yet. Invite friends!</Text>
          </View>
        )}

        {/* Unclaimed milestones */}
        {unclaimed.length > 0 && (
          <>
            <Text style={gs.sectionTitle}>Unclaimed Rewards</Text>
            <View style={gs.grid}>
              {unclaimed.map((m) => (
                <TouchableOpacity key={m.referralCount} style={[gs.card, { borderColor: '#0066FF40' }]} onPress={() => { setPendingMilestone(m); setSelectedReward(null); }} activeOpacity={0.8}>
                  <View style={[gs.cardIcon, { backgroundColor: '#0066FF18' }]}>
                    <Ionicons name="gift-outline" size={20} color="#4DA6FF" />
                  </View>
                  <Text style={gs.cardLabel}>{m.referralCount} Referrals</Text>
                  <Text style={gs.claimBtn}>Claim Now</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Locked milestones - show ALL remaining up to 20 */}
        {locked.length > 0 && (
          <>
            <Text style={gs.sectionTitle}>Locked</Text>
            <View style={gs.grid}>
              {locked.map((m) => (
                <View key={m.referralCount} style={[gs.card, { opacity: 0.6 }]}>
                  <View style={[gs.cardIcon, { backgroundColor: '#1A3A6B' }]}>
                    <Ionicons name="lock-closed" size={18} color="#4A6FA5" />
                  </View>
                  <Text style={gs.cardLabel}>{m.referralCount} Referrals</Text>
                  <Text style={[gs.cardEarned, { color: '#4A6FA5' }]}>Locked</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={gs.totals}>
          <View style={gs.totalBox}>
            <Text style={gs.totalNum}>{earned.length}</Text>
            <Text style={gs.totalLabel}>Total Rewards Earned</Text>
          </View>
          <View style={gs.totalBox}>
            <Text style={gs.totalNum}>₹{totalValue > 0 ? `${totalValue}+` : '0'}</Text>
            <Text style={gs.totalLabel}>Total Value</Text>
          </View>
        </View>
      </View>
    );
  };

  // ═══════════════ HISTORY ═══════════════
  const renderHistory = () => {
    const filtered = historyTab === 'completed' ? completedHistory : pendingHistory;
    return (
      <View>
        <View style={ht.tabs}>
          {(['completed', 'pending'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[ht.tab, historyTab === tab && ht.tabActive]} onPress={() => setHistoryTab(tab)} activeOpacity={0.8}>
              <Text style={[ht.tabText, historyTab === tab && ht.tabTextActive]}>
                {tab === 'completed' ? `Completed (${completedHistory.length})` : `Pending (${pendingHistory.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {historyLoading ? (
          <View style={ht.empty}>
            <ActivityIndicator size="small" color={BRAND} />
            <Text style={ht.emptyText}>Loading referral history…</Text>
          </View>
        ) : filtered.length > 0 ? filtered.map((item) => (
          <View key={item.id} style={ht.row}>
            <View style={ht.avatar}>
              <Ionicons name="person" size={16} color="#4DA6FF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ht.name}>{item.name}</Text>
              <Text style={ht.date}>{item.statusLabel || item.date}</Text>
            </View>
            {item.reward ? (
              <View style={ht.rewardPill}>
                <Text style={ht.rewardLabel}>Reward</Text>
                <Text style={ht.rewardValue}>{item.reward}</Text>
              </View>
            ) : (
              <Ionicons name="hourglass-outline" size={14} color="#F59E0B" />
            )}
          </View>
        )) : (
          <View style={ht.empty}>
            <Ionicons name="document-text-outline" size={30} color="#3A6A9E" />
            <Text style={ht.emptyText}>No {historyTab} referrals yet</Text>
          </View>
        )}

        {/* How Referrals Work */}
        <View style={ht.howCard}>
          <Text style={ht.howTitle}>How Referrals Work?</Text>
          <View style={ht.howSteps}>
            {[
              { icon: 'share-outline' as const, title: 'Invite', desc: 'Share your\nreferral code' },
              { icon: 'car-outline' as const, title: 'Friend Books', desc: 'They book &\ncomplete service' },
              { icon: 'gift-outline' as const, title: 'You Earn', desc: 'You unlock milestone\n& choose reward' },
            ].map((step, i) => (
              <View key={i} style={ht.howStep}>
                <View style={ht.howStepIcon}>
                  <Ionicons name={step.icon} size={18} color="#4DA6FF" />
                </View>
                <Text style={ht.howStepTitle}>{step.title}</Text>
                <Text style={ht.howStepDesc}>{step.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // ═══════════════ SHARE ═══════════════
  const renderShare = () => (
    <View>
      <View style={sh.hero}>
        <Text style={sh.heroLabel}>MYFNG</Text>
        <Text style={sh.heroTitle}>{remoteConfig.content.heroTitle || 'Great cars\ndeserve\ngreat care!'}</Text>
        <Text style={sh.heroDesc}>{remoteConfig.content.heroSubtitle || 'Join MYFNG and let\'s keep your car always performing at its best.'}</Text>
      </View>
      <View style={sh.codeCard}>
        <Text style={sh.codeLabel}>YOUR REFERRAL CODE</Text>
        <Text style={sh.codeValue}>{referralCode || 'MYFNG'}</Text>
      </View>
      <TouchableOpacity style={sh.whatsappBtn} onPress={shareOnWhatsApp} activeOpacity={0.85}>
        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
        <Text style={sh.whatsappText}>Share on WhatsApp</Text>
      </TouchableOpacity>
      <TouchableOpacity style={sh.contactsBtn} onPress={inviteFromContacts} activeOpacity={0.85}>
        <Ionicons name="people-outline" size={18} color="#FFFFFF" />
        <Text style={sh.contactsBtnText}>Invite from Contacts</Text>
      </TouchableOpacity>
      <TouchableOpacity style={sh.moreBtn} onPress={() => Share.share({ message: shareMessage })} activeOpacity={0.8}>
        <Text style={sh.moreText}>More Options</Text>
      </TouchableOpacity>
    </View>
  );

  // ═══════════════ DASHBOARD ═══════════════
  const renderDashboard = () => (
    <View>
      <Text style={db.subtitle}>Overview of your journey</Text>
      <View style={db.statsGrid}>
        {[
          { num: referralStats.total_invites_sent, label: 'Invites\nSent' },
          { num: referralStats.total_referred, label: 'Friends\nJoined' },
          { num: referralStats.total_pending, label: 'Pending\nReferrals' },
          { num: referralStats.total_rewarded, label: 'Successful\nReferrals' },
        ].map((stat, i) => (
          <View key={i} style={db.statBox}>
            <Text style={db.statNum}>{stat.num}</Text>
            <Text style={db.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={db.statsGrid}>
        {[
          { num: totalPicks, label: 'Rewards\nChosen' },
          { num: referralStats.total_earned > 0 ? `₹${Math.round(referralStats.total_earned)}` : '₹0', label: 'Wallet\nEarned' },
        ].map((stat, i) => (
          <View key={`extra-${i}`} style={[db.statBox, { flex: 1 }]}>
            <Text style={db.statNum}>{stat.num}</Text>
            <Text style={db.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {nextMilestone && (
        <View style={db.nextCard}>
          <Text style={db.nextTitle}>Next Milestone</Text>
          <Text style={db.nextNum}>{nextMilestone.referralCount} Referrals</Text>
          <Text style={db.nextDesc}>Big rewards coming your way!</Text>
        </View>
      )}

      <Text style={db.catTitle}>Your Top Category Picks</Text>
      <Text style={db.catSubtitle}>Based on rewards chosen</Text>
      {FAMILY_ORDER.map((key) => {
        const f = FAMILIES[key];
        const pct = totalPicks > 0 ? Math.round((categoryCounts[key] / totalPicks) * 100) : 0;
        return (
          <View key={key} style={db.catRow}>
            <Ionicons name={f.icon} size={14} color={f.color} />
            <Text style={db.catName}>{f.name}</Text>
            <View style={db.catBar}>
              <View style={[db.catBarFill, { width: `${pct}%`, backgroundColor: f.color }]} />
            </View>
            <Text style={db.catPct}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );

  // ═══════════════ CONTACTS ═══════════════
  const renderContactsInviteHeader = () => (
    <View style={ct.wrap}>
      <Text style={ct.sectionTitle}>Share Your Invite</Text>
      <Text style={ct.sectionSub}>Copy link or message and send manually — or pick a contact below.</Text>

      <View style={ct.card}>
        <Text style={ct.label}>YOUR REFERRAL CODE</Text>
        <View style={ct.valueRow}>
          <Text style={ct.codeValue} numberOfLines={1}>{referralCode || 'MYFNG'}</Text>
          <TouchableOpacity style={ct.copyChip} onPress={copyCode} activeOpacity={0.8}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={BRAND} />
            <Text style={ct.copyChipText}>{copied ? 'Copied' : 'Copy'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={ct.card}>
        <Text style={ct.label}>INVITE LINK</Text>
        <Text style={ct.linkValue} numberOfLines={2}>{inviteLink}</Text>
        <TouchableOpacity style={ct.copyChipWide} onPress={copyInviteLink} activeOpacity={0.8}>
          <Ionicons name={copiedLink ? 'checkmark' : 'link-outline'} size={14} color={BRAND} />
          <Text style={ct.copyChipText}>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</Text>
        </TouchableOpacity>
      </View>

      <View style={ct.actionsRow}>
        <TouchableOpacity style={ct.actionBtn} onPress={copyShareMessage} activeOpacity={0.85}>
          <Ionicons name={copiedMessage ? 'checkmark-circle' : 'document-text-outline'} size={16} color={BRAND} />
          <Text style={ct.actionBtnText}>{copiedMessage ? 'Copied!' : 'Copy Message'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ct.actionBtn} onPress={shareInviteLink} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={16} color={BRAND} />
          <Text style={ct.actionBtnText}>Share Link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ct.actionBtn, ct.actionBtnWhatsapp]} onPress={shareOnWhatsApp} activeOpacity={0.85}>
          <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
          <Text style={[ct.actionBtnText, ct.actionBtnTextLight]}>WhatsApp</Text>
        </TouchableOpacity>
      </View>

      <View style={ct.divider} />
      <View style={ct.contactsHeadingRow}>
        <Text style={ct.contactsHeading}>Invite From Contacts</Text>
        {!contactsAccessDenied && !contactsLoading ? (
          <TouchableOpacity style={ct.refreshChip} onPress={() => void refreshContactsScreen(false)} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={14} color={BRAND} />
            <Text style={ct.refreshChipText}>Refresh</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {contactsAccessDenied ? (
        <View style={ct.deniedCard}>
          <Ionicons name="people-outline" size={28} color={BRAND} />
          <Text style={ct.deniedTitle}>Contacts access needed</Text>
          <Text style={ct.deniedSub}>
            Allow contacts to pick friends and send invites. Settings → Notifications toggle alag hai — yahan se bhi permission de sakte ho.
          </Text>
          <TouchableOpacity style={ct.allowBtn} onPress={() => void handleAllowContactsPress()} activeOpacity={0.85}>
            <Text style={ct.allowBtnText}>Allow Contacts</Text>
          </TouchableOpacity>
          {!contactsCanAskAgain ? (
            <TouchableOpacity style={ct.settingsLink} onPress={() => Linking.openSettings()} activeOpacity={0.8}>
              <Text style={ct.settingsLinkText}>Open Phone Settings</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <TouchableOpacity style={ct.addMoreBtn} onPress={() => void handleAddMoreContacts()} activeOpacity={0.85}>
          <Ionicons name="person-add-outline" size={16} color={BRAND} />
          <Text style={ct.addMoreBtnText}>
            {contactsLimited ? 'Add More Contacts' : 'Select More Contacts'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderContacts = () => (
    <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: '#111827' }}
            placeholder="Search and refer your friends"
            placeholderTextColor="#9CA3AF"
            value={contactsSearch}
            onChangeText={setContactsSearch}
          />
        </View>
      </View>

      {renderContactsInviteHeader()}

      {contactsLoading ? (
        <View style={{ justifyContent: 'center', alignItems: 'center', paddingTop: 40, paddingBottom: 40 }}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 14 }}>Loading contacts...</Text>
        </View>
      ) : contactsAccessDenied ? null : filteredContacts.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 24, paddingBottom: 40, paddingHorizontal: 16 }}>
          <Ionicons name="people-outline" size={40} color="#D1D5DB" />
          <Text style={{ marginTop: 8, color: '#6B7280', textAlign: 'center' }}>
            No contacts with phone numbers yet. Tap &quot;Add More Contacts&quot; to allow more.
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {filteredContacts.map((item) => (
            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND_LIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: BRAND }}>{item.initials}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }} numberOfLines={1}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.phone}</Text>
              </View>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#25D366', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 4 }}
                onPress={() => inviteContact(item.phone, item.name)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFFFFF' }}>Invite</Text>
                <Ionicons name="logo-whatsapp" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // ═══════════════ RENDER ═══════════════
  const isDarkView = currentView === 'garageShelf' || currentView === 'share' || currentView === 'dashboard' || currentView === 'history';
  return (
    <View style={[s.root, isDarkView && { backgroundColor: '#001030', flex: 1, minHeight: '100%' }]}>
      {currentView === 'home' && renderHome()}
      {currentView === 'milestones' && renderMilestones()}
      {currentView === 'garageShelf' && renderGarageShelf()}
      {currentView === 'history' && renderHistory()}
      {currentView === 'share' && renderShare()}
      {currentView === 'dashboard' && renderDashboard()}
      {currentView === 'contacts' && renderContacts()}
      {renderRewardPicker()}
      {renderCongrats()}
    </View>
  );
});

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

const s = StyleSheet.create({
  root: { backgroundColor: '#EDF4FF', borderRadius: 16, padding: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 },
  headerTextWrap: { flex: 1, minWidth: 0, paddingRight: 4 },
  headerLabel: { fontSize: 10, letterSpacing: 2, color: '#4A6FA5', fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0A1A3A' },
  headerSub: { fontSize: 11, color: '#4A6FA5', marginTop: 2 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#D6E8FA', flexShrink: 0, maxWidth: 130 },
  headerBadgeText: { fontSize: 11, fontWeight: '600', color: BRAND, flexShrink: 1 },

  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#D6E8FA', ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }) },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressBig: { fontSize: 42, fontWeight: '800', color: BRAND },
  progressLabel: { fontSize: 12, color: '#4A6FA5', marginTop: 2 },
  progressCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDF4FF', borderWidth: 3, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  progressPct: { fontSize: 14, fontWeight: '800', color: BRAND },
  progressHint: { fontSize: 12, color: '#4A6FA5', marginBottom: 12 },
  dotsScroll: { marginTop: 4 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 4 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDF4FF', borderWidth: 1.5, borderColor: '#B8D4F0', alignItems: 'center', justifyContent: 'center' },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },
  dotNext: { borderColor: BRAND, borderWidth: 2 },
  dotText: { fontSize: 9, fontWeight: '700', color: '#4A6FA5' },
  dotTextFilled: { color: '#FFFFFF' },

  testBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3E8FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  testBannerText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#7C3AED' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND, borderRadius: 14, padding: 14, marginBottom: 14, ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10 }, android: { elevation: 5 } }) },
  inviteBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  codeBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E8FA', borderRadius: 14, padding: 14, marginBottom: 14, ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }) },
  codeLabel: { fontSize: 9, fontWeight: '700', color: '#4A6FA5', letterSpacing: 1, marginBottom: 4 },
  codeValue: { fontSize: 22, fontWeight: '900', color: '#0A1A3A', letterSpacing: 2, marginBottom: 12 },
  codeActions: { flexDirection: 'row', gap: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF4FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#D6E8FA' },
  copyText: { fontSize: 11, fontWeight: '600', color: BRAND },
  contactsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EDF4FF', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#D6E8FA' },
  contactsBtnText: { fontSize: 11, fontWeight: '600', color: BRAND },
  shareWhatsapp: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#25D366', borderRadius: 10, paddingVertical: 9 },
  shareWhatsappText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  quickItem: { alignItems: 'center', width: '23%' },
  quickIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E8FA', alignItems: 'center', justifyContent: 'center', marginBottom: 6, ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6 }, android: { elevation: 2 } }) },
  quickLabel: { fontSize: 10, fontWeight: '600', color: '#4A6FA5', textAlign: 'center' },

  upcomingCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#D6E8FA', ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 }, android: { elevation: 2 } }) },
  upcomingTitle: { fontSize: 14, fontWeight: '700', color: '#0A1A3A', marginBottom: 10 },
  upcomingRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E8F1FD' },
  upcomingRowFeatured: { backgroundColor: '#F8FBFF', borderRadius: 12, paddingHorizontal: 10, marginBottom: 4, borderBottomWidth: 0 },
  upcomingRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  upcomingDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EDF4FF', alignItems: 'center', justifyContent: 'center' },
  upcomingDotText: { fontSize: 11, fontWeight: '700', color: BRAND },
  upcomingRowTitle: { fontSize: 13, fontWeight: '600', color: '#0A1A3A' },
  upcomingRowDesc: { fontSize: 11, color: '#4A6FA5', marginTop: 1 },
  upcomingRewardsList: { marginTop: 10, gap: 8 },
  upcomingRewardLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  upcomingRewardIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  upcomingRewardTrack: { fontSize: 11, fontWeight: '800' },
  upcomingRewardText: { fontSize: 11, color: '#4A6FA5', marginTop: 2, lineHeight: 16 },
  upcomingRewardSummary: { fontSize: 10, color: '#6B7280', marginTop: 8, lineHeight: 15, paddingLeft: 42 },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12 },
  viewAllText: { fontSize: 12, fontWeight: '600', color: BRAND },

  tncCardWrap: { marginTop: 14 },
});

const ms = StyleSheet.create({
  subtitle: { fontSize: 13, color: '#4A6FA5', marginBottom: 16, lineHeight: 20 },
  currentCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6E8FA', borderRadius: 18, padding: 18, marginBottom: 18, ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10 }, android: { elevation: 3 } }) },
  currentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  currentTitle: { fontSize: 16, fontWeight: '700', color: '#0A1A3A' },
  currentDesc: { fontSize: 12, color: '#4A6FA5', marginBottom: 8 },
  currentChoose: { fontSize: 12, color: '#4A6FA5', fontWeight: '500', marginBottom: 14 },
  currentIcons: { flexDirection: 'row', justifyContent: 'space-between' },
  currentIconWrap: { alignItems: 'center', width: '23%' },
  currentIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  currentIconLabel: { fontSize: 8, color: '#4A6FA5', fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E8F1FD' },
  node: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F1FD', borderWidth: 1.5, borderColor: '#D6E8FA', alignItems: 'center', justifyContent: 'center' },
  nodeUnlocked: { backgroundColor: BRAND, borderColor: BRAND },
  nodeNext: { borderColor: BRAND, borderWidth: 2 },
  nodeText: { fontSize: 11, fontWeight: '700', color: '#4A6FA5' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#4A6FA5' },
  rowTitleUnlocked: { color: '#0A1A3A' },
  rowDesc: { fontSize: 11, color: '#7BA3D0', marginTop: 1 },
  rewardPreview: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  rewardMini: { width: 16, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  rewardPreviewText: { fontSize: 9, color: '#6B7280', marginLeft: 4, flex: 1 },
  expandedRewards: { marginTop: 8, backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E8F1FD' },
  expandedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  expandedIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  expandedName: { fontSize: 10, fontWeight: '700', color: '#0A1A3A' },
  expandedReward: { fontSize: 10, color: '#4A6FA5' },
});

const rp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,15,40,0.65)' },
  sheet: { backgroundColor: '#001840', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '88%', borderTopWidth: 1, borderColor: '#1A3A6B' },
  sheetScroll: { paddingHorizontal: 20, paddingBottom: 34 },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: '#1A3A6B', alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  headerRow: { marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  desc: { fontSize: 13, color: '#93B4E0', marginBottom: 14 },
  list: { gap: 10 },
  listCard: {
    backgroundColor: '#002060',
    borderWidth: 1.5,
    borderColor: '#1A3A6B',
    borderRadius: 14,
    padding: 14,
  },
  listCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  listCardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  listCardReward: { fontSize: 12, color: '#C7D9F5', lineHeight: 18 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTag: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  confirmBtn: { backgroundColor: '#0066FF', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 14 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  laterBtn: { alignItems: 'center', paddingVertical: 12 },
  laterText: { fontSize: 13, fontWeight: '600', color: '#93B4E0' },
  friendNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#001030', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 12, padding: 12, marginTop: 4 },
  friendNoteText: { flex: 1, fontSize: 11, color: '#93B4E0', lineHeight: 16 },
});

const cg = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,15,40,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#001840', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 28, padding: 28, width: '100%', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#93B4E0', marginBottom: 4 },
  familyTag: { fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  rewardText: { fontSize: 14, color: '#FFFFFF', textAlign: 'center', marginBottom: 6, lineHeight: 20 },
  ready: { fontSize: 12, color: '#93B4E0', marginBottom: 20 },
  primaryBtn: { backgroundColor: '#0066FF', borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  secondaryBtn: { borderWidth: 1.5, borderColor: '#1A3A6B', borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  keepGoing: { marginTop: 18, alignItems: 'center' },
  keepGoingText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  keepGoingSub: { fontSize: 11, color: '#93B4E0', marginTop: 2 },
});

const gs = StyleSheet.create({
  subtitle: { fontSize: 13, color: '#93B4E0', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  card: { width: '30%', backgroundColor: '#002060', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 14, padding: 12, alignItems: 'center' },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  cardLabel: { fontSize: 10, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', marginBottom: 4 },
  cardEarned: { fontSize: 9, fontWeight: '700', color: '#34D399' },
  claimBtn: { fontSize: 9, fontWeight: '700', color: '#4DA6FF' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 12, color: '#93B4E0' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, marginTop: 6 },
  totals: { flexDirection: 'row', gap: 10, marginTop: 6 },
  totalBox: { flex: 1, backgroundColor: '#002060', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 14, padding: 14, alignItems: 'center' },
  totalNum: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  totalLabel: { fontSize: 10, color: '#93B4E0', textAlign: 'center' },
});

const ht = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#002060', borderRadius: 10, padding: 3, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#003090' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#5A8BC4' },
  tabTextActive: { color: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A3A6B' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#002060', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  date: { fontSize: 11, color: '#93B4E0', marginTop: 2 },
  rewardPill: { alignItems: 'flex-end' },
  rewardLabel: { fontSize: 9, color: '#5A8BC4' },
  rewardValue: { fontSize: 11, fontWeight: '700', color: '#4DA6FF' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 12, color: '#5A8BC4' },
  howCard: { marginTop: 20, backgroundColor: '#002060', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1A3A6B' },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginBottom: 14 },
  howSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  howStep: { alignItems: 'center', width: '30%' },
  howStepIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#003090', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  howStepTitle: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  howStepDesc: { fontSize: 9, color: '#93B4E0', textAlign: 'center', lineHeight: 13 },
});

const sh = StyleSheet.create({
  hero: { backgroundColor: '#001840', borderRadius: 18, padding: 22, marginBottom: 16 },
  heroLabel: { fontSize: 10, letterSpacing: 2, color: '#4DA6FF', fontWeight: '700', marginBottom: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', lineHeight: 32, marginBottom: 10 },
  heroDesc: { fontSize: 12, color: '#93B4E0', lineHeight: 18 },
  codeCard: { backgroundColor: '#002060', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 14 },
  codeLabel: { fontSize: 9, fontWeight: '700', color: '#93B4E0', letterSpacing: 1, marginBottom: 4 },
  codeValue: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  whatsappBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#25D366', borderRadius: 14, padding: 16, marginBottom: 10 },
  whatsappText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  contactsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#003090', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#1A4A8B' },
  contactsBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  moreBtn: { alignItems: 'center', paddingVertical: 10 },
  moreText: { fontSize: 13, fontWeight: '600', color: '#4DA6FF' },
});

const db = StyleSheet.create({
  subtitle: { fontSize: 13, color: '#93B4E0', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statBox: { width: '47%', backgroundColor: '#002060', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 14, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  statLabel: { fontSize: 10, color: '#93B4E0', textAlign: 'center' },
  nextCard: { backgroundColor: '#003090', borderRadius: 14, padding: 16, marginBottom: 16 },
  nextTitle: { fontSize: 11, fontWeight: '600', color: '#4DA6FF', marginBottom: 4 },
  nextNum: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  nextDesc: { fontSize: 12, color: '#93B4E0' },
  catTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  catSubtitle: { fontSize: 11, color: '#93B4E0', marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catName: { fontSize: 11, fontWeight: '600', color: '#FFFFFF', width: 70 },
  catBar: { flex: 1, height: 6, backgroundColor: '#1A3A6B', borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPct: { fontSize: 11, fontWeight: '700', color: '#93B4E0', width: 32, textAlign: 'right' },
});

const ct = StyleSheet.create({
  wrap: { marginBottom: 8, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginBottom: 14 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E8FA',
    padding: 14,
    marginBottom: 10,
  },
  label: { fontSize: 10, fontWeight: '700', color: '#4A6FA5', letterSpacing: 0.8, marginBottom: 8 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeValue: { flex: 1, fontSize: 22, fontWeight: '900', color: '#0A1A3A', letterSpacing: 1 },
  linkValue: { fontSize: 13, fontWeight: '600', color: BRAND, lineHeight: 18, marginBottom: 10 },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: BRAND_LIGHT,
  },
  copyChipWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: BRAND_LIGHT,
  },
  copyChipText: { fontSize: 12, fontWeight: '700', color: BRAND },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  actionBtn: {
    flexGrow: 1,
    minWidth: '30%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E8FA',
  },
  actionBtnWhatsapp: { backgroundColor: '#25D366', borderColor: '#25D366' },
  actionBtnText: { fontSize: 12, fontWeight: '700', color: BRAND },
  actionBtnTextLight: { color: '#FFFFFF' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 14 },
  contactsHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  contactsHeading: { fontSize: 14, fontWeight: '700', color: '#111827' },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: BRAND_LIGHT,
  },
  refreshChipText: { fontSize: 11, fontWeight: '700', color: BRAND },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6E8FA',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  addMoreBtnText: { fontSize: 13, fontWeight: '700', color: BRAND },
  deniedCard: {
    alignItems: 'center',
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E8FA',
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  deniedTitle: { marginTop: 10, fontSize: 15, fontWeight: '800', color: '#111827' },
  deniedSub: { marginTop: 6, fontSize: 12, lineHeight: 17, color: '#6B7280', textAlign: 'center' },
  allowBtn: {
    marginTop: 14,
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  allowBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  settingsLink: { marginTop: 10, paddingVertical: 6 },
  settingsLinkText: { fontSize: 12, fontWeight: '700', color: BRAND },
});

export default ReferAndRiseInline;
