import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DashboardHeader from '../../../components/DashboardHeader';
import { apiFetch } from '../../../lib/api';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';
import { formatDateDMY } from '@/lib/dateFormat';

type OrderDetailResponse = {
  order: any;
  invoice: any | null;
  invoices?: any[];
  checklist?: any | null;
  media?: Array<{ id: string; url: string; type: string; note?: string | null; created_at?: string | null }>;
  activities?: any[];
  extra_charges?: any[];
};

export default function CustomerOrderDetailScreen({ navigation, route }: any) {
  const orderId = String(route?.params?.orderId || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [showAllChecklist, setShowAllChecklist] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiFetch<OrderDetailResponse>(`/api/customer/orders/${orderId}`);
        if (mounted) setData(res);
      } catch (e) {
        console.error('Failed to load order detail', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  const order = data?.order || {};
  const invoice = data?.invoice || null;
  const checklistItems = useMemo(() => {
    const raw = data?.checklist?.checklist_items;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [data?.checklist?.checklist_items]);

  const toReadable = (value: string) =>
    String(value || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());

  const statusRaw = String(order?.status || 'PENDING').toUpperCase();
  const invoiceStatusRaw = String(invoice?.payment_status || 'PENDING').toUpperCase();
  const statusMeta = (() => {
    if (['DELIVERED', 'COMPLETED', 'CLOSED'].includes(statusRaw)) {
      return { bg: '#ECFDF3', text: '#166534' };
    }
    if (['CANCELLED', 'REJECTED'].includes(statusRaw)) {
      return { bg: '#FEF2F2', text: '#991B1B' };
    }
    if (['READY_FOR_BILLING', 'QC_APPROVED', 'IN_PROGRESS'].includes(statusRaw)) {
      return { bg: '#EFF6FF', text: '#1E3A8A' };
    }
    return { bg: '#F3F4F6', text: '#334155' };
  })();

  const amount =
    Number(invoice?.final_amount || 0) ||
    Number(order?.invoice_amount || 0) ||
    Number(order?.actual_amount || 0) ||
    Number(order?.estimated_amount || 0) ||
    0;
  const checklistPreviewCount = 12;
  const visibleChecklist = showAllChecklist ? checklistItems : checklistItems.slice(0, checklistPreviewCount);

  const normalizeMediaSection = (m: any) => {
    const type = String(m?.type || '').toUpperCase();
    const url = String(m?.url || '').toUpperCase();
    const note = String(m?.note || '').toUpperCase();
    const text = `${type} ${url} ${note}`;

    if (text.includes('BEFORE_') || text.includes('/BEFORE/') || text.includes('VEHICLE-PHOTOS')) {
      return 'Before Inspection';
    }
    if (text.includes('DURING_') || text.includes('/DURING/')) {
      return 'During Service';
    }
    if (text.includes('AFTER_') || text.includes('/AFTER/')) {
      return 'After Service';
    }
    if (text.includes('QC') || text.includes('PROOF') || text.includes('DELIVERY')) {
      return 'QC / Delivery Proof';
    }
    return 'Other Photos';
  };

  const mediaSections = useMemo(() => {
    const grouped: Record<string, any[]> = {
      'Before Inspection': [],
      'During Service': [],
      'After Service': [],
      'QC / Delivery Proof': [],
      'Other Photos': [],
    };
    for (const media of data?.media || []) {
      grouped[normalizeMediaSection(media)].push(media);
    }
    return Object.entries(grouped).filter(([, items]) => items.length > 0);
  }, [data?.media]);

  if (loading) {
    return (
      <View style={styles.container}>
        <DashboardHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <DashboardHeader title="Order Details" onBack={() => navigation.goBack()} />
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>Unable to load order details.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title={order?.lead_number || 'Order Details'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, styles.heroCard]}>
          <View style={styles.rowBetween}>
            <Text style={styles.serviceText}>{order?.service_display || order?.service_type || 'Service'}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
              <Text style={[styles.statusText, { color: statusMeta.text }]}>{toReadable(statusRaw)}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{order?.vehicle_number || 'Vehicle'} • {formatDateDMY(order?.created_at)}</Text>
          <Text style={styles.amount}>Amount: {amount > 0 ? `₹${amount.toFixed(2)}` : 'Pending'}</Text>
          {invoice?.invoice_number ? (
            <Text style={styles.meta}>Invoice: {invoice.invoice_number} ({toReadable(invoiceStatusRaw)})</Text>
          ) : null}
        </View>

        {Array.isArray(order?.custom_repair_items) && order.custom_repair_items.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Work done</Text>
              <Text style={styles.sectionMeta}>{order.custom_repair_items.length} items</Text>
            </View>
            {order.custom_repair_items.map((item: any, idx: number) => {
              const qty = Number(item?.qty || 1) || 1;
              const lineAmount = Number(item?.amount || 0);
              return (
                <View key={`${item?.name || 'item'}-${idx}`} style={styles.priceRow}>
                  <Text style={styles.listText}>
                    {item?.name || `Item ${idx + 1}`}{qty > 1 ? ` × ${qty}` : ''}
                  </Text>
                  <Text style={styles.priceText}>
                    {lineAmount > 0 ? `₹${Math.round(lineAmount).toLocaleString('en-IN')}` : '—'}
                  </Text>
                </View>
              );
            })}
            <View style={[styles.priceRow, styles.priceTotalRow]}>
              <Text style={styles.priceTotalLabel}>Total</Text>
              <Text style={styles.priceTotalValue}>
                ₹{Math.round(
                  order.custom_repair_items.reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0),
                ).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Checklist</Text>
            {data?.checklist ? (
              <Text style={styles.sectionMeta}>
                {Number(data.checklist.completed_items || 0)}/{Number(data.checklist.total_items || checklistItems.length || 0)}
              </Text>
            ) : null}
          </View>
          {data?.checklist ? (
            <>
              {visibleChecklist.map((item: any, idx: number) => {
                const done = String(item?.status || '').toUpperCase() === 'COMPLETED';
                return (
                  <View key={`${item?.id || idx}`} style={styles.listRow}>
                    <Ionicons name={done ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={done ? COLORS.success : COLORS.textSecondary} />
                    <Text style={styles.listText}>{item?.name || item?.title || `Checklist item ${idx + 1}`}</Text>
                  </View>
                );
              })}
              {!showAllChecklist && checklistItems.length > checklistPreviewCount ? (
                <TouchableOpacity onPress={() => setShowAllChecklist(true)}>
                  <Text style={styles.moreLink}>+{checklistItems.length - checklistPreviewCount} more checklist points</Text>
                </TouchableOpacity>
              ) : null}
              {showAllChecklist && checklistItems.length > checklistPreviewCount ? (
                <TouchableOpacity onPress={() => setShowAllChecklist(false)}>
                  <Text style={styles.moreLink}>Show less checklist points</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <Text style={styles.meta}>Checklist not available yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Photos & Proof</Text>
            <Text style={styles.sectionMeta}>{(data.media || []).length}</Text>
          </View>
          {mediaSections.length > 0 ? (
            <View style={styles.sectionStack}>
              {mediaSections.map(([section, items]) => (
                <View key={section} style={styles.mediaSectionWrap}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.mediaSectionTitle}>{section}</Text>
                    <Text style={styles.sectionMeta}>{items.length}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                    {items.slice(0, 40).map((m: any) => (
                      <TouchableOpacity key={m.id} onPress={() => { void Linking.openURL(m.url); }} style={styles.mediaCard}>
                        <Image source={{ uri: m.url }} style={styles.mediaImage} resizeMode="cover" />
                        <Text numberOfLines={1} style={styles.mediaLabel}>{String(m.type || 'PHOTO').replace(/_/g, ' ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.meta}>No media uploaded yet.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Service Timeline</Text>
            <Text style={styles.sectionMeta}>{(data.activities || []).length}</Text>
          </View>
          {(data.activities || []).length > 0 ? (
            (data.activities || []).slice(0, 25).map((a: any) => (
              <View key={a.id} style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>{a.description || a.activity_type || 'Activity update'}</Text>
                <Text style={styles.timelineTime}>{formatDateDMY(a.created_at)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>Timeline not available.</Text>
          )}
        </View>

        {(data.extra_charges || []).length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Additional Work</Text>
            {(data.extra_charges || []).map((x: any) => (
              <View key={x.id} style={styles.timelineItem}>
                <Text style={styles.timelineTitle}>{x.description || 'Additional job'}</Text>
                <Text style={styles.timelineTime}>
                  ₹{Number(x.amount || 0).toFixed(2)} • {String(x.status || 'PENDING')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: SPACING.xl },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: COLORS.textSecondary, fontSize: SIZES.sm },
  emptyText: { color: COLORS.textSecondary, fontSize: SIZES.md },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E8EDF5',
  },
  heroCard: { backgroundColor: '#F9FBFF', borderColor: '#D9E6FF' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serviceText: { flex: 1, fontSize: SIZES.md, fontWeight: '800', color: COLORS.textHeading },
  meta: { marginTop: 6, color: COLORS.textSecondary, fontSize: SIZES.sm },
  amount: { marginTop: 8, color: COLORS.success, fontSize: SIZES.md, fontWeight: '800' },
  statusPill: { borderRadius: 18, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: SIZES.md, fontWeight: '800', color: COLORS.textHeading, marginBottom: 8 },
  sectionMeta: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },
  moreLink: { marginTop: 4, color: COLORS.primary, fontSize: SIZES.sm, fontWeight: '700' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  listText: { flex: 1, color: COLORS.textHeading, fontSize: SIZES.sm },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  priceText: { color: COLORS.textHeading, fontSize: SIZES.sm, fontWeight: '700' },
  priceTotalRow: { borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 10, marginTop: 4, marginBottom: 0 },
  priceTotalLabel: { color: COLORS.textHeading, fontSize: SIZES.sm, fontWeight: '800' },
  priceTotalValue: { color: COLORS.textHeading, fontSize: SIZES.sm, fontWeight: '800' },
  sectionStack: { gap: 12 },
  mediaSectionWrap: { borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 10 },
  mediaSectionTitle: { fontSize: SIZES.sm, fontWeight: '800', color: COLORS.textHeading },
  mediaRow: { gap: 10, paddingVertical: 4 },
  mediaCard: { width: 120 },
  mediaImage: { width: 120, height: 90, borderRadius: 10, backgroundColor: '#E5E7EB' },
  mediaLabel: { marginTop: 6, fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
  timelineItem: { borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 8, marginTop: 8 },
  timelineTitle: { fontSize: SIZES.sm, color: COLORS.textHeading, fontWeight: '600' },
  timelineTime: { marginTop: 4, fontSize: 12, color: COLORS.textSecondary },
});
