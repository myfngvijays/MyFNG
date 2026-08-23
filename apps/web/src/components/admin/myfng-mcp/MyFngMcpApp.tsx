'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Loader2,
  Package,
  RefreshCw,
  Shield,
  Terminal,
  XCircle,
} from 'lucide-react';

type Tool = { name: string; area: string; description: string };

type Payload = {
  ok: boolean;
  meta: {
    name: string;
    version: string;
    mode: string;
    packagePath: string;
    notes: string[];
  };
  status: 'ready' | 'needs_build' | 'missing_package' | 'missing_env';
  filesystem: {
    package_present: boolean;
    built: boolean;
    runner_present: boolean;
    dist_entry: string | null;
    runner_entry: string | null;
  };
  env: {
    supabase_url: boolean;
    service_role_key: boolean;
    mask_pii: string;
    max_rows: string;
  };
  tool_count: number;
  tools: Tool[];
  by_area: Record<string, Tool[]>;
  sample_mcp_config: unknown;
  setup_steps: string[];
  checked_at: string;
};

const STATUS_UI: Record<
  Payload['status'],
  { label: string; className: string; hint: string }
> = {
  ready: {
    label: 'Package ready',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    hint: 'Built + env present. Connect any MCP client only if you want — not wired into Cursor by default.',
  },
  needs_build: {
    label: 'Needs build',
    className: 'bg-amber-100 text-amber-900 border-amber-200',
    hint: 'Run: cd packages/myfng-mcp && npm install && npm run build',
  },
  missing_env: {
    label: 'Missing Supabase env',
    className: 'bg-rose-100 text-rose-800 border-rose-200',
    hint: 'Add SUPABASE URL + SERVICE_ROLE_KEY to apps/web/.env.local (or server env).',
  },
  missing_package: {
    label: 'Package missing',
    className: 'bg-rose-100 text-rose-800 border-rose-200',
    hint: 'packages/myfng-mcp not found on this server.',
  },
};

export default function MyFngMcpApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/myfng-mcp');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setData(json);
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

  const copyConfig = async () => {
    if (!data?.sample_mcp_config) return;
    await navigator.clipboard.writeText(JSON.stringify(data.sample_mcp_config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const status = data ? STATUS_UI[data.status] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#004AAD]">Developer tools</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
            <Package className="h-7 w-7 text-[#004AAD]" />
            MyFNG MCP
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Standalone <strong>read-only</strong> Model Context Protocol server for MyFNG data. Built
            as a package — not auto-connected to Cursor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading package status…
        </div>
      ) : null}

      {data && status ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
              <span
                className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}
              >
                {status.label}
              </span>
              <p className="mt-2 text-xs text-slate-500">{status.hint}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Package</p>
              <p className="mt-1 text-lg font-black text-slate-900">{data.meta.name}</p>
              <p className="text-xs text-slate-500">
                v{data.meta.version} · {data.meta.mode} · {data.tool_count} tools
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Filesystem</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                <Flag ok={data.filesystem.package_present} label="packages/myfng-mcp" />
                <Flag ok={data.filesystem.built} label="dist/index.js built" />
                <Flag ok={data.filesystem.runner_present} label="run-with-env.mjs" />
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Env (no secrets)</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                <Flag ok={data.env.supabase_url} label="Supabase URL" />
                <Flag ok={data.env.service_role_key} label="Service role key" />
                <li className="text-slate-500">MASK_PII: {data.env.mask_pii}</li>
                <li className="text-slate-500">MAX_ROWS: {data.env.max_rows}</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Shield className="h-4 w-4 text-[#004AAD]" />
              Safety notes
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {data.meta.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Terminal className="h-4 w-4 text-[#004AAD]" />
                Optional client config (copy if needed)
              </h2>
              <button
                type="button"
                onClick={() => void copyConfig()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Use only when you deliberately want an MCP host to talk to MyFNG. Not required for
              dashboard / CRM.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(data.sample_mcp_config, null, 2)}
            </pre>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600">
              {data.setup_steps.map((s) => (
                <li key={s}>
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">{s}</code>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Tools ({data.tool_count})</h2>
            {Object.entries(data.by_area).map(([area, tools]) => (
              <div
                key={area}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#023D95]">
                    {area} · {tools.length}
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {tools.map((t) => (
                    <li
                      key={t.name}
                      className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                    >
                      <code className="text-sm font-semibold text-slate-900">{t.name}</code>
                      <span className="text-xs text-slate-500 sm:text-right">{t.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400">Checked {new Date(data.checked_at).toLocaleString()}</p>
        </>
      ) : null}
    </div>
  );
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-rose-500" />
      )}
      {label}
    </li>
  );
}
