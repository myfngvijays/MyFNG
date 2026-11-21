'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Copy,
  History,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Webhook,
  X,
  XCircle,
} from 'lucide-react';
import {
  TEMPLATE_VARIABLES,
  TRIGGER_OPTIONS,
  triggerLabel,
  type ApiTemplateRow,
} from '@/lib/crm/apiTemplateShared';

type Draft = {
  id: string | null;
  name: string;
  description: string;
  method: string;
  url: string;
  timeout_seconds: number;
  auth_type: 'NONE' | 'BEARER' | 'BASIC' | 'HEADER';
  auth_token: string;
  auth_username: string;
  auth_password: string;
  auth_header_name: string;
  auth_header_value: string;
  extra_headers: Array<{ key: string; value: string }>;
  payload_type: 'JSON' | 'FORM';
  payload_template: string;
  trigger_status: string;
  is_active: boolean;
  send_once_per_lead: boolean;
  // Saved secret hints (masked)
  saved_token: string;
  saved_password: string;
  saved_header_value: string;
};

type Run = {
  id: string;
  lead_number: string | null;
  trigger: string | null;
  ok: boolean;
  status_code: number | null;
  error: string | null;
  request_body: string | null;
  response_body: string | null;
  duration_ms: number | null;
  run_by_name: string | null;
  created_at: string;
};

type TestResult = {
  sent: boolean;
  ok?: boolean;
  status?: number | null;
  error?: string | null;
  response?: string | null;
  duration_ms?: number | null;
  request: { url: string; method: string; headers: Record<string, string>; payload: unknown };
  unknown_variables: string[];
};

const SAMPLE_PAYLOAD = `{
  "lead_phone": "{{Phone}}",
  "lead_person_name": "{{Name}}",
  "workshop": "{{Workshop}}",
  "package": "{{PACKAGE}}",
  "pickupvisit": "{{PickupVisit}}",
  "remark": "{{REMARK}}",
  "model": "{{Model}}",
  "carno": "{{CARNO}}",
  "address": "{{ADDRESS}}",
  "plan": "{{Plan}}",
  "status": "{{status}}",
  "lead_link": "{{lead_id}}",
  "service_done": "{{Service Done}}",
  "system_note": "{{ACTION_text}}",
  "employe": "{{ASSIGNEE_EMAIL}}",
  "repeat_customer": "{{Repeat Customer}}"
}`;

function emptyDraft(): Draft {
  return {
    id: null,
    name: '',
    description: '',
    method: 'POST',
    url: '',
    timeout_seconds: 10,
    auth_type: 'BEARER',
    auth_token: '',
    auth_username: '',
    auth_password: '',
    auth_header_name: '',
    auth_header_value: '',
    extra_headers: [],
    payload_type: 'JSON',
    payload_template: SAMPLE_PAYLOAD,
    trigger_status: 'SERVICE_DONE',
    is_active: true,
    send_once_per_lead: false,
    saved_token: '',
    saved_password: '',
    saved_header_value: '',
  };
}

function draftFromRow(row: ApiTemplateRow, copy = false): Draft {
  return {
    id: copy ? null : row.id,
    name: copy ? `${row.name} - copy` : row.name,
    description: row.description || '',
    method: row.method,
    url: row.url,
    timeout_seconds: row.timeout_seconds,
    auth_type: row.auth_type,
    auth_token: row.auth_token || '',
    auth_username: row.auth_username,
    auth_password: row.auth_password || '',
    auth_header_name: row.auth_header_name,
    auth_header_value: row.auth_header_value || '',
    extra_headers: Object.entries(row.extra_headers || {}).map(([key, value]) => ({ key, value: String(value) })),
    payload_type: row.payload_type,
    payload_template: row.payload_template,
    trigger_status: row.trigger_status,
    is_active: copy ? false : row.is_active,
    send_once_per_lead: Boolean(row.send_once_per_lead),
    saved_token: '',
    saved_password: '',
    saved_header_value: '',
  };
}

