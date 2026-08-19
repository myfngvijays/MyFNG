import React, { useState, useEffect } from 'react';
import { formatDateTime } from "@/lib/dateFormat";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
  BackHandler,
  Modal,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { COLORS, SPACING } from '../../../constants/theme';
import {
  istYmd,
  istDayBounds,
} from '../../../lib/crmDateRange';

type ScopeFilter = 'all' | 'today' | 'calendar' | 'completed';
type TypeFilter = 'all' | 'CALLBACK';
type DropdownKey = 'type' | null;
type CalendarPickMode = 'single' | 'range';

function scheduledInIstRange(iso: string, startIso: string, endIso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= new Date(startIso).getTime() && t <= new Date(endIso).getTime();
}

function isScheduledIstToday(iso: string) {
  const bounds = istDayBounds(istYmd());
  return scheduledInIstRange(iso, bounds.start, bounds.end);
}

function formatYmdShort(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

function addMonthsYm(year: number, month0: number, delta: number) {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

function ymdFromParts(y: number, m0: number, day: number) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthCells(year: number, month0: number) {
  const firstDow = new Date(year, month0, 1).getDay(); // 0 Sun
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const cells: Array<{ ymd: string | null; day: number | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ ymd: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ ymd: ymdFromParts(year, month0, day), day });
  }
  while (cells.length % 7 !== 0) cells.push({ ymd: null, day: null });
  return cells;
}

