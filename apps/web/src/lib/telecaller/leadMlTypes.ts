export type LeadTemperature = 'hot' | 'warm' | 'cold';

export type LeadMlScore = {
  lead_id: string;
  conversion_score: number;
  temperature: LeadTemperature;
  ghost_risk: number;
  best_call_hour: number | null;
  best_call_label: string | null;
  reasons: string[];
  features: Record<string, string | number | boolean | null>;
  engine: string;
  scored_at: string;
};

export type CallDlInsight = {
  call_log_id: string;
  lead_id: string | null;
  transcript: string | null;
  emotion: string | null;
  emotion_score: number | null;
  voice_intent: string | null;
  voice_intent_score: number | null;
  tags: string[];
  engine: string | null;
  warning: string | null;
  processed_at: string;
};

export type SimilarBookedLead = {
  lead_id: string;
  customer_name: string | null;
  city: string | null;
  vehicle: string | null;
  status: string | null;
  similarity: number;
};

export type LeadBrainPayload = {
  score: LeadMlScore | null;
  voice: CallDlInsight | null;
  similar: SimilarBookedLead[];
};

export function temperatureFromScore(score: number): LeadTemperature {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export function formatBestCallHour(hour: number | null | undefined): string | null {
  if (hour == null || !Number.isFinite(hour)) return null;
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${ampm} IST`;
}

export function mapScoreRow(r: any): LeadMlScore {
  return {
    lead_id: String(r.lead_id),
    conversion_score: Number(r.conversion_score) || 0,
    temperature: (r.temperature as LeadTemperature) || temperatureFromScore(Number(r.conversion_score) || 0),
    ghost_risk: Number(r.ghost_risk) || 0,
    best_call_hour: r.best_call_hour == null ? null : Number(r.best_call_hour),
    best_call_label: r.best_call_label || formatBestCallHour(r.best_call_hour),
    reasons: Array.isArray(r.reasons) ? r.reasons.map(String) : [],
    features: r.features && typeof r.features === 'object' ? r.features : {},
    engine: String(r.engine || 'tabular_ml_v1'),
    scored_at: r.scored_at || r.updated_at || new Date().toISOString(),
  };
}

export function mapDlRow(r: any): CallDlInsight {
  return {
    call_log_id: String(r.call_log_id),
    lead_id: r.lead_id ? String(r.lead_id) : null,
    transcript: r.transcript ? String(r.transcript) : null,
    emotion: r.emotion ? String(r.emotion) : null,
    emotion_score: r.emotion_score == null ? null : Number(r.emotion_score),
    voice_intent: r.voice_intent ? String(r.voice_intent) : null,
    voice_intent_score: r.voice_intent_score == null ? null : Number(r.voice_intent_score),
    tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
    engine: r.engine ? String(r.engine) : null,
    warning: r.warning ? String(r.warning) : null,
    processed_at: r.processed_at || r.updated_at || new Date().toISOString(),
  };
}
