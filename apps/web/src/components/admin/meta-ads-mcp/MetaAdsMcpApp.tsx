'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BarChart3,
  Brain,
  Copy,
  Download,
  ExternalLink,
  FileBarChart,
  Images,
  KeyRound,
  Layers,
  Loader2,
  Megaphone,
  MessageCircle,
  Mic,
  MicOff,
  Play,
  Printer,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Terminal,
  Wallet,
} from 'lucide-react';

type Tool = { name: string; area: string; description: string; params: { key: string; label: string; required?: boolean; placeholder?: string }[] };

type Settings = {
  has_token: boolean;
  account_id: string;
  app_id: string;
  from_env: boolean;
  token_hint: string;
  ready: boolean;
};

type Payload = {
  ok: boolean;
  meta: { name: string; version: string; mode: string; notes: string[] };
  status: 'ready' | 'needs_account' | 'needs_token';
  settings: Settings;
  claude: {
    connectors_url: string;
    connector_url: string;
    this_host_url: string;
    localhost_blocked: boolean;
    has_token: boolean;
    from_env: boolean;
    hint: string;
  };
  tool_count: number;
  tools: Tool[];
  by_area: Record<string, Tool[]>;
  setup_steps: string[];
  playbook?: {
    goal: string;
    audience: string;
    offers: string;
    copy_rules: string;
    decision_rules: string;
  };
  checked_at: string;
};

type Period = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  messaging?: number;
  results?: number;
  cpl: number;
  cpr?: number;
  date_start?: string | null;
};

type Campaign = {
  id: string;
  name: string;
  effective_status?: string;
  status?: string;
  objective?: string;
  last_7d?: Period;
};

