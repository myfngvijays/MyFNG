'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Shield,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

type EnvConfigView = {
  whatsapp_phone_number_id: string;
  whatsapp_business_account_id: string;
  whatsapp_api_url: string;
  use_db_credentials: boolean;
  admin_notes: string;
  openai_api_key_set: boolean;
  openai_api_key_masked: string;
  whatsapp_access_token_set: boolean;
  whatsapp_access_token_masked: string;
  whatsapp_app_secret_set: boolean;
  whatsapp_app_secret_masked: string;
  whatsapp_webhook_verify_token_set: boolean;
  whatsapp_webhook_verify_token_masked: string;
  cron_secret_set: boolean;
  cron_secret_masked: string;
  telecrm_webhook_secret_set: boolean;
  telecrm_webhook_secret_masked: string;
  credentials_source: 'database' | 'environment' | 'none';
  env_fallback: {
    openai_configured: boolean;
    whatsapp_configured: boolean;
    cron_configured: boolean;
    telecrm_configured: boolean;
    supabase_service_role_configured: boolean;
    supabase_url: string;
  };
};

type Health = {
  ok: boolean;
  credentials_source: string;
  openai: { ok: boolean; message: string };
  whatsapp: { ok: boolean; message: string };
  cron: { ok: boolean; message: string };
  telecrm: { ok: boolean; message: string };
  supabase_admin: { ok: boolean; message: string };
};

type FormState = {
  openai_api_key: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_business_account_id: string;
  whatsapp_api_url: string;
  whatsapp_app_secret: string;
  whatsapp_webhook_verify_token: string;
  cron_secret: string;
  telecrm_webhook_secret: string;
  use_db_credentials: boolean;
  admin_notes: string;
};

const EMPTY_FORM: FormState = {
  openai_api_key: '',
  whatsapp_access_token: '',
  whatsapp_phone_number_id: '',
  whatsapp_business_account_id: '',
  whatsapp_api_url: 'https://graph.facebook.com/v25.0',
  whatsapp_app_secret: '',
  whatsapp_webhook_verify_token: '',
  cron_secret: '',
  telecrm_webhook_secret: '',
  use_db_credentials: false,
  admin_notes: '',
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}

