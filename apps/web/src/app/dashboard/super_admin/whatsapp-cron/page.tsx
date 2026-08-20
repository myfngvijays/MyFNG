'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Server,
  Trash2,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import ToggleSwitch from '@/components/shared/ToggleSwitch';

type TriggerRow = {
  trigger_key: string;
  display_name: string;
  is_enabled: boolean;
  cron_enabled: boolean;
};

type CronJobRow = {
  id: string;
  jobName: string;
  title: string;
  description: string;
  scheduleUtc: string;
  scheduleIst: string;
  jobParam?: string;
  force?: boolean;
  cadence: 'daily' | 'weekly';
  category: 'automation' | 'system_health';
  job_enabled: boolean;
  endpoint_url: string;
  triggers: TriggerRow[];
  effective: {
    master_on: boolean;
    triggers_cron_on: boolean;
    triggers_active: boolean;
    will_send: boolean;
    block_reason?: string | null;
  };
};

type AlertNumber = { phone: string; enabled: boolean };

type CronPayload = {
  provider: string;
  base_url: string;
  cron_master_enabled: boolean;
  alert_numbers: AlertNumber[];
  alert_numbers_enabled_count: number;
  sql_source: string;
  timezone_note: string;
  jobs: CronJobRow[];
  telecaller_leads_template?: {
    templateName: string;
    display_name?: string;
    exists: boolean;
    isApproved: boolean;
    metaStatus: string | null;
    canSendTemplate: boolean;
    body_preview?: string;
  } | null;
};

