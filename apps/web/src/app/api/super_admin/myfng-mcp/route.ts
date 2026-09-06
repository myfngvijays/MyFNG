import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import {
  MYFNG_MCP_AREAS,
  MYFNG_MCP_META,
  MYFNG_MCP_TOOLS,
} from '@/lib/admin/myfng-mcp-catalog';
import {
  CLAUDE_CONNECTORS_URL,
  MCP_PUBLIC_ORIGIN,
  mcpTokenStatus,
  saveMcpHttpToken,
} from '@/lib/mcp/httpAuth';

export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('id, role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: String((userProfile as any)?.id || user.id) };
}

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, 'packages', 'myfng-mcp', 'package.json'))) return cwd;
  if (existsSync(join(cwd, '..', '..', 'packages', 'myfng-mcp', 'package.json'))) {
    return join(cwd, '..', '..');
  }
  if (existsSync(join(cwd, '..', 'packages', 'myfng-mcp', 'package.json'))) {
    return join(cwd, '..');
  }
  return cwd;
}

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return MCP_PUBLIC_ORIGIN;
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const root = resolveRepoRoot();
    const pkgDir = join(root, 'packages', 'myfng-mcp');
    const packageJson = join(pkgDir, 'package.json');
    const distEntry = join(pkgDir, 'dist', 'index.js');
    const runner = join(pkgDir, 'scripts', 'run-with-env.mjs');
    const readme = join(pkgDir, 'README.md');

    const hasUrl = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);

    const packagePresent = existsSync(packageJson);
    const built = existsSync(distEntry);
    const runnerPresent = existsSync(runner);

    let status: 'ready' | 'needs_build' | 'missing_package' | 'missing_env' = 'ready';
    if (!packagePresent) status = 'missing_package';
    else if (!hasUrl || !hasKey) status = 'missing_env';
    else if (!built) status = 'needs_build';

    const absRunner = runnerPresent ? runner : null;
    const absDist = built ? distEntry : null;
    const origin = requestOrigin(request);
    const productionUrl = `${MCP_PUBLIC_ORIGIN}/api/mcp`;
    const thisHostUrl = `${origin}/api/mcp`;
    const tokenInfo = await mcpTokenStatus();

    const byArea = Object.fromEntries(
      MYFNG_MCP_AREAS.map((area) => [area, MYFNG_MCP_TOOLS.filter((t) => t.area === area)]),
    );

    return NextResponse.json({
      ok: true,
      meta: MYFNG_MCP_META,
      status,
      filesystem: {
        repo_root: root,
        package_dir: pkgDir,
        package_present: packagePresent,
        built,
        runner_present: runnerPresent,
        readme_present: existsSync(readme),
        dist_entry: absDist,
        runner_entry: absRunner,
      },
      env: {
        supabase_url: hasUrl,
        service_role_key: hasKey,
        mask_pii: process.env.MYFNG_MCP_MASK_PII ?? 'true (default)',
        max_rows: process.env.MYFNG_MCP_MAX_ROWS ?? '50 (default)',
      },
      claude: {
        connectors_url: CLAUDE_CONNECTORS_URL,
        connector_url: productionUrl,
        this_host_url: thisHostUrl,
        localhost_blocked: /localhost|127\.0\.0\.1/i.test(origin),
        auth: 'oauth_cimd',
        header_name: 'authorization',
        header_value_prefix: 'Bearer ',
        oauth_authorize_url: `${MCP_PUBLIC_ORIGIN}/api/mcp/oauth/authorize`,
        oauth_metadata_url: `${MCP_PUBLIC_ORIGIN}/.well-known/oauth-authorization-server`,
        ...tokenInfo,
      },
      sample_mcp_config: {
        mcpServers: {
          myfng: {
            url: productionUrl,
            headers: {
              Authorization: 'Bearer <paste token from this page>',
            },
          },
        },
      },
      local_stdio_config: {
        mcpServers: {
          myfng: {
            command: 'node',
            args: [absRunner || absDist || MYFNG_MCP_META.entryDev],
          },
        },
      },
      tool_count: MYFNG_MCP_TOOLS.length,
      tools: MYFNG_MCP_TOOLS,
      by_area: byArea,
      setup_steps: [
        `Claude → Customize → Connectors → Add custom connector → Web → paste ${productionUrl}`,
        'Authentication: Always required (Detected). OAuth client: Anthropic hosted client metadata',
        'Add, then Connect. Sign in as Super Admin and Approve',
        'Optional: generate a Bearer token on this page for Cursor / Claude Code headers',
      ],
      checked_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'generate_token') {
      const token = randomBytes(32).toString('hex');
      await saveMcpHttpToken(token, gate.userId);
      const status = await mcpTokenStatus();
      return NextResponse.json({
        success: true,
        token,
        ...status,
        note: 'Copy this token now. Claude header value: Bearer ' + token,
      });
    }

    if (action === 'save_token') {
      const token = String(body?.token || '').trim();
      if (token.length < 16) {
        return NextResponse.json({ error: 'Token must be at least 16 characters' }, { status: 400 });
      }
      await saveMcpHttpToken(token, gate.userId);
      const status = await mcpTokenStatus();
      return NextResponse.json({ success: true, ...status });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
