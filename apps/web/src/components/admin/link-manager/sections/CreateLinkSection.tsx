'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  QrCode,
  Sparkles,
  Upload,
  Smartphone,
  Shield,
  Share2,
  Split,
  Globe2,
  Webhook,
} from 'lucide-react';
import LinkPreviewPanel from '../LinkPreviewPanel';
import QrCustomizer from '../QrCustomizer';
import SplitWithPreview from '../SplitWithPreview';
import { DEFAULT_QR_STYLE, type QrStyleOptions } from '@/lib/link-manager/qr-types';
import { isValidHttpUrl, normalizeLongUrl } from '@/lib/link-manager/utils';

type Mode = 'link' | 'qr' | 'both';
type AdvTab = 'targeting' | 'security' | 'social' | 'abgeo' | 'tracking' | 'bulk';

const EXPIRY_OPTIONS = [
  { value: 'never', label: 'Never expires' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

const ADV_TABS: Array<{ id: AdvTab; label: string; icon: typeof Smartphone }> = [
  { id: 'targeting', label: 'Device & App', icon: Smartphone },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'social', label: 'WhatsApp / OG', icon: Share2 },
  { id: 'abgeo', label: 'A/B & Geo', icon: Split },
  { id: 'tracking', label: 'Pixels & Hook', icon: Webhook },
  { id: 'bulk', label: 'Bulk', icon: Upload },
];

const emptyForm = {
  long_url: '',
  title: '',
  description: '',
  custom_code: '',
  tags: '',
  folder: '',
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
  expires_option: 'never',
  password: '',
  max_clicks: '',
  expired_redirect_url: '',
  ios_url: '',
  android_url: '',
  desktop_url: '',
  app_deep_link: '',
  og_title: '',
  og_description: '',
  og_image_url: '',
  enable_landing: true,
  webhook_url: '',
  pixel_meta_id: '',
  pixel_google_id: '',
  ab_a_url: '',
  ab_a_weight: '50',
  ab_b_url: '',
  ab_b_weight: '50',
  geo_countries: '',
  geo_url: '',
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      {hint ? <span className="block text-[11px] text-gray-500">{hint}</span> : null}
    </label>
  );
}