const STATUS_UI: Record<Payload['status'], { label: string; className: string }> = {
  ready: { label: 'Connected', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  needs_account: { label: 'Token saved · add account ID', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  needs_token: { label: 'Not connected', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

type SectionId = 'overview' | 'ask' | 'reports' | 'brain' | 'funds' | 'campaigns' | 'assets' | 'connect' | 'tools';

type ChatMsg = { role: 'user' | 'assistant'; content: string; report?: any };

const ADS_NAV: {
  id: SectionId;
  label: string;
  icon: typeof MessageCircle;
  description: string;
}[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Today, 7d, 30d spend' },
  { id: 'ask', label: 'Ask ads', icon: MessageCircle, description: 'Bolke ya likh ke poocho' },
  { id: 'brain', label: 'Brain', icon: Brain, description: 'Playbook — Keep / Test / Pause rules' },
  { id: 'reports', label: 'Reports', icon: FileBarChart, description: 'Downloadable ads briefing' },
  { id: 'funds', label: 'Funds', icon: Wallet, description: 'Due, spend cap, pay method' },
  { id: 'campaigns', label: 'Campaigns', icon: Layers, description: 'Active / paused campaigns' },
  { id: 'assets', label: 'Pages & Pixel', icon: Images, description: 'Facebook Page and Pixel' },
  { id: 'connect', label: 'Connect', icon: KeyRound, description: 'Token & ad account' },
  { id: 'tools', label: 'Tools', icon: Terminal, description: 'Advanced tools & safety' },
];

function isSectionId(value: string | null | undefined): value is SectionId {
  return Boolean(value && ADS_NAV.some((item) => item.id === value));
}

function readSectionFromUrl(fallback: SectionId): SectionId {
  if (typeof window === 'undefined') return fallback;
  const q = new URLSearchParams(window.location.search).get('section');
  return isSectionId(q) ? q : fallback;
}

const ASK_CHIPS = [
  'Kaunsi copy chalaun?',
  'Is campaign ki ads compare karo',
  'Aaj kitna spend hua?',
  '7 din ka spend aur WA chats',
  'Active campaigns',
  'Due kitna hai?',
];

function reportHtml(report: { title?: string; markdown?: string }) {
  const body = String(report.markdown || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${String(report.title || 'MyFNG Ads Report').replace(/</g, '')}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:760px;margin:40px auto;color:#0f172a;padding:0 24px}h1{color:#004AAD;font-size:22px}pre{white-space:pre-wrap;font-family:inherit;line-height:1.55;font-size:14px}.foot{margin-top:28px;font-size:11px;color:#64748b}</style>
</head><body><h1>MyFNG · Meta Ads</h1><pre>${body}</pre><p class="foot">Live Marketing API · read-only</p></body></html>`;
}

function downloadReportFile(report: { title?: string; markdown?: string; filename?: string }) {
  const blob = new Blob([reportHtml(report)], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = report.filename || 'myfng-ads-report.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

function printReportFile(report: { title?: string; markdown?: string }) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(reportHtml(report));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

function pickRecorderMime() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || '';
}

function cleanChatMarks(s: string) {
  return String(s || '')
    .replace(/\*\*/g, '')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`+/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

type ChatCampaign = { name: string; metrics: { label: string; value: string }[] };

function parseCampaignReply(text: string): { intro: string; campaigns: ChatCampaign[] } {
  const raw = String(text || '').replace(/\r/g, '').trim();
  const chunks = raw.split(/\n(?=\s*\d+[\.\)]\s+)/);
  const intro: string[] = [];
  const campaigns: ChatCampaign[] = [];

  const pushCampaign = (body: string) => {
    const lines = body
      .split('\n')
      .map((l) => cleanChatMarks(l.replace(/^\s*[-•]\s*/, '')))
      .filter(Boolean);
    let name = '';
    const metrics: { label: string; value: string }[] = [];
    for (const line of lines) {
      const kv = line.match(/^([^:]{1,48}):\s*(.+)$/);
      if (!kv) {
        if (!name) name = line;
        continue;
      }
      const label = kv[1].trim();
      const value = kv[2].trim();
      if (/नाम|name|campaign/i.test(label)) name = value;
      else if (/खर्च|spend/i.test(label)) metrics.push({ label: 'Spend', value });
      else if (/इंप्रेशन|impression/i.test(label)) metrics.push({ label: 'Impr', value });
      else if (/क्लिक|clicks/i.test(label)) metrics.push({ label: 'Clicks', value });
      else if (/\bctr\b/i.test(label)) metrics.push({ label: 'CTR', value });
      else if (/\bcpc\b/i.test(label)) metrics.push({ label: 'CPC', value });
      else if (/\bcpm\b/i.test(label)) metrics.push({ label: 'CPM', value });
      else if (/परिणाम|रिज़ल्ट|result|leads|wa /i.test(label)) metrics.push({ label: 'Results', value });
      else metrics.push({ label, value });
    }
    if (name || metrics.length) campaigns.push({ name: name || 'Campaign', metrics: metrics.slice(0, 6) });
  };

  for (const chunk of chunks) {
    const numbered = chunk.match(/^\s*\d+[\.\)]\s+([\s\S]+)/);
    if (numbered) pushCampaign(numbered[1]);
    else intro.push(chunk.trim());
  }

  if (!campaigns.length) {
    const bullets = raw.split('\n').filter((l) => /^\s*[•\-]\s+/.test(l));
    for (const line of bullets) {
      const body = cleanChatMarks(line.replace(/^\s*[•\-]\s+/, ''));
      const bits = body.split(/\s+[—\-]\s+/);
      if (bits.length >= 2) {
        campaigns.push({
          name: bits[0],
          metrics: bits.slice(1, 5).map((v, i) => ({
            label: ['Status', 'Spend', 'Results', 'Extra'][i] || 'Info',
            value: v,
          })),
        });
      }
    }
  }

  return { intro: intro.join('\n').trim(), campaigns };
}

type AdviceKind = 'keep' | 'test' | 'pause' | 'next';

function parseAdvice(text: string): { verdict: string; advice: { kind: AdviceKind; title: string; reason: string }[] } {
  const advice: { kind: AdviceKind; title: string; reason: string }[] = [];
  let verdict = '';
  for (const line of String(text || '').split('\n')) {
    const v = line.match(/^\s*Verdict:\s*(.+)$/i);
    if (v) {
      verdict = cleanChatMarks(v[1]);
      continue;
    }
    const m = line.match(/^\s*(KEEP|TEST|PAUSE|NEXT COPY|NEXT):\s*(.+)$/i);
    if (!m) continue;
    const raw = m[1].toUpperCase();
    const kind: AdviceKind = raw.startsWith('KEEP')
      ? 'keep'
      : raw.startsWith('TEST')
        ? 'test'
        : raw.startsWith('PAUSE')
          ? 'pause'
          : 'next';
    const body = cleanChatMarks(m[2]);
    const bits = body.split(/\s+[—\-]\s+|\s+\|\s+/);
    advice.push({ kind, title: bits[0] || body, reason: bits.slice(1).join(' — ') });
  }
  return { verdict, advice };
}

const ADVICE_UI: Record<AdviceKind, { label: string; className: string }> = {
  keep: { label: 'Keep / scale', className: 'border-emerald-200 bg-emerald-50' },
  test: { label: 'Test', className: 'border-amber-200 bg-amber-50' },
  pause: { label: 'Pause', className: 'border-rose-200 bg-rose-50' },
  next: { label: 'Next copy', className: 'border-sky-200 bg-sky-50' },
};

type MetricTile = { label: string; value: string };
type AnswerKind = 'billing' | 'spend' | 'advice' | 'campaigns' | 'report' | 'answer';

const ANSWER_KIND_UI: Record<AnswerKind, { title: string; bar: string; Icon: typeof Wallet }> = {
  billing: { title: 'Billing', bar: 'from-amber-600 to-orange-500', Icon: Wallet },
  spend: { title: 'Spend', bar: 'from-[#012A66] to-[#004AAD]', Icon: BarChart3 },
  advice: { title: 'Copy advice', bar: 'from-emerald-700 to-teal-600', Icon: Brain },
  campaigns: { title: 'Campaigns', bar: 'from-indigo-700 to-violet-600', Icon: Megaphone },
  report: { title: 'Report', bar: 'from-slate-800 to-slate-600', Icon: FileBarChart },
  answer: { title: 'Answer', bar: 'from-[#012A66] to-[#004AAD]', Icon: Sparkles },
};

function prettyMetricLabel(raw: string) {
  const k = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const map: Record<string, string> = {
    'current due': 'Due',
    due: 'Due',
    'spend cap': 'Spend cap',
    cap: 'Spend cap',
    'pay method': 'Pay method',
    'payment method': 'Pay method',
    funding: 'Pay method',
    'prepaid funds': 'Funds',
    funds: 'Funds',
    hint: 'Hint',
    aaj: 'Today',
    today: 'Today',
    'last 7 days': 'Last 7 days',
    'last 30 days': 'Last 30 days',
    chats: 'WA chats',
    'wa chats': 'WA chats',
  };
  if (map[k]) return map[k];
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetricValue(v: string) {
  const t = String(v || '').trim().replace(/\.\s*$/, '');
  if (/^no cap$/i.test(t) || /ads manager/i.test(t)) return t;
  const m = t.match(/^₹?\s*([\d,]+(?:\.\d+)?)$/);
  if (m) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return t;
}

function parseKvMetrics(text: string): { metrics: MetricTile[]; hints: string[] } {
  const metrics: MetricTile[] = [];
  const hints: string[] = [];
  const cleaned = cleanChatMarks(text);
  const pieces = cleaned.split(/\n+/).flatMap((line) => {
    const trimmed = line.trim().replace(/^\s*[-•]\s*/, '');
    if (!trimmed) return [];
    if (/^\s*(Verdict|KEEP|TEST|PAUSE|NEXT COPY|NEXT):/i.test(trimmed)) return [];
    if (/^\s*\d+[\.\)]\s+/.test(trimmed)) return [];
    if ((trimmed.match(/:\s*/g) || []).length >= 2) {
      return trimmed.split(/,(?=\s*[^,:]{1,48}:\s*)/);
    }
    return [trimmed];
  });

  for (const piece of pieces) {
    const m = piece.trim().match(/^([^:]{1,48}):\s*(.+)$/);
    if (!m) {
      if (piece.trim()) hints.push(piece.trim());
      continue;
    }
    const label = prettyMetricLabel(m[1]);
    if (label === 'Hint') {
      hints.push(m[2].trim());
      continue;
    }
    let rest = m[2].trim();
    if (rest.includes('·')) {
      const parts = rest.split('·').map((p) => p.trim()).filter(Boolean);
      metrics.push({ label, value: formatMetricValue(parts[0]) });
      for (const p of parts.slice(1)) {
        const kv = p.match(/^([\d,.₹%]+)\s+(.+)$/) || p.match(/^(.+?)\s+([\d,.₹%]+)$/);
        if (!kv) continue;
        const [a, b] = [kv[1].trim(), kv[2].trim()];
        if (/^[\d₹]/.test(a) || a.includes('%')) metrics.push({ label: prettyMetricLabel(b), value: formatMetricValue(a) });
        else metrics.push({ label: prettyMetricLabel(a), value: formatMetricValue(b) });
      }
      continue;
    }
    const money = rest.match(
      /^(₹\s*[\d,]+(?:\.\d+)?|INR\s*[\d,]+(?:\.\d+)?|[\d,]+(?:\.\d+)?%?|no cap)(?:\.?\s+)(.+)$/i,
    );
    if (money && money[2] && money[2].length > 10) {
      metrics.push({ label, value: formatMetricValue(money[1]) });
      hints.push(money[2].replace(/^\.+\s*/, '').trim());
    } else {
      metrics.push({ label, value: formatMetricValue(rest) });
    }
  }
  return { metrics, hints };
}

function detectAnswerKind(input: {
  advice: number;
  campaigns: number;
  metrics: MetricTile[];
  report?: unknown;
}): AnswerKind {
  if (input.report) return 'report';
  if (input.advice > 0) return 'advice';
  if (input.metrics.some((m) => /due|cap|fund|pay method|billing/i.test(m.label))) return 'billing';
  if (input.campaigns > 0) return 'campaigns';
  if (input.metrics.some((m) => /spend|today|last 7|last 30|chats|clicks|ctr/i.test(m.label))) return 'spend';
  if (input.metrics.length) return 'spend';
  return 'answer';
}

function ChatMessageBody({
  role,
  content,
  report,
}: {
  role: 'user' | 'assistant';
  content: string;
  report?: any;
}) {
  const [open, setOpen] = useState(false);
  const isUser = role === 'user';
  const introText = cleanChatMarks(content);
  const longUser = isUser && introText.length > 160;
  const shownIntro = isUser && longUser && !open ? `${introText.slice(0, 140).trim()}…` : introText;

  if (isUser) {
    return (
      <div className="text-white">
        <p className="text-sm leading-relaxed">{shownIntro}</p>
        {longUser ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-[11px] font-bold text-sky-100 underline">
            {open ? 'Show less' : 'Full message'}
          </button>
        ) : null}
      </div>
    );
  }

  const parsed = parseCampaignReply(content);
  const advice = parseAdvice(content);
  const kv = parseKvMetrics(parsed.intro);
  const kind = detectAnswerKind({
    advice: advice.advice.length,
    campaigns: parsed.campaigns.length,
    metrics: kv.metrics,
    report,
  });
  const ui = ANSWER_KIND_UI[kind];
  const Icon = ui.Icon;
  const tiles = kv.metrics;
  const prose = kv.hints.filter((h) => !/^hint:/i.test(h));
  const wide = kind === 'advice' || kind === 'campaigns' || Boolean(report);

  return (
    <article className={`w-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${wide ? 'max-w-[20rem]' : 'max-w-[16.5rem]'}`}>
      <div className={`flex items-center gap-1.5 bg-gradient-to-r ${ui.bar} px-3 py-1.5 text-white`}>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" />
        <p className="text-[10px] font-bold uppercase tracking-[0.12em]">{ui.title}</p>
      </div>

      {advice.verdict ? (
        <p className="px-3 pt-2 text-xs font-medium leading-snug text-slate-700">{advice.verdict}</p>
      ) : null}

      {tiles.length > 0 ? (
        <div className="divide-y divide-slate-100 px-3 py-1">
          {tiles.map((m) => (
            <div key={`${m.label}-${m.value}`} className="flex items-baseline justify-between gap-3 py-1.5">
              <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{m.label}</p>
              <p className="truncate text-right text-sm font-bold text-slate-900">{m.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {advice.advice.length > 0 ? (
        <div className="space-y-1.5 px-2.5 pb-2.5">
          {advice.advice.map((a, i) => {
            const chip = ADVICE_UI[a.kind];
            return (
              <div key={`${a.kind}-${i}`} className={`rounded-lg border px-2.5 py-1.5 ${chip.className}`}>
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{chip.label}</p>
                <p className="text-xs font-bold leading-snug text-slate-900">{a.title}</p>
                {a.reason ? <p className="mt-0.5 text-[11px] leading-snug text-slate-600">{a.reason}</p> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {parsed.campaigns.length > 0 ? (
        <div className="space-y-1.5 px-2.5 pb-2.5">
          {parsed.campaigns.slice(0, 6).map((c, i) => (
            <div key={`${c.name}-${i}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5">
              <p className="text-xs font-bold leading-snug text-slate-900">{c.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {c.metrics.map((m) => (
                  <span
                    key={`${m.label}-${m.value}`}
                    className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
                  >
                    {m.label} {m.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!tiles.length && !advice.advice.length && !parsed.campaigns.length ? (
        <div className="space-y-1 px-3 py-2 text-xs leading-snug text-slate-700">
          {introText.split('\n').filter(Boolean).map((line, i) => (
            <p key={i}>{line.replace(/^\s*[-•]\s*/, '• ')}</p>
          ))}
        </div>
      ) : null}

      {prose.length > 0 ? (
        <div className="border-t border-slate-100 px-3 py-1.5">
          {prose.map((h) => (
            <p key={h} className="truncate text-[10px] text-slate-400" title={h}>
              {h}
            </p>
          ))}
        </div>
      ) : null}

      {report ? (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-2.5 py-2">
          <button
            type="button"
            onClick={() => downloadReportFile(report)}
            className="inline-flex items-center gap-1 rounded-full bg-[#004AAD]/10 px-2 py-0.5 text-[10px] font-bold text-[#004AAD]"
          >
            <Download className="h-3 w-3" /> Download
          </button>
          <button
            type="button"
            onClick={() => printReportFile(report)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700"
          >
            <Printer className="h-3 w-3" /> PDF
          </button>
        </div>
      ) : null}
    </article>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').replace(/^data:[^;]+;base64,/, ''));
    reader.onerror = () => reject(new Error('Could not read audio'));
    reader.readAsDataURL(blob);
  });
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const mixed = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) mixed[i] += ch[i] / buffer.numberOfChannels;
  }
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  const str = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  str(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, length * 2, true);
  for (let i = 0; i < length; i += 1) {
    const s = Math.max(-1, Math.min(1, mixed[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

async function recordingToWav(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const copy = blob.slice(0);
    const decoded = await ctx.decodeAudioData(await copy.arrayBuffer());
    return audioBufferToWav(decoded);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

function money(n: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n || 0);
  } catch {
    return `${currency} ${Math.round(n || 0).toLocaleString('en-IN')}`;
  }
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}%`;
}

const PERIOD_LABELS: Record<string, string> = {
  today: 'Today',
  last_7d: 'Last 7 days',
  last_30d: 'Last 30 days',
};

function kv(label: string, value: ReactNode) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  );
}

function PeriodCards({
  periods,
  currency,
}: {
  periods: Record<string, Period | undefined>;
  currency: string;
}) {
  const keys = Object.keys(periods || {});
  if (!keys.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {keys.map((key) => {
        const row = periods[key];
        return (
          <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {PERIOD_LABELS[key] || key}
            </p>
            <p className="mt-1 text-xl font-black text-slate-900">{money(row?.spend || 0, currency)}</p>
            <p className="mt-1 text-[11px] text-slate-600">
              {num(row?.leads || 0)} leads · {num(row?.messaging || 0)} WA · {num(row?.clicks || 0)} clicks
            </p>
            <p className="text-[11px] text-slate-500">
              CPR {money(row?.cpr || row?.cpl || 0, currency)} · CTR {pct(row?.ctr || 0)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function SimpleTable({ rows, columns }: { rows: any[]; columns: { key: string; label: string; render?: (row: any) => ReactNode }[] }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No rows</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="py-1.5 pr-3 font-bold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map((c) => (
                <td key={c.key} className="py-1.5 pr-3 text-xs text-slate-700">
                  {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolResultView({ result, currency }: { result: any; currency: string }) {
  if (!result || typeof result !== 'object') {
    return <p className="text-sm text-slate-600">{String(result ?? 'No result')}</p>;
  }
  const cur = result.currency || currency || 'INR';

  if (result.periods) {
    return (
      <div className="space-y-3">
        {result.account?.name ? (
          <p className="text-sm font-semibold text-slate-800">
            {result.account.name}
            <span className="ml-2 text-xs font-normal text-slate-500">
              {result.account.id} · {cur}
            </span>
          </p>
        ) : null}
        <PeriodCards periods={result.periods} currency={cur} />
      </div>
    );
  }

  if (Array.isArray(result.campaigns)) {
    return (
      <SimpleTable
        rows={result.campaigns}
        columns={[
          { key: 'name', label: 'Campaign' },
          { key: 'status', label: 'Status', render: (r) => r.effective_status || r.status || '—' },
          {
            key: 'spend',
            label: '7d spend',
            render: (r) => money(r.last_7d?.spend || 0, cur),
          },
          {
            key: 'results',
            label: 'Results',
            render: (r) => `${num(r.last_7d?.messaging || r.last_7d?.leads || 0)}`,
          },
        ]}
      />
    );
  }

  if (Array.isArray(result.pages)) {
    return (
      <SimpleTable
        rows={result.pages}
        columns={[
          { key: 'name', label: 'Page' },
          { key: 'id', label: 'ID' },
          { key: 'fan_count', label: 'Fans', render: (r) => num(r.fan_count || r.followers_count || 0) },
        ]}
      />
    );
  }

  if (Array.isArray(result.pixels)) {
    return (
      <SimpleTable
        rows={result.pixels}
        columns={[
          { key: 'name', label: 'Pixel' },
          { key: 'id', label: 'ID' },
          { key: 'last_fired_time', label: 'Last fired' },
        ]}
      />
    );
  }

  if (Array.isArray(result.ads) || Array.isArray(result.adsets) || Array.isArray(result.accounts)) {
    const rows = result.ads || result.adsets || result.accounts;
    const keys = ['name', 'id', 'status', 'effective_status'];
    return (
      <SimpleTable
        rows={rows}
        columns={keys
          .filter((k) => rows.some((r: any) => r[k] != null))
          .map((k) => ({ key: k, label: k.replace(/_/g, ' ') }))}
      />
    );
  }

  if (Array.isArray(result.rows)) {
    return (
      <SimpleTable
        rows={result.rows}
        columns={[
          { key: 'campaign_name', label: 'Name', render: (r) => r.campaign_name || r.ad_id || r.adset_id || 'Account' },
          { key: 'spend', label: 'Spend', render: (r) => money(r.spend || 0, cur) },
          { key: 'clicks', label: 'Clicks', render: (r) => num(r.clicks || 0) },
          { key: 'leads', label: 'Leads', render: (r) => num(r.leads || 0) },
          { key: 'messaging', label: 'WA', render: (r) => num(r.messaging || 0) },
        ]}
      />
    );
  }

  if (result.amount_due != null || result.spend_cap != null) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {kv('Current due', money(result.amount_due || result.balance || 0, cur))}
        {kv('Spend cap', result.spend_cap ? money(result.spend_cap, cur) : 'No cap')}
        {kv('Pay method', result.account?.funding || '—')}
      </div>
    );
  }

  if (result.account && !result.periods) {
    const a = result.account;
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {kv('Name', a.name)}
        {kv('ID', a.id)}
        {kv('Currency', a.currency || cur)}
        {kv('Status', a.account_status ?? a.status ?? '—')}
        {kv('Timezone', a.timezone_name || a.timezone || '—')}
        {a.amount_spent != null ? kv('Lifetime spent (raw)', String(a.amount_spent)) : null}
      </div>
    );
  }

  const entries = Object.entries(result).filter(([k]) => k !== 'ok' && k !== 'raw' && k !== 'funding_raw' && k !== 'funding_debug');
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.slice(0, 12).map(([k, v]) =>
        kv(k.replace(/_/g, ' '), typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v ?? '—')),
      )}
    </div>
  );
}

function num(n: number) {
  return Math.round(n || 0).toLocaleString('en-IN');
}

function resultLine(p?: Period | null, currency = 'INR') {
  if (!p) return 'Load overview';
  const chats = p.messaging || 0;
  const leads = p.leads || 0;
  const results = p.results || leads + chats;
  const cost = results > 0 ? p.cpr || p.cpl : 0;
  const bits = [
    `${num(leads)} leads`,
    chats ? `${num(chats)} WA chats` : null,
    `CPR ${money(cost, currency)}`,
    `${num(p.clicks)} clicks`,
    `${num(p.impressions)} impr`,
    `CTR ${pct(p.ctr)}`,
  ].filter(Boolean);
  return bits.join(' · ');
}

export default function MetaAdsMcpApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const [appId, setAppId] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [funds, setFunds] = useState<any>(null);
  const [fundsLoading, setFundsLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState('ACTIVE');
  const [campaignQuery, setCampaignQuery] = useState('');
  const [pages, setPages] = useState<any[]>([]);
  const [pixels, setPixels] = useState<any[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pixelsLoading, setPixelsLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [toolName, setToolName] = useState('get_spend_summary');
  const [toolParams, setToolParams] = useState<Record<string, string>>({});
  const [toolResult, setToolResult] = useState<any>(null);
  const [toolRunning, setToolRunning] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [listening, setListening] = useState(false);
  const [micHint, setMicHint] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [playbook, setPlaybook] = useState({
    goal: '',
    audience: '',
    offers: '',
    copy_rules: '',
    decision_rules: '',
  });
  const [playbookSaving, setPlaybookSaving] = useState(false);
  const mediaRef = useRef<{ stream: MediaStream; recorder: MediaRecorder; chunks: Blob[] } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [section, setSection] = useState<SectionId>(() => readSectionFromUrl('overview'));
  const fetched = useRef({
    overview: false,
    funds: false,
    campaigns: false,
    assets: false,
    account: '',
  });

  const goSection = (id: SectionId) => {
    setSection(id);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', id);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/meta-ads-mcp');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setData(json);
      setAccountId(json?.settings?.account_id || '');
      setAppId(json?.settings?.app_id || '');
      if (json?.playbook) setPlaybook(json.playbook);
    } catch (e: any) {
      setError(e?.message || 'Failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/super_admin/meta-ads-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Request failed');
    return json;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await post({
        action: 'save_settings',
        access_token: token || undefined,
        account_id: accountId,
        app_id: appId,
      });
      setToken('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setError(null);
    try {
      const json = await post({ action: 'test_connection' });
      setTestResult(json);
    } catch (e: any) {
      setTestResult({ ok: false, error: e?.message });
      setError(e?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const loadOverview = async () => {
    setOverviewLoading(true);
    setError(null);
    try {
      const json = await post({ action: 'overview' });
      setOverview(json);
    } catch (e: any) {
      setError(e?.message || 'Overview failed');
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadFunds = async () => {
    setFundsLoading(true);
    try {
      const json = await post({ action: 'funds' });
      setFunds(json);
    } catch (e: any) {
      setFunds({ error: e?.message || 'Funds failed' });
    } finally {
      setFundsLoading(false);
    }
  };

  const loadCampaigns = async (status = campaignFilter) => {
    setCampaignsLoading(true);
    setError(null);
    try {
      const json = await post({ action: 'list_campaigns', status, limit: 40 });
      setCampaigns(json.campaigns || []);
    } catch (e: any) {
      setError(e?.message || 'Campaigns failed');
    } finally {
      setCampaignsLoading(false);
    }
  };

  const loadPages = async () => {
    setPagesLoading(true);
    try {
      const json = await post({ action: 'list_pages', limit: 25 });
      setPages(json.pages || []);
      setAssetError(null);
    } catch (e: any) {
      setPages([]);
      setAssetError(e?.message || 'Pages failed — assign the Page (View) on Myfng-adsreader');
    } finally {
      setPagesLoading(false);
    }
  };

  const loadPixels = async () => {
    setPixelsLoading(true);
    try {
      const json = await post({ action: 'list_pixels' });
      setPixels(json.pixels || []);
    } catch (e: any) {
      setPixels([]);
      setAssetError((prev) => prev || e?.message || 'Pixel failed — assign Dataset (View)');
    } finally {
      setPixelsLoading(false);
    }
  };

  useEffect(() => {
    if (!data?.settings?.ready) return;
    if (fetched.current.account !== data.settings.account_id) {
      fetched.current = {
        overview: false,
        funds: false,
        campaigns: false,
        assets: false,
        account: data.settings.account_id,
      };
    }
    const run = async () => {
      if (section === 'overview' && !fetched.current.overview) {
        fetched.current.overview = true;
        await loadOverview();
      }
      if (section === 'funds' && !fetched.current.funds) {
        fetched.current.funds = true;
        if (!fetched.current.overview) {
          fetched.current.overview = true;
          await loadOverview();
        }
        await loadFunds();
      }
      if (section === 'campaigns' && !fetched.current.campaigns) {
        fetched.current.campaigns = true;
        await loadCampaigns();
      }
      if (section === 'assets' && !fetched.current.assets) {
        fetched.current.assets = true;
        await loadPages();
        await loadPixels();
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, data?.settings?.ready, data?.settings?.account_id]);

  const runTool = async () => {
    setToolRunning(true);
    setError(null);
    try {
      const params = Object.fromEntries(Object.entries(toolParams).filter(([, v]) => String(v || '').trim()));
      const json = await post({ action: 'run_tool', name: toolName, params });
      setToolResult(json.result);
    } catch (e: any) {
      setToolResult(null);
      setError(e?.message || 'Tool failed');
    } finally {
      setToolRunning(false);
    }
  };

  const sendChat = async (text?: string) => {
    const message = String(text || chatInput).trim();
    if (!message || chatBusy) return;
    setChatInput('');
    setChatBusy(true);
    setError(null);
    const next = [...chat, { role: 'user' as const, content: message }];
    setChat(next);
    try {
      const json = await post({
        action: 'chat',
        message,
        history: next.slice(0, -1).slice(-8),
      });
      setChat([
        ...next,
        { role: 'assistant', content: json.reply || 'No reply', report: json.report || null },
      ]);
    } catch (e: any) {
      setChat([...next, { role: 'assistant', content: e?.message || 'Chat failed' }]);
    } finally {
      setChatBusy(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, chatBusy]);

  useEffect(() => {
    return () => {
      const ctx = mediaRef.current;
      mediaRef.current = null;
      try {
        ctx?.recorder.stop();
      } catch {
        /* ignore */
      }
      ctx?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const finishRecording = async (sendIt: boolean) => {
    const ctx = mediaRef.current;
    mediaRef.current = null;
    setListening(false);
    if (!ctx) return;

    const blob = await new Promise<Blob>((resolve) => {
      ctx.recorder.onstop = () => {
        ctx.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(ctx.chunks, { type: ctx.recorder.mimeType || 'audio/webm' }));
      };
      if (ctx.recorder.state === 'inactive') {
        ctx.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(ctx.chunks, { type: ctx.recorder.mimeType || 'audio/webm' }));
        return;
      }
      ctx.recorder.stop();
    });

    if (!sendIt) {
      setMicHint(null);
      return;
    }
    if (blob.size < 800) {
      setMicHint('Bahut short tha — mic dabao, bolo, phir Stop.');
      return;
    }

    setChatBusy(true);
    setMicHint('Voice samajh raha hoon…');
    try {
      let payload = blob;
      let mime = 'audio/webm';
      let filename = 'ask.webm';
      try {
        payload = await recordingToWav(blob);
        mime = 'audio/wav';
        filename = 'ask.wav';
      } catch {
        mime = 'audio/webm';
        filename = 'ask.webm';
      }
      const b64 = await blobToBase64(payload);
      const json = await post({
        action: 'transcribe',
        audio_base64: b64,
        mime,
        filename,
      });
      const text = String(json.text || '').trim();
      if (!text) {
        setMicHint('Voice samajh nahi aayi — dubara bolo ya type karo.');
        setChatBusy(false);
        return;
      }
      setMicHint(null);
      setChatBusy(false);
      await sendChat(text);
    } catch (e: any) {
      setChatBusy(false);
      setMicHint(e?.message || 'Voice transcribe fail — type karke bhejo.');
    }
  };

  const toggleMic = async () => {
    if (listening) {
      await finishRecording(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicHint('Is browser mein mic nahi chalta — Chrome use karo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data?.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        setMicHint('Mic record fail ho gaya.');
        stream.getTracks().forEach((t) => t.stop());
        mediaRef.current = null;
        setListening(false);
      };
      mediaRef.current = { stream, recorder, chunks };
      recorder.start();
      setListening(true);
      setMicHint('Bol rahe ho — khatam hone pe mic / Stop dabao.');
      setError(null);
    } catch (e: any) {
      const denied = /notallowed|permission|denied/i.test(String(e?.name || e?.message || ''));
      setMicHint(
        denied
          ? 'Mic Chrome/macOS se band hai. Site settings → Microphone Allow, aur Mac: System Settings → Privacy → Microphone → Google Chrome ON. Phir refresh.'
          : e?.message || 'Mic start nahi hua.',
      );
    }
  };

  const generateReport = async (period: 'today' | 'last_7d' | 'last_30d' | 'briefing') => {
    setReportBusy(true);
    setError(null);
    try {
      const json = await post({ action: 'generate_report', period });
      setGeneratedReport(json.report);
    } catch (e: any) {
      setError(e?.message || 'Report failed');
    } finally {
      setReportBusy(false);
    }
  };

  const savePlaybook = async () => {
    setPlaybookSaving(true);
    setError(null);
    try {
      const json = await post({ action: 'save_playbook', playbook });
      if (json.playbook) setPlaybook(json.playbook);
    } catch (e: any) {
      setError(e?.message || 'Playbook save failed');
    } finally {
      setPlaybookSaving(false);
    }
  };

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const selectedTool = useMemo(() => data?.tools.find((t) => t.name === toolName) || null, [data, toolName]);
  const currency = overview?.currency || 'INR';
  const status = data ? STATUS_UI[data.status] : null;
  const currentNav = ADS_NAV.find((item) => item.id === section) || ADS_NAV[0];
  const visibleCampaigns = useMemo(() => {
    const q = campaignQuery.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.objective || '').toLowerCase().includes(q),
    );
  }, [campaigns, campaignQuery]);
  const dailyBurn = (overview?.periods?.last_7d?.spend || 0) / 7;
  const wallet = Number(funds?.funds || 0);
  const daysLeft = wallet > 0 && dailyBurn > 0 ? Math.max(0, Math.floor(wallet / dailyBurn)) : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-[#012A66] via-[#004AAD] to-[#0284c7] px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Super Admin</p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-black text-white sm:text-2xl">
              <Megaphone className="h-6 w-6 text-sky-200" />
              Meta Ads
            </h1>
            <p className="mt-1 text-sm text-sky-100/90">
              {currentNav.label} — {currentNav.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {status ? (
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className} bg-white/95`}>
                {status.label}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        </div>
        {data ? (
          <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/70 px-3 py-2 sm:px-5">
            <div className="flex min-w-max gap-1.5 pb-0.5">
              {ADS_NAV.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goSection(item.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
                      active
                        ? 'bg-[#004AAD] text-white shadow-sm'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[#004AAD]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : null}

      {data && status ? (
        <>
          {section === 'connect' ? (
          <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
                {status.label}
              </span>
              <p className="mt-2 text-xs text-slate-500">{data.meta.mode} · {data.tool_count} tools</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ad account</p>
              <p className="mt-1 break-all text-sm font-black text-slate-900">{data.settings.account_id || '—'}</p>
              <p className="text-xs text-slate-500">{testResult?.account?.name || overview?.account?.name || 'Test connection to confirm'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Token</p>
              <p className="mt-1 text-sm font-black text-slate-900">
                {data.settings.has_token ? data.settings.token_hint : 'Not set'}
              </p>
              <p className="text-xs text-slate-500">{data.settings.from_env ? 'From META_ADS_* env' : 'Saved in system settings'}</p>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-[#004AAD]/20 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <KeyRound className="h-5 w-5 text-[#004AAD]" />
              Connect MyFNG ad account
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {data.setup_steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-slate-500">Access token</span>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={data.settings.from_env}
                  placeholder={data.settings.has_token ? `Saved ${data.settings.token_hint} — paste to replace` : 'System User token with ads_read'}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Ad account ID</span>
                <input
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={data.settings.from_env}
                  placeholder="act_1234567890"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">App ID (optional)</span>
                <input
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  disabled={data.settings.from_env}
                  placeholder="Meta app ID"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving || data.settings.from_env}
                onClick={() => void save()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </button>
              <button
                type="button"
                disabled={testing || !data.settings.has_token}
                onClick={() => void test()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Test connection
              </button>
            </div>
            {testResult?.account ? (
              <div className="mt-3 space-y-1 text-sm text-emerald-800">
                <p>
                  Connected: <strong>{testResult.account.name}</strong> · {testResult.account.currency} · {testResult.account.id}
                </p>
                <p>
                  Pages {testResult.pages?.length ?? 0} · Pixels {testResult.pixels?.length ?? 0}
                </p>
                {(testResult.warnings || []).length > 0 ? (
                  <p className="text-amber-800">{(testResult.warnings || []).join(' · ')}</p>
                ) : null}
              </div>
            ) : testResult?.error ? (
              <p className="mt-3 text-sm text-rose-700">{testResult.error}</p>
            ) : null}
          </div>
          </>
          ) : null}

          {section === 'overview' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900">Performance</h2>
                <p className="text-sm text-slate-500">
                  {overview?.account?.name || 'My FNG Car Service'}
                  {overviewLoading ? ' · loading…' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reportBusy || !data.settings.ready}
                  onClick={() => goSection('reports')}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <FileBarChart className="h-3.5 w-3.5" />
                  Generate report
                </button>
                <button
                  type="button"
                  disabled={overviewLoading || !data.settings.ready}
                  onClick={() => void loadOverview()}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#004AAD] disabled:opacity-50"
                >
                  {overviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Reload
                </button>
              </div>
            </div>
            {!data.settings.ready ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                Token + account ID save karo, phir spend yahan dikhega.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                {(['today', 'last_7d', 'last_30d'] as const).map((key) => {
                  const p: Period | undefined = overview?.periods?.[key];
                  const label = key === 'today' ? 'Today' : key === 'last_7d' ? 'Last 7 days' : 'Last 30 days';
                  const hero = key === 'today';
                  return (
                    <div
                      key={key}
                      className={`rounded-2xl border p-4 shadow-sm ${
                        hero
                          ? 'border-transparent bg-gradient-to-br from-[#012A66] to-[#0369a1] text-white'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className={`text-[10px] font-bold uppercase tracking-wide ${hero ? 'text-sky-200' : 'text-slate-500'}`}>
                        {label}
                      </p>
                      <p className={`mt-2 text-2xl font-black ${hero ? 'text-white' : 'text-slate-900'}`}>
                        {p ? money(p.spend, currency) : overviewLoading ? '…' : '—'}
                      </p>
                      <div className={`mt-3 grid grid-cols-2 gap-2 text-[11px] ${hero ? 'text-sky-100' : 'text-slate-600'}`}>
                        <span>{num(p?.messaging || 0)} WA chats</span>
                        <span>{num(p?.clicks || 0)} clicks</span>
                        <span>CPR {p ? money(p.cpr || p.cpl || 0, currency) : '—'}</span>
                        <span>CTR {p ? pct(p.ctr) : '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          ) : null}

          {section === 'funds' ? (
          <div className="rounded-2xl border-2 border-emerald-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <Wallet className="h-5 w-5 text-emerald-700" />
                Ads funds tracker
              </h2>
              <button
                type="button"
                disabled={fundsLoading || !data.settings.ready}
                onClick={() => void loadFunds()}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#004AAD] disabled:opacity-50"
              >
                {fundsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reload
              </button>
            </div>
            {funds?.error ? (
              <p className="mt-3 text-sm text-rose-700">{funds.error}</p>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800">
                      Current balance (due)
                    </p>
                    <p className="mt-1 text-xl font-black text-amber-900">
                      {funds ? money(funds.amount_due || funds.balance || 0, currency) : '—'}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-800">
                      Pay when {funds?.pay_threshold ? money(funds.pay_threshold, currency) : 'threshold'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Funds</p>
                    <p className="mt-1 text-xl font-black text-emerald-900">
                      {funds?.funds_from_api ? money(funds.funds || 0, currency) : 'Ads Manager'}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800">
                      {funds?.funds_from_api
                        ? `After next payment: ${money(funds.available_after_payment || 0, currency)}`
                        : 'Prepaid wallet API mein nahi aata'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Daily burn (7d avg)</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{money(dailyBurn || 0, currency)}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {daysLeft != null ? `~${daysLeft} days of Funds left` : '7-day spend se burn'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Spending limit</p>
                    <p className="mt-1 text-xl font-black text-slate-900">
                      {funds?.spend_cap ? money(funds.spend_cap, currency) : 'No cap'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {funds?.account?.funding && funds.account.funding !== '—'
                        ? funds.account.funding
                        : 'Card / auto-pay in Ads Manager'}
                    </p>
                  </div>
                </div>
                {funds?.permission_hint ? (
                  <p className="mt-3 text-xs text-slate-500">{funds.permission_hint}</p>
                ) : null}
                {(funds?.transactions || []).length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Recent transactions</p>
                    <table className="min-w-full text-left text-sm">
                      <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="py-1 pr-3 font-bold">When</th>
                          <th className="py-1 pr-3 font-bold">Type</th>
                          <th className="py-1 font-bold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {funds.transactions.slice(0, 8).map((tx: any, i: number) => (
                          <tr key={tx.id || i}>
                            <td className="py-1.5 pr-3 text-xs text-slate-500">
                              {tx.time ? new Date(tx.time).toLocaleString() : '—'}
                            </td>
                            <td className="py-1.5 pr-3 text-xs">{tx.type}</td>
                            <td className="py-1.5 text-xs font-semibold">
                              {tx.amount != null ? money(tx.amount, currency) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            )}
          </div>
          ) : null}

          {section === 'campaigns' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">Campaigns (7d)</h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={campaignQuery}
                  onChange={(e) => setCampaignQuery(e.target.value)}
                  placeholder="Search campaign"
                  className="w-40 rounded-lg border border-slate-200 px-2 py-1.5 text-xs sm:w-56"
                />
                <select
                  value={campaignFilter}
                  onChange={(e) => {
                    setCampaignFilter(e.target.value);
                    void loadCampaigns(e.target.value);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="ALL">All</option>
                </select>
                <button
                  type="button"
                  disabled={campaignsLoading || !data.settings.ready}
                  onClick={() => void loadCampaigns()}
                  className="text-xs font-semibold text-[#004AAD] disabled:opacity-50"
                >
                  {campaignsLoading ? 'Loading…' : 'Reload'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-bold">Campaign</th>
                    <th className="px-4 py-2 font-bold">Status</th>
                    <th className="px-4 py-2 font-bold">Spend</th>
                    <th className="px-4 py-2 font-bold">Results</th>
                    <th className="px-4 py-2 font-bold">CPR</th>
                    <th className="px-4 py-2 font-bold">Clicks</th>
                    <th className="px-4 py-2 font-bold">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        {data.settings.ready ? 'No campaigns for this filter.' : 'Connect account first.'}
                      </td>
                    </tr>
                  ) : (
                    visibleCampaigns.map((c) => {
                      const p = c.last_7d;
                      const has = Boolean(p?.date_start);
                      const results = p?.results || (p?.leads || 0) + (p?.messaging || 0);
                      return (
                        <tr key={c.id}>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-slate-900">{c.name}</p>
                            <p className="text-[11px] text-slate-400">{c.objective || c.id}</p>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-semibold">{c.effective_status || c.status}</td>
                          <td className="px-4 py-2.5">{has ? money(p?.spend || 0, currency) : '—'}</td>
                          <td className="px-4 py-2.5">
                            {has
                              ? `${num(results)}${(p?.messaging || 0) > 0 ? ' WA' : (p?.leads || 0) > 0 ? ' leads' : ''}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5">{has ? money(p?.cpr || p?.cpl || 0, currency) : '—'}</td>
                          <td className="px-4 py-2.5">{has ? num(p?.clicks || 0) : '—'}</td>
                          <td className="px-4 py-2.5">{has ? pct(p?.ctr || 0) : '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          ) : null}

          {section === 'assets' ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Pages</h2>
                <button
                  type="button"
                  disabled={pagesLoading || !data.settings.has_token}
                  onClick={() => void loadPages()}
                  className="text-xs font-semibold text-[#004AAD] disabled:opacity-50"
                >
                  {pagesLoading ? 'Loading…' : 'Reload'}
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {pages.length === 0 ? (
                  <li className="px-4 py-5 text-sm text-slate-500">
                    {assetError || 'No pages. Assign Pages (View) on Myfng-adsreader, then generate a new token with pages_show_list.'}
                  </li>
                ) : (
                  pages.map((p) => (
                    <li key={p.id} className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {num(p.fan_count || p.followers_count || 0)} fans
                        {p.instagram_business_account?.username ? ` · IG @${p.instagram_business_account.username}` : ''}
                      </p>
                      <a
                        href={p.link || `https://facebook.com/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-[11px] font-semibold text-[#004AAD]"
                      >
                        Open page
                      </a>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Pixels</h2>
                <button
                  type="button"
                  disabled={pixelsLoading || !data.settings.ready}
                  onClick={() => void loadPixels()}
                  className="text-xs font-semibold text-[#004AAD] disabled:opacity-50"
                >
                  {pixelsLoading ? 'Loading…' : 'Reload'}
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {pixels.length === 0 ? (
                  <li className="px-4 py-5 text-sm text-slate-500">
                    Pixel Graph se nahi aaya. Events Manager se Pixel ID copy karke neeche tool{' '}
                    <code className="rounded bg-slate-100 px-1">get_pixel</code> chalao. Dataset assign ho chuka hai.
                  </li>
                ) : (
                  pixels.map((px) => (
                    <li key={px.id} className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900">{px.name || 'My FNG Pixel'}</p>
                      <p className="text-[11px] text-slate-400">
                        {px.id}
                        {px.last_fired_time ? ` · last fired ${new Date(px.last_fired_time).toLocaleString()}` : ''}
                        {px.is_unavailable ? ' · unavailable' : ''}
                      </p>
                      {Array.isArray(px.events) && px.events.length > 0 ? (
                        <p className="mt-1 text-[11px] text-slate-600">
                          7d:{' '}
                          {px.events
                            .slice(0, 4)
                            .map((ev: any) => `${ev.event} ${num(ev.count)}`)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
          ) : null}

          {section === 'ask' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#012A66] to-[#004AAD] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2 text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold">Ask MyFNG Ads</p>
                  <p className="text-[11px] text-sky-100">Likho, ya mic dabao — live numbers aayenge</p>
                </div>
              </div>
              {listening ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Sun raha hoon
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3">
              {ASK_CHIPS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={chatBusy || !data.settings.has_token}
                  onClick={() => void sendChat(q)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-[#004AAD]/10 hover:text-[#004AAD] disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="max-h-[28rem] min-h-[20rem] space-y-3 overflow-y-auto bg-[#F4F7FB] px-4 py-4">
              {chat.length === 0 ? (
                <div className="flex h-full min-h-[16rem] flex-col items-center justify-center text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#004AAD]/10 text-[#004AAD]">
                    <Mic className="h-7 w-7" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-800">Bolke report nikaal sakte ho</p>
                  <p className="mt-1 max-w-sm text-xs text-slate-500">
                    “Aaj kitna spend hua?” ya “7 din ki report banao” — mic ya type, dono chalega.
                  </p>
                </div>
              ) : (
                chat.map((m, i) => (
                  <div key={`${m.role}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#004AAD] px-4 py-2.5 text-sm text-white shadow-sm">
                        <ChatMessageBody role={m.role} content={m.content} report={m.report} />
                      </div>
                    ) : (
                      <div className="w-fit max-w-[16.5rem]">
                        <ChatMessageBody role={m.role} content={m.content} report={m.report} />
                      </div>
                    )}
                  </div>
                ))
              )}
              {chatBusy ? (
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#004AAD]" /> Meta se nikal raha hoon…
                </div>
              ) : null}
              <div ref={chatEndRef} />
            </div>
            <form
              className="border-t border-slate-100 bg-white p-3 sm:p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (listening) void toggleMic();
                else void sendChat();
              }}
            >
              {micHint ? (
                <p className={`mb-2 text-xs font-semibold ${listening ? 'text-rose-600' : 'text-slate-600'}`}>
                  {micHint}
                </p>
              ) : null}
              <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={(chatBusy && !listening) || !data.settings.has_token}
                onClick={() => void toggleMic()}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                  listening ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-100 text-slate-700 hover:bg-[#004AAD] hover:text-white'
                }`}
                aria-label="Voice"
              >
                {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={listening ? 'Bolte raho, phir Stop…' : 'Sawaal likho ya mic dabao…'}
                disabled={chatBusy || listening || !data.settings.has_token}
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-[#004AAD] focus:bg-white"
              />
              <button
                type="submit"
                disabled={
                  (chatBusy && !listening) ||
                  !data.settings.has_token ||
                  (!listening && !chatInput.trim())
                }
                className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-[#004AAD] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {listening ? 'Stop' : <><Send className="h-4 w-4" /> Send</>}
              </button>
              </div>
            </form>
          </div>
          ) : null}

          {section === 'brain' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900">Ads brain</h2>
                <p className="text-sm text-slate-500">
                  Ask ads isi playbook se Keep / Test / Pause suggestion dega. Numbers hamesha live Meta se.
                </p>
              </div>
              <button
                type="button"
                disabled={playbookSaving}
                onClick={() => void savePlaybook()}
                className="rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {playbookSaving ? 'Saving…' : 'Save playbook'}
              </button>
            </div>
            {(
              [
                ['goal', 'Goal / KPI', 'WhatsApp chats, CPR, cities…'],
                ['audience', 'Audience', 'Kaun, kahan, language'],
                ['offers', 'Offers / USPs', 'Pickup, warranty, CTA'],
                ['copy_rules', 'Copy rules', 'Headline length, tone, geo'],
                ['decision_rules', 'Keep / Test / Pause rules', '7d chats vs spend'],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <span className="text-sm font-bold text-slate-900">{label}</span>
                <span className="ml-2 text-xs text-slate-400">{hint}</span>
                <textarea
                  value={playbook[key]}
                  onChange={(e) => setPlaybook((prev) => ({ ...prev, [key]: e.target.value }))}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#004AAD] focus:bg-white"
                />
              </label>
            ))}
          </div>
          ) : null}

          {section === 'reports' ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">Generate report</h2>
              <p className="text-sm text-slate-500">Live Meta numbers se HTML report — Print se PDF bhi nikal sakte ho.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { id: 'today' as const, label: 'Today', hint: 'Aaj ka spend + results' },
                  { id: 'last_7d' as const, label: 'Last 7 days', hint: 'Hafta + campaigns' },
                  { id: 'last_30d' as const, label: 'Last 30 days', hint: 'Mahine ka overview' },
                  { id: 'briefing' as const, label: 'Full briefing', hint: 'Spend + campaigns + due' },
                ]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={reportBusy || !data.settings.ready}
                  onClick={() => void generateReport(item.id)}
                  className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#004AAD]/40 hover:shadow-md disabled:opacity-50"
                >
                  <FileBarChart className="h-5 w-5 text-[#004AAD]" />
                  <p className="mt-2 text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.hint}</p>
                </button>
              ))}
            </div>
            {reportBusy ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Report nikal raha hoon — Meta pe 10–20 sec lag sakte hain.
              </p>
            ) : null}
            {generatedReport ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-bold text-slate-900">{generatedReport.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadReportFile(generatedReport)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AAD] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </button>
                    <button
                      type="button"
                      onClick={() => printReportFile(generatedReport)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print / PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy('report', generatedReport.markdown || '')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied === 'report' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-800">
                  {generatedReport.markdown}
                </pre>
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Card choose karo, ya Ask ads mein bolo “7 din ki report banao”.
              </p>
            )}
          </div>
          ) : null}

          {section === 'tools' ? (
          <>
          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-900">
              <Terminal className="h-4 w-4" />
              Advanced: run a tool
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">Tool</span>
                <select
                  value={toolName}
                  onChange={(e) => {
                    setToolName(e.target.value);
                    setToolParams({});
                    setToolResult(null);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                >
                  {data.tools.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name} — {t.description}
                    </option>
                  ))}
                </select>
              </label>
              {selectedTool?.params.map((p) => (
                <label key={p.key} className="block">
                  <span className="text-xs font-semibold text-slate-500">
                    {p.label}
                    {p.required ? ' *' : ''}
                  </span>
                  <input
                    value={toolParams[p.key] || ''}
                    onChange={(e) => setToolParams((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder={p.placeholder}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
                  />
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={toolRunning || !data.settings.has_token}
              onClick={() => void runTool()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {toolRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run {toolName}
            </button>
            {toolResult ? (
              <div className="mt-4 space-y-3">
                <ToolResultView result={toolResult} currency={currency} />
                <details className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500">Raw JSON</summary>
                  <pre className="mt-2 max-h-48 overflow-auto text-[11px] leading-relaxed text-slate-600">
                    {JSON.stringify(toolResult, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}
          </details>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Shield className="h-4 w-4 text-[#004AAD]" />
              Safety
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {data.meta.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              Optional: Claude connector URL (not required for this admin page)
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Same Meta credentials, public MCP at <code className="rounded bg-slate-100 px-1">{data.claude.connector_url}</code>.
              Bearer token MyFNG MCP page se generate hota hai.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <code className="flex-1 overflow-x-auto rounded-xl bg-slate-950 px-3 py-2.5 text-sm text-emerald-300">
                {data.claude.connector_url}
              </code>
              <button
                type="button"
                onClick={() => void copy('url', data.claude.connector_url)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold"
              >
                <Copy className="h-4 w-4" />
                {copied === 'url' ? 'Copied' : 'Copy'}
              </button>
              <a
                href={data.claude.connectors_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#004AAD] px-3 py-2 text-sm font-semibold text-white"
              >
                Claude <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </details>

          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Tools ({data.tool_count})</h2>
            {Object.entries(data.by_area).map(([area, tools]) => (
              <div key={area} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#023D95]">
                    {area} · {tools.length}
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {tools.map((t) => (
                    <li key={t.name} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
                      <code className="text-sm font-semibold text-slate-900">{t.name}</code>
                      <span className="text-xs text-slate-500 sm:text-right">{t.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          </>
          ) : null}

          <p className="text-[11px] text-slate-400">Checked {new Date(data.checked_at).toLocaleString()}</p>
        </>
      ) : null}
    </div>
  );
}
