'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Copy, Loader2, MessageSquare, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import ToggleSwitch from '@/components/shared/ToggleSwitch';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';

type ScriptRow = {
  id: string;
  script_title?: string;
  title?: string;
  script_content?: string;
  body?: string;
  category?: string;
  script_type?: string;
};

type WaTemplate = {
  id: string;
  template_name: string;
  display_name?: string | null;
  body?: string | null;
  language?: string | null;
  is_active?: boolean;
  crm_telecaller: boolean;
  meta?: Record<string, unknown> | null;
};

function isShownToTelecaller(row: {
  template_name: string;
  is_active?: boolean;
  meta?: Record<string, unknown> | null;
}): boolean {
  if (row.is_active === false) return false;
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {};
  const flag = (meta as any).crm_telecaller;
  return flag === true || flag === '1' || flag === 1;
}

export default function CrmTemplatesPanel({ basePath: _basePath }: { basePath: string }) {
  const pathname = usePathname();
  const { isLeadManager } = getCrmDashboardBase(pathname);
  /** Telecaller ON/OFF is manager/admin only — telecallers just browse allowed templates. */
  const canManageTelecallerVisibility = isLeadManager;
  const searchParams = useSearchParams();
  const tabParam = String(searchParams.get('tab') || '').toLowerCase();
  const [tab, setTab] = useState<'scripts' | 'whatsapp'>(
    tabParam === 'whatsapp' ? 'whatsapp' : 'scripts',
  );
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (tabParam === 'whatsapp') setTab('whatsapp');
    else if (tabParam === 'scripts') setTab('scripts');
  }, [tabParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [{ data: scriptRows, error: sErr }, waRes] = await Promise.all([
        supabase
          .from('telecaller_scripts')
          .select('id, script_title, script_content, category, script_type, is_active')
          .eq('is_active', true)
          .order('script_type', { ascending: true })
          .limit(100),
        fetch('/api/whatsapp/templates').then(async (r) => {
          const j = await r.json().catch(() => ({}));
          return { ok: r.ok, j };
        }),
      ]);
      if (sErr) throw new Error(sErr.message);
      setScripts((scriptRows || []) as ScriptRow[]);
      if (waRes.ok) {
        const list = Array.isArray(waRes.j?.templates) ? waRes.j.templates : [];
        setTemplates(
          list
            .filter((t: any) => t?.is_active !== false && t?.id)
            .map((t: any) => {
              const mapped = {
                id: String(t.id),
                template_name: String(t.template_name || ''),
                display_name: t.display_name || null,
                body: t.body || t.body_text || null,
                language: t.language || t.language_code || null,
                is_active: t.is_active !== false,
                meta: t.meta && typeof t.meta === 'object' ? t.meta : null,
                crm_telecaller: false,
              };
              mapped.crm_telecaller = isShownToTelecaller(mapped);
              return mapped;
            })
            .filter((t: WaTemplate) => t.template_name),
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const toggleTelecaller = async (row: WaTemplate, next: boolean) => {
    setTogglingId(row.id);
    setTemplates((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? {
              ...item,
              crm_telecaller: next,
              meta: { ...(item.meta || {}), crm_telecaller: next },
            }
          : item,
      ),
    );
    try {
      const res = await fetch(`/api/whatsapp/templates/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crm_telecaller: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to update');
      toast.success(next ? 'Telecaller can see this template' : 'Hidden from telecallers');
    } catch (e: any) {
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                crm_telecaller: row.crm_telecaller,
                meta: row.meta,
              }
            : item,
        ),
      );
      toast.error(e?.message || 'Failed to update telecaller visibility');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-[#023D95]">Msg Templates</h1>
        <p className="text-sm text-slate-500 mt-1">
          Call scripts + WhatsApp templates.
          {canManageTelecallerVisibility
            ? ' On WhatsApp tab, turn Telecaller ON/OFF to control what your team sees in chat.'
            : ' Templates shown here are enabled for your role.'}
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: 'scripts' as const, label: 'Call scripts', icon: Phone },
            { id: 'whatsapp' as const, label: 'WhatsApp templates', icon: MessageSquare },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold border ${
              tab === t.id
                ? 'bg-[#004AAD] text-white border-[#004AAD]'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : tab === 'scripts' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {scripts.map((s) => {
            const title = s.script_title || s.title || 'Script';
            const body = s.script_content || s.body || '';
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#023D95]">{title}</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {[s.category, s.script_type].filter(Boolean).join(' · ') || 'Call script'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copy(s.id, body)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-[#004AAD]"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === s.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {body}
                </p>
              </div>
            );
          })}
          {!scripts.length ? (
            <p className="text-sm text-slate-500 col-span-full text-center py-10">
              No active call scripts yet.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div
              key={t.id || t.template_name}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[#023D95]">
                    {t.display_name || t.template_name}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 break-all">
                    {t.template_name}
                    {t.language ? ` · ${t.language}` : ''}
                  </p>
                </div>
                {t.body ? (
                  <button
                    type="button"
                    onClick={() => void copy(t.template_name, String(t.body))}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-[#004AAD]"
                  >
                    <Copy className="h-3 w-3" />
                    {copied === t.template_name ? 'Copied' : 'Copy'}
                  </button>
                ) : null}
              </div>
              {t.body ? (
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {t.body}
                </p>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Use this template from WhatsApp chat send picker.
                </p>
              )}
              {canManageTelecallerVisibility ? (
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <ToggleSwitch
                      enabled={t.crm_telecaller}
                      busy={togglingId === t.id}
                      size="sm"
                      onChange={(next) => void toggleTelecaller(t, next)}
                      label={`Show ${t.template_name} to telecallers`}
                    />
                    <span
                      className={`text-xs font-bold ${
                        t.crm_telecaller ? 'text-[#004AAD]' : 'text-slate-400'
                      }`}
                    >
                      {togglingId === t.id
                        ? 'Saving…'
                        : t.crm_telecaller
                          ? 'Telecaller ON'
                          : 'Telecaller OFF'}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {!templates.length ? (
            <p className="text-sm text-slate-500 col-span-full text-center py-10">
              No WhatsApp templates available.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
