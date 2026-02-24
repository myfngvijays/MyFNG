import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Linking, RefreshControl, Alert } from 'react-native';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SPACING, SIZES } from '../../../constants/theme';
import { apiFetch } from '../../../lib/api';
import * as Clipboard from 'expo-clipboard';

type TabKey = 'overview' | 'create' | 'registered' | 'car_service' | 'collect_payment' | 'call_report';

export default function TelecallerRSAScreen({ navigation }: any) {
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const [complaints, setComplaints] = useState<any[]>([]);
  const [registered, setRegistered] = useState<any[]>([]);
  const [carEnquiries, setCarEnquiries] = useState<any[]>([]);
  const [payLinks, setPayLinks] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>(null);
  const [performanceOverview, setPerformanceOverview] = useState<any>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [callPage, setCallPage] = useState(1);
  const [callTotal, setCallTotal] = useState(0);
  const [callHasRecording, setCallHasRecording] = useState<'all' | 'yes' | 'no'>('all');
  const [callHasAudit, setCallHasAudit] = useState<'all' | 'yes' | 'no'>('all');
  const [auditByCallId, setAuditByCallId] = useState<Record<string, any>>({});
  const [auditLoadingId, setAuditLoadingId] = useState<string | null>(null);
  const [dispositionCallId, setDispositionCallId] = useState<string | null>(null);
  const [dispositionSaving, setDispositionSaving] = useState(false);
  const [dispositionForm, setDispositionForm] = useState({
    disposition: '',
    service_type: '',
    note: '',
  });

  const [carForm, setCarForm] = useState({
    customer_name: '',
    customer_phone: '',
    car_model: '',
    remark: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    customer_name: '',
    customer_phone: '',
    amount: '',
    notes: '',
  });

  const fetchTabData = async (tabKey: TabKey) => {
    setLoading(true);
    try {
      if (tabKey === 'overview' || tabKey === 'registered') {
        const data = await apiFetch<any>('/api/telecaller/rsa-complaints?limit=200');
        const list = Array.isArray(data?.leads) ? data.leads : Array.isArray(data?.complaints) ? data.complaints : [];
        setComplaints(list);
        setRegistered(
          list.filter((row: any) => {
            const status = String(row?.lead_status || row?.complaint_status || '').toLowerCase();
            return status === 'registered' && !row?.assigned_mechanic_id;
          })
        );
        setKpis({
          total: list.length,
          open: list.filter((r: any) => {
            const status = String(r?.lead_status || r?.complaint_status || '').toLowerCase();
            return !['completed', 'closed', 'cancelled'].includes(status);
          }).length,
          completed: list.filter((r: any) => {
            const status = String(r?.lead_status || r?.complaint_status || '').toLowerCase();
            return status === 'completed' || status === 'closed';
          }).length,
          cancelled: list.filter((r: any) => String(r?.lead_status || r?.complaint_status || '').toLowerCase() === 'cancelled').length,
        });
      }

      if (tabKey === 'overview') {
        setPerformanceLoading(true);
        try {
          const p = await apiFetch<any>('/api/telecaller/performance-overview');
          setPerformanceOverview(p || null);
        } catch (e) {
          console.error('performance overview load failed', e);
          setPerformanceOverview(null);
        } finally {
          setPerformanceLoading(false);
        }
      }

      if (tabKey === 'car_service') {
        const data = await apiFetch<any>('/api/telecaller/car-service-enquiries?limit=200');
        setCarEnquiries(Array.isArray(data?.enquiries) ? data.enquiries : []);
      }

      if (tabKey === 'collect_payment') {
        const data = await apiFetch<any>('/api/telecaller/direct-pay-links?limit=200');
        setPayLinks(Array.isArray(data?.links) ? data.links : []);
      }

      if (tabKey === 'call_report') {
        const params = new URLSearchParams();
        params.set('limit', '20');
        params.set('page', String(callPage));
        if (search.trim()) params.set('q', search.trim());
        if (callHasRecording === 'yes') params.set('has_recording', 'true');
        if (callHasRecording === 'no') params.set('has_recording', 'false');
        if (callHasAudit === 'yes') params.set('has_audit', 'true');
        if (callHasAudit === 'no') params.set('has_audit', 'false');
        const data = await apiFetch<any>(`/api/telecaller/sarv-calls?${params.toString()}`);
        setCalls(Array.isArray(data?.calls) ? data.calls : []);
        setCallTotal(Number(data?.pagination?.total || 0));
      }
    } catch (e) {
      console.error('TelecallerRSAScreen fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTabData(tab);
  }, [tab]);

  useEffect(() => {
    if (tab !== 'call_report') return;
    fetchTabData('call_report');
  }, [tab, callPage, search, callHasRecording, callHasAudit]);

  useEffect(() => {
    if (tab === 'call_report' && callPage !== 1) {
      setCallPage(1);
    }
  }, [tab]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTabData(tab);
  };

  const filteredComplaints = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return complaints;
    return complaints.filter((row: any) =>
      String(row?.customer_name || '').toLowerCase().includes(s) ||
      String(row?.contact_number || '').includes(s) ||
      String(row?.vehicle_number || '').toLowerCase().includes(s)
    );
  }, [complaints, search]);

  const filteredRegistered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return registered;
    return registered.filter((row: any) =>
      String(row?.customer_name || '').toLowerCase().includes(s) ||
      String(row?.contact_number || '').includes(s)
    );
  }, [registered, search]);

  const filteredCalls = useMemo(() => calls, [calls]);

  const submitCarService = async () => {
    try {
      await apiFetch('/api/telecaller/car-service-enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(carForm),
      });
      setCarForm({ customer_name: '', customer_phone: '', car_model: '', remark: '' });
      fetchTabData('car_service');
    } catch (e) {
      console.error('submit car service failed', e);
    }
  };

  const generatePayLink = async () => {
    try {
      await apiFetch('/api/telecaller/direct-pay-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: paymentForm.customer_name,
          customer_phone: paymentForm.customer_phone,
          amount: Number(paymentForm.amount || 0),
          notes: paymentForm.notes || null,
        }),
      });
      setPaymentForm({ customer_name: '', customer_phone: '', amount: '', notes: '' });
      fetchTabData('collect_payment');
    } catch (e) {
      console.error('generate payment link failed', e);
    }
  };

  const cancelPayLink = async (ref: string) => {
    try {
      await apiFetch('/api/telecaller/direct-pay-links', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, action: 'cancel' }),
      });
      fetchTabData('collect_payment');
    } catch (e) {
      console.error('cancel payment link failed', e);
    }
  };

  const refreshPayLinkStatuses = async () => {
    try {
      await apiFetch('/api/telecaller/direct-pay-links/status', { method: 'POST' });
      await fetchTabData('collect_payment');
    } catch (e) {
      console.error('refresh pay link status failed', e);
      Alert.alert('Error', 'Failed to refresh payment statuses');
    }
  };

  const copyPayLink = async (link: string) => {
    try {
      await Clipboard.setStringAsync(link);
      Alert.alert('Copied', 'Payment link copied to clipboard');
    } catch {
      Alert.alert('Error', 'Failed to copy link');
    }
  };

  const viewAudit = async (callId: string) => {
    if (!callId) return;
    setAuditLoadingId(callId);
    try {
      const data = await apiFetch<any>(`/api/sarv-calls/${encodeURIComponent(callId)}/audit`);
      setAuditByCallId((prev) => ({ ...prev, [callId]: data?.audit || null }));
    } catch (e) {
      console.error('load audit failed', e);
      Alert.alert('Error', 'Failed to load audit');
    } finally {
      setAuditLoadingId(null);
    }
  };

  const saveDisposition = async () => {
    if (!dispositionCallId || !dispositionForm.disposition) return;
    setDispositionSaving(true);
    try {
      await apiFetch(`/api/sarv-calls/${encodeURIComponent(dispositionCallId)}/disposition`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition: dispositionForm.disposition,
          disposition_category: dispositionForm.service_type || null,
          disposition_note: dispositionForm.note || null,
        }),
      });
      setDispositionCallId(null);
      setDispositionForm({ disposition: '', service_type: '', note: '' });
      await fetchTabData('call_report');
      Alert.alert('Saved', 'Disposition saved successfully');
    } catch (e) {
      console.error('save disposition failed', e);
      Alert.alert('Error', 'Failed to save disposition');
    } finally {
      setDispositionSaving(false);
    }
  };

  const openComplaint = (id: string) => {
    navigation.navigate('TelecallerRSAComplaintDetail', { complaintId: id });
  };

  const handleBack = () => {
    if (typeof navigation?.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (typeof navigation?.goBack === 'function') {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('TelecallerDashboard');
  };

  return (
    <View style={styles.container}>
      <DashboardHeader title="Telecaller RSA" onBack={handleBack} />

      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            ['overview', 'Overview'],
            ['create', 'Create'],
            ['registered', 'Registered'],
            ['car_service', 'Car Service'],
            ['collect_payment', 'Collect Payment'],
            ['call_report', 'Call Report'],
          ].map(([id, label]) => (
            <TouchableOpacity
              key={id}
              style={[styles.tabBtn, tab === id && styles.tabBtnActive]}
              onPress={() => setTab(id as TabKey)}
            >
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name/phone/vehicle..."
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.subtle}>Loading...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {tab === 'overview' && (
            <View style={styles.section}>
              <View style={styles.kpiRow}>
                <Kpi label="Total" value={kpis?.total ?? 0} />
                <Kpi label="Open" value={kpis?.open ?? 0} />
                <Kpi label="Completed" value={kpis?.completed ?? 0} />
                <Kpi label="Cancelled" value={kpis?.cancelled ?? 0} />
              </View>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Actionable Performance</Text>
                {performanceLoading ? (
                  <Text style={styles.subtle}>Loading performance...</Text>
                ) : performanceOverview ? (
                  <View style={styles.kpiRow}>
                    <Kpi label="Calls Received" value={Number(performanceOverview?.callsReceived || 0)} />
                    <Kpi label="No Recording" value={Number(performanceOverview?.noRecording || 0)} />
                    <Kpi label="No Summary" value={Number(performanceOverview?.noSummary || 0)} />
                    <Kpi label="No Disposition" value={Number(performanceOverview?.noDisposition || 0)} />
                    <Kpi label="Follow-ups Due" value={Number(performanceOverview?.todayFollowUpsDue || 0)} />
                    <Kpi label="High Priority" value={Number(performanceOverview?.highPriorityPending || 0)} />
                  </View>
                ) : (
                  <Text style={styles.subtle}>Performance data unavailable.</Text>
                )}
              </View>
              {filteredComplaints.map((row: any) => (
                <TouchableOpacity key={row.id} style={styles.card} onPress={() => openComplaint(String(row.id))}>
                  <Text style={styles.cardTitle}>{row.customer_name || 'Customer'}</Text>
                  <Text style={styles.subtle}>{row.contact_number || '—'} • {row.vehicle_number || '—'}</Text>
                  <Text style={styles.subtle}>Status: {row.lead_status || row.complaint_status || '—'}</Text>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openComplaint(String(row.id))}>
                      <Text style={styles.actionBtnText}>View</Text>
                    </TouchableOpacity>
                    {!row?.assigned_mechanic_id ? (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => navigation.navigate('TelecallerRSACreateComplaint', { complaintId: String(row.id) })}
                      >
                        <Text style={styles.actionBtnText}>Edit</Text>
                      </TouchableOpacity>
                    ) : null}
                    {row?.location_link ? (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(String(row.location_link))}>
                        <Text style={styles.actionBtnText}>Open Map</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
              {filteredComplaints.length === 0 ? <Text style={styles.subtle}>No complaints found.</Text> : null}
            </View>
          )}

          {tab === 'create' && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('TelecallerRSACreateComplaint')}>
                <Text style={styles.primaryBtnText}>Open Create RSA Complaint Form</Text>
              </TouchableOpacity>
            </View>
          )}

          {tab === 'registered' && (
            <View style={styles.section}>
              {filteredRegistered.map((row: any) => (
                <TouchableOpacity key={row.id} style={styles.card} onPress={() => openComplaint(String(row.id))}>
                  <Text style={styles.cardTitle}>{row.customer_name || 'Customer'}</Text>
                  <Text style={styles.subtle}>{row.contact_number || '—'} • {row.vehicle_number || '—'}</Text>
                </TouchableOpacity>
              ))}
              {filteredRegistered.length === 0 ? <Text style={styles.subtle}>No registered complaints found.</Text> : null}
            </View>
          )}

          {tab === 'car_service' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Create Car Service Enquiry</Text>
              <TextInput style={styles.input} placeholder="Customer Name" value={carForm.customer_name} onChangeText={(v) => setCarForm((p) => ({ ...p, customer_name: v }))} />
              <TextInput style={styles.input} placeholder="Phone" value={carForm.customer_phone} onChangeText={(v) => setCarForm((p) => ({ ...p, customer_phone: v }))} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder="Car Model" value={carForm.car_model} onChangeText={(v) => setCarForm((p) => ({ ...p, car_model: v }))} />
              <TextInput style={styles.input} placeholder="Remark" value={carForm.remark} onChangeText={(v) => setCarForm((p) => ({ ...p, remark: v }))} />
              <TouchableOpacity style={styles.primaryBtn} onPress={submitCarService}>
                <Text style={styles.primaryBtnText}>Submit</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Submitted Enquiries</Text>
              {carEnquiries.map((row: any) => (
                <View key={row.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{row.customer_name || 'Customer'} ({row.customer_phone_raw || row.customer_phone_norm || '—'})</Text>
                  <Text style={styles.subtle}>{row.car_model || '—'} • {row.remark || '—'}</Text>
                </View>
              ))}
            </View>
          )}

          {tab === 'collect_payment' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Generate Payment Link</Text>
              <TextInput style={styles.input} placeholder="Customer Name" value={paymentForm.customer_name} onChangeText={(v) => setPaymentForm((p) => ({ ...p, customer_name: v }))} />
              <TextInput style={styles.input} placeholder="Phone" value={paymentForm.customer_phone} onChangeText={(v) => setPaymentForm((p) => ({ ...p, customer_phone: v }))} keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder="Amount" value={paymentForm.amount} onChangeText={(v) => setPaymentForm((p) => ({ ...p, amount: v }))} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Notes" value={paymentForm.notes} onChangeText={(v) => setPaymentForm((p) => ({ ...p, notes: v }))} />
              <TouchableOpacity style={styles.primaryBtn} onPress={generatePayLink}>
                <Text style={styles.primaryBtnText}>Generate Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtnBlue} onPress={refreshPayLinkStatuses}>
                <Text style={styles.secondaryBtnBlueText}>Refresh Link Status</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Generated Links</Text>
              {payLinks.map((row: any) => (
                <View key={row.id || row.ref} style={styles.card}>
                  <Text style={styles.cardTitle}>{row.customer_name || row.customer_phone || 'Payment Link'}</Text>
                  <Text style={styles.subtle}>Status: {row.status || '—'}</Text>
                  {row.link ? (
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity onPress={() => Linking.openURL(String(row.link))}>
                        <Text style={styles.linkText}>Open Link</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => copyPayLink(String(row.link))}>
                        <Text style={styles.linkText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {(row?.rsa_lead_id || row?.lead_id || row?.complaint_id) ? (
                    <TouchableOpacity onPress={() => openComplaint(String(row.rsa_lead_id || row.lead_id || row.complaint_id))}>
                      <Text style={styles.linkText}>View Complaint</Text>
                    </TouchableOpacity>
                  ) : null}
                  {row.ref ? (
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => cancelPayLink(String(row.ref))}>
                      <Text style={styles.secondaryBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {payLinks.length === 0 ? <Text style={styles.subtle}>No payment links found.</Text> : null}
            </View>
          )}

          {tab === 'call_report' && (
            <View style={styles.section}>
              <View style={styles.callFilterRow}>
                <TouchableOpacity
                  style={[styles.filterPill, callHasRecording === 'all' && styles.filterPillActive]}
                  onPress={() => setCallHasRecording('all')}
                >
                  <Text style={[styles.filterPillText, callHasRecording === 'all' && styles.filterPillTextActive]}>All Rec</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, callHasRecording === 'yes' && styles.filterPillActive]}
                  onPress={() => setCallHasRecording('yes')}
                >
                  <Text style={[styles.filterPillText, callHasRecording === 'yes' && styles.filterPillTextActive]}>Rec Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, callHasRecording === 'no' && styles.filterPillActive]}
                  onPress={() => setCallHasRecording('no')}
                >
                  <Text style={[styles.filterPillText, callHasRecording === 'no' && styles.filterPillTextActive]}>Rec No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, callHasAudit === 'all' && styles.filterPillActive]}
                  onPress={() => setCallHasAudit('all')}
                >
                  <Text style={[styles.filterPillText, callHasAudit === 'all' && styles.filterPillTextActive]}>All Audit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, callHasAudit === 'yes' && styles.filterPillActive]}
                  onPress={() => setCallHasAudit('yes')}
                >
                  <Text style={[styles.filterPillText, callHasAudit === 'yes' && styles.filterPillTextActive]}>Audit Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, callHasAudit === 'no' && styles.filterPillActive]}
                  onPress={() => setCallHasAudit('no')}
                >
                  <Text style={[styles.filterPillText, callHasAudit === 'no' && styles.filterPillTextActive]}>Audit No</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.subtle}>Total calls: {callTotal}</Text>
              {filteredCalls.map((row: any, idx: number) => (
                <View key={row.id || idx} style={styles.card}>
                  <Text style={styles.cardTitle}>{row.customer_phone || row.cnumber || row.from_number || 'Call'}</Text>
                  <Text style={styles.subtle}>Disposition: {row.disposition || row.disposition_category || '—'} • Duration: {row.duration_seconds || row.talkduration || 0}s</Text>
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => Alert.alert('Summary', String(row?.summary || 'Summary not available'))}>
                      <Text style={styles.actionBtnText}>View Summary</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => viewAudit(String(row.id || ''))}>
                      <Text style={styles.actionBtnText}>{auditLoadingId === String(row.id || '') ? 'Loading Audit...' : 'View Audit'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setDispositionCallId(String(row.id || ''));
                        setDispositionForm({
                          disposition: String(row?.disposition || ''),
                          service_type: String(row?.disposition_category || ''),
                          note: String(row?.disposition_note || ''),
                        });
                      }}
                    >
                      <Text style={styles.actionBtnText}>Save Disposition</Text>
                    </TouchableOpacity>
                  </View>
                  {auditByCallId[String(row.id || '')] ? (
                    <View style={styles.auditBox}>
                      <Text style={styles.subtle}>Audit: {auditByCallId[String(row.id || '')]?.audit_status || '—'}</Text>
                      <Text style={styles.subtle}>Score: {auditByCallId[String(row.id || '')]?.audit_score ?? '—'}</Text>
                      <Text style={styles.subtle}>Feedback: {auditByCallId[String(row.id || '')]?.feedback || '—'}</Text>
                    </View>
                  ) : null}
                  {dispositionCallId === String(row.id || '') ? (
                    <View style={styles.dispositionBox}>
                      <TextInput
                        style={styles.input}
                        placeholder="Disposition (required)"
                        value={dispositionForm.disposition}
                        onChangeText={(v) => setDispositionForm((p) => ({ ...p, disposition: v }))}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Service Type (optional)"
                        value={dispositionForm.service_type}
                        onChangeText={(v) => setDispositionForm((p) => ({ ...p, service_type: v }))}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Disposition Note"
                        value={dispositionForm.note}
                        onChangeText={(v) => setDispositionForm((p) => ({ ...p, note: v }))}
                      />
                      <View style={styles.cardActionsRow}>
                        <TouchableOpacity style={styles.primaryBtnSmall} onPress={saveDisposition} disabled={dispositionSaving}>
                          <Text style={styles.primaryBtnText}>{dispositionSaving ? 'Saving...' : 'Save'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.secondaryBtnSmall} onPress={() => setDispositionCallId(null)}>
                          <Text style={styles.secondaryBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                  {row.recording_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(String(row.recording_url))}>
                      <Text style={styles.linkText}>Open Recording</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              {filteredCalls.length === 0 ? <Text style={styles.subtle}>No calls found for this filter.</Text> : null}
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.secondaryBtnSmall, callPage <= 1 && styles.btnDisabled]}
                  disabled={callPage <= 1}
                  onPress={() => setCallPage((p) => Math.max(1, p - 1))}
                >
                  <Text style={styles.secondaryBtnText}>Previous</Text>
                </TouchableOpacity>
                <Text style={styles.subtle}>Page {callPage}</Text>
                <TouchableOpacity
                  style={[styles.secondaryBtnSmall, callPage * 20 >= callTotal && styles.btnDisabled]}
                  disabled={callPage * 20 >= callTotal}
                  onPress={() => setCallPage((p) => p + 1)}
                >
                  <Text style={styles.secondaryBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabsWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  tabBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: 8, backgroundColor: COLORS.gray[100], marginRight: SPACING.sm },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: SIZES.sm, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.white },
  searchWrap: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  searchInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.white, padding: SPACING.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  subtle: { fontSize: SIZES.xs, color: COLORS.textSecondary, marginTop: 2 },
  content: { flex: 1 },
  section: { padding: SPACING.md, gap: SPACING.sm },
  sectionTitle: { fontSize: SIZES.md, fontWeight: '700', color: COLORS.textHeading, marginTop: SPACING.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  kpi: { flexGrow: 1, minWidth: '22%', backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm, alignItems: 'center' },
  kpiValue: { fontSize: SIZES.lg, fontWeight: '700', color: COLORS.primary },
  kpiLabel: { fontSize: SIZES.xs, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.white, borderRadius: 10, padding: SPACING.sm },
  cardTitle: { fontSize: SIZES.sm, fontWeight: '700', color: COLORS.textHeading },
  cardActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.xs },
  actionBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  actionBtnText: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.white, padding: SPACING.sm },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  primaryBtnText: { color: COLORS.white, fontSize: SIZES.sm, fontWeight: '700' },
  primaryBtnSmall: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryBtn: { marginTop: SPACING.xs, borderWidth: 1, borderColor: COLORS.error, borderRadius: 8, paddingVertical: SPACING.xs, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.error, fontSize: SIZES.xs, fontWeight: '700' },
  secondaryBtnSmall: { flex: 1, borderWidth: 1, borderColor: COLORS.error, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryBtnBlue: { marginTop: SPACING.xs, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: SPACING.sm, alignItems: 'center' },
  secondaryBtnBlueText: { color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '700' },
  linkText: { marginTop: SPACING.xs, color: COLORS.primary, fontSize: SIZES.xs, fontWeight: '600' },
  auditBox: { marginTop: SPACING.xs, backgroundColor: COLORS.gray[100], borderRadius: 8, padding: SPACING.xs },
  dispositionBox: { marginTop: SPACING.xs, gap: SPACING.xs },
  paginationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.sm },
  btnDisabled: { opacity: 0.5 },
  callFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  filterPill: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.white,
  },
  filterPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterPillText: { fontSize: SIZES.xs, color: COLORS.textSecondary, fontWeight: '600' },
  filterPillTextActive: { color: COLORS.white },
});