function bodyFromDraft(d: Draft) {
  return {
    name: d.name,
    description: d.description,
    method: d.method,
    url: d.url,
    timeout_seconds: d.timeout_seconds,
    auth_type: d.auth_type,
    auth_token: d.auth_token,
    auth_username: d.auth_username,
    auth_password: d.auth_password,
    auth_header_name: d.auth_header_name,
    auth_header_value: d.auth_header_value,
    extra_headers: Object.fromEntries(d.extra_headers.filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value])),
    payload_type: d.payload_type,
    payload_template: d.payload_template,
    trigger_status: d.trigger_status,
    is_active: d.is_active,
    send_once_per_lead: d.send_once_per_lead,
  };
}

/** "script.google.com/macros/s/AKfy…" — host + path, no scheme. */
function endpointLabel(url: string) {
  return String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '');
}

function authLabel(type: string) {
  if (type === 'BEARER') return 'Bearer token';
  if (type === 'BASIC') return 'Basic auth';
  if (type === 'HEADER') return 'API key header';
  return 'No auth';
}

/** "Service Done" instead of "Lead → Service Done" for the narrow list column. */
function triggerShort(id: string) {
  return triggerLabel(id).replace(/^Lead → /, '');
}

function ago(iso: string | null) {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const inputCls =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-blue-100';
const labelCls = 'mb-1 block text-xs font-bold text-slate-600';

/** Plain text field the browser must not treat as a login (no saved-password popup). */
const NO_AUTOFILL = {
  type: 'text',
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'off',
  spellCheck: false,
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-form-type': 'other',
} as const;

export default function ApiTemplatesPanel({ padded = false }: { padded?: boolean }) {
  const [rows, setRows] = useState<ApiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsMigration, setNeedsMigration] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [runsFor, setRunsFor] = useState<ApiTemplateRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/crm/api-templates', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNeedsMigration(Boolean(json?.needs_migration));
        throw new Error(json?.error || 'Could not load templates');
      }
      setNeedsMigration(false);
      setRows(Array.isArray(json.templates) ? json.templates : []);
    } catch (e: any) {
      setError(e?.message || 'Could not load templates');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.url, triggerLabel(r.trigger_status), r.description].some((v) => String(v || '').toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(draft.id ? `/api/crm/api-templates/${draft.id}` : '/api/crm/api-templates', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyFromDraft(draft)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      toast.success(draft.id ? 'Template updated' : 'Template created');
      if (Array.isArray(json.unknown_variables) && json.unknown_variables.length) {
        toast(`Unknown variables will be sent empty: ${json.unknown_variables.join(', ')}`, { icon: '⚠️', duration: 6000 });
      }
      setDraft(draftFromRow(json.template));
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: ApiTemplateRow) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !row.is_active } : r)));
    const res = await fetch(`/api/crm/api-templates/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !row.is_active }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error || 'Could not change');
      void load();
    } else {
      toast.success(!row.is_active ? 'Template turned on' : 'Template turned off');
    }
  };

  const remove = async (row: ApiTemplateRow) => {
    if (!window.confirm(`Delete template "${row.name}"? It will stop sending.`)) return;
    const res = await fetch(`/api/crm/api-templates/${row.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(json?.error || 'Delete failed');
    toast.success('Template deleted');
    if (draft?.id === row.id) setDraft(null);
    void load();
  };

  return (
    <div className={`w-full max-w-none space-y-4 pb-8 ${padded ? 'px-3 pt-4 sm:px-6 sm:pt-6' : ''}`}>
      <div className="rounded-2xl bg-[#004AAD] px-4 py-4 text-white shadow-md sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Webhook className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold leading-tight !text-white sm:text-2xl">API Templates</h1>
              <p className="text-xs font-semibold text-blue-100">
                Send a lead to any API when its status changes — set up once, works from every panel and the app
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-xs font-bold text-white hover:bg-white/25"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={() => setDraft(emptyDraft())}
              disabled={needsMigration}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-[#023D95] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create New
            </button>
          </div>
        </div>
      </div>

      {needsMigration ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          One-time setup: run <code className="rounded bg-white px-1">database/402_crm_api_templates.sql</code> in the
          Supabase SQL editor, then press Refresh.
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, URL, trigger"
            className={`${inputCls} pl-9`}
          />
        </div>
        <span className="ml-auto text-xs font-semibold text-slate-500">
          {rows.filter((r) => r.is_active).length} on · {rows.length} total
        </span>
      </div>

      {error && !needsMigration ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</div>
      ) : null}

      {!loading && !error && !rows.length ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <Webhook className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No API templates yet</p>
          <p className="text-xs text-slate-500">Create one to send leads to your workshop panel, sheets or any other system.</p>
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#004AAD] px-4 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Create New
          </button>
        </div>
      ) : null}

      {filtered.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[26%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
              <col className="w-[9%]" />
              <col className="w-[64px]" />
              <col className="w-[164px]" />
            </colgroup>
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr className="h-11">
                <th className="whitespace-nowrap px-4">Template</th>
                <th className="whitespace-nowrap px-3">Endpoint</th>
                <th className="whitespace-nowrap px-3">Fires when</th>
                <th className="whitespace-nowrap px-3">Variables</th>
                <th className="whitespace-nowrap px-3">Last send</th>
                <th className="whitespace-nowrap px-3">Modified</th>
                <th className="whitespace-nowrap px-3 text-center">On</th>
                <th className="whitespace-nowrap px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className={`h-[68px] align-middle transition hover:bg-slate-50/70 ${r.is_active ? '' : 'opacity-60'}`}
                >
                  <td className="px-4">
                    <button
                      type="button"
                      onClick={() => setDraft(draftFromRow(r))}
                      className="block w-full truncate text-left font-bold text-slate-800 hover:text-[#004AAD]"
                      title={r.name}
                    >
                      {r.name}
                    </button>
                    <div className="truncate text-xs text-slate-500" title={r.description || ''}>
                      {r.description || '—'}
                    </div>
                  </td>
                  <td className="px-3">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-700" title={r.url}>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600">
                        {r.method}
                      </span>
                      <span className="truncate">{endpointLabel(r.url)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-400">{authLabel(r.auth_type)}</div>
                  </td>
                  <td className="px-3">
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="truncate rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-[#023D95]">
                        {triggerShort(r.trigger_status)}
                      </span>
                      {r.send_once_per_lead ? (
                        <span
                          title="Sends a lead only once"
                          className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
                        >
                          1×
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3">
                    {r.variables.length ? (
                      <span
                        className="inline-flex max-w-full items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700"
                        title={r.variables.join(', ')}
                      >
                        <span className="truncate">{r.variables[0]}</span>
                        {r.variables.length > 1 ? (
                          <span className="shrink-0 rounded-full bg-violet-200 px-1">+{r.variables.length - 1}</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="px-3 text-xs">
                    {r.last_run_at ? (
                      <>
                        <div
                          className={`flex items-center gap-1 font-semibold ${r.last_run_ok ? 'text-emerald-700' : 'text-rose-700'}`}
                        >
                          {r.last_run_ok ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          {r.last_run_status ?? (r.last_run_ok ? 'OK' : 'Failed')}
                        </div>
                        <div
                          className={`truncate text-[11px] ${r.last_run_ok ? 'text-slate-400' : 'text-rose-600'}`}
                          title={r.last_run_error || ''}
                        >
                          {r.last_run_ok ? ago(r.last_run_at) : r.last_run_error || ago(r.last_run_at)}
                        </div>
                      </>
                    ) : (
                      <span className="text-slate-400">Never</span>
                    )}
                  </td>
                  <td className="px-3 text-xs text-slate-600">
                    <div className="truncate">{ago(r.updated_at)}</div>
                    <div className="truncate text-[11px] text-slate-400">{r.updated_by_name ? `by ${r.updated_by_name}` : ''}</div>
                  </td>
                  <td className="px-3 text-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.is_active}
                      aria-label={r.is_active ? 'Turn off' : 'Turn on'}
                      title={r.is_active ? 'On — click to turn off' : 'Off — click to turn on'}
                      onClick={() => void toggleActive(r)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${r.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${r.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </td>
                  <td className="px-4">
                    <div className="flex justify-end gap-1">
                      <IconBtn title="Edit" onClick={() => setDraft(draftFromRow(r))}>
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn title="Send history" onClick={() => setRunsFor(r)}>
                        <History className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn title="Duplicate" onClick={() => setDraft(draftFromRow(r, true))}>
                        <Copy className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn title="Delete" danger onClick={() => void remove(r)}>
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {draft ? (
        <TemplateEditor
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSave={() => void save()}
          onClose={() => setDraft(null)}
          onShowRuns={() => {
            const row = rows.find((r) => r.id === draft.id);
            if (row) setRunsFor(row);
          }}
          onAfterTest={() => void load()}
        />
      ) : null}

      {runsFor ? <RunsDrawer template={runsFor} onClose={() => setRunsFor(null)} /> : null}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white ${
        danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-50 hover:text-[#004AAD]'
      }`}
    >
      {children}
    </button>
  );
}

function Drawer({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/40" onMouseDown={onClose}>
      <div
        className={`flex h-full w-full flex-col bg-white shadow-2xl ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function TemplateEditor({
  draft,
  setDraft,
  saving,
  onSave,
  onClose,
  onShowRuns,
  onAfterTest,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onShowRuns: () => void;
  onAfterTest: () => void;
}) {
  const payloadRef = useRef<HTMLTextAreaElement | null>(null);
  const [varSearch, setVarSearch] = useState('');
  const [testLead, setTestLead] = useState('');
  const [testing, setTesting] = useState<'preview' | 'send' | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  const jsonError = useMemo(() => {
    if (draft.method === 'GET' && !draft.payload_template.trim()) return '';
    try {
      // Placeholders sit inside quotes, so swap them out before checking.
      JSON.parse(draft.payload_template.replace(/\{\{[^{}]*\}\}/g, 'x') || '{}');
      return '';
    } catch (e: any) {
      return e?.message || 'Invalid JSON';
    }
  }, [draft.payload_template, draft.method]);

  const insertVar = (name: string) => {
    const el = payloadRef.current;
    const token = `{{${name}}}`;
    if (!el) return set({ payload_template: `${draft.payload_template}${token}` });
    const start = el.selectionStart ?? draft.payload_template.length;
    const end = el.selectionEnd ?? start;
    const next = draft.payload_template.slice(0, start) + token + draft.payload_template.slice(end);
    set({ payload_template: next });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const formatJson = () => {
    const holders: string[] = [];
    const masked = draft.payload_template.replace(/\{\{[^{}]*\}\}/g, (m) => {
      holders.push(m);
      return `__VAR_${holders.length - 1}__`;
    });
    try {
      const pretty = JSON.stringify(JSON.parse(masked), null, 2).replace(/__VAR_(\d+)__/g, (_m, i) => holders[Number(i)]);
      set({ payload_template: pretty });
    } catch {
      toast.error('Fix the JSON first');
    }
  };

  const runTest = async (send: boolean) => {
    if (!testLead.trim()) return toast.error('Enter a lead number to test with');
    if (send && !draft.id) return toast.error('Save the template first');
    if (send && !window.confirm(`Really send lead ${testLead.trim()} to ${draft.url}?`)) return;
    setTesting(send ? 'send' : 'preview');
    try {
      const res = await fetch('/api/crm/api-templates/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: draft.id, template: bodyFromDraft(draft), lead_number: testLead.trim(), send }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Test failed');
      setTestResult(json);
      if (send) {
        if (json.ok) toast.success(`Sent · HTTP ${json.status}`);
        else toast.error(`Failed · ${json.error || json.status}`);
        onAfterTest();
      }
    } catch (e: any) {
      toast.error(e?.message || 'Test failed');
    } finally {
      setTesting(null);
    }
  };

  const vars = TEMPLATE_VARIABLES.filter(
    (v) => !varSearch.trim() || `${v.name} ${v.hint}`.toLowerCase().includes(varSearch.trim().toLowerCase()),
  );

  return (
    <Drawer onClose={onClose} wide>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold text-slate-800">{draft.id ? draft.name || 'Edit template' : 'New API template'}</h2>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`inline-block h-2 w-2 rounded-full ${draft.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-hidden
            />
            {draft.is_active ? 'On' : 'Off'} · fires on {triggerShort(draft.trigger_status)}
            {draft.send_once_per_lead ? ' · once per lead' : ''}
          </p>
        </div>
        {draft.id ? (
          <button type="button" onClick={onShowRuns} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
            <History className="h-4 w-4" /> History
          </button>
        ) : null}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || Boolean(jsonError)}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#004AAD] px-4 text-xs font-bold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 bg-slate-50/70 p-4 sm:p-6">
          <Section title="Basics" hint="What it is and when it fires">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Template name *</label>
              <input className={inputCls} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Workshop-leads" />
            </div>
            <div>
              <label className={labelCls}>Fires when *</label>
              <select className={inputCls} value={draft.trigger_status} onChange={(e) => set({ trigger_status: e.target.value })}>
                {TRIGGER_OPTIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input className={inputCls} value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What this sends and where" />
          </div>
          </Section>

          <Section title="Request" hint="Where to send it">
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 sm:grid-cols-[120px_minmax(0,1fr)_110px]">
            <div>
              <label className={labelCls}>Method *</label>
              <select className={inputCls} value={draft.method} onChange={(e) => set({ method: e.target.value })}>
                {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Endpoint URL *</label>
              <input className={inputCls} value={draft.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Timeout (sec)</label>
              <input
                type="number"
                min={1}
                max={60}
                className={inputCls}
                value={draft.timeout_seconds}
                onChange={(e) => set({ timeout_seconds: Number(e.target.value) || 10 })}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Authentication *</label>
                <select className={inputCls} value={draft.auth_type} onChange={(e) => set({ auth_type: e.target.value as Draft['auth_type'] })}>
                  <option value="NONE">No auth</option>
                  <option value="BEARER">Bearer Token</option>
                  <option value="BASIC">Basic (username + password)</option>
                  <option value="HEADER">API key header</option>
                </select>
              </div>
              {draft.auth_type === 'BEARER' ? (
                <div>
                  <label className={labelCls}>Bearer token *</label>
                  <input
                    className={inputCls}
                    {...NO_AUTOFILL}
                    value={draft.auth_token}
                    onChange={(e) => set({ auth_token: e.target.value })}
                    placeholder="Paste token"
                  />
                </div>
              ) : null}
              {draft.auth_type === 'BASIC' ? (
                <>
                  <div>
                    <label className={labelCls}>Username</label>
                    <input className={inputCls} value={draft.auth_username} onChange={(e) => set({ auth_username: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Password</label>
                    <input
                      className={inputCls}
                      {...NO_AUTOFILL}
                      value={draft.auth_password}
                      onChange={(e) => set({ auth_password: e.target.value })}
                      placeholder="Password"
                    />
                  </div>
                </>
              ) : null}
              {draft.auth_type === 'HEADER' ? (
                <>
                  <div>
                    <label className={labelCls}>Header name *</label>
                    <input className={inputCls} value={draft.auth_header_name} onChange={(e) => set({ auth_header_name: e.target.value })} placeholder="x-api-key" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Header value *</label>
                    <input
                      className={inputCls}
                      {...NO_AUTOFILL}
                      value={draft.auth_header_value}
                      onChange={(e) => set({ auth_header_value: e.target.value })}
                      placeholder="Key value"
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className={labelCls}>Extra headers</span>
              <button
                type="button"
                onClick={() => set({ extra_headers: [...draft.extra_headers, { key: '', value: '' }] })}
                className="text-xs font-bold text-[#004AAD]"
              >
                + Add header
              </button>
            </div>
            {draft.extra_headers.length ? (
              <div className="space-y-2">
                {draft.extra_headers.map((h, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px] gap-2">
                    <input
                      className={inputCls}
                      value={h.key}
                      placeholder="Header"
                      onChange={(e) => {
                        const next = [...draft.extra_headers];
                        next[i] = { ...h, key: e.target.value };
                        set({ extra_headers: next });
                      }}
                    />
                    <input
                      className={inputCls}
                      value={h.value}
                      placeholder="Value"
                      onChange={(e) => {
                        const next = [...draft.extra_headers];
                        next[i] = { ...h, value: e.target.value };
                        set({ extra_headers: next });
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Remove header"
                      onClick={() => set({ extra_headers: draft.extra_headers.filter((_, j) => j !== i) })}
                      className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">None</p>
            )}
          </div>
          </Section>

          <Section title="Payload" hint="Data sent for each lead">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold"
                value={draft.payload_type}
                onChange={(e) => set({ payload_type: e.target.value as Draft['payload_type'] })}
              >
                <option value="JSON">JSON</option>
                <option value="FORM">Form (x-www-form-urlencoded)</option>
              </select>
              <button type="button" onClick={formatJson} className="ml-auto text-xs font-bold text-[#004AAD]">
                Format JSON
              </button>
            </div>
            <textarea
              ref={payloadRef}
              value={draft.payload_template}
              onChange={(e) => set({ payload_template: e.target.value })}
              spellCheck={false}
              rows={18}
              className={`min-h-[320px] w-full resize-y rounded-xl border bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100 focus:outline-none focus:ring-2 ${
                jsonError ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-800 focus:ring-blue-200'
              }`}
            />
            {jsonError ? (
              <p className="mt-1 text-xs font-semibold text-rose-600">JSON error: {jsonError}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                Write JSON keys your API expects. Put <code>{'{{Variable}}'}</code> inside quotes — click a variable on the right to insert it.
                For Form type, the same JSON keys are sent as form fields.
              </p>
            )}
          </div>
          </Section>
        </div>

        <aside className="space-y-4 border-t border-slate-100 bg-white p-4 sm:p-6 lg:border-l lg:border-t-0">
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            <SwitchRow
              label="Template on"
              hint={draft.is_active ? 'Fires automatically' : 'Off — nothing is sent'}
              checked={draft.is_active}
              onChange={(v) => set({ is_active: v })}
            />
            <SwitchRow
              label="Send only once per lead"
              hint="Skip a lead already sent, even if it comes back to this status"
              checked={draft.send_once_per_lead}
              onChange={(v) => set({ send_once_per_lead: v })}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Test with a lead</div>
            <input
              className={inputCls}
              value={testLead}
              onChange={(e) => setTestLead(e.target.value)}
              placeholder="Lead number, e.g. L-6738018561"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void runTest(false)}
                disabled={Boolean(testing)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:opacity-50"
              >
                {testing === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Preview
              </button>
              <button
                type="button"
                onClick={() => void runTest(true)}
                disabled={Boolean(testing) || !draft.id}
                title={draft.id ? 'Really call the API' : 'Save first'}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
              >
                {testing === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">Preview only fills the payload. Send test really calls the API.</p>
            {testResult ? (
              <div className="mt-3 space-y-2">
                {testResult.sent ? (
                  <div
                    className={`rounded-lg px-2 py-1.5 text-xs font-bold ${
                      testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {testResult.ok ? 'Success' : 'Failed'} · HTTP {testResult.status ?? '—'}
                    {testResult.duration_ms != null ? ` · ${testResult.duration_ms} ms` : ''}
                    {testResult.error && !testResult.ok ? ` · ${testResult.error}` : ''}
                  </div>
                ) : null}
                {testResult.unknown_variables?.length ? (
                  <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-800">
                    Unknown variables (sent empty): {testResult.unknown_variables.join(', ')}
                  </div>
                ) : null}
                <div className="text-[11px] font-semibold text-slate-500">
                  {testResult.request.method} {testResult.request.url}
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] leading-4 text-slate-100">
                  {JSON.stringify(testResult.request.payload, null, 2)}
                </pre>
                {testResult.response ? (
                  <>
                    <div className="text-[11px] font-semibold text-slate-500">Response</div>
                    <pre className="max-h-40 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] leading-4 text-slate-700">
                      {testResult.response}
                    </pre>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Variables</span>
              <span className="text-[11px] text-slate-400">click to insert</span>
            </div>
            <input
              className={`${inputCls} mb-2 h-9`}
              value={varSearch}
              onChange={(e) => setVarSearch(e.target.value)}
              placeholder="Find variable"
            />
            <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
              {vars.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => insertVar(v.name)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-blue-50"
                >
                  <code className="text-xs font-bold text-[#023D95]">{`{{${v.name}}}`}</code>
                  <span className="truncate text-[11px] text-slate-500">{v.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Drawer>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
        {hint ? <span className="text-[11px] text-slate-400">{hint}</span> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-700">{label}</div>
        <div className="text-[11px] text-slate-500">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function RunsDrawer({ template, onClose }: { template: ApiTemplateRow; onClose: () => void }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/api-templates/${template.id}/runs?limit=100`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load history');
      setRuns(Array.isArray(json.runs) ? json.runs : []);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load history');
    } finally {
      setLoading(false);
    }
  }, [template.id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Drawer onClose={onClose}>
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-extrabold text-slate-800">Send history</h2>
          <p className="truncate text-xs text-slate-500">{template.name}</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {!loading && !runs.length ? <p className="text-center text-sm text-slate-500">Nothing sent yet.</p> : null}
        <div className="space-y-2">
          {runs.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 bg-white">
              <button
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                {r.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-600" />}
                <span className="text-xs font-bold text-slate-800">{r.lead_number || '—'}</span>
                <span className="rounded bg-slate-100 px-1.5 text-[11px] font-bold text-slate-600">{r.trigger === 'TEST' ? 'Test' : triggerLabel(r.trigger || '')}</span>
                <span className="text-[11px] text-slate-500">HTTP {r.status_code ?? '—'}</span>
                {r.run_by_name ? <span className="truncate text-[11px] text-slate-400">by {r.run_by_name}</span> : null}
                <span className="ml-auto whitespace-nowrap text-[11px] text-slate-500">{fmtDateTime(r.created_at)}</span>
              </button>
              {open === r.id ? (
                <div className="space-y-2 border-t border-slate-100 px-3 py-2">
                  {r.error ? <div className="text-xs font-semibold text-rose-700">{r.error}</div> : null}
                  <div className="text-[11px] font-semibold text-slate-500">Sent</div>
                  <pre className="max-h-56 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] text-slate-100">{prettyMaybeJson(r.request_body)}</pre>
                  <div className="text-[11px] font-semibold text-slate-500">Response {r.duration_ms != null ? `· ${r.duration_ms} ms` : ''}</div>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] text-slate-700">{r.response_body || '—'}</pre>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function prettyMaybeJson(text: string | null) {
  if (!text) return '—';
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}