export default function CreateLinkSection({ onCreated }: { onCreated?: () => void }) {
  const [mode, setMode] = useState<Mode>('both');
  const [advTab, setAdvTab] = useState<AdvTab>('targeting');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<any | null>(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkMode, setBulkMode] = useState<'series' | 'urls'>('series');
  const [series, setSeries] = useState({
    from: '1',
    to: '24',
    pad: '0',
    long_url: '',
    title_template: 'Saket Complex {n}',
    slug_template: 'saket-{n}',
  });
  const [qrStyle, setQrStyle] = useState<QrStyleOptions>({ ...DEFAULT_QR_STYLE });
  const [form, setForm] = useState(emptyForm);

  const expiresLabel = EXPIRY_OPTIONS.find((o) => o.value === form.expires_option)?.label || 'Never expires';
  const normalizedUrl = useMemo(() => normalizeLongUrl(form.long_url), [form.long_url]);
  const urlReady = Boolean(normalizedUrl && isValidHttpUrl(normalizedUrl));
  const previewMode = mode === 'qr' ? 'qr' : 'link';
  const patch = (key: keyof typeof emptyForm, value: string | boolean) =>
    setForm((p) => ({ ...p, [key]: value }));

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed');
    }
  }

  function buildAdvancedPayload() {
    const ab_variants = [
      form.ab_a_url.trim()
        ? { url: normalizeLongUrl(form.ab_a_url), weight: Number(form.ab_a_weight) || 50 }
        : null,
      form.ab_b_url.trim()
        ? { url: normalizeLongUrl(form.ab_b_url), weight: Number(form.ab_b_weight) || 50 }
        : null,
    ].filter(Boolean);

    const geo_rules =
      form.geo_countries.trim() && form.geo_url.trim()
        ? [
            {
              countries: form.geo_countries
                .split(/[\s,]+/)
                .map((c) => c.trim().toUpperCase())
                .filter(Boolean),
              url: normalizeLongUrl(form.geo_url),
            },
          ]
        : [];

    return {
      description: form.description,
      tags: form.tags.split(/[,]+/).map((t) => t.trim()).filter(Boolean),
      folder: form.folder,
      password: form.password || null,
      max_clicks: form.max_clicks ? Number(form.max_clicks) : null,
      expired_redirect_url: form.expired_redirect_url || null,
      ios_url: form.ios_url || null,
      android_url: form.android_url || null,
      desktop_url: form.desktop_url || null,
      app_deep_link: form.app_deep_link || null,
      og_title: form.og_title || null,
      og_description: form.og_description || null,
      og_image_url: form.og_image_url || null,
      enable_landing:
        Boolean(form.enable_landing) ||
        Boolean(form.app_deep_link) ||
        Boolean(form.password) ||
        Boolean(form.og_title),
      webhook_url: form.webhook_url || null,
      pixel_meta_id: form.pixel_meta_id || null,
      pixel_google_id: form.pixel_google_id || null,
      ab_variants,
      geo_rules,
    };
  }

  async function handleCreate() {
    const longUrl = normalizeLongUrl(form.long_url);
    if (!longUrl || !isValidHttpUrl(longUrl)) {
      toast.error('Enter a valid http/https URL');
      return;
    }
    setCreating(true);
    try {
      const create_mode = mode === 'qr' ? 'qr_only' : mode === 'both' ? 'both' : 'link_only';
      const res = await fetch('/api/super_admin/link-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          ...buildAdvancedPayload(),
          long_url: longUrl,
          create_mode,
          qr_style: create_mode === 'link_only' ? null : qrStyle,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create link');
      setCreated({ ...json.link, create_mode });
      toast.success('Link created');
    } catch (e: any) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  const seriesFrom = Math.floor(Number(series.from));
  const seriesTo = Math.floor(Number(series.to));
  const seriesCount =
    Number.isFinite(seriesFrom) && Number.isFinite(seriesTo) && seriesTo >= seriesFrom
      ? seriesTo - seriesFrom + 1
      : 0;

  async function handleBulk() {
    const create_mode = mode === 'qr' ? 'qr_only' : mode === 'both' ? 'both' : 'link_only';
    const shared = {
      create_mode,
      folder: form.folder || null,
      tags: form.tags.split(/[,]+/).map((t) => t.trim()).filter(Boolean),
      expires_option: form.expires_option,
      qr_style: create_mode === 'link_only' ? null : qrStyle,
      utm_source: form.utm_source || undefined,
      utm_medium: form.utm_medium || undefined,
      utm_campaign: form.utm_campaign || undefined,
      utm_term: form.utm_term || undefined,
      utm_content: form.utm_content || undefined,
    };

    let payload: Record<string, unknown>;

    if (bulkMode === 'series') {
      const longUrl = (series.long_url.trim() || form.long_url.trim()).trim();
      if (!longUrl) {
        toast.error('Series ke liye destination URL daalo (Basics me ya yahan)');
        return;
      }
      if (!seriesCount || seriesCount > 100) {
        toast.error('From–To range 1–100 links tak rakho (e.g. 1 to 24)');
        return;
      }
      if (!series.slug_template.trim() && !series.title_template.trim()) {
        toast.error('Title ya slug template me {n} use karo');
        return;
      }
      payload = {
        ...shared,
        series: {
          from: seriesFrom,
          to: seriesTo,
          pad: Number(series.pad) || 0,
          long_url: longUrl,
          title_template: series.title_template.trim() || `Link {n}`,
          slug_template: series.slug_template.trim() || null,
        },
      };
    } else {
      const lines = bulkText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) {
        toast.error('Paste one URL per line');
        return;
      }
      payload = { ...shared, urls: lines };
    }

    setCreating(true);
    try {
      const res = await fetch('/api/super_admin/link-manager/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Bulk create failed');
      const errCount = Array.isArray(json.errors) ? json.errors.length : 0;
      toast.success(
        `${json.created_count || 0} links created${errCount ? ` · ${errCount} failed` : ''}`,
      );
      if (errCount && json.errors?.[0]?.error) {
        toast.error(String(json.errors[0].error));
      }
      if (bulkMode === 'urls') setBulkText('');
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message || 'Bulk failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
        <h2 className="text-xl font-black text-gray-900">Create advanced short link</h2>
        <p className="mt-1 text-sm text-gray-600">
          Basics left pe · advanced options neeche tabs me · live preview right pe.
        </p>
      </div>

      <SplitWithPreview
        main={
        <div className="space-y-4">
          {/* Mode */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Output type</p>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['link', 'Short link', Link2],
                  ['qr', 'QR only', QrCode],
                  ['both', 'Link + QR', Sparkles],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setMode(id);
                    setCreated(null);
                  }}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    mode === id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <Icon className={`mb-1 h-4 w-4 ${mode === id ? 'text-blue-600' : 'text-gray-500'}`} />
                  <div className={`text-sm font-bold ${mode === id ? 'text-blue-900' : 'text-gray-800'}`}>
                    {label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Basics */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Basics</p>
            <Field
              label="Destination URL *"
              value={form.long_url}
              onChange={(v) => patch('long_url', v)}
              placeholder="https://example.com/campaign"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" value={form.title} onChange={(v) => patch('title', v)} placeholder="Saket WhatsApp" />
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-gray-700">Custom slug</span>
                <div className="flex overflow-hidden rounded-xl border border-gray-200">
                  <span className="bg-gray-50 px-3 py-2.5 text-xs text-gray-500 border-r">/s/</span>
                  <input
                    value={form.custom_code}
                    onChange={(e) => patch('custom_code', e.target.value)}
                    placeholder="saket-wp"
                    className="w-full px-3 py-2.5 text-sm outline-none"
                  />
                </div>
              </label>
              <Field label="Tags" value={form.tags} onChange={(v) => patch('tags', v)} placeholder="whatsapp, saket" />
              <Field label="Folder" value={form.folder} onChange={(v) => patch('folder', v)} placeholder="Workshops" />
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-gray-700">Notes</span>
              <textarea
                value={form.description}
                onChange={(e) => patch('description', e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                placeholder="Internal note"
              />
            </label>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">UTM + expiry</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Source" value={form.utm_source} onChange={(v) => patch('utm_source', v)} />
                <Field label="Medium" value={form.utm_medium} onChange={(v) => patch('utm_medium', v)} />
                <Field label="Campaign" value={form.utm_campaign} onChange={(v) => patch('utm_campaign', v)} />
                <Field label="Term" value={form.utm_term} onChange={(v) => patch('utm_term', v)} />
                <Field label="Content" value={form.utm_content} onChange={(v) => patch('utm_content', v)} />
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-gray-700">Expiry</span>
                  <select
                    value={form.expires_option}
                    onChange={(e) => patch('expires_option', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                  >
                    {EXPIRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Advanced tabs — always visible */}
          <div className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-violet-100 bg-violet-50/80 px-4 py-3">
              <p className="text-sm font-black text-violet-900">Advanced options</p>
              <p className="text-xs text-violet-700/80">Yahan saari advanced settings dikhengi — tab select karo</p>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 py-2">
              {ADV_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = advTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdvTab(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                      active ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-4 space-y-3">
              {advTab === 'targeting' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="iOS URL" value={form.ios_url} onChange={(v) => patch('ios_url', v)} placeholder="App Store / web" />
                    <Field label="Android URL" value={form.android_url} onChange={(v) => patch('android_url', v)} placeholder="Play Store / web" />
                    <Field label="Desktop URL" value={form.desktop_url} onChange={(v) => patch('desktop_url', v)} placeholder="Desktop visitors" />
                  </div>
                  <Field label="App deep link" value={form.app_deep_link} onChange={(v) => patch('app_deep_link', v)} placeholder="myfng://membership" />
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={form.enable_landing}
                      onChange={(e) => patch('enable_landing', e.target.checked)}
                    />
                    Branded landing page (/l/…) before redirect
                  </label>
                </>
              ) : null}

              {advTab === 'security' ? (
                <div className="space-y-3">
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Optional protections: visitor pehle password enter kare, click limit ke baad band, ya expiry ke baad dusri URL pe bhejo.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-gray-700">Password</span>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.password}
                          onChange={(e) => patch('password', e.target.value)}
                          placeholder="Optional — blank = open link"
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                          title={showPassword ? 'Hide password' : 'Show password'}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <span className="block text-[11px] text-gray-500">
                        Link open karne se pehle ye password maanga jayega (landing page pe).
                      </span>
                    </label>
                    <Field
                      label="Max clicks"
                      value={form.max_clicks}
                      onChange={(v) => patch('max_clicks', v)}
                      type="number"
                      placeholder="e.g. 500"
                      hint="Itne clicks ke baad link band — blank = unlimited"
                    />
                    <div className="sm:col-span-2">
                      <Field
                        label="Fallback URL (after expiry / max clicks)"
                        value={form.expired_redirect_url}
                        onChange={(v) => patch('expired_redirect_url', v)}
                        placeholder="https://myfng.in/"
                        hint="Expiry ya max clicks ke baad user yahan redirect hoga"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              {advTab === 'social' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="OG title" value={form.og_title} onChange={(v) => patch('og_title', v)} />
                  <Field label="OG image URL" value={form.og_image_url} onChange={(v) => patch('og_image_url', v)} />
                  <div className="sm:col-span-2">
                    <Field label="OG description" value={form.og_description} onChange={(v) => patch('og_description', v)} />
                  </div>
                </div>
              ) : null}

              {advTab === 'abgeo' ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <Split className="h-3.5 w-3.5" /> A/B split
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Variant A URL" value={form.ab_a_url} onChange={(v) => patch('ab_a_url', v)} />
                    <Field label="A weight" value={form.ab_a_weight} onChange={(v) => patch('ab_a_weight', v)} />
                    <Field label="Variant B URL" value={form.ab_b_url} onChange={(v) => patch('ab_b_url', v)} />
                    <Field label="B weight" value={form.ab_b_weight} onChange={(v) => patch('ab_b_weight', v)} />
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600 pt-2">
                    <Globe2 className="h-3.5 w-3.5" /> Geo rule
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Countries (ISO)" value={form.geo_countries} onChange={(v) => patch('geo_countries', v)} placeholder="IN, AE" />
                    <Field label="URL for those countries" value={form.geo_url} onChange={(v) => patch('geo_url', v)} />
                  </div>
                </>
              ) : null}

              {advTab === 'tracking' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Meta Pixel ID" value={form.pixel_meta_id} onChange={(v) => patch('pixel_meta_id', v)} />
                  <Field label="Google tag ID" value={form.pixel_google_id} onChange={(v) => patch('pixel_google_id', v)} placeholder="G-XXXX" />
                  <div className="sm:col-span-2">
                    <Field label="Webhook URL" value={form.webhook_url} onChange={(v) => patch('webhook_url', v)} placeholder="https://hooks…" />
                  </div>
                </div>
              ) : null}

              {advTab === 'bulk' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkMode('series')}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${
                        bulkMode === 'series'
                          ? 'border-violet-500 bg-violet-50 text-violet-900'
                          : 'border-gray-200 text-gray-700'
                      }`}
                    >
                      Number series (1→24)
                      <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                        Same destination · slug/title me number
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkMode('urls')}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold ${
                        bulkMode === 'urls'
                          ? 'border-violet-500 bg-violet-50 text-violet-900'
                          : 'border-gray-200 text-gray-700'
                      }`}
                    >
                      Paste URL list
                      <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                        Different destinations, one per line
                      </span>
                    </button>
                  </div>

                  {bulkMode === 'series' ? (
                    <>
                      <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800">
                        Example: title <code className="font-mono">Saket Complex {'{n}'}</code>, slug{' '}
                        <code className="font-mono">saket-{'{n}'}</code>, from 1 to 24 →{' '}
                        <code className="font-mono">/s/saket-1</code> … <code className="font-mono">/s/saket-24</code>
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field
                          label="From"
                          value={series.from}
                          onChange={(v) => setSeries((p) => ({ ...p, from: v }))}
                          type="number"
                          placeholder="1"
                        />
                        <Field
                          label="To"
                          value={series.to}
                          onChange={(v) => setSeries((p) => ({ ...p, to: v }))}
                          type="number"
                          placeholder="24"
                        />
                        <Field
                          label="Zero pad"
                          value={series.pad}
                          onChange={(v) => setSeries((p) => ({ ...p, pad: v }))}
                          type="number"
                          placeholder="0"
                          hint="e.g. 2 → 01, 02…"
                        />
                      </div>
                      <Field
                        label="Destination URL (same for all, or use {n})"
                        value={series.long_url}
                        onChange={(v) => setSeries((p) => ({ ...p, long_url: v }))}
                        placeholder={form.long_url || 'https://wa.me/91xxxxxxxxxx'}
                        hint="Blank = Basics wala destination URL use hoga"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Title template"
                          value={series.title_template}
                          onChange={(v) => setSeries((p) => ({ ...p, title_template: v }))}
                          placeholder="Saket Complex {n}"
                        />
                        <Field
                          label="Slug template (/s/…)"
                          value={series.slug_template}
                          onChange={(v) => setSeries((p) => ({ ...p, slug_template: v }))}
                          placeholder="saket-{n}"
                        />
                      </div>
                      {seriesCount > 0 ? (
                        <p className="text-xs font-semibold text-gray-600">
                          Preview: {seriesCount} links ·{' '}
                          <span className="font-mono text-violet-700">
                            /s/{(series.slug_template || 'link-{n}').replace(/\{n\}|\{num\}|\{#\}/gi, series.from || '1')}
                          </span>
                          {' → '}
                          <span className="font-mono text-violet-700">
                            /s/{(series.slug_template || 'link-{n}').replace(/\{n\}|\{num\}|\{#\}/gi, series.to || '24')}
                          </span>
                        </p>
                      ) : null}
                      <button
                        type="button"
                        disabled={creating || seriesCount < 1}
                        onClick={() => void handleBulk()}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Create series ({seriesCount || 0} links)
                      </button>
                    </>
                  ) : (
                    <>
                      <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        rows={5}
                        placeholder={'https://site.com/a\nhttps://site.com/b'}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm"
                      />
                      <button
                        type="button"
                        disabled={creating || !bulkText.trim()}
                        onClick={() => void handleBulk()}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Bulk create ({bulkText.split(/\n+/).filter((l) => l.trim()).length} URLs)
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {mode !== 'link' ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">QR style</p>
              <QrCustomizer value={qrStyle} onChange={setQrStyle} />
            </div>
          ) : null}

          <div className="sticky bottom-3 z-10 rounded-2xl border border-blue-200 bg-white/95 p-4 shadow-lg backdrop-blur">
            <button
              type="button"
              disabled={creating || !urlReady}
              onClick={() => void handleCreate()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {mode === 'both' ? 'Create short link + QR' : mode === 'qr' ? 'Generate QR' : 'Create short link'}
              <ArrowRight className="h-4 w-4" />
            </button>
            {created ? (
              <button
                type="button"
                onClick={() => {
                  setCreated(null);
                  setForm(emptyForm);
                }}
                className="ml-0 mt-2 text-sm font-semibold text-blue-700 hover:underline sm:ml-4 sm:mt-0"
              >
                Create another
              </button>
            ) : null}
            {created ? (
              <button
                type="button"
                onClick={() => onCreated?.()}
                className="ml-4 text-sm font-semibold text-gray-600 hover:underline"
              >
                View My Links →
              </button>
            ) : null}
          </div>
        </div>
        }
        preview={
          <LinkPreviewPanel
            form={{ ...form, expires_label: expiresLabel }}
            mode={previewMode}
            qrStyle={qrStyle}
            created={created}
            onCopy={copyText}
          />
        }
      />
    </div>
  );
}