export default function WhatsAppCronPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CronPayload | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [masterBusy, setMasterBusy] = useState(false);
  const [jobBusyId, setJobBusyId] = useState<string | null>(null);
  const [numberBusy, setNumberBusy] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [addingPhone, setAddingPhone] = useState(false);
  const [lastRun, setLastRun] = useState<Record<string, string>>({});
  const [templateBusy, setTemplateBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load cron jobs');
      setData(json as CronPayload);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleMaster = async (enabled: boolean) => {
    setMasterBusy(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-cron-master', cronMasterEnabled: enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update master switch');
      toast.success(enabled ? 'Cron master ON' : 'Cron master OFF');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setMasterBusy(false);
    }
  };

  const toggleJob = async (jobId: string, enabled: boolean) => {
    setJobBusyId(jobId);
    setData((prev) =>
      prev
        ? {
            ...prev,
            jobs: prev.jobs.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    job_enabled: enabled,
                    effective: {
                      ...j.effective,
                      will_send: enabled ? j.effective.will_send || true : false,
                      block_reason: enabled ? j.effective.block_reason : 'This job is OFF',
                    },
                  }
                : j,
            ),
          }
        : prev,
    );
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-job', jobId, enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update job');
      toast.success(enabled ? 'Job ON' : 'Job OFF');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
      await load();
    } finally {
      setJobBusyId(null);
    }
  };

  const toggleAlertNumber = async (phone: string, enabled: boolean) => {
    setNumberBusy(phone);
    setData((prev) =>
      prev
        ? {
            ...prev,
            alert_numbers: prev.alert_numbers.map((n) =>
              n.phone === phone ? { ...n, enabled } : n,
            ),
          }
        : prev,
    );
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-alert-number', phone, enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update number');
      toast.success(enabled ? `${phone} ON` : `${phone} OFF`);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
      await load();
    } finally {
      setNumberBusy(null);
    }
  };

  const addAlertNumber = async () => {
    const phone = newPhone.trim();
    if (!phone) return;
    setAddingPhone(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-alert-number', phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to add number');
      setNewPhone('');
      toast.success('Number added');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setAddingPhone(false);
    }
  };

  const removeAlertNumber = async (phone: string) => {
    if (!confirm(`Remove ${phone} from alert list?`)) return;
    setNumberBusy(phone);
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-alert-number', phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to remove');
      toast.success('Number removed');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setNumberBusy(null);
    }
  };

  const runNow = async (jobId: string) => {
    setRunningId(jobId);
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Run failed');
      setLastRun((prev) => ({
        ...prev,
        [jobId]: json.success
          ? `OK ${json.status} · ${new Date().toLocaleTimeString('en-IN')}`
          : `HTTP ${json.status}`,
      }));
      if (json.success) toast.success(`${jobId} ran`);
      else toast.error(`Job returned ${json.status}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setRunningId(null);
    }
  };

  const ensureTcLeadsTemplate = async () => {
    setTemplateBusy(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ensure-telecaller-leads-template' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Template create/sync failed');
      toast.success(json?.message || 'Template synced with Meta');
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Template failed');
    } finally {
      setTemplateBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock className="h-6 w-6 text-violet-600" />
              <h1 className="text-2xl font-bold text-gray-900">WhatsApp Cron Jobs</h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Har job alag on/off · alert numbers on/off · schedule IST
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {data ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Provider</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{data.provider}</p>
              <p className="mt-1 text-xs text-gray-500">{data.timezone_note}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Target</p>
              <p className="mt-1 break-all text-sm font-semibold text-gray-900">{data.base_url}</p>
              <p className="mt-1 text-xs text-gray-500">SQL: {data.sql_source}</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    Master switch
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      data.cron_master_enabled ? 'text-violet-700' : 'text-gray-400'
                    }`}
                  >
                    {data.cron_master_enabled ? 'Scheduler ON' : 'Scheduler OFF'}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={data.cron_master_enabled}
                  busy={masterBusy}
                  disabled={masterBusy}
                  onChange={toggleMaster}
                  label="Toggle WhatsApp cron master"
                />
              </div>
              <Link
                href="/dashboard/super_admin/whatsapp-automation"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
              >
                Trigger on/off <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : null}

        {/* Alert numbers */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-rose-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-rose-700" />
              <p className="text-sm font-semibold text-rose-950">
                System alert WhatsApp numbers
              </p>
            </div>
            <p className="mt-1 text-xs text-rose-800/80">
              Health alert + admin daily summary + telecaller leads shift report inhe bhejte hain. Har
              number alag on/off.
              {data
                ? ` · ${data.alert_numbers_enabled_count}/${data.alert_numbers.length} ON`
                : ''}
            </p>
          </div>
          <div className="divide-y">
            {(data?.alert_numbers || []).length === 0 && !loading ? (
              <p className="px-4 py-4 text-sm text-gray-500">
                Koi number nahi. Env se seed hoga pehli load pe, ya neeche add karo.
              </p>
            ) : null}
            {(data?.alert_numbers || []).map((n) => (
              <div
                key={n.phone}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-gray-900">{n.phone}</p>
                  <p className="text-[11px] text-gray-500">
                    {n.enabled ? 'Alerts ON' : 'Alerts OFF — skip this number'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void removeAlertNumber(n.phone)}
                    disabled={numberBusy === n.phone}
                    className="rounded-lg border p-2 text-gray-400 hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ToggleSwitch
                    enabled={n.enabled}
                    busy={numberBusy === n.phone}
                    disabled={numberBusy !== null && numberBusy !== n.phone}
                    onChange={(v) => void toggleAlertNumber(n.phone, v)}
                    label={`Toggle alert ${n.phone}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center">
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="Add number e.g. 9198XXXXXXXX"
              className="w-full rounded-lg border bg-white px-3 py-2 font-mono text-sm sm:max-w-xs"
            />
            <button
              type="button"
              onClick={() => void addAlertNumber()}
              disabled={addingPhone || !newPhone.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {addingPhone ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add number
            </button>
          </div>
        </div>

        {/* TC leads template */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="border-b bg-emerald-50/70 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-950">
              Telecaller leads WhatsApp template
            </p>
            <p className="mt-1 text-xs text-emerald-800/80">
              7pm shift report ke liye Meta UTILITY template — bina 24h window ke bhej sakte ho.
              Name: <code className="rounded bg-white px-1">telecaller_leads_shift_report</code>
            </p>
          </div>
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              {data?.telecaller_leads_template ? (
                <>
                  <p className="font-semibold text-gray-900">
                    {data.telecaller_leads_template.display_name ||
                      data.telecaller_leads_template.templateName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Status:{' '}
                    <span
                      className={
                        data.telecaller_leads_template.canSendTemplate
                          ? 'font-bold text-emerald-700'
                          : 'font-bold text-amber-700'
                      }
                    >
                      {data.telecaller_leads_template.metaStatus ||
                        (data.telecaller_leads_template.exists ? 'PENDING' : 'NOT CREATED')}
                    </span>
                    {data.telecaller_leads_template.canSendTemplate
                      ? ' · ready to send'
                      : ' · Create/Sync pe click karo, Meta approve hone tak wait'}
                  </p>
                </>
              ) : (
                <p className="text-gray-500">Template status load nahi hua</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void ensureTcLeadsTemplate()}
              disabled={templateBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {templateBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Create / Sync on Meta
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-violet-500" />
            Loading cron jobs…
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="border-b bg-violet-50/60 px-4 py-3">
              <p className="text-sm font-semibold text-violet-950">Scheduled jobs (Supabase)</p>
              <p className="text-xs text-violet-800/80">
                Har job ka apna on/off. OFF = schedule time pe bhi skip.
              </p>
            </div>
            <div className="divide-y">
              {(data?.jobs || []).map((job) => {
                const ok = job.effective.will_send;
                return (
                  <div key={job.id} className="px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-bold text-gray-900">{job.title}</h2>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              job.category === 'system_health'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-violet-100 text-violet-800'
                            }`}
                          >
                            {job.category === 'system_health' ? 'health' : 'automation'}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              job.cadence === 'weekly'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {job.cadence}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              ok
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {ok ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Will run
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" /> Blocked / off
                              </>
                            )}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{job.description}</p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 font-semibold text-violet-900">
                            <Clock3 className="h-3.5 w-3.5" />
                            {job.scheduleIst}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border bg-gray-50 px-2.5 py-1 font-mono text-gray-700">
                            UTC cron: {job.scheduleUtc}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg border bg-gray-50 px-2.5 py-1 font-mono text-gray-600">
                            <Server className="h-3.5 w-3.5" />
                            {job.jobName}
                          </span>
                          {job.jobParam ? (
                            <span className="rounded-lg border bg-gray-50 px-2.5 py-1 font-mono text-gray-600">
                              {job.category === 'system_health' ? 'slot' : 'job'}=
                              {job.jobParam}
                              {job.force ? '&force=1' : ''}
                            </span>
                          ) : null}
                        </div>

                        {job.triggers.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {job.triggers.map((t) => (
                              <span
                                key={t.trigger_key}
                                className="rounded-md border px-2 py-0.5 text-[11px] text-gray-700"
                                title={`Active: ${t.is_enabled} · Cron: ${t.cron_enabled}`}
                              >
                                {t.display_name}
                                <span className="ml-1 text-gray-400">
                                  {t.is_enabled ? '●' : '○'}
                                  {t.cron_enabled ? 'C' : '—'}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {!ok && job.effective.block_reason ? (
                          <p className="mt-2 text-[11px] text-amber-700">
                            {job.effective.block_reason}
                          </p>
                        ) : null}

                        {lastRun[job.id] ? (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Last run: {lastRun[job.id]}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold ${
                              job.job_enabled ? 'text-violet-700' : 'text-gray-400'
                            }`}
                          >
                            {job.job_enabled ? 'ON' : 'OFF'}
                          </span>
                          <ToggleSwitch
                            enabled={job.job_enabled}
                            busy={jobBusyId === job.id}
                            disabled={jobBusyId !== null && jobBusyId !== job.id}
                            onChange={(v) => void toggleJob(job.id, v)}
                            label={`Toggle job ${job.title}`}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => void runNow(job.id)}
                          disabled={runningId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          {runningId === job.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                          Run now
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
          <p className="font-semibold">Notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>
              Pehli baar numbers env{' '}
              <code className="rounded bg-white px-1">SYSTEM_ALERT_WHATSAPP_NUMBERS</code> se
              seed hote hain, phir DB me save — yahan se on/off.
            </li>
            <li>
              SQL:{' '}
              <code className="rounded bg-white px-1">supabase_cron_whatsapp_automation.sql</code>{' '}
              + migration{' '}
              <code className="rounded bg-white px-1">296_system_alert_whatsapp_cron_controls.sql</code>
              .
            </li>
            <li>
              Per-trigger toggles:{' '}
              <Link
                href="/dashboard/super_admin/whatsapp-automation"
                className="font-semibold text-blue-700"
              >
                WhatsApp Automation
              </Link>
              .
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
