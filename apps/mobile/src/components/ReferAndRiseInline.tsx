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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { apiFetch } from '../lib/api';
import { ENV } from '../config/environment';
import {
  FAMILIES,
  FAMILY_ORDER,
  MILESTONES,
  MILESTONE_COUNTS,
  MAX_REFERRALS,
  getNextMilestone,
  getUnlockedMilestone,
  getCurrentMilestoneIndex,
  type FamilyKey,
  type Milestone,
} from '../constants/referAndRise';
import { useReferAndRiseConfig } from '../hooks/useReferAndRiseConfig';

const BRAND = '#004AAD';
const BRAND_LIGHT = '#E8F1FD';
const BRAND_BG = '#F0F7FF';

type Props = {
  referralCode: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onViewChange?: (title: string) => void;
};

export type ReferAndRiseHandle = {
  handleBack: () => boolean;
  getViewTitle: () => string;
};

type ViewName = 'home' | 'milestones' | 'garageShelf' | 'history' | 'share' | 'dashboard';

const VIEW_TITLES: Record<ViewName, string> = {
  home: 'Refer & Rise',
  milestones: 'Milestones',
  garageShelf: 'My Garage Shelf',
  history: 'Referral History',
  share: 'Share Referral',
  dashboard: 'Referral Dashboard',
};

type HistoryItem = {
  name: string;
  date: string;
  reward: string;
  status: 'completed' | 'pending';
  statusLabel?: string;
};

