'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
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
    notes: string[];
  };
  status: 'ready' | 'needs_build' | 'missing_package' | 'missing_env';
  filesystem: {
    package_present: boolean;
    built: boolean;
    runner_present: boolean;
  };
  env: {
    supabase_url: boolean;
    service_role_key: boolean;
    mask_pii: string;
    max_rows: string;
  };
  claude?: {
    connectors_url: string;
    connector_url: string;
    this_host_url: string;
    localhost_blocked: boolean;
    header_name: string;
    header_value_prefix: string;
    has_token: boolean;
    from_env: boolean;
    hint: string;
  };
  tool_count: number;
  tools: Tool[];
  by_area: Record<string, Tool[]>;
  sample_mcp_config: unknown;
  local_stdio_config?: unknown;
  setup_steps: string[];
  checked_at: string;
};

const STATUS_UI: Record<
  Payload['status'],
  { label: string; className: string; hint: string }
> = {
  ready: {
    label: 'Ready',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    hint: 'Paste the HTTPS URL into Claude Connectors. Local file path is only for Cursor on this Mac.',
  },
  needs_build: {
    label: 'Needs build (local stdio only)',
    className: 'bg-amber-100 text-amber-900 border-amber-200',
    hint: 'Claude remote URL still works. Local Cursor stdio needs: cd packages/myfng-mcp && npm run build',
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
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

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

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1600);
  };

  const generateToken = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/myfng-mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_token' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to generate token');
      setFreshToken(String(json.token || ''));
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to generate token');
    } finally {
      setSaving(false);
    }
  };

  const status = data ? STATUS_UI[data.status] : null;
  const claude = data?.claude;
  const headerValue = freshToken ? `Bearer ${freshToken}` : '';

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
            Claude needs a <strong>public HTTPS link</strong> — not a Mac file path. That JSON with{' '}
            <code className="rounded bg-slate-100 px-1">node /Users/…</code> is only for Cursor on this computer.
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
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : null}

      {data && status && claude ? (
        <>
          <div className="rounded-2xl border-2 border-[#004AAD]/20 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#004AAD]">Claude connector link</p>
                <h2 className="mt-1 text-lg font-black text-slate-900">Paste this URL in Claude</h2>
              </div>
              <a
                href={claude.connectors_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#004AAD] px-3 py-2 text-sm font-semibold text-white hover:bg-[#023D95]"
              >
                Open Claude Connectors <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {claude.localhost_blocked ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Claude.ai Anthropic servers se is URL ko hit karta hai. <strong>localhost kaam nahi karega.</strong> Production link use karo (neeche).
              </p>
            ) : null}

            <label className="mt-4 block text-xs font-semibold text-slate-500">Remote MCP URL</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <code className="flex-1 overflow-x-auto rounded-xl bg-slate-950 px-3 py-2.5 text-sm text-emerald-300">
                {claude.connector_url}
              </code>
              <button
                type="button"
                onClick={() => void copy('url', claude.connector_url)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
              >
                <Copy className="h-4 w-4" />
                {copied === 'url' ? 'Copied' : 'Copy link'}
              </button>
            </div>

            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
              <li>
                Claude → <strong>Customize → Connectors → Add custom connector</strong> → type <strong>Web</strong>
              </li>
              <li>Name: <code className="rounded bg-slate-100 px-1">myfng</code></li>
              <li>
                URL: <code className="rounded bg-slate-100 px-1">{claude.connector_url}</code>
              </li>
              <li>
                Authentication: <strong>None</strong>. Request header <code className="rounded bg-slate-100 px-1">authorization</code> ={' '}
                <code className="rounded bg-slate-100 px-1">Bearer &lt;token&gt;</code>
              </li>
            </ol>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <KeyRound className="h-4 w-4 text-[#004AAD]" />
                  Bearer token
                </h3>
                <button
                  type="button"
                  disabled={saving || claude.from_env}
                  onClick={() => void generateToken()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {claude.has_token ? 'Rotate token' : 'Generate token'}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {claude.from_env
                  ? 'Token comes from MYFNG_MCP_TOKEN env — change it on the server, not here.'
                  : claude.has_token
                    ? `Saved (${claude.hint}). Generate again only if you lost it — old token stops working.`
                    : 'Generate once, then paste Bearer + token in Claude request headers.'}
              </p>
              {freshToken ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">Copy now — yeh dubara nahi dikhega.</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-xs text-slate-900">
                      {headerValue}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy('token', headerValue)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied === 'token' ? 'Copied' : 'Copy header value'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</p>
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}>
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
                <Flag ok={data.filesystem.built} label="dist/index.js (local stdio)" />
                <Flag ok={data.env.supabase_url && data.env.service_role_key} label="Supabase env" />
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Claude token</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                <Flag ok={claude.has_token} label={claude.has_token ? `Set ${claude.hint}` : 'Not generated'} />
                <Flag ok={!claude.localhost_blocked} label="Public HTTPS host" />
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

          <details className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <summary className="cursor-pointer text-sm font-bold text-slate-900">
              Cursor / Claude Desktop on this Mac (local file — not a link)
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Ye wahi JSON hai jo pehle dikh raha tha. Claude.ai isko use nahi karta.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-100">
              {JSON.stringify(data.local_stdio_config || data.sample_mcp_config, null, 2)}
            </pre>
            <button
              type="button"
              onClick={() =>
                void copy('json', JSON.stringify(data.sample_mcp_config, null, 2))
              }
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied === 'json' ? 'Copied' : 'Copy remote JSON (url + header)'}
            </button>
          </details>

          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Terminal className="h-4 w-4" /> Tools ({data.tool_count})
            </h2>
            {Object.entries(data.by_area).map(([area, tools]) => (
              <div key={area} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