export default function AgentEnvSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [health, setHealth] = useState<Health | null>(null);
  const [configView, setConfigView] = useState<EnvConfigView | null>(null);

  const update = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-agents/env-settings');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to load settings');
        return;
      }
      const cfg = data.config as EnvConfigView;
      setConfigView(cfg);
      setCanEdit(Boolean(data.can_edit));
      setHealth(data.health as Health);
      setForm({
        openai_api_key: '',
        whatsapp_access_token: '',
        whatsapp_phone_number_id: cfg.whatsapp_phone_number_id || '',
        whatsapp_business_account_id: cfg.whatsapp_business_account_id || '',
        whatsapp_api_url: cfg.whatsapp_api_url || 'https://graph.facebook.com/v25.0',
        whatsapp_app_secret: '',
        whatsapp_webhook_verify_token: '',
        cron_secret: '',
        telecrm_webhook_secret: '',
        use_db_credentials: cfg.use_db_credentials,
        admin_notes: cfg.admin_notes || '',
      });
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-agents/env-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Save failed');
        return;
      }
      toast.success(data.message || 'Saved');
      setHealth(data.health as Health);
      await load();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-agents/env-settings', { method: 'POST' });
      const data = await res.json();
      setHealth(data.health as Health);
      if (data.ok) toast.success('All credentials healthy');
      else toast.error(data.message || 'Some checks failed');
    } catch {
      toast.error('Network error');
    } finally {
      setTesting(false);
    }
  };

  const runBootstrap = async () => {
    setBootstrapping(true);
    try {
      const res = await fetch('/api/super_admin/whatsapp-agents/env-settings/bootstrap', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Bootstrap failed');
        return;
      }
      toast.success(data.message || 'Bootstrapped from server');
      setHealth(data.health as Health);
      await load();
    } catch {
      toast.error('Network error');
    } finally {
      setBootstrapping(false);
    }
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl border bg-white" />;
  }

  const sourceLabel =
    configView?.credentials_source === 'database'
      ? 'Database (saved credentials)'
      : configView?.credentials_source === 'environment'
        ? 'Server .env'
        : 'Not configured';

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">WhatsApp & API Credentials</h2>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                Super Admin only
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              WABA ID, Phone Number ID, Access Token, App Secret, Verify Token — Firebase Settings jaisa.
              Change karo, Save dabao; redeploy ki zaroorat nahi (Use saved credentials ON rakho).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void runTest()}
              disabled={testing}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Test Connection
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">Quick setup</p>
          <p className="mt-1 text-emerald-800">
            <strong>Auto-fill from server</strong> — server ke{' '}
            <code className="rounded bg-white/70 px-1 text-xs">.env</code> se keys save.
          </p>
          {canEdit ? (
            <button
              type="button"
              onClick={() => void runBootstrap()}
              disabled={bootstrapping}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {bootstrapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Auto-fill from server
            </button>
          ) : null}
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Active source: {sourceLabel}</p>
            <p className="mt-0.5">
              Secrets masked. Blank = purani value. Webhook:{' '}
              <code className="text-xs">https://myfng.in/api/webhooks/whatsapp</code>
            </p>
          </div>
        </div>

        {!canEdit ? (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            Sub Admin dekh sakta hai; edit sirf <strong>Super Admin</strong>.
          </div>
        ) : null}

        {health ? (
          <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-semibold text-gray-500">OpenAI</div>
              <StatusPill ok={health.openai.ok} label={health.openai.ok ? 'OK' : 'Check'} />
              <p className="mt-1 text-[11px] text-gray-600">{health.openai.message}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-semibold text-gray-500">WhatsApp</div>
              <StatusPill ok={health.whatsapp.ok} label={health.whatsapp.ok ? 'OK' : 'Check'} />
              <p className="mt-1 text-[11px] text-gray-600">{health.whatsapp.message}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-semibold text-gray-500">Cron</div>
              <StatusPill ok={health.cron.ok} label={health.cron.ok ? 'OK' : 'Missing'} />
              <p className="mt-1 text-[11px] text-gray-600">{health.cron.message}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-semibold text-gray-500">TeleCRM</div>
              <StatusPill ok={health.telecrm.ok} label={health.telecrm.ok ? 'OK' : 'Missing'} />
              <p className="mt-1 text-[11px] text-gray-600">{health.telecrm.message}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="mb-1 text-xs font-semibold text-gray-500">Supabase Admin</div>
              <StatusPill
                ok={health.supabase_admin.ok}
                label={health.supabase_admin.ok ? 'OK' : 'Check'}
              />
              <p className="mt-1 text-[11px] text-gray-600">{health.supabase_admin.message}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={form.use_db_credentials}
              onChange={(e) => update('use_db_credentials', e.target.checked)}
              disabled={!canEdit}
              className="rounded border-gray-300"
            />
            Use saved credentials (database overrides server .env)
          </label>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">
              Meta WhatsApp Cloud API
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                WHATSAPP_BUSINESS_ACCOUNT_ID (WABA)
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder="WhatsApp Business Account ID"
                value={form.whatsapp_business_account_id}
                onChange={(e) => update('whatsapp_business_account_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                WHATSAPP_PHONE_NUMBER_ID
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder="Meta Phone Number ID"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => update('whatsapp_phone_number_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                WHATSAPP_ACCESS_TOKEN
              </label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={
                  configView?.whatsapp_access_token_set
                    ? configView.whatsapp_access_token_masked
                    : 'EAA...'
                }
                value={form.whatsapp_access_token}
                onChange={(e) => update('whatsapp_access_token', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                WHATSAPP_APP_SECRET
              </label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={
                  configView?.whatsapp_app_secret_set
                    ? configView.whatsapp_app_secret_masked
                    : 'App secret from Meta App settings'
                }
                value={form.whatsapp_app_secret}
                onChange={(e) => update('whatsapp_app_secret', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                WHATSAPP_WEBHOOK_VERIFY_TOKEN
              </label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={
                  configView?.whatsapp_webhook_verify_token_set
                    ? configView.whatsapp_webhook_verify_token_masked
                    : 'hub.verify_token'
                }
                value={form.whatsapp_webhook_verify_token}
                onChange={(e) => update('whatsapp_webhook_verify_token', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">WHATSAPP_API_URL</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                value={form.whatsapp_api_url}
                onChange={(e) => update('whatsapp_api_url', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
              OpenAI · Cron · TeleCRM
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">OPENAI_API_KEY</label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={
                  configView?.openai_api_key_set ? configView.openai_api_key_masked : 'sk-...'
                }
                value={form.openai_api_key}
                onChange={(e) => update('openai_api_key', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">CRON_SECRET</label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={
                  configView?.cron_secret_set
                    ? configView.cron_secret_masked
                    : 'Bearer token for cron'
                }
                value={form.cron_secret}
                onChange={(e) => update('cron_secret', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                TELECRM_WEBHOOK_SECRET
              </label>
              <input
                type="password"
                className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                placeholder={
                  configView?.telecrm_webhook_secret_set
                    ? configView.telecrm_webhook_secret_masked
                    : 'x-webhook-secret header'
                }
                value={form.telecrm_webhook_secret}
                onChange={(e) => update('telecrm_webhook_secret', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="font-semibold text-gray-700">Server-only (read-only)</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              <li>
                SUPABASE_SERVICE_ROLE_KEY:{' '}
                {configView?.env_fallback.supabase_service_role_configured ? (
                  <span className="font-semibold text-emerald-700">Configured in .env</span>
                ) : (
                  <span className="font-semibold text-amber-700">Not found in .env</span>
                )}
              </li>
              <li>
                SUPABASE_URL: <code>{configView?.env_fallback.supabase_url || '—'}</code>
              </li>
            </ul>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Admin notes</label>
            <textarea
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={2}
              value={form.admin_notes}
              onChange={(e) => update('admin_notes', e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {canEdit ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save credentials
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
