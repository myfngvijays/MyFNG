import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from '../../lib/api';
import { Icon } from '../Icon';

type QueryItem = {
  id?: string;
  query?: string;
  agent_answer?: string | null;
  resolution?: string;
  gap?: string | null;
};

type Analysis = {
  quality_score?: number;
  quality_grade?: string;
  summary?: string | null;
  customer_problem?: string | null;
  agent_solution?: string | null;
  coaching_tips?: string[];
  query_resolutions?: QueryItem[];
  sop_audit?: {
    summary_of_call?: string;
    improvement_suggestions?: string[];
    positive_highlights?: string[];
    overall_score?: number;
    call_transcript?: string;
  } | null;
};

type CallRow = {
  id: string;
  created_at?: string | null;
  call_status?: string | null;
  has_call_recording?: boolean;
  analysis?: Analysis | null;
};

export default function LeadRecordingBrain({
  leadId,
  visible,
  onClose,
}: {
  leadId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    if (!visible || !leadId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<{ call_logs?: CallRow[] }>(`/api/telecaller/calls/${encodeURIComponent(leadId)}`)
      .then((json) => {
        if (!cancelled) setCalls(Array.isArray(json?.call_logs) ? json.call_logs : []);
      })
      .catch(() => {
        if (!cancelled) setCalls([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, leadId]);

  const recorded = calls.filter((row) => row.has_call_recording || row.analysis);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Lead recording</Text>
            <Pressable onPress={onClose} style={styles.close}>
              <Icon name="close" size={18} color="#334155" />
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color="#023D95" style={{ marginTop: 24 }} />
          ) : recorded.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Recording abhi nahi hai</Text>
              <Text style={styles.emptyBody}>
                Jab is lead ki call recording aayegi, yahan score, summary, problem aur coaching dikhega.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
              {recorded.map((row) => {
                const sop = row.analysis?.sop_audit;
                const summary = String(sop?.summary_of_call || row.analysis?.summary || '').trim();
                const coaching = [
                  ...(sop?.improvement_suggestions || []),
                  ...(row.analysis?.coaching_tips || []),
                ].filter(Boolean);
                return (
                  <View key={row.id} style={styles.card}>
                    <Text style={styles.meta}>
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : 'Call'}
                      {row.call_status ? ` · ${row.call_status}` : ''}
                    </Text>
                    {row.analysis?.quality_grade ? (
                      <Text style={styles.grade}>
                        {row.analysis.quality_grade} {row.analysis.quality_score ?? ''}
                        {sop?.overall_score != null ? ` · SOP ${sop.overall_score}/100` : ''}
                      </Text>
                    ) : row.has_call_recording ? (
                      <Text style={styles.body}>Recording hai. Analysis save hote hi yahan dikhega.</Text>
                    ) : null}
                    {summary ? <Text style={styles.body}>{summary}</Text> : null}
                    {row.analysis?.customer_problem ? (
                      <Text style={styles.body}>Problem: {row.analysis.customer_problem}</Text>
                    ) : null}
                    {row.analysis?.agent_solution ? (
                      <Text style={styles.body}>Handling: {row.analysis.agent_solution}</Text>
                    ) : null}
                    {coaching.slice(0, 4).map((tip) => (
                      <Text key={tip} style={styles.tip}>
                        {tip}
                      </Text>
                    ))}
                    {(row.analysis?.query_resolutions || []).map((q, i) => (
                      <Text key={q.id || String(i)} style={styles.body}>
                        Q. {q.query}
                        {q.agent_answer ? `\nA. ${q.agent_answer}` : ''}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '86%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#023D95' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { paddingVertical: 28, paddingHorizontal: 8 },
  emptyTitle: { textAlign: 'center', fontSize: 16, fontWeight: '800', color: '#0F172A' },
  emptyBody: { marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#64748B' },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  meta: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  grade: { fontSize: 13, fontWeight: '800', color: '#3730A3', marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 19, color: '#0F172A', marginBottom: 6 },
  tip: { fontSize: 13, lineHeight: 19, color: '#9A3412', marginBottom: 4 },
});