export default function TelecallerFollowUpsScreen({ navigation, route, embedded = false }: any) {
  const { user } = useAuth();
  const initialFilter = route?.params?.filter;

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ScopeFilter>(
    initialFilter === 'today'
      ? 'today'
      : initialFilter === 'completed'
        ? 'completed'
        : initialFilter === 'overdue' || initialFilter === 'upcoming'
          ? 'calendar'
          : 'all',
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarPickMode, setCalendarPickMode] = useState<CalendarPickMode>('single');
  const [draftStart, setDraftStart] = useState(istYmd());
  const [draftEnd, setDraftEnd] = useState(istYmd());
  const [rangeTap, setRangeTap] = useState<'start' | 'end'>('start');
  const todayYmd = istYmd();
  const [viewYear, setViewYear] = useState(() => Number(todayYmd.slice(0, 4)));
  const [viewMonth0, setViewMonth0] = useState(() => Number(todayYmd.slice(5, 7)) - 1);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ pending: 0, today: 0, overdue: 0 });
  const [rescheduleTarget, setRescheduleTarget] = useState<any | null>(null);
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [rescheduleDraft, setRescheduleDraft] = useState(new Date());
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState<'reschedule' | 'next_after_done'>('reschedule');
  const [completionTarget, setCompletionTarget] = useState<any | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);

  const calendarLabel =
    customStart === customEnd
      ? formatYmdShort(customStart)
      : `${formatYmdShort(customStart)} – ${formatYmdShort(customEnd)}`;
  const typeLabel = typeFilter === 'CALLBACK' ? 'Follow-up only' : 'All types';

  const openCalendarPicker = () => {
    setFilter('calendar');
    setDraftStart(customStart || istYmd());
    setDraftEnd(customEnd || customStart || istYmd());
    setCalendarPickMode(customStart && customEnd && customStart !== customEnd ? 'range' : 'single');
    setRangeTap('start');
    const base = customStart || istYmd();
    setViewYear(Number(base.slice(0, 4)));
    setViewMonth0(Number(base.slice(5, 7)) - 1);
    setOpenDropdown(null);
    setShowCalendarModal(true);
  };

  const applyCalendarSelection = () => {
    let start = draftStart;
    let end = calendarPickMode === 'single' ? draftStart : draftEnd || draftStart;
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
    setCustomStart(start);
    setCustomEnd(end);
    setFilter('calendar');
    setShowCalendarModal(false);
  };

  const onCalendarDayPress = (ymd: string) => {
    if (calendarPickMode === 'single') {
      setDraftStart(ymd);
      setDraftEnd(ymd);
      return;
    }
    if (rangeTap === 'start' || !draftStart) {
      setDraftStart(ymd);
      setDraftEnd(ymd);
      setRangeTap('end');
      return;
    }
    if (ymd < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(ymd);
    } else {
      setDraftEnd(ymd);
    }
    setRangeTap('start');
  };

  useEffect(() => {
    const next = route?.params?.filter;
    if (next === 'today') setFilter('today');
    else if (next === 'completed') setFilter('completed');
    else if (next === 'overdue' || next === 'upcoming') {
      setFilter('calendar');
      const today = istYmd();
      if (next === 'overdue') {
        // last 7 days through today
        const [y, m, d] = today.split('-').map(Number);
        const past = new Date(y, m - 1, d - 6);
        setCustomStart(ymdFromParts(past.getFullYear(), past.getMonth(), past.getDate()));
        setCustomEnd(today);
      } else {
        setCustomStart(today);
        setCustomEnd(today);
      }
    } else if (next === 'all' || next === 'pending') setFilter('all');
  }, [route?.params?.filter]);

  useEffect(() => {
    fetchFollowUps();
  }, [filter, searchTerm, typeFilter, customStart, customEnd]);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const fetchFollowUps = async () => {
    try {
      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user?.email)
        .single();

      // Always load pending for accurate stats + to hide superseded Done rows
      const pendingQuery = supabase
        .from('telecaller_follow_ups')
        .select(`
          *,
          lead:lead_id(
            lead_number,
            customer_name,
            customer_phone,
            status,
            service_type,
            deleted_at
          ),
          telecaller:telecaller_id(full_name)
        `)
        .eq('telecaller_id', profile?.id)
        .eq('status', 'PENDING')
        .order('scheduled_time', { ascending: true });

      const { data: pendingRaw, error: pendingErr } = await pendingQuery;
      if (pendingErr) throw pendingErr;

      const pendingList = (pendingRaw || []).filter((fu: any) => !fu.lead?.deleted_at);
      const pendingLeadIds = new Set(pendingList.map((fu: any) => String(fu.lead_id)));

      const now = new Date();

      setStats({
        pending: pendingList.length,
        today: pendingList.filter((fu: any) => isScheduledIstToday(fu.scheduled_time)).length,
        overdue: pendingList.filter((fu: any) => new Date(fu.scheduled_time) < now).length,
      });

      let list: any[] = [];

      if (filter === 'completed') {
        const { data: doneRaw, error: doneErr } = await supabase
          .from('telecaller_follow_ups')
          .select(`
            *,
            lead:lead_id(
              lead_number,
              customer_name,
              customer_phone,
              status,
              service_type,
              deleted_at
            ),
            telecaller:telecaller_id(full_name)
          `)
          .eq('telecaller_id', profile?.id)
          .eq('status', 'COMPLETED')
          .order('completed_at', { ascending: false });
        if (doneErr) throw doneErr;
        // Active pending follow-up wale leads ko Done se hatao — warna same lead dono jagah dikhe
        list = (doneRaw || []).filter(
          (fu: any) => !fu.lead?.deleted_at && !pendingLeadIds.has(String(fu.lead_id)),
        );
      } else {
        list = [...pendingList];
        if (filter === 'today') {
          list = list.filter((fu: any) => isScheduledIstToday(fu.scheduled_time));
        } else if (filter === 'calendar') {
          const start = istDayBounds(customStart).start;
          const end = istDayBounds(customEnd).end;
          list = list.filter((fu: any) =>
            scheduledInIstRange(fu.scheduled_time, start, end),
          );
        }
      }

      if (typeFilter === 'CALLBACK') {
        list = list.filter(
          (fu: any) => String(fu.follow_up_type || '').toUpperCase() === 'CALLBACK',
        );
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        list = list.filter(
          (fu: any) =>
            fu.lead?.customer_name?.toLowerCase().includes(search) ||
            fu.lead?.customer_phone?.includes(search) ||
            fu.lead?.lead_number?.toLowerCase().includes(search) ||
            fu.reason?.toLowerCase().includes(search),
        );
      }

      setFollowUps(list);
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFollowUps();
  };

  const syncLeadCallbackFields = async (
    leadId: string,
    nextIso: string | null,
    opts?: { keepDisposition?: boolean },
  ) => {
    if (!leadId) return;
    const patch: Record<string, unknown> = {
      follow_up_required: Boolean(nextIso),
      next_follow_up_at: nextIso,
      updated_at: new Date().toISOString(),
    };
    if (opts?.keepDisposition) {
      const { data: lead } = await supabase
        .from('service_leads')
        .select('coupon_meta')
        .eq('id', leadId)
        .maybeSingle();
      const meta =
        lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? { ...lead.coupon_meta } : {};
      meta.last_call_result = 'CALLBACK';
      meta.last_call_label = meta.last_call_label || 'Follow-up';
      patch.coupon_meta = meta;
    }
    await supabase.from('service_leads').update(patch).eq('id', leadId);
  };

  const createNextCallbackReminder = async (fromItem: any, when: Date, notes?: string) => {
    const whenIso = when.toISOString();
    const { data: profile } = await supabase
      .from('users_login')
      .select('id')
      .eq('email', user?.email)
      .single();
    await supabase.from('telecaller_follow_ups').insert([
      {
        lead_id: fromItem.lead_id,
        telecaller_id: profile?.id || fromItem.telecaller_id,
        follow_up_type: 'CALLBACK',
        scheduled_time: whenIso,
        reason: notes || fromItem.reason || 'Follow-up',
        priority: fromItem.priority || 'NORMAL',
        status: 'PENDING',
      },
    ]);
    await syncLeadCallbackFields(fromItem.lead_id, whenIso, { keepDisposition: true });
  };

  const handleMarkCompleted = (followUpId: string) => {
    const target = followUps.find((f) => f.id === followUpId);
    setCompletionTarget(target || null);
    setCompletionNotes('');
    setShowCompletion(true);
  };

  const finishCompletion = async (scheduleNext: boolean) => {
    if (!completionTarget) return;
    try {
      const { error } = await supabase
        .from('telecaller_follow_ups')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          completion_notes: completionNotes || null,
        })
        .eq('id', completionTarget.id);

      if (error) throw error;

      const isCallback =
        String(completionTarget.follow_up_type || '').toUpperCase() === 'CALLBACK';

      if (scheduleNext && isCallback) {
        const target = completionTarget;
        setShowCompletion(false);
        setCompletionTarget(null);
        openReschedulePicker(target, 'next_after_done');
        return;
      }

      // Reminder Done ≠ lead status change — Follow-up disposition rehti hai
      if (isCallback) {
        await syncLeadCallbackFields(completionTarget.lead_id, null, { keepDisposition: true });
      } else {
        await syncLeadCallbackFields(completionTarget.lead_id, null);
      }

      fetchFollowUps();
      Alert.alert(
        'Done',
        isCallback
          ? 'Reminder complete. Lead Follow-up pe hi rahega — nayi date ke liye Reschedule ya Lead pe Follow-up status dubara set karo.'
          : 'Follow-up marked as completed',
      );
    } catch (error) {
      console.error('Error updating follow-up:', error);
      Alert.alert('Error', 'Failed to update follow-up');
    } finally {
      if (!(String(completionTarget?.follow_up_type || '').toUpperCase() === 'CALLBACK' && scheduleNext)) {
        setShowCompletion(false);
        setCompletionTarget(null);
      }
    }
  };

  const submitCompletion = async () => {
    if (!completionTarget) return;
    const isCallback =
      String(completionTarget.follow_up_type || '').toUpperCase() === 'CALLBACK';

    if (isCallback) {
      Alert.alert(
        'Follow-up reminder',
        'Is call ke baad next follow-up schedule karna hai?\n\nLead Follow-up status pe hi rahega.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sirf Done', onPress: () => void finishCompletion(false) },
          { text: 'Next date set karo', onPress: () => void finishCompletion(true) },
        ],
      );
      return;
    }

    Alert.alert('Mark as Completed', 'Mark this follow-up as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', onPress: () => void finishCompletion(false) },
    ]);
  };

  const handleMarkMissed = async (followUpId: string) => {
    Alert.alert(
      'Cancel Follow-up',
      'Cancel this follow-up?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const target = followUps.find((f) => f.id === followUpId);
              const { error } = await supabase
                .from('telecaller_follow_ups')
                .update({ status: 'CANCELLED' })
                .eq('id', followUpId);

              if (!error) {
                if (target?.lead_id) {
                  await syncLeadCallbackFields(target.lead_id, null, {
                    keepDisposition:
                      String(target.follow_up_type || '').toUpperCase() === 'CALLBACK',
                  });
                }
                fetchFollowUps();
                Alert.alert('Follow-up cancelled');
              }
            } catch (error) {
              console.error('Error updating follow-up:', error);
              Alert.alert('Error', 'Failed to cancel follow-up');
            }
          }
        }
      ]
    );
  };

  const openReschedulePicker = (
    target: any,
    mode: 'reschedule' | 'next_after_done' = 'reschedule',
  ) => {
    const base = target?.scheduled_time ? new Date(target.scheduled_time) : new Date();
    const initial =
      mode === 'next_after_done' || Number.isNaN(base.getTime())
        ? new Date(Date.now() + 60 * 60 * 1000)
        : base;
    setRescheduleMode(mode);
    setRescheduleTarget(target || null);
    setRescheduleDraft(initial);
    setShowReschedulePicker(true);
  };

  const closeReschedulePicker = () => {
    setShowReschedulePicker(false);
    setRescheduleTarget(null);
    setRescheduleMode('reschedule');
    setRescheduleSaving(false);
  };

  const handleReschedule = (followUpId: string) => {
    const target = followUps.find((f) => f.id === followUpId);
    openReschedulePicker(target, 'reschedule');
  };

  const applyReschedule = async (selectedDate: Date) => {
    if (!rescheduleTarget || rescheduleSaving) return;
    setRescheduleSaving(true);
    try {
      if (rescheduleMode === 'next_after_done') {
        await createNextCallbackReminder(
          rescheduleTarget,
          selectedDate,
          completionNotes || rescheduleTarget.reason,
        );
        fetchFollowUps();
        Alert.alert('Scheduled', 'Next follow-up Reminder ban gaya. Lead Follow-up pe hi hai.');
      } else {
        const whenIso = selectedDate.toISOString();
        const { error } = await supabase
          .from('telecaller_follow_ups')
          .update({ scheduled_time: whenIso, status: 'PENDING' })
          .eq('id', rescheduleTarget.id);
        if (!error) {
          await syncLeadCallbackFields(rescheduleTarget.lead_id, whenIso, {
            keepDisposition:
              String(rescheduleTarget.follow_up_type || '').toUpperCase() === 'CALLBACK',
          });
          fetchFollowUps();
        }
      }
      setCompletionNotes('');
      closeReschedulePicker();
    } catch (error) {
      console.error('Error rescheduling follow-up:', error);
      Alert.alert('Error', 'Failed to reschedule follow-up');
      setRescheduleSaving(false);
    }
  };

  const handleAndroidPickerChange = (_event: any, selectedDate?: Date) => {
    // Android dialog — apply immediately on set, dismiss on cancel
    if (_event?.type === 'dismissed' || !selectedDate) {
      closeReschedulePicker();
      return;
    }
    void applyReschedule(selectedDate);
  };

  const handleViewLead = (leadId: string) => {
    navigation.navigate('TelecallerLeadDetail', { leadId });
  };

  const renderFollowUp = (item: any) => {
    const scheduledTime = new Date(item.scheduled_time);
    const isDone = item.status === 'COMPLETED';
    const isCancelled = item.status === 'CANCELLED';
    const isPending = item.status === 'PENDING';
    const isOverdue = isPending && scheduledTime < new Date();
    const isToday = isPending && isScheduledIstToday(item.scheduled_time);
    const whenLabel = formatDateTime(item.scheduled_time) || scheduledTime.toLocaleString();
    const rawType = String(item.follow_up_type || 'CALLBACK').toUpperCase();
    const typeLabel = rawType === 'CALLBACK' ? 'FOLLOW-UP' : rawType.replace(/_/g, ' ');
    const phone = String(item.lead?.customer_phone || '').replace(/\D/g, '').slice(-10);
    const pillLabel = isDone
      ? 'Done'
      : isCancelled
        ? 'Cancelled'
        : isOverdue
          ? 'Overdue'
          : isToday
            ? 'Today'
            : 'Upcoming';
    const pillStyle = isDone
      ? styles.timePillDone
      : isCancelled
        ? styles.timePillCancelled
        : isOverdue
          ? styles.timePillOverdue
          : isToday
            ? styles.timePillToday
            : styles.timePillSoon;
    const pillTextStyle = isDone
      ? styles.timePillTextDone
      : isCancelled
        ? styles.timePillTextCancelled
        : isOverdue
          ? styles.timePillTextOverdue
          : isToday
            ? styles.timePillTextToday
            : undefined;

    return (
      <View key={item.id} style={[styles.followUpCard, isOverdue && styles.overdueCard]}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {String(item.lead?.customer_name || 'C')
                .trim()
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.customerName} numberOfLines={1}>
              {item.lead?.customer_name || 'Customer'}
            </Text>
            <Text style={styles.leadMeta} numberOfLines={1}>
              #{item.lead?.lead_number || '—'}
              {phone ? ` · ${phone}` : ''}
            </Text>
          </View>
          <View style={[styles.timePill, pillStyle]}>
            <Text style={[styles.timePillText, pillTextStyle]}>{pillLabel}</Text>
          </View>
        </View>

        <View style={styles.scheduleRow}>
          <Icon
            name="clock-outline"
            size={15}
            color={isOverdue ? '#B91C1C' : isDone ? '#059669' : '#0369A1'}
          />
          <Text style={[styles.scheduleText, isOverdue && styles.overdueText]}>{whenLabel}</Text>
          <View style={styles.typePill}>
            <Text style={styles.typePillText}>{typeLabel}</Text>
          </View>
        </View>

        {item.reason ? (
          <Text style={styles.noteText} numberOfLines={2}>
            {item.reason}
          </Text>
        ) : null}

        {isPending ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => Linking.openURL(`tel:${item.lead?.customer_phone}`)}
            >
              <Icon name="phone" size={15} color="#fff" />
              <Text style={styles.actionBtnTextOn}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionGhost]}
              onPress={() => handleViewLead(item.lead_id)}
            >
              <Text style={styles.actionGhostText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => handleMarkCompleted(item.id)}
              accessibilityLabel="Done"
            >
              <Icon name="check" size={18} color="#059669" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => handleReschedule(item.id)}
              accessibilityLabel="Reschedule"
            >
              <Icon name="calendar-clock" size={17} color="#0369A1" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconAction}
              onPress={() => handleMarkMissed(item.id)}
              accessibilityLabel="Cancel"
            >
              <Icon name="close" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        ) : null}

        {isDone && item.completed_at ? (
          <View style={styles.completedInfo}>
            <Icon name="check" size={14} color={COLORS.green} />
            <View style={{ flex: 1 }}>
              <Text style={styles.completedText}>Done · {formatDateTime(item.completed_at)}</Text>
              {item.completion_notes ? (
                <Text style={styles.completedNotes}>{item.completion_notes}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading follow-ups...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={embedded ? [] : ['top']}>
      {!embedded ? (
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reminders</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : (
        <View style={styles.embeddedTitleRow}>
          <Icon name="alarm" size={18} color={COLORS.primary} />
          <Text style={styles.embeddedTitle}>Reminders</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, lead #…"
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      <View style={styles.scopeRow}>
        {(
          [
            { id: 'all' as const, label: 'All Pending' },
            { id: 'today' as const, label: 'Today' },
            { id: 'calendar' as const, label: 'Calendar' },
          ]
        ).map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.scopeChip, filter === f.id && styles.scopeChipActive]}
            onPress={() => {
              setOpenDropdown(null);
              if (f.id === 'calendar') {
                openCalendarPicker();
                return;
              }
              setFilter(f.id);
            }}
          >
            {f.id === 'calendar' ? (
              <Icon
                name="calendar"
                size={14}
                color={filter === 'calendar' ? '#fff' : COLORS.primary}
              />
            ) : null}
            <Text style={[styles.scopeChipText, filter === f.id && styles.scopeChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.scopeChip, filter === 'completed' && styles.scopeChipActive]}
          onPress={() => {
            setFilter('completed');
            setOpenDropdown(null);
          }}
        >
          <Text
            style={[styles.scopeChipText, filter === 'completed' && styles.scopeChipTextActive]}
          >
            Done
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.dropdownRow} pointerEvents="box-none">
        <View
          style={[
            styles.dropdownWrap,
            filter !== 'calendar' && styles.dropdownDim,
          ]}
        >
          <TouchableOpacity
            style={styles.dropdownBtn}
            activeOpacity={0.85}
            onPress={openCalendarPicker}
          >
            <Icon name="calendar" size={16} color={COLORS.primary} />
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {filter === 'calendar' ? calendarLabel : 'Pick date / range'}
            </Text>
            <Icon name="chevron-down" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        <View
          style={[styles.dropdownWrap, openDropdown === 'type' && styles.dropdownOpen]}
        >
          <TouchableOpacity
            style={styles.dropdownBtn}
            activeOpacity={0.85}
            onPress={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
          >
            <Icon name="filter" size={16} color={COLORS.primary} />
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {typeLabel}
            </Text>
            <Icon
              name={openDropdown === 'type' ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
          {openDropdown === 'type' ? (
            <View style={styles.dropdownMenu}>
              {(
                [
                  { id: 'all' as const, label: 'All types', hint: 'Har reminder type' },
                  {
                    id: 'CALLBACK' as const,
                    label: 'Follow-up only',
                    hint: 'Sirf Follow-up status wale',
                  },
                ]
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.dropdownItem,
                    typeFilter === opt.id && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setTypeFilter(opt.id);
                    setOpenDropdown(null);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        typeFilter === opt.id && styles.dropdownItemTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                    <Text style={styles.dropdownHint}>{opt.hint}</Text>
                  </View>
                  {typeFilter === opt.id ? (
                    <Icon name="check" size={16} color={COLORS.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{stats.today}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.red }]}>{stats.overdue}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: embedded ? 110 : 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
      >
        {followUps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="calendar-check" size={56} color={COLORS.gray[500]} />
            <Text style={styles.emptyTitle}>No reminders</Text>
            <Text style={styles.emptyText}>
              {filter === 'today'
                ? `Aaj (IST ${istYmd()}) koi pending reminder nahi. All Pending mein future dates dekho.`
                : filter === 'completed'
                  ? 'Koi done reminder nahi (active pending wale leads yahan nahi dikhte).'
                  : 'Call follow-up banane ke liye Lead Detail → Status = Follow-up → date & time set karke Save karo. Wahi Reminder yahan dikhega.'}
            </Text>
          </View>
        ) : (
          followUps.map(renderFollowUp)
        )}
      </ScrollView>

      {showCompletion && (
        <View style={styles.completionCard}>
          <Text style={styles.completionTitle}>Completion Notes</Text>
          <TextInput
            style={styles.completionInput}
            placeholder="Optional notes..."
            value={completionNotes}
            onChangeText={setCompletionNotes}
            multiline
          />
          <View style={styles.completionActions}>
            <TouchableOpacity style={styles.completionButton} onPress={submitCompletion}>
              <Text style={styles.completionButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.completionButton, styles.completionButtonSecondary]}
              onPress={() => setShowCompletion(false)}
            >
              <Text style={styles.completionButtonTextSecondary}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={showCalendarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendarModal(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowCalendarModal(false)}>
          <Pressable style={styles.calSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Select date</Text>
            <Text style={styles.pickerSubtitle}>
              Single date ya range — calendar pe tap karke choose karo
            </Text>

            <View style={styles.calModeRow}>
              {(
                [
                  { id: 'single' as const, label: 'Single date' },
                  { id: 'range' as const, label: 'Date range' },
                ]
              ).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.calModeChip, calendarPickMode === m.id && styles.calModeChipActive]}
                  onPress={() => {
                    setCalendarPickMode(m.id);
                    setRangeTap('start');
                    if (m.id === 'single') setDraftEnd(draftStart);
                  }}
                >
                  <Text
                    style={[
                      styles.calModeChipText,
                      calendarPickMode === m.id && styles.calModeChipTextActive,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.calMonthNav}>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() => {
                  const next = addMonthsYm(viewYear, viewMonth0, -1);
                  setViewYear(next.year);
                  setViewMonth0(next.month0);
                }}
              >
                <Icon name="chevron-left" size={22} color={COLORS.primary} />
              </TouchableOpacity>
              <Text style={styles.calMonthTitle}>
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][viewMonth0]}{' '}
                {viewYear}
              </Text>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() => {
                  const next = addMonthsYm(viewYear, viewMonth0, 1);
                  setViewYear(next.year);
                  setViewMonth0(next.month0);
                }}
              >
                <Icon name="chevron-right" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={`${d}-${i}`} style={styles.calWeekLabel}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.calGrid}>
              {buildMonthCells(viewYear, viewMonth0).map((cell, idx) => {
                if (!cell.ymd) {
                  return <View key={`e-${idx}`} style={styles.calDayCell} />;
                }
                const ymd = cell.ymd;
                const rangeStart = draftStart;
                const rangeEnd =
                  calendarPickMode === 'single' ? draftStart : draftEnd || draftStart;
                const lo = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
                const hi = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
                const selected = ymd === lo || ymd === hi;
                const inRange = calendarPickMode === 'range' && ymd > lo && ymd < hi;
                const isToday = ymd === todayYmd;
                return (
                  <TouchableOpacity
                    key={ymd}
                    style={[styles.calDayCell, inRange && styles.calDayInRange]}
                    onPress={() => onCalendarDayPress(ymd)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.calDayInner, selected && styles.calDaySelected]}>
                      <Text
                        style={[
                          styles.calDayText,
                          isToday && !selected && styles.calDayTodayText,
                          selected && styles.calDaySelectedText,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.calSelectionHint}>
              {calendarPickMode === 'single'
                ? `Selected: ${formatYmdShort(draftStart)}`
                : rangeTap === 'end' && draftStart === draftEnd
                  ? `Start: ${formatYmdShort(draftStart)} · ab end date choose karo`
                  : `${formatYmdShort(draftStart)} – ${formatYmdShort(draftEnd || draftStart)}`}
            </Text>

            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[styles.pickerBtn, styles.pickerBtnGhost]}
                onPress={() => setShowCalendarModal(false)}
              >
                <Text style={styles.pickerBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerBtn, styles.pickerBtnPrimary]}
                onPress={applyCalendarSelection}
              >
                <Text style={styles.pickerBtnPrimaryText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showReschedulePicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={rescheduleDraft}
          mode="datetime"
          display="default"
          onChange={handleAndroidPickerChange}
        />
      ) : null}

      <Modal
        visible={showReschedulePicker && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={closeReschedulePicker}
      >
        <Pressable style={styles.pickerOverlay} onPress={closeReschedulePicker}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>
              {rescheduleMode === 'next_after_done' ? 'Next follow-up' : 'Reschedule reminder'}
            </Text>
            <Text style={styles.pickerSubtitle}>
              {formatDateTime(rescheduleDraft.toISOString()) || rescheduleDraft.toLocaleString()}
            </Text>
            <DateTimePicker
              value={rescheduleDraft}
              mode="datetime"
              display="spinner"
              themeVariant="light"
              style={styles.pickerSpinner}
              onChange={(_e, date) => {
                if (date) setRescheduleDraft(date);
              }}
            />
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={[styles.pickerBtn, styles.pickerBtnGhost]}
                onPress={closeReschedulePicker}
                disabled={rescheduleSaving}
              >
                <Text style={styles.pickerBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerBtn, styles.pickerBtnPrimary]}
                onPress={() => void applyReschedule(rescheduleDraft)}
                disabled={rescheduleSaving}
              >
                {rescheduleSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.pickerBtnPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: SPACING.md,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  embeddedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 4,
  },
  embeddedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textHeading || COLORS.textPrimary,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.1)',
  },
  typeChipActive: {
    backgroundColor: '#E8F1FF',
    borderColor: '#93C5FD',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  typeChipTextActive: {
    color: COLORS.primary,
  },
  scopeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: 8,
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.12)',
  },
  scopeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  scopeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  scopeChipTextActive: {
    color: '#fff',
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: 10,
    zIndex: 20,
  },
  dropdownWrap: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  dropdownOpen: {
    zIndex: 40,
  },
  dropdownDim: {
    opacity: 0.72,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dropdownBtnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textHeading,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'hidden',
  },
  dropdownMenuScroll: {
    maxHeight: 260,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray[100],
  },
  dropdownItemActive: {
    backgroundColor: '#EFF6FF',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  dropdownHint: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  calSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
    maxHeight: '92%',
  },
  calModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  calModeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  calModeChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.primary,
  },
  calModeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  calModeChipTextActive: {
    color: COLORS.primary,
  },
  calMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calNavBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  calMonthTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textHeading || COLORS.textPrimary,
  },
  calWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  calWeekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calDayCell: {
    width: `${100 / 7}%` as any,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayInner: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayInRange: {
    backgroundColor: '#DBEAFE',
  },
  calDaySelected: {
    backgroundColor: COLORS.primary,
  },
  calDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 16,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  calDayTodayText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  calDaySelectedText: {
    color: '#fff',
    fontWeight: '800',
  },
  calSelectionHint: {
    marginTop: 10,
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: 6,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.08)',
    shadowColor: '#023D95',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  filterContainer: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.1)',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginBottom: 12,
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.06)',
    shadowColor: '#023D95',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.gray[200],
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  followUpCard: {
    backgroundColor: '#fff',
    marginHorizontal: SPACING.md,
    marginBottom: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(2, 61, 149, 0.07)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  overdueCard: {
    borderColor: 'rgba(239, 68, 68, 0.22)',
    backgroundColor: '#FFFCFC',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E8F1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textHeading,
    letterSpacing: -0.2,
  },
  leadMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  timePillOverdue: {
    backgroundColor: '#FEE2E2',
  },
  timePillToday: {
    backgroundColor: '#DBEAFE',
  },
  timePillSoon: {
    backgroundColor: '#ECFDF5',
  },
  timePillDone: {
    backgroundColor: '#D1FAE5',
  },
  timePillCancelled: {
    backgroundColor: '#F3F4F6',
  },
  timePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.2,
  },
  timePillTextOverdue: {
    color: '#B91C1C',
  },
  timePillTextToday: {
    color: '#1D4ED8',
  },
  timePillTextDone: {
    color: '#047857',
  },
  timePillTextCancelled: {
    color: '#6B7280',
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  scheduleText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0369A1',
  },
  overdueText: {
    color: '#B91C1C',
  },
  typePill: {
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
    marginBottom: 10,
    backgroundColor: COLORS.gray[50],
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[200],
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 5,
  },
  actionPrimary: {
    flex: 1.15,
    backgroundColor: COLORS.primary,
  },
  actionGhost: {
    flex: 0.85,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionBtnTextOn: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  actionGhostText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray[50],
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray[200],
  },
  completedText: {
    fontSize: 12,
    color: COLORS.green,
    fontWeight: '700',
  },
  completedNotes: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxl * 2,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textHeading,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  completionCard: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
    padding: SPACING.md,
  },
  completionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textHeading,
    marginBottom: SPACING.sm,
  },
  completionInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACING.sm,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: COLORS.white,
    color: COLORS.text,
  },
  completionActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  completionButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  completionButtonSecondary: {
    backgroundColor: COLORS.gray[200],
  },
  completionButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  completionButtonTextSecondary: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.gray[300],
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textHeading,
    textAlign: 'center',
  },
  pickerSubtitle: {
    marginTop: 6,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  pickerSpinner: {
    alignSelf: 'stretch',
    height: 216,
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  pickerBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnGhost: {
    backgroundColor: COLORS.gray[100],
  },
  pickerBtnPrimary: {
    backgroundColor: COLORS.primary,
  },
  pickerBtnGhostText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pickerBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});

