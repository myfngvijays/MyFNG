'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Hash,
  FileText,
  MessageSquare,
  Plug,
  Link2,
  Send,
  History,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Save,
} from 'lucide-react';
import type {
  DltSmsCta,
  DltSmsEntity,
  DltSmsHeader,
  DltSmsSnapshot,
  DltSmsTelemarketer,
  DltSmsTemplate,
  DltStatusCounts,
} from '@/lib/dlt-sms/types';
import { DLT_EVENT_KEYS, DLT_OPERATORS, DLT_PROVIDERS, DEFAULT_OPERATOR_BODY } from '@/lib/dlt-sms/types';

type SectionId =
  | 'dashboard'
  | 'entity'
  | 'headers'
  | 'consent'
  | 'content'
  | 'telemarketers'
  | 'cta'
  | 'compose'
  | 'history';

const NAV: { id: SectionId; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Approval counts' },
  { id: 'entity', label: 'Entity', icon: Building2, hint: 'PE ID & operator' },
  { id: 'headers', label: 'Header SMS', icon: Hash, hint: 'Sender IDs' },
  { id: 'consent', label: 'Consent Template', icon: FileText, hint: 'Promo consent' },
  { id: 'content', label: 'Content Template', icon: MessageSquare, hint: 'SMS bodies' },
  { id: 'telemarketers', label: 'Own SMS pipe', icon: Plug, hint: 'Operator HTTP — no aggregator' },
  { id: 'cta', label: 'CTA Whitelisting', icon: Link2, hint: 'URLs & numbers' },
  { id: 'compose', label: 'Send SMS', icon: Send, hint: 'Test / transactional' },
  { id: 'history', label: 'Transaction History', icon: History, hint: 'Delivery logs' },
];

function StatusIcon({ status }: { status: string }) {
  if (status === 'APPROVED') return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
  if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-slate-500" />;
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'APPROVED'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : status === 'REJECTED'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      <StatusIcon status={status} />
      {status}
    </span>
  );
}

