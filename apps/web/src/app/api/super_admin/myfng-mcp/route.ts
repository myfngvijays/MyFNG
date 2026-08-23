import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import {
  MYFNG_MCP_AREAS,
  MYFNG_MCP_META,
  MYFNG_MCP_TOOLS,
} from '@/lib/admin/myfng-mcp-catalog';

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
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

function resolveRepoRoot(): string {
  // Next usually runs with cwd = apps/web
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

    const hasUrl = Boolean(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
    const hasKey = Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    );

    const packagePresent = existsSync(packageJson);
    const built = existsSync(distEntry);
    const runnerPresent = existsSync(runner);

    let status: 'ready' | 'needs_build' | 'missing_package' | 'missing_env' = 'ready';
    if (!packagePresent) status = 'missing_package';
    else if (!hasUrl || !hasKey) status = 'missing_env';
    else if (!built) status = 'needs_build';

    const absRunner = runnerPresent ? runner : null;
    const absDist = built ? distEntry : null;

    const sampleConfig = {
      mcpServers: {
        myfng: {
          command: 'node',
          args: [absRunner || absDist || MYFNG_MCP_META.entryDev],
        },
      },
    };

    const byArea = Object.fromEntries(
      MYFNG_MCP_AREAS.map((area) => [
        area,
        MYFNG_MCP_TOOLS.filter((t) => t.area === area),
      ]),
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
      tool_count: MYFNG_MCP_TOOLS.length,
      tools: MYFNG_MCP_TOOLS,
      by_area: byArea,
      sample_mcp_config: sampleConfig,
      setup_steps: [
        'cd packages/myfng-mcp && npm install && npm run build',
        'Ensure apps/web/.env.local has SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY',
        'Point any MCP host at scripts/run-with-env.mjs (loads .env.local) — optional; not required for MyFNG web',
      ],
      checked_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
