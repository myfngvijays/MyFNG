import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { apiFetch } from '../../lib/api';
import { COLORS } from '../../constants/theme';

type BrainPayload = {
  score: {
    conversion_score: number;
    temperature: string;
    ghost_risk: number;
    best_call_label: string | null;
    reasons: string[];
  } | null;
  voice: {
    emotion: string | null;
    voice_intent: string | null;
    transcript: string | null;
  } | null;
  similar: Array<{
    lead_id: string;
    customer_name: string | null;
    city: string | null;
    vehicle: string | null;
    similarity: number;
  }>;
};

function tone(score?: number | null, temperature?: string | null) {
  const t = String(temperature || '').toLowerCase();
  const n = Number(score);
  if (t === 'hot' || n >= 70) return { bg: '#ffedd5', text: '#9a3412' };
  if (t === 'cold' || n < 40) return { bg: '#f1f5f9', text: '#475569' };
  return { bg: '#fef3c7', text: '#92400e' };
}

export default function LeadBrainCard({
  leadId,
  onOpenSimilar,
}: {
  leadId: string;
  onOpenSimilar?: (leadId: string) => void;
}) {
  const [data, setData] = useState<BrainPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const json = await apiFetch<any>(
        `/api/telecaller/crm/lead-brain?lead_id=${encodeURIComponent(leadId)}`,
      );
      setData({
        score: json?.score || null,
        voice: json?.voice || null,
        similar: Array.isArray(json?.similar) ? json.similar : [],
      });
      setError(json?.warning || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async (processDl: boolean) => {
    if (!leadId) return;
    setRunning(true);
    setError(null);
    try {
      const json = await apiFetch<any>('/api/telecaller/crm/lead-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, process_dl: processDl }),
      });
      setData({
        score: json?.score || null,
        voice: json?.voice || null,
        similar: Array.isArray(json?.similar) ? json.similar : [],
      });
      if (json?.warning) setError(String(json.warning));
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setRunning(false);
    }
  };

  const score = data?.score;
  const voice = data?.voice;
  const pill = tone(score?.conversion_score, score?.temperature);

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#ffedd5',
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ fontWeight: '800', color: COLORS.textPrimary }}>Lead Brain · ML + DL</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            disabled={running}
            onPress={() => void refresh(false)}
            style={{ borderWidth: 1, borderColor: COLORS.gray[200], borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.textPrimary }}>
              {running ? '…' : 'Rescore'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={running}
            onPress={() => void refresh(true)}
            style={{ backgroundColor: '#c2410c', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Voice DL</Text>
          </TouchableOpacity>
        </View>
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : null}
      {error ? <Text style={{ fontSize: 11, color: '#92400e', marginBottom: 6 }}>{error}</Text> : null}
      {!loading && score ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <View style={{ backgroundColor: pill.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: pill.text, fontWeight: '800', fontSize: 12 }}>{score.conversion_score}</Text>
          </View>
          {score.best_call_label ? (
            <Text style={{ fontSize: 12, color: COLORS.textSecondary, flex: 1 }}>
              Best call {score.best_call_label}
            </Text>
          ) : null}
        </View>
      ) : null}
      {score?.reasons?.slice(0, 3).map((r) => (
        <Text key={r} style={{ fontSize: 12, color: COLORS.textPrimary, marginBottom: 2 }}>
          • {r}
        </Text>
      ))}
      {voice?.emotion || voice?.voice_intent ? (
        <Text style={{ fontSize: 12, color: '#9a3412', marginTop: 6, fontWeight: '700' }}>
          Voice: {voice.emotion || '—'} · {voice.voice_intent || '—'}
        </Text>
      ) : null}
      {voice?.transcript ? (
        <Text style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 4 }} numberOfLines={3}>
          {voice.transcript}
        </Text>
      ) : null}
      {data?.similar?.length ? (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 4 }}>
            SIMILAR BOOKED
          </Text>
          {data.similar.map((s) => (
            <TouchableOpacity
              key={s.lead_id}
              onPress={() => onOpenSimilar?.(s.lead_id)}
              disabled={!onOpenSimilar}
            >
              <Text style={{ fontSize: 12, color: COLORS.primary, marginBottom: 2 }}>
                {s.customer_name || 'Booked lead'}
                {s.city ? ` · ${s.city}` : ''} · {Math.round(s.similarity * 100)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MlScorePill({
  score,
  temperature,
}: {
  score?: number | null;
  temperature?: string | null;
}) {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const n = Math.round(Number(score));
  const pill = tone(n, temperature);
  return (
    <View style={{ backgroundColor: pill.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ color: pill.text, fontWeight: '800', fontSize: 10 }}>{n}</Text>
    </View>
  );
}

export function LeadBrainStrip({ leadId }: { leadId?: string | null }) {
  const [data, setData] = useState<BrainPayload | null>(null);

  useEffect(() => {
    const id = String(leadId || '').trim();
    if (!id) {
      setData(null);
      return;
    }
    let cancelled = false;
    void apiFetch<any>(`/api/telecaller/crm/lead-brain?lead_id=${encodeURIComponent(id)}`)
      .then((json) => {
        if (cancelled) return;
        setData({
          score: json?.score || null,
          voice: json?.voice || null,
          similar: Array.isArray(json?.similar) ? json.similar : [],
        });
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const score = data?.score;
  const voice = data?.voice;
  if (!score && !voice?.emotion && !voice?.voice_intent) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#fff7ed',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        marginTop: 8,
      }}
    >
      <MlScorePill score={score?.conversion_score} temperature={score?.temperature} />
      {score?.best_call_label ? (
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#9a3412' }}>
          {score.best_call_label}
        </Text>
      ) : null}
      {voice?.emotion || voice?.voice_intent ? (
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#9a3412' }}>
          {voice.emotion || '—'} · {voice.voice_intent || '—'}
        </Text>
      ) : null}
    </View>
  );
}