const ReferAndRiseInline = forwardRef(function ReferAndRiseInline({ referralCode, isLoggedIn, onLogin, onViewChange }: Props, ref: React.Ref<ReferAndRiseHandle>) {
  const [currentView, setCurrentView] = useState<ViewName>('home');
  const remoteConfig = useReferAndRiseConfig();
  const activeMilestones = remoteConfig.milestones;
  const activeFamilies = remoteConfig.families;
  const activeMaxReferrals = activeMilestones.length > 0 ? activeMilestones[activeMilestones.length - 1].referralCount : MAX_REFERRALS;

  const changeView = (view: ViewName) => {
    setCurrentView(view);
    onViewChange?.(VIEW_TITLES[view]);
  };
  const [referrals, setReferrals] = useState(0);
  const [picks, setPicks] = useState<Record<number, FamilyKey>>({});
  const [pendingMilestone, setPendingMilestone] = useState<Milestone | null>(null);
  const [selectedReward, setSelectedReward] = useState<FamilyKey | null>(null);
  const [showCongrats, setShowCongrats] = useState(false);
  const [congratsData, setCongratsData] = useState<{ milestone: Milestone; family: FamilyKey } | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);
  const [historyTab, setHistoryTab] = useState<'completed' | 'pending'>('completed');

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
    apiFetch<any>('/api/customer/referral')
      .then((res) => {
        if (res?.stats?.total_rewarded) setReferrals(res.stats.total_rewarded);
        if (res?.refer_and_rise?.picks) setPicks(res.refer_and_rise.picks);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const currentIdx = getCurrentMilestoneIndex(referrals);
  const nextMilestone = getNextMilestone(referrals);
  const progressPct = (referrals / MAX_REFERRALS) * 100;
  const referralsToNext = nextMilestone ? nextMilestone.referralCount - referrals : 0;

  const referralLink = `https://play.google.com/store/apps/details?id=com.myfng.app&referrer=${encodeURIComponent(`referral_code=${referralCode || 'MYFNG'}`)}`;

  const shareMessage = `🚗 Great cars deserve great care!\n\nJoin MyFNG and let's keep your car always performing at its best.\n\nUse my referral code *${referralCode || 'MYFNG'}* to get ₹1,500 wallet bonus instantly.\n\n👉 ${referralLink}`;

  const simulateReferral = () => {
    if (pendingMilestone || referrals >= MAX_REFERRALS) return;
    const next = referrals + 1;
    setReferrals(next);
    const unlocked = getUnlockedMilestone(next);
    if (unlocked) {
      setPendingMilestone(unlocked);
    }
  };

  const shareOnWhatsApp = () => Share.share({ message: shareMessage });
  const inviteFromContacts = () => {
    const smsBody = encodeURIComponent(shareMessage);
    Linking.openURL(`sms:&body=${smsBody}`).catch(() => Share.share({ message: shareMessage }));
  };

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
    setPicks((p) => ({ ...p, [ms.referralCount]: family }));
    setPendingMilestone(null);
    setSelectedReward(null);
    setCongratsData({ milestone: ms, family });
    setShowCongrats(true);
    try {
      await apiFetch('/api/customer/referral/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCount: ms.referralCount, family }),
      });
    } catch {}
  };

  const closeCongrats = () => { setShowCongrats(false); setCongratsData(null); };

  const dummyHistory: HistoryItem[] = [
    ...Object.entries(picks).map(([count, fam]) => ({
      name: `Referral #${count}`,
      date: `Completed on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      reward: FAMILIES[fam].name,
      status: 'completed' as const,
    })),
    { name: 'Vikas Singh', date: 'Booked Service', statusLabel: 'Service on 17 May 2025', reward: '', status: 'pending' },
    { name: 'Karan Patel', date: 'Invitation Sent', statusLabel: 'Waiting for booking', reward: '', status: 'pending' },
  ];

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
        <View>
          <Text style={s.headerLabel}>MYFNG</Text>
          <Text style={s.headerTitle}>Refer & Rise</Text>
        </View>
        <View style={s.headerBadge}>
          <Ionicons name="sparkles" size={12} color={BRAND} />
          <Text style={s.headerBadgeText}>
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
        <View style={s.dotsRow}>
          {MILESTONE_COUNTS.map((count) => (
            <View key={count} style={[s.dot, referrals >= count && s.dotFilled, nextMilestone?.referralCount === count && s.dotNext]}>
              <Text style={[s.dotText, referrals >= count && s.dotTextFilled]}>{count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Invite Button */}
      <TouchableOpacity style={s.inviteBtn} onPress={simulateReferral} activeOpacity={0.85} disabled={!!pendingMilestone || referrals >= MAX_REFERRALS}>
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

      {/* Upcoming Milestones Preview */}
      {nextMilestone && (
        <View style={s.upcomingCard}>
          <Text style={s.upcomingTitle}>Upcoming Milestones</Text>
          {MILESTONES.filter((m) => m.referralCount > referrals).slice(0, 3).map((m) => (
            <View key={m.referralCount} style={s.upcomingRow}>
              <View style={s.upcomingDot}>
                <Text style={s.upcomingDotText}>{m.referralCount}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.upcomingRowTitle}>{m.referralCount} Referrals</Text>
                <Text style={s.upcomingRowDesc}>
                  {m.referralCount - referrals <= 2 ? 'Unlock exciting rewards' : 'Bigger rewards await'}
                </Text>
              </View>
              <Ionicons name="lock-closed-outline" size={14} color="#B8D4F0" />
            </View>
          ))}
          <TouchableOpacity onPress={() => changeView('milestones')} style={s.viewAllLink} activeOpacity={0.8}>
            <Text style={s.viewAllText}>View all milestones</Text>
            <Ionicons name="chevron-forward" size={14} color={BRAND} />
          </TouchableOpacity>
        </View>
      )}

      {/* Terms & Conditions */}
      <View style={s.tncCard}>
        <Text style={s.tncTitle}>Terms & Conditions</Text>
        {remoteConfig.content.tnc.map((item, idx) => (
          <View key={idx} style={s.tncRow}>
            <Text style={s.tncBullet}>•</Text>
            <Text style={s.tncText}>{item}</Text>
          </View>
        ))}
      </View>
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
        const isExpanded = expandedMilestone === m.referralCount;
        return (
          <TouchableOpacity
            key={m.referralCount}
            style={ms.row}
            onPress={() => {
              if (canClaim) { setPendingMilestone(m); setSelectedReward(null); }
              else { setExpandedMilestone(isExpanded ? null : m.referralCount); }
            }}
            activeOpacity={0.7}
          >
            <View style={[ms.node, unlocked && ms.nodeUnlocked, isNext && ms.nodeNext]}>
              {unlocked ? (
                picked ? <Ionicons name={FAMILIES[picked].icon} size={14} color="#FFFFFF" /> : <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text style={ms.nodeText}>{m.referralCount}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ms.rowTitle, unlocked && ms.rowTitleUnlocked]}>{m.referralCount} Referrals</Text>
              <Text style={ms.rowDesc} numberOfLines={1}>
                {picked ? `${FAMILIES[picked].name} claimed` : unlocked ? 'Tap to claim reward' : isNext ? 'Unlock exciting rewards' : `${m.referralCount - referrals} more to unlock`}
              </Text>
              {/* Expanded reward details */}
              {isExpanded && (
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
              {/* Reward preview icons (collapsed) */}
              {!picked && !isExpanded && (
                <View style={ms.rewardPreview}>
                  {FAMILY_ORDER.map((key) => (
                    <View key={key} style={[ms.rewardMini, { backgroundColor: FAMILIES[key].color + '12' }]}>
                      <Ionicons name={FAMILIES[key].icon} size={9} color={FAMILIES[key].color} />
                    </View>
                  ))}
                  <Text style={ms.rewardPreviewText} numberOfLines={1}>
                    {m.rewards.saveMoney}
                  </Text>
                </View>
              )}
            </View>
            {unlocked && picked && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
            {unlocked && !picked && <Ionicons name="gift-outline" size={16} color={BRAND} />}
            {!unlocked && <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color="#7BA3D0" />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ═══════════════ REWARD PICKER (Bottom Sheet Style) ═══════════════
  const renderRewardPicker = () => (
    <Modal visible={!!pendingMilestone} transparent animationType="slide" onRequestClose={() => setPendingMilestone(null)}>
      <View style={rp.overlay}>
        <TouchableOpacity style={rp.scrim} activeOpacity={1} onPress={() => setPendingMilestone(null)} />
        <View style={rp.sheet}>
          <View style={rp.handle} />
          {pendingMilestone && (
            <>
              <View style={rp.headerRow}>
                <Text style={rp.title}>Milestone #{pendingMilestone.referralCount} Unlocked</Text>
              </View>
              <Text style={rp.desc}>Pick <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>one</Text> reward — it tells us what you care about.</Text>

              {/* 2x2 Grid */}
              <View style={rp.grid}>
                {FAMILY_ORDER.map((key) => {
                  const f = FAMILIES[key];
                  const reward = pendingMilestone.rewards[key];
                  const isSelected = selectedReward === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        rp.card,
                        { borderColor: f.color + '40', borderWidth: 1.5 },
                        isSelected && { borderColor: f.color, borderWidth: 2, backgroundColor: `${f.color}12` },
                        Platform.select({
                          ios: { shadowColor: f.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: isSelected ? 0.7 : 0.2, shadowRadius: isSelected ? 14 : 5 },
                          android: { elevation: isSelected ? 10 : 3 },
                        }),
                      ]}
                      onPress={() => setSelectedReward(key)}
                      activeOpacity={0.85}
                    >
                      <View style={rp.cardTop}>
                        <View style={[rp.cardIcon, { backgroundColor: f.color + '1A' }]}>
                          <Ionicons name={f.icon} size={18} color={f.color} />
                        </View>
                        <Text style={[rp.cardTag, { color: f.color }]} numberOfLines={1}>{f.tag}</Text>
                      </View>
                      <Text style={rp.cardName} numberOfLines={1}>{f.name}</Text>
                      <Text style={rp.cardReward} numberOfLines={2}>{reward}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Confirm */}
              <TouchableOpacity
                style={[rp.confirmBtn, !selectedReward && { opacity: 0.4 }]}
                onPress={handleConfirmReward}
                disabled={!selectedReward}
                activeOpacity={0.85}
              >
                <Text style={rp.confirmText}>Confirm Selection</Text>
              </TouchableOpacity>

              {/* Claim Later */}
              <TouchableOpacity style={rp.laterBtn} onPress={() => setPendingMilestone(null)} activeOpacity={0.8}>
                <Text style={rp.laterText}>I'll choose later</Text>
              </TouchableOpacity>

              {/* Friend reward note */}
              <View style={rp.friendNote}>
                <Ionicons name="checkmark-circle" size={14} color="#34D399" />
                <Text style={rp.friendNoteText}>
                  Your friend just got a <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>free in-app health check</Text> — claimed the moment they installed.
                </Text>
              </View>
            </>
          )}
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
    const totalValue = earned.filter((e) => e.fam === 'saveMoney').length * 500;

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
    const filtered = dummyHistory.filter((h) => h.status === historyTab);
    return (
      <View>
        <View style={ht.tabs}>
          {(['completed', 'pending'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[ht.tab, historyTab === tab && ht.tabActive]} onPress={() => setHistoryTab(tab)} activeOpacity={0.8}>
              <Text style={[ht.tabText, historyTab === tab && ht.tabTextActive]}>{tab === 'completed' ? 'Completed' : 'Pending'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length > 0 ? filtered.map((item, i) => (
          <View key={i} style={ht.row}>
            <View style={ht.avatar}>
              <Ionicons name="person" size={16} color="#6B7280" />
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
            <Ionicons name="document-text-outline" size={30} color="#D1D5DB" />
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
                  <Ionicons name={step.icon} size={18} color={BRAND} />
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
        <Text style={sh.heroTitle}>Great cars{'\n'}deserve{'\n'}great care!</Text>
        <Text style={sh.heroDesc}>Join MYFNG and let's keep your car always performing at its best.</Text>
      </View>
      <View style={sh.codeCard}>
        <Text style={sh.codeLabel}>YOUR REFERRAL CODE</Text>
        <Text style={sh.codeValue}>{referralCode || 'MYFNG'}</Text>
      </View>
      <TouchableOpacity style={sh.whatsappBtn} onPress={shareOnWhatsApp} activeOpacity={0.85}>
        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
        <Text style={sh.whatsappText}>Share on WhatsApp</Text>
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
          { num: referrals, label: 'Total Invited' },
          { num: totalPicks, label: 'Successful\nReferrals' },
          { num: totalPicks, label: 'Rewards\nEarned' },
          { num: `₹${totalPicks * 300}+`, label: 'Total Value\nEarned' },
        ].map((stat, i) => (
          <View key={i} style={db.statBox}>
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

  // ═══════════════ RENDER ═══════════════
  const isDarkView = currentView === 'garageShelf' || currentView === 'share' || currentView === 'dashboard';
  return (
    <View style={[s.root, isDarkView && { backgroundColor: '#001030' }]}>
      {currentView === 'home' && renderHome()}
      {currentView === 'milestones' && renderMilestones()}
      {currentView === 'garageShelf' && renderGarageShelf()}
      {currentView === 'history' && renderHistory()}
      {currentView === 'share' && renderShare()}
      {currentView === 'dashboard' && renderDashboard()}
      {renderRewardPicker()}
      {renderCongrats()}
    </View>
  );
});

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

const s = StyleSheet.create({
  root: { backgroundColor: '#EDF4FF', borderRadius: 16, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerLabel: { fontSize: 10, letterSpacing: 2, color: '#4A6FA5', fontWeight: '600' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#0A1A3A' },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#D6E8FA' },
  headerBadgeText: { fontSize: 11, fontWeight: '600', color: BRAND },

  progressCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#D6E8FA', ...Platform.select({ ios: { shadowColor: '#004AAD', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 3 } }) },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressBig: { fontSize: 42, fontWeight: '800', color: BRAND },
  progressLabel: { fontSize: 12, color: '#4A6FA5', marginTop: 2 },
  progressCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDF4FF', borderWidth: 3, borderColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  progressPct: { fontSize: 14, fontWeight: '800', color: BRAND },
  progressHint: { fontSize: 12, color: '#4A6FA5', marginBottom: 12 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDF4FF', borderWidth: 1.5, borderColor: '#B8D4F0', alignItems: 'center', justifyContent: 'center' },
  dotFilled: { backgroundColor: BRAND, borderColor: BRAND },
  dotNext: { borderColor: BRAND, borderWidth: 2 },
  dotText: { fontSize: 9, fontWeight: '700', color: '#4A6FA5' },
  dotTextFilled: { color: '#FFFFFF' },

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
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E8F1FD' },
  upcomingDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EDF4FF', alignItems: 'center', justifyContent: 'center' },
  upcomingDotText: { fontSize: 11, fontWeight: '700', color: BRAND },
  upcomingRowTitle: { fontSize: 13, fontWeight: '600', color: '#0A1A3A' },
  upcomingRowDesc: { fontSize: 11, color: '#4A6FA5', marginTop: 1 },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 12 },
  viewAllText: { fontSize: 12, fontWeight: '600', color: BRAND },

  tncCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#D6E8FA' },
  tncTitle: { fontSize: 12, fontWeight: '700', color: '#0A1A3A', marginBottom: 8 },
  tncRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  tncBullet: { fontSize: 11, color: '#4A6FA5', lineHeight: 17 },
  tncText: { fontSize: 11, color: '#4A6FA5', lineHeight: 17, flex: 1 },
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
  sheet: { backgroundColor: '#001840', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 34, borderTopWidth: 1, borderColor: '#1A3A6B' },
  handle: { width: 40, height: 4, borderRadius: 4, backgroundColor: '#1A3A6B', alignSelf: 'center', marginBottom: 16 },
  headerRow: { marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  desc: { fontSize: 13, color: '#93B4E0', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', backgroundColor: '#002060', borderWidth: 1.5, borderColor: '#1A3A6B',
    borderRadius: 16, padding: 14, minHeight: 130, overflow: 'hidden',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTag: { fontSize: 7, fontWeight: '800', letterSpacing: 0.3, flexShrink: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  cardReward: { fontSize: 10.5, color: '#93B4E0', lineHeight: 14 },
  confirmBtn: { backgroundColor: '#0066FF', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 14 },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  laterBtn: { alignItems: 'center', paddingVertical: 12 },
  laterText: { fontSize: 13, fontWeight: '600', color: '#93B4E0' },
  friendNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#001030', borderWidth: 1, borderColor: '#1A3A6B', borderRadius: 12, padding: 12 },
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
  tabs: { flexDirection: 'row', backgroundColor: '#E8F1FD', borderRadius: 10, padding: 3, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive: { color: '#0A1A3A' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8F1FD' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F1FD', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '600', color: '#0A1A3A' },
  date: { fontSize: 11, color: '#7BA3D0', marginTop: 2 },
  rewardPill: { alignItems: 'flex-end' },
  rewardLabel: { fontSize: 9, color: '#9CA3AF' },
  rewardValue: { fontSize: 11, fontWeight: '700', color: BRAND },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: 12, color: '#9CA3AF' },
  howCard: { marginTop: 20, backgroundColor: '#E8F1FD', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#D6E8FA' },
  howTitle: { fontSize: 13, fontWeight: '700', color: '#0A1A3A', marginBottom: 14 },
  howSteps: { flexDirection: 'row', justifyContent: 'space-between' },
  howStep: { alignItems: 'center', width: '30%' },
  howStepIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND_LIGHT, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  howStepTitle: { fontSize: 11, fontWeight: '700', color: '#0A1A3A', marginBottom: 2 },
  howStepDesc: { fontSize: 9, color: '#4A6FA5', textAlign: 'center', lineHeight: 13 },
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

export default ReferAndRiseInline;
