'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Send } from 'lucide-react';

function money(n: number | null | undefined, currency = 'INR') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
  } catch {
    return `${currency} ${n}`;
  }
}

export default function GoogleAdsFundsPanel({
  funds,
  loading,
  onRefresh,
  onTestAlert,
  onCreateTemplate,
}: {
  funds: any;
  loading?: boolean;
  onRefresh: () => void;
  onTestAlert?: () => Promise<{ sent?: number; skipped?: boolean; reason?: string; template?: any } | void>;
  onCreateTemplate?: () => Promise<{ message?: string; template?: any } | void>;
}) {
  const currency = funds?.currency || 'INR';
  const remaining = funds?.remaining;
  const daily = Number(funds?.daily_budget || 0);
  const low = Boolean(funds?.funds_from_api && remaining != null && Number(remaining) < 1000);
  const [alertBusy, setAlertBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [alertNote, setAlertNote] = useState<string | null>(null);
  const [template, setTemplate] = useState<any>(funds?.template || null);

  useEffect(() => {
    if (funds?.template) setTemplate(funds.template);
  }, [funds?.template]);

  const sendTest = async () => {
    if (!onTestAlert) return;
    setAlertBusy(true);
    setAlertNote(null);
    try {
      const result = await onTestAlert();
      if (result?.template) setTemplate(result.template);
      if (result?.sent) setAlertNote(`WhatsApp sent to ${result.sent} number(s).`);
      else setAlertNote(result?.reason || 'Alert skipped.');
    } catch (e: any) {
      setAlertNote(e?.message || 'Failed to send test WhatsApp');
    } finally {
      setAlertBusy(false);
    }
  };

  const createTemplate = async () => {
    if (!onCreateTemplate) return;
    setTemplateBusy(true);
    setAlertNote(null);
    try {
      const result = await onCreateTemplate();
      if (result?.template) setTemplate(result.template);
      setAlertNote(result?.message || 'Template submitted to Meta.');
    } catch (e: any) {
      setAlertNote(e?.message || 'Failed to create template');
    } finally {
      setTemplateBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Google Ads funds</h2>
          <p className="text-xs text-slate-500">
            {funds?.account?.name} · {funds?.account?.id} · {funds?.billing_type || 'Billing'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onCreateTemplate ? (
            <button
              type="button"
              disabled={templateBusy}
              onClick={() => void createTemplate()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"
            >
              {templateBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {template?.canSendTemplate ? 'Refresh template' : 'Create template'}
            </button>
          ) : null}
          {onTestAlert ? (
            <button
              type="button"
              disabled={alertBusy}
              onClick={() => void sendTest()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
            >
              {alertBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Test WhatsApp
            </button>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Remaining ₹1,000 ke neeche aate hi WhatsApp Cron ke alert numbers pe message jayega (har 3 ghante check, 12h cooldown).
        Invoice account pe prepaid remaining API nahi deti — wahan alert skip.
      </p>
      <p className="text-xs text-slate-500">
        Template <code className="rounded bg-slate-100 px-1">google_ads_funds_alert</code>:{' '}
        <span className={template?.canSendTemplate ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
          {template?.canSendTemplate
            ? 'APPROVED · 24/7 ready'
            : template?.metaStatus || (template?.exists ? 'PENDING' : 'NOT CREATED')}
        </span>
        {!template?.canSendTemplate ? ' — Create template dabao, Meta approve hone ke baad 24/7 chalega.' : ''}
      </p>
      {alertNote ? <p className="text-xs font-semibold text-slate-700">{alertNote}</p> : null}
      {low ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          Funds low: {money(remaining, currency)} remaining. Ads → Billing & payments mein top-up karo.
        </div>
      ) : null}

      {funds?.error ? <p className="text-sm text-rose-700">{funds.error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">Remaining</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            {funds?.funds_from_api ? money(remaining, currency) : 'Invoice'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {funds?.funds_from_api
              ? `${money(funds.served, currency)} used of ${money(funds.limit, currency)}`
              : funds?.funding || 'Monthly billing'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">Daily budget</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{money(daily, currency)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Today {money(funds?.today_spend, currency)}
            {funds?.today_vs_daily != null ? ` · ${funds.today_vs_daily}%` : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">7-day burn</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{money(funds?.daily_burn, currency)}/day</p>
          <p className="mt-1 text-xs text-slate-500">
            {funds?.days_left != null ? `~${funds.days_left} days left` : `Week ${money(funds?.last_7d_spend, currency)}`}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">Pay method</p>
          <p className="mt-1 text-lg font-extrabold text-slate-900">{funds?.funding || '—'}</p>
          <p className="mt-1 text-xs text-slate-500">{funds?.payments_account_id || 'Ads Billing'}</p>
        </div>
      </div>

      {funds?.permission_hint ? <p className="text-xs text-slate-500">{funds.permission_hint}</p> : null}

      {(funds?.budgets || []).length ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="text-sm font-extrabold text-slate-900">Account budgets</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {funds.budgets.map((b: any) => (
              <div key={b.id || b.name} className="grid gap-2 px-5 py-3 sm:grid-cols-4 sm:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{b.name}</p>
                  <p className="text-[11px] text-slate-400">{b.status}</p>
                </div>
                <p className="text-sm text-slate-700">{b.infinite ? 'Unlimited' : money(b.limit, currency)}</p>
                <p className="text-sm text-slate-700">Used {money(b.served, currency)}</p>
                <p className="text-sm font-bold text-slate-900">{b.infinite ? '—' : money(b.remaining, currency)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