function CountCard({
  title,
  counts,
  onClick,
}: {
  title: string;
  counts: DltStatusCounts;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow"
    >
      <div className="mb-4 text-sm font-semibold text-slate-800">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'APPROVED', value: counts.approved, color: 'text-blue-700', bg: 'bg-blue-50', icon: 'APPROVED' },
          { label: 'PENDING', value: counts.pending, color: 'text-slate-600', bg: 'bg-slate-50', icon: 'PENDING' },
          { label: 'REJECTED', value: counts.rejected, color: 'text-red-600', bg: 'bg-red-50', icon: 'REJECTED' },
        ].map((item) => (
          <div key={item.label} className={`rounded-lg ${item.bg} px-2 py-3 text-center`}>
            <div className="mx-auto mb-1 flex justify-center">
              <StatusIcon status={item.icon} />
            </div>
            <div className="text-[10px] font-semibold tracking-wide text-slate-500">{item.label}</div>
            <div className={`mt-1 text-xl font-bold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function DltSmsApp() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading DLT SMS…</div>}>
      <DltSmsAppInner />
    </Suspense>
  );
}

function DltSmsAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (NAV.find((n) => n.id === searchParams.get('section'))?.id || 'dashboard') as SectionId;
  const [data, setData] = useState<DltSmsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const setSection = useCallback(
    (next: SectionId) => {
      router.push(`/dashboard/super_admin/dlt-sms?section=${next}`);
    },
    [router],
  );

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/super_admin/dlt-sms', { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Failed to load');
    setData(json);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e: any) {
        setError(e?.message || 'Failed to load DLT SMS');
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/super_admin/dlt-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || json.message || 'Save failed');
      await load();
      setNotice('Saved');
      return json;
    } catch (e: any) {
      setError(e?.message || 'Save failed');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const current = NAV.find((n) => n.id === section) || NAV[0];

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 sm:px-4 md:px-6 md:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-blue-800 sm:text-2xl">DLT SMS</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            TRAI DLT registry for MyFNG — same flow as Jio TrueConnect. Register header & templates on the
            operator portal, then store approved IDs here. Sending goes through your own Jio/Airtel HTTP pipe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="https://trueconnect.jio.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Jio TrueConnect <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.id === section;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold sm:text-sm ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading DLT registry…
        </div>
      ) : data ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">{current.label}</h2>
          {section === 'dashboard' && <DashboardSection data={data} onNavigate={setSection} />}
          {section === 'entity' && <EntitySection entity={data.entity} saving={saving} onSave={(entity) => post({ action: 'save_entity', entity })} />}
          {section === 'headers' && (
            <HeadersSection headers={data.headers} saving={saving} post={post} />
          )}
          {section === 'consent' && (
            <TemplatesSection
              kind="CONSENT"
              templates={data.consentTemplates}
              headers={data.headers}
              saving={saving}
              post={post}
            />
          )}
          {section === 'content' && (
            <TemplatesSection
              kind="CONTENT"
              templates={data.contentTemplates}
              headers={data.headers}
              saving={saving}
              post={post}
            />
          )}
          {section === 'telemarketers' && (
            <TelemarketersSection rows={data.telemarketers} headers={data.headers} saving={saving} post={post} />
          )}
          {section === 'cta' && <CtaSection rows={data.cta} saving={saving} post={post} />}
          {section === 'compose' && (
            <ComposeSection templates={data.contentTemplates} ready={data.readyToSend} saving={saving} post={post} />
          )}
          {section === 'history' && <HistorySection logs={data.logs} />}
        </section>
      ) : null}
    </div>
  );
}

function DashboardSection({
  data,
  onNavigate,
}: {
  data: DltSmsSnapshot;
  onNavigate: (id: SectionId) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        PE <span className="font-mono font-semibold">{data.entity.pe_id || '—'}</span>
        {' · '}
        {data.entity.pe_name || 'Unnamed entity'}
        {' · '}
        {DLT_OPERATORS.find((o) => o.id === data.entity.operator)?.label || data.entity.operator}
        {' · '}
        <StatusPill status={data.entity.entity_status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CountCard title="Entity" counts={data.stats.entity} onClick={() => onNavigate('entity')} />
        <CountCard title="Header SMS" counts={data.stats.headers} onClick={() => onNavigate('headers')} />
        <CountCard title="Consent Template" counts={data.stats.consent} onClick={() => onNavigate('consent')} />
        <CountCard title="Content Template" counts={data.stats.content} onClick={() => onNavigate('content')} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Setup checklist</h3>
        <ol className="space-y-2">
          {data.setupSteps.map((step, i) => (
            <li key={step.id} className="flex gap-3 text-sm">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step.done ? '✓' : i + 1}
              </span>
              <div>
                <div className="font-medium text-slate-800">{step.label}</div>
                <div className="text-slate-500">{step.hint}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Jio TrueConnect does not expose a public API to register headers/templates. Approve them on the
          operator site, then paste DLT IDs here. Sending uses <strong>your own Jio/Airtel operator pipe</strong> — not
          MSG91 or any aggregator.
        </p>
      </div>
    </div>
  );
}

function EntitySection({
  entity,
  saving,
  onSave,
}: {
  entity: DltSmsEntity;
  saving: boolean;
  onSave: (entity: Partial<DltSmsEntity>) => Promise<unknown>;
}) {
  const [form, setForm] = useState(entity);
  useEffect(() => setForm(entity), [entity]);
  const set = (key: keyof DltSmsEntity, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(form);
      }}
    >
      <Field label="PE ID">
        <input className={`${inputCls} font-mono`} value={form.pe_id} onChange={(e) => set('pe_id', e.target.value)} />
      </Field>
      <Field label="Registered name">
        <input className={inputCls} value={form.pe_name} onChange={(e) => set('pe_name', e.target.value)} />
      </Field>
      <Field label="Brand">
        <input className={inputCls} value={form.brand_name} onChange={(e) => set('brand_name', e.target.value)} />
      </Field>
      <Field label="DLT operator">
        <select
          className={inputCls}
          value={form.operator}
          onChange={(e) => {
            const op = DLT_OPERATORS.find((o) => o.id === e.target.value);
            setForm((prev) => ({
              ...prev,
              operator: e.target.value,
              portal_url: op?.portal || prev.portal_url,
            }));
          }}
        >
          {DLT_OPERATORS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Entity status">
        <select className={inputCls} value={form.entity_status} onChange={(e) => set('entity_status', e.target.value)}>
          <option value="APPROVED">APPROVED</option>
          <option value="PENDING">PENDING</option>
          <option value="REJECTED">REJECTED</option>
          <option value="NOT_REGISTERED">NOT_REGISTERED</option>
        </select>
      </Field>
      <Field label="Portal URL">
        <input className={inputCls} value={form.portal_url} onChange={(e) => set('portal_url', e.target.value)} />
      </Field>
      <Field label="PAN">
        <input className={inputCls} value={form.pan} onChange={(e) => set('pan', e.target.value)} />
      </Field>
      <Field label="GSTIN">
        <input className={inputCls} value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Registered address">
          <input className={inputCls} value={form.registered_address} onChange={(e) => set('registered_address', e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Admin notes">
          <textarea className={inputCls} rows={3} value={form.admin_notes} onChange={(e) => set('admin_notes', e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save entity
        </button>
      </div>
    </form>
  );
}

function HeadersSection({
  headers,
  saving,
  post,
}: {
  headers: DltSmsHeader[];
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<Partial<DltSmsHeader>>({
    header: '',
    header_type: 'TRANS',
    status: 'PENDING',
    dlt_header_id: '',
    notes: '',
  });

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          void post({ action: 'upsert_header', ...form }).then(() =>
            setForm({ header: '', header_type: 'TRANS', status: 'PENDING', dlt_header_id: '', notes: '' }),
          );
        }}
      >
        <Field label="Header (3–6 chars)">
          <input
            className={`${inputCls} font-mono uppercase`}
            maxLength={6}
            value={form.header || ''}
            onChange={(e) => setForm((p) => ({ ...p, header: e.target.value.toUpperCase() }))}
            placeholder="MYFNG"
            required
          />
        </Field>
        <Field label="Type">
          <select
            className={inputCls}
            value={form.header_type || 'TRANS'}
            onChange={(e) => setForm((p) => ({ ...p, header_type: e.target.value as DltSmsHeader['header_type'] }))}
          >
            <option value="TRANS">TRANS</option>
            <option value="PROMO">PROMO</option>
            <option value="SEAMLESS">SEAMLESS</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            className={inputCls}
            value={form.status || 'PENDING'}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as DltSmsHeader['status'] }))}
          >
            <option>PENDING</option>
            <option>APPROVED</option>
            <option>REJECTED</option>
          </select>
        </Field>
        <Field label="DLT header ID">
          <input
            className={inputCls}
            value={form.dlt_header_id || ''}
            onChange={(e) => setForm((p) => ({ ...p, dlt_header_id: e.target.value }))}
          />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {form.id ? 'Update' : 'Add'}
          </button>
        </div>
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Header</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">DLT ID</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {headers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  No headers yet. Register on Jio TrueConnect → Header SMS, then add here.
                </td>
              </tr>
            ) : (
              headers.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono font-semibold">{row.header}</td>
                  <td className="px-3 py-2">{row.header_type}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.dlt_header_id || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="mr-2 text-blue-700" onClick={() => setForm(row)}>
                      <Pencil className="inline h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => void post({ action: 'delete_header', id: row.id })}
                    >
                      <Trash2 className="inline h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TemplatesSection({
  kind,
  templates,
  headers,
  saving,
  post,
}: {
  kind: 'CONSENT' | 'CONTENT';
  templates: DltSmsTemplate[];
  headers: DltSmsHeader[];
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const blank: Partial<DltSmsTemplate> = {
    kind,
    name: '',
    header_id: headers[0]?.id || '',
    category: kind === 'CONSENT' ? 'SERVICE_EXPLICIT' : 'TRANSACTIONAL',
    template_text: '',
    dlt_template_id: '',
    provider_template_id: '',
    event_key: '',
    status: 'PENDING',
    notes: '',
  };
  const [form, setForm] = useState<Partial<DltSmsTemplate>>(blank);

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void post({ action: 'upsert_template', ...form, kind }).then(() => setForm(blank));
        }}
      >
        <Field label="Name">
          <input className={inputCls} value={form.name || ''} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
        </Field>
        <Field label="Header">
          <select
            className={inputCls}
            value={form.header_id || ''}
            onChange={(e) => setForm((p) => ({ ...p, header_id: e.target.value }))}
          >
            <option value="">None</option>
            {headers.map((h) => (
              <option key={h.id} value={h.id}>
                {h.header} ({h.status})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select
            className={inputCls}
            value={form.category || 'TRANSACTIONAL'}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as DltSmsTemplate['category'] }))}
          >
            <option value="TRANSACTIONAL">TRANSACTIONAL</option>
            <option value="SERVICE_IMPLICIT">SERVICE_IMPLICIT</option>
            <option value="SERVICE_EXPLICIT">SERVICE_EXPLICIT</option>
            <option value="PROMOTIONAL">PROMOTIONAL</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            className={inputCls}
            value={form.status || 'PENDING'}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as DltSmsTemplate['status'] }))}
          >
            <option>PENDING</option>
            <option>APPROVED</option>
            <option>REJECTED</option>
          </select>
        </Field>
        <Field label="DLT Template ID (TRAI)">
          <input
            className={`${inputCls} font-mono`}
            value={form.dlt_template_id || ''}
            onChange={(e) => setForm((p) => ({ ...p, dlt_template_id: e.target.value }))}
            placeholder="1207xxxxxxxxxxxx"
          />
        </Field>
        <Field label="Provider template / Flow ID">
          <input
            className={`${inputCls} font-mono`}
            value={form.provider_template_id || ''}
            onChange={(e) => setForm((p) => ({ ...p, provider_template_id: e.target.value }))}
            placeholder="Operator template id (optional)"
          />
        </Field>
        {kind === 'CONTENT' ? (
          <Field label="MyFNG event mapping">
            <select
              className={inputCls}
              value={form.event_key || ''}
              onChange={(e) => setForm((p) => ({ ...p, event_key: e.target.value }))}
            >
              {DLT_EVENT_KEYS.map((ev) => (
                <option key={ev.id || 'none'} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <div className="sm:col-span-2">
          <Field label="Template text (must match DLT-approved body)">
            <textarea
              className={inputCls}
              rows={4}
              required
              value={form.template_text || ''}
              onChange={(e) => setForm((p) => ({ ...p, template_text: e.target.value }))}
              placeholder="Your MyFNG OTP is {#otp#}. Valid 10 min. Do not share."
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> {form.id ? 'Update template' : 'Add template'}
          </button>
        </div>
      </form>
      <div className="space-y-2">
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No {kind.toLowerCase()} templates. Submit on Jio TrueConnect, then paste the approved DLT ID.
          </div>
        ) : (
          templates.map((row) => (
            <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{row.name}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <StatusPill status={row.status} />
                    <span>{row.category}</span>
                    {row.header ? <span className="font-mono">{row.header}</span> : null}
                    {row.dlt_template_id ? <span className="font-mono">{row.dlt_template_id}</span> : null}
                    {row.event_key ? <span>{row.event_key}</span> : null}
                  </div>
                </div>
                <div>
                  <button type="button" className="mr-2 text-blue-700" onClick={() => setForm(row)}>
                    <Pencil className="inline h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => void post({ action: 'delete_template', id: row.id })}
                  >
                    <Trash2 className="inline h-4 w-4" />
                  </button>
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {row.template_text}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TelemarketersSection({
  rows,
  headers,
  saving,
  post,
}: {
  rows: DltSmsTelemarketer[];
  headers: DltSmsHeader[];
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const blank = {
    name: 'MyFNG own pipe',
    provider: 'MYFNG',
    tm_id: '',
    api_key: '',
    api_url: '',
    default_header: headers.find((h) => h.status === 'APPROVED')?.header || '',
    is_primary: rows.length === 0,
    is_active: true,
    extra_config: {
      http_method: 'POST',
      auth_type: 'bearer',
      content_type: 'application/json',
      body_template: DEFAULT_OPERATOR_BODY,
      success_contains: '',
    },
  };
  const [form, setForm] = useState<any>(blank);
  const extra = form.extra_config && typeof form.extra_config === 'object' ? form.extra_config : {};
  const setExtra = (key: string, value: string) =>
    setForm((p: any) => ({ ...p, extra_config: { ...(p.extra_config || {}), [key]: value } }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <p className="font-semibold">Koi aggregator nahi — MyFNG khud SMS engine hai.</p>
        <p className="mt-1">
          TRAI DLT (TrueConnect) sirf registry hai. Phone tak SMS tab jata hai jab Jio/Airtel tumhe{' '}
          <strong>telemarketer / enterprise HTTP</strong> de. TrueConnect → My Telemarketers pe apni company chain
          karo, operator se URL + key lo, yahan paste karo.
        </p>
      </div>
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void post({ action: 'upsert_telemarketer', ...form }).then(() => setForm(blank));
        }}
      >
        <Field label="Pipe name">
          <input className={inputCls} value={form.name} onChange={(e) => setForm((p: any) => ({ ...p, name: e.target.value }))} required />
        </Field>
        <Field label="Operator">
          <select className={inputCls} value={form.provider} onChange={(e) => setForm((p: any) => ({ ...p, provider: e.target.value }))}>
            {DLT_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your DLT Telemarketer ID">
          <input
            className={inputCls}
            value={form.tm_id}
            onChange={(e) => setForm((p: any) => ({ ...p, tm_id: e.target.value }))}
            placeholder="Jio TrueConnect → My Telemarketers"
          />
        </Field>
        <Field label="Default header">
          <input
            className={`${inputCls} uppercase`}
            value={form.default_header}
            onChange={(e) => setForm((p: any) => ({ ...p, default_header: e.target.value.toUpperCase() }))}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Operator HTTP URL (own pipe)">
            <input
              className={inputCls}
              value={form.api_url}
              onChange={(e) => setForm((p: any) => ({ ...p, api_url: e.target.value }))}
              placeholder="https://… jio/airtel enterprise SMS endpoint"
              required={!form.id}
            />
          </Field>
        </div>
        <Field label="HTTP method">
          <select className={inputCls} value={extra.http_method || 'POST'} onChange={(e) => setExtra('http_method', e.target.value)}>
            <option>POST</option>
            <option>PUT</option>
            <option>GET</option>
          </select>
        </Field>
        <Field label="Auth">
          <select className={inputCls} value={extra.auth_type || 'bearer'} onChange={(e) => setExtra('auth_type', e.target.value)}>
            <option value="bearer">Bearer token</option>
            <option value="header">Custom header</option>
            <option value="basic">Basic</option>
            <option value="none">None (IP whitelist)</option>
          </select>
        </Field>
        <Field label="Operator API key / token">
          <input
            className={inputCls}
            type="password"
            autoComplete="off"
            value={form.api_key}
            onChange={(e) => setForm((p: any) => ({ ...p, api_key: e.target.value }))}
            placeholder={form.has_api_key ? 'Leave blank to keep existing' : 'From Jio/Airtel TM portal'}
          />
        </Field>
        <Field label="Success text (optional)">
          <input
            className={inputCls}
            value={extra.success_contains || ''}
            onChange={(e) => setExtra('success_contains', e.target.value)}
            placeholder="success / SUBMITTED"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Request body template">
            <textarea
              className={`${inputCls} font-mono`}
              rows={8}
              value={extra.body_template || DEFAULT_OPERATOR_BODY}
              onChange={(e) => setExtra('body_template', e.target.value)}
            />
          </Field>
          <p className="mt-1 text-xs text-slate-500">
            Tokens: {'{{pe_id}}'} {'{{header}}'} {'{{dlt_template_id}}'} {'{{phone}}'} {'{{mobile}}'} {'{{message}}'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(form.is_primary)}
            onChange={(e) => setForm((p: any) => ({ ...p, is_primary: e.target.checked }))}
          />
          Primary pipe
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_active !== false}
            onChange={(e) => setForm((p: any) => ({ ...p, is_active: e.target.checked }))}
          />
          Active
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> {form.id ? 'Update own pipe' : 'Save own pipe'}
          </button>
        </div>
      </form>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <div className="font-semibold text-slate-900">
                {row.name} <span className="text-xs font-normal text-slate-500">{row.provider}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {row.api_url || 'no operator URL'} · Header {row.default_header || '—'} · Key{' '}
                {row.has_api_key ? row.api_key_hint : 'none'} · TM {row.tm_id || '—'}
                {row.is_primary ? ' · PRIMARY' : ''}
                {row.is_active ? '' : ' · inactive'}
              </div>
            </div>
            <div>
              <button
                type="button"
                className="mr-2 text-blue-700"
                onClick={() =>
                  setForm({
                    ...row,
                    api_key: '',
                    extra_config: {
                      http_method: 'POST',
                      auth_type: 'bearer',
                      body_template: DEFAULT_OPERATOR_BODY,
                      ...(row.extra_config || {}),
                    },
                  })
                }
              >
                <Pencil className="inline h-4 w-4" />
              </button>
              <button type="button" className="text-red-600" onClick={() => void post({ action: 'delete_telemarketer', id: row.id })}>
                <Trash2 className="inline h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtaSection({
  rows,
  saving,
  post,
}: {
  rows: DltSmsCta[];
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [form, setForm] = useState<Partial<DltSmsCta>>({ cta_type: 'URL', value: '', status: 'PENDING', notes: '' });
  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void post({ action: 'upsert_cta', ...form }).then(() =>
            setForm({ cta_type: 'URL', value: '', status: 'PENDING', notes: '' }),
          );
        }}
      >
        <Field label="Type">
          <select className={inputCls} value={form.cta_type} onChange={(e) => setForm((p) => ({ ...p, cta_type: e.target.value as DltSmsCta['cta_type'] }))}>
            <option>URL</option>
            <option>PHONE</option>
            <option>SHORTCODE</option>
          </select>
        </Field>
        <Field label="Value">
          <input className={inputCls} value={form.value || ''} onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))} placeholder="https://myfng.com" required />
        </Field>
        <Field label="Status">
          <select className={inputCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as DltSmsCta['status'] }))}>
            <option>PENDING</option>
            <option>APPROVED</option>
            <option>REJECTED</option>
          </select>
        </Field>
        <div className="flex items-end">
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">
            Add CTA
          </button>
        </div>
      </form>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  No CTAs. Required only if templates include links or phone numbers.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.cta_type}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.value}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" className="text-red-600" onClick={() => void post({ action: 'delete_cta', id: row.id })}>
                      <Trash2 className="inline h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComposeSection({
  templates,
  ready,
  saving,
  post,
}: {
  templates: DltSmsTemplate[];
  ready: boolean;
  saving: boolean;
  post: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const approved = templates.filter((t) => t.status === 'APPROVED');
  const [templateId, setTemplateId] = useState(approved[0]?.id || '');
  const [phone, setPhone] = useState('');
  const [varsText, setVarsText] = useState('{}');
  const selected = useMemo(() => approved.find((t) => t.id === templateId), [approved, templateId]);

  return (
    <div className="space-y-4">
      {!ready ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Sending is blocked until entity, an approved header, an approved content template with DLT ID, and a
          Sending is blocked until entity, an approved header, an approved content template with DLT ID, and your
          own operator HTTP URL are in place.
        </div>
      ) : null}
      <form
        className="grid max-w-xl gap-3 rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          let vars: Record<string, string> = {};
          try {
            vars = JSON.parse(varsText || '{}');
          } catch {
            alert('Variables must be valid JSON, e.g. {"otp":"123456"}');
            return;
          }
          void post({ action: 'send', phone, templateId, vars });
        }}
      >
        <Field label="Approved template">
          <select className={inputCls} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            {approved.length === 0 ? <option value="">None approved</option> : null}
            {approved.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mobile (10 digit)">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" required />
        </Field>
        <Field label="Variables JSON">
          <textarea className={`${inputCls} font-mono`} rows={4} value={varsText} onChange={(e) => setVarsText(e.target.value)} />
        </Field>
        {selected ? (
          <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{selected.template_text}</pre>
        ) : null}
        <button
          type="submit"
          disabled={saving || !ready || !templateId}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send test SMS
        </button>
      </form>
    </div>
  );
}

function HistorySection({ logs }: { logs: DltSmsSnapshot['logs'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Provider</th>
            <th className="px-3 py-2">Message</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                No SMS sent yet.
              </td>
            </tr>
          ) : (
            logs.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.phone}</td>
                <td className="px-3 py-2">
                  <span className={row.status === 'SENT' ? 'text-emerald-700' : 'text-red-600'}>{row.status}</span>
                </td>
                <td className="px-3 py-2 text-xs">{row.provider}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {row.message}
                  {row.error ? <div className="mt-1 text-red-600">{row.error}</div> : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
