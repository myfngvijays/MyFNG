'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Brain,
  Copy,
  ExternalLink,
  FileBarChart,
  KeyRound,
  Layers,
  Loader2,
  Megaphone,
  MessageCircle,
  Mic,
  MicOff,
  Plug,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Type,
  Goal,
  Wallet,
} from 'lucide-react';
import GoogleAdsDatePicker from './GoogleAdsDatePicker';
import GoogleAdsTable from './GoogleAdsTable';
import GoogleAdsColumnsPicker from './GoogleAdsColumnsPicker';
import GoogleAdsCampaignDetail from './GoogleAdsCampaignDetail';
import GoogleAdsConversionsPanel from './GoogleAdsConversionsPanel';
import GoogleAdsReportPanel from './GoogleAdsReportPanel';
import GoogleAdsFundsPanel from './GoogleAdsFundsPanel';
import { datePresetLabel, type DateRangeInput } from '@/lib/google-ads/dateRange';
import { DEFAULT_CAMPAIGN_COLUMNS, DEFAULT_LIST_COLUMNS, loadCampaignColumns, saveCampaignColumns } from '@/lib/google-ads/columns';

type Settings = {
  has_developer_token: boolean;
  has_refresh_token: boolean;
  has_oauth_client: boolean;
  customer_id: string;
  customer_id_display: string;
  login_customer_id: string;
  login_customer_id_display: string;
  project_id: string;
  from_env: boolean;
  developer_token_hint: string;
  refresh_token_hint: string;
  ready: boolean;
};

type Payload = {
  ok: boolean;
  status: 'ready' | 'needs_account' | 'needs_oauth';
  settings: Settings;
  oauth_url: string;
  claude: {
    connectors_url: string;
    connector_url: string;
    this_host_url: string;
    official_repo: string;
    has_token?: boolean;
    hint?: string;
  };
  tools: { name: string; area: string; description: string }[];
  setup_steps: string[];
};

type Period = {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctr?: number;
  cpc?: number | null;
  cpl: number | null;
  roas?: number | null;
};

type Row = Period & {
  id?: string;
  name?: string;
  text?: string;
  status?: string;
  channel?: string;
  campaign?: string;
  ad_group?: string;
  match?: string;
  type?: string;
  headlines?: string[];
  date?: string;
};

type SectionId =
  | 'overview'
  | 'funds'
  | 'ask'
  | 'reports'
  | 'brain'
  | 'campaigns'
  | 'ad_groups'
  | 'ads'
  | 'keywords'
  | 'search_terms'
  | 'conversions'
  | 'connect'
  | 'mcp';
type ChatMsg = { role: 'user' | 'assistant'; content: string; cards?: any; report?: any; blocks?: any[] };

const STATUS_UI: Record<Payload['status'], { label: string; className: string }> = {
  ready: { label: 'Connected', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  needs_account: { label: 'Google connected · add customer ID', className: 'bg-amber-100 text-amber-900 border-amber-200' },
  needs_oauth: { label: 'Connect Google (Ads)', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

const NAV: { id: SectionId; label: string; icon: typeof Target }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'funds', label: 'Funds', icon: Wallet },
  { id: 'ask', label: 'Ask AI', icon: MessageCircle },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'brain', label: 'Brain', icon: Brain },
  { id: 'campaigns', label: 'Campaigns', icon: Target },
  { id: 'ad_groups', label: 'Ad groups', icon: Layers },
  { id: 'ads', label: 'Ads', icon: Megaphone },
  { id: 'keywords', label: 'Keywords', icon: Type },
  { id: 'search_terms', label: 'Search terms', icon: Search },
  { id: 'conversions', label: 'Conversions', icon: Goal },
  { id: 'connect', label: 'Connect', icon: KeyRound },
  { id: 'mcp', label: 'Claude / MCP', icon: Plug },
];

const ASK_CHIPS = [
  'Kaunsi copy chalaun?',
  'Aaj kitna spend hua?',
  '7 din ka spend aur conversions',
  'Enabled campaigns',
  'Top search terms',
  '7 din ki report banao',
  'Keywords se headlines suggest kar',
  'Kitna fund bacha hai?',
];

