'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, Search, Sparkles } from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import { ALL_CRM_LEAD_STATUS_NAMES } from '@/lib/telecaller/salesPlaybookDefaults';
import type { LeadIqBrief } from '@/lib/telecaller/leadIq';

function intentTone(v?: string) {
  if (v === 'High' || v === 'Hot') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (v === 'Low' || v === 'Cold') return 'bg-slate-100 text-slate-700 ring-slate-200';
  return 'bg-amber-50 text-amber-900 ring-amber-200';
}

export function LeadIqBriefView({
  brief,
  compact = false,
}: {
  brief: LeadIqBrief;
  compact?: boolean;
}) {
  const [tab, setTab] = useState<'brief' | 'scripts'>('brief');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${intentTone(brief.intent_level)}`}>
          Intent {brief.intent_level}
        </span>
        {brief.temperature ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${intentTone(brief.temperature)}`}>
            {brief.temperature}
          </span>
        ) : null}
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
          {brief.decision_stage}
        </span>
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800 ring-1 ring-violet-200">
          {brief.engine === 'openai_lead_iq_v1' ? 'Deep AI' : 'Free'}
        </span>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setTab('brief')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              tab === 'brief' ? 'bg-violet-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            Brief
          </button>
          <button
            type="button"
            onClick={() => setTab('scripts')}
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
              tab === 'scripts' ? 'bg-violet-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
            }`}
          >
            Scripts
          </button>
        </div>
      </div>
      {tab === 'brief' ? (
        <div className="space-y-2">
          <p className={`text-sm font-semibold text-slate-900 ${compact ? 'line-clamp-2' : ''}`}>
            {brief.verdict}
          </p>
          <div className="grid sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-orange-100 bg-orange-50/70 px-2.5 py-1.5">
              <p className="font-bold uppercase tracking-wide text-[10px] text-orange-800">Hidden risk</p>
              <p className="mt-0.5 text-slate-800 line-clamp-3">{brief.hidden_risk}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-2.5 py-1.5">
              <p className="font-bold uppercase tracking-wide text-[10px] text-emerald-800">Next move</p>
              <p className="mt-0.5 text-slate-800 line-clamp-3">{brief.next_move}</p>
            </div>
          </div>
          {brief.buyer_type ? (
            <p className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-800">Buyer:</span> {brief.buyer_type}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <p className="font-bold text-slate-800">WhatsApp</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700 line-clamp-8">{brief.whatsapp_script}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
            <p className="font-bold text-slate-800">Call</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-700 line-clamp-8">{brief.call_script}</p>
          </div>
        </div>
      )}
    </div>
  );
}

type LeadRow = {
  id: string;
  lead_number?: string | null;
  customer_name?: string | null;
  phone?: string | null;
  city?: string | null;
  status?: string | null;
  agent?: string | null;
  total_calls?: number;
  brief?: LeadIqBrief | null;
};

export default function LeadIqPanel({
  helpHref,
  suiteHref,
  leadsHref,
}: {
  helpHref: string;
  suiteHref: string;
  leadsHref: string;
}) {
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [crmStatuses, setCrmStatuses] = useState<string[]>([...ALL_CRM_LEAD_STATUS_NAMES]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ list: '1', limit: '40' });
      if (q.trim()) params.set('q', q.trim());
      if (status && status !== 'All') params.set('status', status);
      const res = await fetch(`/api/super_admin/lead-iq?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setLeads(Array.isArray(json.leads) ? json.leads : []);
      if (json.warning && !/database\/|\.sql/i.test(String(json.warning))) setError(json.warning);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/lead-manager/statuses', { credentials: 'include', cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        const names = (Array.isArray(json?.statuses) ? json.statuses : [])
          .filter((s: any) => s?.is_active !== false)
          .map((s: any) => String(s.name || '').trim())
          .filter(Boolean);
        if (names.length) setCrmStatuses(names);
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  async function generate(id: string, deep: boolean) {
    setRunningId(id);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/lead-iq', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id, deep }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Generate failed');
      setLeads((prev) =>
        prev.map((row) => (row.id === id ? { ...row, brief: json.brief } : row)),
      );
      setOpenId(id);
      if (json.warning && !/database\/|\.sql/i.test(String(json.warning))) setError(json.warning);
    } catch (e: any) {
      setError(e?.message || 'Generate failed');
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-3 max-w-[1200px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-violet-700" />
            Lead IQ
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            CRM lead pe intent, hidden risk, next move + WhatsApp/call script.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PageHelpIcon href={helpHref} label="Lead IQ" />
          <Link
            href={suiteHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
          >
            AI Suite
          </Link>
          <Link
            href={leadsHref}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium"
          >
            Leads
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-sm"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Search name, phone, or L-number"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['All', ...crmStatuses].map((name) => {
            const on = status === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setStatus(name)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                  on ? 'bg-violet-700 text-white ring-violet-700' : 'bg-white text-slate-600 ring-slate-200'
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-1.5">Lead</th>
                <th className="px-3 py-1.5">Status</th>
                <th className="px-3 py-1.5">Intent</th>
                <th className="px-3 py-1.5">Next move</th>
                <th className="px-3 py-1.5 text-right">IQ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-violet-700" />
                  </td>
                </tr>
              ) : null}
              {!loading &&
                leads.map((row, i) => {
                  const open = openId === row.id;
                  const running = runningId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr className={i % 2 ? 'bg-slate-50/70' : 'bg-white'}>
                        <td className="px-3 py-1.5">
                          <p className="font-semibold text-[13px] leading-tight text-slate-900">
                            {row.customer_name || row.phone || 'Lead'}
                          </p>
                          <p className="text-[10px] leading-tight text-teal-700">
                            {row.lead_number || ''}
                            {row.agent ? ` · ${row.agent}` : ''}
                          </p>
                        </td>
                        <td className="px-3 py-1.5 text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                          {row.status || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-[11px]">
                          {row.brief?.intent_level || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-[11px] text-slate-600 max-w-[280px]">
                          <span className="line-clamp-1">{row.brief?.next_move || 'Generate to get next move'}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={!!runningId}
                            onClick={() => void generate(row.id, false)}
                            className="mr-1 text-[11px] font-semibold text-slate-700 hover:underline disabled:opacity-50"
                          >
                            {running ? '…' : 'Free'}
                          </button>
                          <button
                            type="button"
                            disabled={!!runningId}
                            onClick={() => void generate(row.id, true)}
                            className="mr-2 text-[11px] font-semibold text-violet-700 hover:underline disabled:opacity-50"
                          >
                            Deep
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenId(open ? null : row.id)}
                            className="text-[11px] font-semibold text-violet-700 hover:underline"
                          >
                            {open ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {open && row.brief ? (
                        <tr className="bg-violet-50/40">
                          <td colSpan={5} className="px-3 py-2">
                            <LeadIqBriefView brief={row.brief} compact />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              {!loading && !leads.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                    Is filter pe koi lead nahi. Status chip ya search change karo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