function isSectionId(value: string | null): value is SectionId {
  return Boolean(value && NAV.some((item) => item.id === value));
}

function inr(n: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);
  } catch {
    return `${currency} ${Math.round(n || 0)}`;
  }
}

function num(n: number) {
  return new Intl.NumberFormat('en-IN').format(n || 0);
}

function cleanAskText(value: string) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .trim();
}

function AskMetricCards({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {items.map((item, idx) => (
        <div key={`${item.name}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-extrabold text-slate-900">{item.name}</p>
            {(item.tags || []).map((tag: string) => (
              <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                {tag}
              </span>
            ))}
          </div>
          {item.headline ? <p className="mt-0.5 text-[11px] text-slate-500">{item.headline}</p> : null}
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {(item.metrics || []).map((x: any) => (
              <div key={x.label} className="rounded-lg bg-white px-2 py-1">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{x.label}</p>
                <p className="text-xs font-extrabold text-slate-900">{x.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AskReportCard({ report }: { report: any }) {
  const currency = report?.currency || 'INR';
  const m = report?.metrics || {};
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-800">
      <p className="text-xs font-extrabold">{report.label || report.title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Spend', inr(m.spend || 0, currency)],
          ['Clicks', num(m.clicks || 0)],
          ['Results', num(m.conversions || 0)],
          ['CPL', m.cpl != null ? inr(m.cpl, currency) : '—'],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg bg-white px-2 py-1.5">
            <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
            <p className="text-sm font-extrabold">{value}</p>
          </div>
        ))}
      </div>
      {(report.insights?.lines || []).slice(0, 3).map((line: string) => (
        <p key={line} className="text-[11px] text-slate-600">
          • {line}
        </p>
      ))}
      {(report.ad_groups || []).slice(0, 6).map((row: any) => (
        <p key={row.id || row.name} className="truncate text-[11px] text-slate-600">
          {row.name} · {inr(row.spend || 0, currency)} · {row.conversions || 0} results
        </p>
      ))}
    </div>
  );
}

function metricLine(row: Period, currency: string) {
  return [
    inr(row.spend || 0, currency),
    `${num(row.clicks || 0)} clicks`,
    row.ctr != null ? `${row.ctr}% CTR` : null,
    row.cpc != null ? `CPC ${inr(row.cpc, currency)}` : null,
    `${num(row.conversions || 0)} conv.`,
    row.cpl != null ? `CPL ${inr(row.cpl, currency)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function GoogleAdsMcpApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [overview, setOverview] = useState<any>(null);
  const [funds, setFunds] = useState<any>(null);
  const [conversionReport, setConversionReport] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeInput>({ during: 'LAST_7_DAYS' });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [channel, setChannel] = useState('');
  const [sort, setSort] = useState('spend');
  const [campaignColumns, setCampaignColumns] = useState<string[]>(DEFAULT_CAMPAIGN_COLUMNS);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>('overview');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [playbook, setPlaybook] = useState({
    goal: '',
    audience: '',
    offers: '',
    copy_rules: '',
    decision_rules: '',
  });
  const [playbookSaving, setPlaybookSaving] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const cache = useRef<Record<string, any>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/google-ads-mcp');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setData(json);
      setCustomerId(json?.settings?.customer_id_display || json?.settings?.customer_id || '');
      setLoginCustomerId(json?.settings?.login_customer_id_display || json?.settings?.login_customer_id || '');
      if (json?.playbook) setPlaybook(json.playbook);
      cache.current = {};
      setOverview(null);
      setRows([]);
    } catch (e: any) {
      setError(e?.message || 'Failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCampaignColumns(loadCampaignColumns());
  }, []);

  useEffect(() => {
    void load();
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const gads = url.searchParams.get('gads');
    if (gads === 'connected') setBanner('Google Ads connected. Run Test connection.');
    if (gads === 'state') setError('OAuth state mismatch. Try Connect with Google again.');
    if (gads === 'missing_oauth_client') setError('GOOGLE_OAUTH_CLIENT_ID is missing on the server.');
    if (gads === 'oauth_failed') {
      setError(`Google OAuth failed: ${url.searchParams.get('detail') || 'no refresh token returned'}`);
    }
    const tab = url.searchParams.get('section');
    if (isSectionId(tab)) setSection(tab);
  }, [load]);

  useEffect(() => {
    if (section !== 'campaigns') {
      setDetailId(null);
      setDetail(null);
      setDetailError(null);
    }
  }, [section]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/super_admin/google-ads-mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      if (res.status === 401) throw new Error('Session expire ho gaya. Page refresh karke login karo.');
      throw new Error(json?.error || 'Request failed');
    }
    return json;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await post({ action: 'save_settings', customer_id: customerId, login_customer_id: loginCustomerId });
      setBanner('Customer IDs saved.');
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
      setBanner(json?.account?.name ? `Connected · ${json.account.name}` : 'Google Ads API reachable');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (!data?.settings?.ready) return;
    const key = `v3:${section}:${dateRange.during}:${dateRange.since || ''}:${dateRange.until || ''}:${statusFilter}:${channel}:${sort}`;
    const apply = (json: any) => {
      if (section === 'overview') {
        setOverview(json);
        if (json?.funds) setFunds(json.funds);
      } else if (section === 'funds') setFunds(json);
      else if (section === 'conversions') setConversionReport(json);
      else setRows(json?.campaigns || json?.ad_groups || json?.ads || json?.keywords || json?.search_terms || []);
    };
    if (cache.current[key]) {
      apply(cache.current[key]);
      return;
    }
    const actions: Record<string, string> = {
      overview: 'overview',
      funds: 'funds',
      campaigns: 'campaigns',
      ad_groups: 'ad_groups',
      ads: 'ads',
      keywords: 'keywords',
      search_terms: 'search_terms',
      conversions: 'conversions',
    };
    const action = actions[section];
    if (!action) return;
    setSectionLoading(true);
    setError(null);
    post({
        action,
        during: dateRange.during,
        since: dateRange.since,
        until: dateRange.until,
        limit: 40,
        status: statusFilter,
        channel,
        sort,
      })
      .then((json) => {
        cache.current[key] = json;
        apply(json);
      })
      .catch((e) => setError(e?.message || 'Load failed'))
      .finally(() => setSectionLoading(false));
  }, [section, dateRange.during, dateRange.since, dateRange.until, statusFilter, channel, sort, data?.settings?.ready, refreshTick]);

  useEffect(() => {
    if (!detailId || !data?.settings?.ready) return;
    setDetailLoading(true);
    setDetailError(null);
    post({
      action: 'campaign_detail',
      campaign_id: detailId,
      during: dateRange.during,
      since: dateRange.since,
      until: dateRange.until,
    })
      .then((json) => setDetail(json))
      .catch((e) => setDetailError(e?.message || 'Failed to load campaign'))
      .finally(() => setDetailLoading(false));
  }, [detailId, dateRange.during, dateRange.since, dateRange.until, data?.settings?.ready]);

  const sendChat = async (preset?: string) => {
    const message = String(preset || chatInput).trim();
    if (!message || chatBusy) return;
    setChatBusy(true);
    setChatInput('');
    setChat((prev) => [...prev, { role: 'user', content: message }]);
    try {
      const json = await post({
        action: 'chat',
        message,
        history: chat.slice(-8).map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 400) })),
      });
      setChat((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: cleanAskText(json.reply || 'No reply'),
          cards: json.cards,
          report: json.report,
          blocks: json.blocks,
        },
      ]);
    } catch (e: any) {
      setChat((prev) => [...prev, { role: 'assistant', content: e?.message || 'Ask AI failed' }]);
    } finally {
      setChatBusy(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const toggleMic = () => {
    const Speech = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!Speech) {
      setError('Voice sirf Chrome / Edge pe chalega. Type karo.');
      return;
    }
    if (listening) {
      setListening(false);
      return;
    }
    const rec = new Speech();
    rec.lang = 'hi-IN';
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      const said = String(ev.results?.[0]?.[0]?.transcript || '').trim();
      setListening(false);
      if (said) void sendChat(said);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const savePlaybook = async () => {
    setPlaybookSaving(true);
    try {
      await post({ action: 'save_playbook', playbook });
      setBanner('Playbook saved. Ask AI isi rules se suggest karega.');
    } catch (e: any) {
      setError(e?.message || 'Playbook save failed');
    } finally {
      setPlaybookSaving(false);
    }
  };

  const generateReport = async (period: string, campaignId?: string) => {
    setReportBusy(true);
    setError(null);
    try {
      const json = await post({
        action: 'generate_report',
        period,
        campaign_id: campaignId || '',
        ...(period === 'custom'
          ? { during: dateRange.during, since: dateRange.since, until: dateRange.until }
          : {}),
      });
      setGeneratedReport(json.report);
    } catch (e: any) {
      setError(e?.message || 'Report failed');
    } finally {
      setReportBusy(false);
    }
  };

  const refreshAll = () => {
    cache.current = {};
    setOverview(null);
    setFunds(null);
    setRows([]);
    setConversionReport(null);
    setGeneratedReport(null);
    setError(null);
    setRefreshTick((n) => n + 1);
    void load();
  };

  const goSection = (id: SectionId) => {
    setSection(id);
    setQuery('');
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', id);
    url.searchParams.delete('gads');
    url.searchParams.delete('detail');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  };

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const officialSnippet = useMemo(() => {
    const project = data?.settings?.project_id || 'gmb-api-for-myfng';
    const login = data?.settings?.login_customer_id || '2510208286';
    return `# Official Google Ads MCP (Claude / Cursor)
# https://github.com/googleads/google-ads-mcp
# Same IDs as Super Admin. Refresh token comes from Connect with Google.

pipx install git+https://github.com/googleads/google-ads-mcp.git

# google-ads.yaml (do not commit)
developer_token: \${GOOGLE_ADS_DEVELOPER_TOKEN}
client_id: \${GOOGLE_OAUTH_CLIENT_ID}
client_secret: \${GOOGLE_OAUTH_CLIENT_SECRET}
refresh_token: \${GOOGLE_ADS_REFRESH_TOKEN}
login_customer_id: ${login}
use_proto_plus: True

# Project: ${project}
# Then add google-ads-mcp to Claude Desktop / Cursor mcp.json`;
  }, [data]);

  const status = data?.status || 'needs_oauth';
  const statusUi = STATUS_UI[status];
  const currency = overview?.currency || 'INR';
  const periods = (overview?.periods || {}) as Record<string, Period>;
  const daily: Row[] = Array.isArray(overview?.daily) ? overview.daily : [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.spend || 0));
  const q = query.trim().toLowerCase();
  const visible = q
    ? rows.filter((row) =>
        [row.name, row.text, row.campaign, row.ad_group, ...(row.headlines || [])]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : rows;
  const listSections: SectionId[] = ['campaigns', 'ad_groups', 'ads', 'keywords', 'search_terms'];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading Google Ads…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[88rem] space-y-5 pb-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Super Admin</p>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Google Ads</h1>
            <p className="mt-1 text-sm text-slate-600">
              Read-only spend, campaigns, ads, keywords, and search terms — same creds as official MCP.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GoogleAdsDatePicker
              value={dateRange}
              onChange={(next) => {
                setDateRange(next);
                setRows([]);
                setOverview(null);
              }}
            />
            <button
              type="button"
              onClick={refreshAll}
              disabled={loading || sectionLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              {loading || sectionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusUi.className}`}>{statusUi.label}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goSection(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  active
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {banner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {banner}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}

      {section === 'overview' && (
        <div className="space-y-4">
          {!data?.settings?.ready && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Connect Google (Ads scope) on the Connect tab, then Test connection.
            </div>
          )}
          {sectionLoading && (
            <div className="flex items-center text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading spend…
            </div>
          )}
          {overview?.account && (
            <p className="text-sm text-slate-600">
              {overview.account.name} · {overview.account.id} · {overview.account.currency}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [datePresetLabel(dateRange), periods.selected || periods.last_7d],
              ['Today', periods.today],
              ['Last 7 days', periods.last_7d],
              ['Last 30 days', periods.last_30d],
            ].map(([label, period]) => {
              const p = (period || {}) as Period;
              return (
                <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{String(label)}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">{inr(p.spend || 0, currency)}</p>
                  <p className="mt-2 text-sm text-slate-600">{metricLine(p, currency)}</p>
                </div>
              );
            })}
          </div>
          {overview?.funds ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">Funds remaining</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">
                  {overview.funds.funds_from_api ? inr(overview.funds.remaining || 0, currency) : 'Invoice account'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {overview.funds.funds_from_api && Number(overview.funds.remaining) < 1000
                    ? 'Below ₹1,000 — WhatsApp alert on'
                    : overview.funds.funding || overview.funds.billing_type}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase text-slate-400">Daily budget</p>
                <p className="mt-1 text-xl font-extrabold text-slate-900">{inr(overview.funds.daily_budget || 0, currency)}</p>
                <p className="mt-1 text-xs text-slate-500">Enabled campaigns combined</p>
              </div>
              <button
                type="button"
                onClick={() => goSection('funds')}
                className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-left shadow-sm"
              >
                <p className="text-[11px] font-bold uppercase text-[#004AAD]">Billing</p>
                <p className="mt-1 text-sm font-extrabold text-slate-900">Open Funds tab</p>
                <p className="mt-1 text-xs text-slate-500">Account budget + pay method</p>
              </button>
            </div>
          ) : null}
          {daily.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{datePresetLabel(dateRange)}</p>
              <div className="mt-3 flex h-28 items-end gap-1">
                {daily.map((day) => (
                  <div key={day.date} className="group relative flex-1">
                    <div
                      className="rounded-t bg-blue-500/80"
                      style={{ height: `${Math.max(4, ((day.spend || 0) / maxDaily) * 100)}%` }}
                      title={`${day.date}: ${inr(day.spend || 0, currency)}`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {daily[0]?.date} → {daily[daily.length - 1]?.date}
              </p>
            </div>
          )}
        </div>
      )}

      {section === 'funds' && (
        <GoogleAdsFundsPanel
          funds={funds}
          loading={sectionLoading}
          onRefresh={() => {
            cache.current = {};
            setFunds(null);
            setRefreshTick((n) => n + 1);
          }}
          onTestAlert={async () => post({ action: 'funds_alert', test: true })}
          onCreateTemplate={async () => post({ action: 'funds_template' })}
        />
      )}

      {section === 'ask' && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#012A66] to-[#004AAD] px-4 py-3">
            <div className="flex items-center gap-2 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">Ask Google Ads</p>
                <p className="text-[11px] text-sky-100">Live numbers + Keep / Test / Pause</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-3">
            {ASK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={chatBusy || !data?.settings?.ready}
                onClick={() => void sendChat(chip)}
                className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-[#004AAD]/10 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
          <div className="max-h-[28rem] min-h-[18rem] space-y-3 overflow-y-auto bg-[#F4F7FB] px-4 py-4">
            {chat.length === 0 ? (
              <div className="flex min-h-[14rem] flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-slate-800">Likho ya mic dabao</p>
                <p className="mt-1 max-w-sm text-xs text-slate-500">“Aaj kitna spend hua?” ya “Kaunsi copy chalaun?”</p>
              </div>
            ) : (
              chat.map((m, i) => (
                <div key={`${m.role}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                      m.role === 'user' ? 'rounded-br-md bg-[#004AAD] text-white' : 'bg-white text-slate-800'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      <p className="text-sm font-semibold text-slate-800">{cleanAskText(m.content)}</p>
                    ) : (
                      m.content
                    )}
                    {m.report ? <AskReportCard report={m.report} /> : null}
                    {Array.isArray(m.blocks)
                      ? m.blocks.map((block: any) => (
                          <div key={block.title} className="mt-3">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">{block.title}</p>
                            <AskMetricCards items={block.items || []} />
                          </div>
                        ))
                      : null}
                    {!m.blocks?.length && Array.isArray(m.cards?.items) ? <AskMetricCards items={m.cards.items} /> : null}
                  </div>
                </div>
              ))
            )}
            {chatBusy ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Google Ads se nikal raha hoon…
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex items-end gap-2 border-t border-slate-100 bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat();
            }}
          >
            <button
              type="button"
              disabled={chatBusy || !data?.settings?.ready}
              onClick={toggleMic}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${listening ? 'bg-rose-500 text-white' : 'bg-slate-100'}`}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Sawaal likho…"
              disabled={chatBusy || !data?.settings?.ready}
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={chatBusy || !chatInput.trim() || !data?.settings?.ready}
              className="inline-flex h-11 items-center gap-1 rounded-2xl bg-[#004AAD] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Send
            </button>
          </form>
        </div>
      )}

      {section === 'reports' && (
        <GoogleAdsReportPanel
          report={generatedReport}
          busy={reportBusy}
          ready={Boolean(data?.settings?.ready)}
          onGenerate={(period, campaignId) => void generateReport(period, campaignId)}
        />
      )}

      {section === 'brain' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Google Ads brain</h2>
              <p className="text-sm text-slate-500">Ask AI isi playbook se Keep / Test / Pause dega.</p>
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
              ['goal', 'Goal / KPI'],
              ['audience', 'Audience'],
              ['offers', 'Offers / USPs'],
              ['copy_rules', 'Copy rules'],
              ['decision_rules', 'Keep / Test / Pause'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-sm font-bold text-slate-900">{label}</span>
              <textarea
                value={playbook[key]}
                onChange={(e) => setPlaybook((prev) => ({ ...prev, [key]: e.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      )}

      {section === 'conversions' && (
        <GoogleAdsConversionsPanel
          report={conversionReport}
          loading={sectionLoading}
          currency={currency}
          rangeLabel={datePresetLabel(dateRange)}
        />
      )}

      {listSections.includes(section) && (
        <div className="space-y-3">
          {!(section === 'campaigns' && detailId) && (
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'ENABLED', 'PAUSED', 'REMOVED'].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setStatusFilter(id);
                  setRows([]);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                  statusFilter === id ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600'
                }`}
              >
                {id === 'ALL' ? 'All status' : id}
              </button>
            ))}
            {section === 'campaigns' && (
              <select
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setRows([]);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
              >
                <option value="">All channels</option>
                <option value="SEARCH">Search</option>
                <option value="PERFORMANCE_MAX">PMax</option>
                <option value="DEMAND_GEN">Demand Gen</option>
                <option value="MULTI_CHANNEL">App / Multi</option>
                <option value="SMART">Smart</option>
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setRows([]);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold"
            >
              <option value="spend">Sort: spend</option>
              <option value="conversions">Sort: results</option>
              <option value="clicks">Sort: clicks</option>
              <option value="impressions">Sort: impressions</option>
              <option value="cpl">Sort: cost / conv.</option>
              <option value="cpi">Sort: cost / install</option>
              <option value="opt_score">Sort: opt. score</option>
            </select>
            {section === 'campaigns' && (
              <GoogleAdsColumnsPicker
                selected={campaignColumns}
                onChange={(next) => {
                  setCampaignColumns(next);
                  saveCampaignColumns(next);
                }}
              />
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name / keyword / headline…"
              className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          )}
          {section === 'campaigns' && detailId ? null : sectionLoading && (
            <div className="flex items-center text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          )}
          {!(section === 'campaigns' && detailId) && !sectionLoading && visible.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
              No rows for this range.
            </div>
          )}
          {section === 'campaigns' && detailId ? (
            <GoogleAdsCampaignDetail
              detail={detail}
              loading={detailLoading}
              error={detailError}
              currency={currency}
              onClose={() => {
                setDetailId(null);
                setDetail(null);
                setDetailError(null);
              }}
            />
          ) : (
            <>
              {visible.length > 0 && section === 'campaigns' && (
                <p className="text-xs text-slate-500">Campaign name pe click karke detail kholo.</p>
              )}
              {visible.length > 0 && (
                <GoogleAdsTable
                  rows={visible}
                  currency={currency}
                  sort={sort}
                  columnKeys={section === 'campaigns' ? campaignColumns : DEFAULT_LIST_COLUMNS}
                  onSort={(key) => {
                    setSort(key);
                    setRows([]);
                  }}
                  onRowClick={
                    section === 'campaigns'
                      ? (row) => {
                          setDetailId(String(row.id));
                          setDetail(null);
                        }
                      : undefined
                  }
                />
              )}
            </>
          )}
        </div>
      )}

      {section === 'connect' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">Account IDs</h2>
            <p className="mt-1 text-sm text-slate-600">
              Developer token and OAuth client come from server env. Customer / MCC can stay in env or be saved here.
            </p>
            <label className="mt-4 block text-xs font-bold uppercase text-slate-500">Customer ID</label>
            <input
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="834-331-6060"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            />
            <label className="mt-3 block text-xs font-bold uppercase text-slate-500">MCC / login-customer-id</label>
            <input
              value={loginCustomerId}
              onChange={(e) => setLoginCustomerId(e.target.value)}
              placeholder="251-020-8286"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Save IDs
              </button>
              <button
                type="button"
                onClick={() => void test()}
                disabled={testing}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Test connection
              </button>
            </div>
            <div className="mt-4 space-y-1 text-xs text-slate-500">
              <p>Developer token: {data?.settings?.developer_token_hint || 'missing'}</p>
              <p>Refresh token: {data?.settings?.refresh_token_hint || 'not connected'}</p>
              <p>OAuth client: {data?.settings?.has_oauth_client ? 'present' : 'missing'}</p>
              <p>Project: {data?.settings?.project_id || '—'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">Connect with Google</h2>
            <p className="mt-1 text-sm text-slate-600">
              GMB token will not work here. This requests the Ads <code>adwords</code> scope and stores a refresh token.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {(data?.setup_steps || []).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a
              href={data?.oauth_url || '/api/super_admin/google-ads-mcp/oauth'}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
            >
              Connect with Google
              <ExternalLink className="h-4 w-4" />
            </a>
            {testResult?.account && (
              <p className="mt-4 text-sm font-semibold text-emerald-800">
                {testResult.account.name} · {testResult.account.id}
              </p>
            )}
            {Array.isArray(testResult?.warnings) && testResult.warnings.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                {testResult.warnings.map((w: string) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {section === 'mcp' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900">MyFNG Google Ads MCP</h2>
            <p className="mt-1 text-sm text-slate-600">
              Preferred: Claude mein MyFNG MCP <code className="rounded bg-slate-100 px-1">https://myfng.in/api/mcp</code> — tools{' '}
              <code className="rounded bg-slate-100 px-1">google_*</code>. Ye alag URL optional hai (same bearer).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs">{data?.claude?.this_host_url}</code>
              <button
                type="button"
                onClick={() => void copy('url', data?.claude?.this_host_url || '')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied === 'url' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-slate-600">
              {(data?.tools || []).map((tool) => (
                <li key={tool.name}>
                  <span className="font-semibold text-slate-800">{tool.name}</span> — {tool.description}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">Official Google MCP</h2>
              <a
                href={data?.claude?.official_repo || 'https://github.com/googleads/google-ads-mcp'}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-blue-700"
              >
                github.com/googleads/google-ads-mcp
              </a>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{officialSnippet}</pre>
            <button
              type="button"
              onClick={() => void copy('snippet', officialSnippet)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === 'snippet' ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
