import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerGoogleAdsTools } from '../google-ads/createServer';
import { registerMetaAdsTools } from '../meta-ads/createServer';

/**
 * Load the Cursor MCP factory at runtime.
 * Do not statically import packages/myfng-mcp/src — Turbopack cannot resolve
 * its NodeNext `.js` imports or the SDK from that folder.
 */
let cachedFactory: ((...args: any[]) => any) | null = null;

function nativeImport(specifier: string) {
  return (new Function('specifier', 'return import(specifier)'))(specifier);
}

function collectCreateServers(): string[] {
  const hits: string[] = [];
  if (process.env.MYFNG_MCP_DIST) hits.push(process.env.MYFNG_MCP_DIST);
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    hits.push(join(dir, 'packages/myfng-mcp/dist/createServer.js'));
    hits.push(join(dir, 'node_modules/@myfng/mcp/dist/createServer.js'));
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return [...new Set(hits.filter((p) => p && existsSync(p)))];
}

function mcpPkgRoot(distFile: string): string {
  return join(dirname(distFile), '..');
}

function hasLocalDep(distFile: string, name: string): boolean {
  let dir = dirname(distFile);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'node_modules', name, 'package.json'))) return true;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

function findNodeModulesWith(name: string): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const nm = join(dir, 'node_modules');
    if (existsSync(join(nm, name, 'package.json'))) return nm;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return '';
}

function linkDep(pkgRoot: string, name: string, seen: Set<string>) {
  if (seen.has(name) || name.startsWith('.')) return;
  seen.add(name);
  const dest = join(pkgRoot, 'node_modules', name);
  if (!existsSync(join(dest, 'package.json'))) {
    const srcNm = findNodeModulesWith(name);
    if (!srcNm) return;
    const src = join(srcNm, name);
    mkdirSync(dirname(dest), { recursive: true });
    try {
      symlinkSync(src, dest);
    } catch {
      cpSync(src, dest, { recursive: true });
    }
  }
  try {
    const json = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'));
    for (const dep of Object.keys(json.dependencies || {})) {
      linkDep(pkgRoot, dep, seen);
    }
  } catch {
    /* ignore */
  }
}

function ensureToolDeps(distFile: string) {
  const pkgRoot = mcpPkgRoot(distFile);
  const seen = new Set<string>();
  linkDep(pkgRoot, 'zod', seen);
  linkDep(pkgRoot, '@supabase/supabase-js', seen);
}

function findMcpCreateServer(): string {
  const hits = collectCreateServers();
  return hits.find((p) => hasLocalDep(p, 'zod')) || hits[0] || '';
}

export async function createMyfngMcpServer() {
  if (!cachedFactory) {
    const found = findMcpCreateServer();
    if (!found) {
      throw new Error(
        `MyFNG MCP dist not found from cwd=${process.cwd()}. Run: cd packages/myfng-mcp && npm install && npm run build`,
      );
    }
    ensureToolDeps(found);

    try {
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      const toolsFile = join(dirname(found), 'tools/index.js');
      if (existsSync(toolsFile)) {
        const tools = await nativeImport(pathToFileURL(toolsFile).href);
        if (typeof tools.registerAllTools === 'function') {
          cachedFactory = () => {
            const server = new McpServer({
              name: 'myfng-readonly',
              version: '1.0.0',
            });
            tools.registerAllTools(server);
            return server;
          };
        }
      }
    } catch {
      cachedFactory = null;
    }

    if (!cachedFactory) {
      const mod = await nativeImport(pathToFileURL(found).href);
      if (typeof mod.createMyfngMcpServer !== 'function') {
        throw new Error('MyFNG MCP dist is missing createMyfngMcpServer');
      }
      cachedFactory = mod.createMyfngMcpServer;
    }

    const baseFactory = cachedFactory;
    cachedFactory = () => {
      const server = baseFactory();
      try {
        registerMetaAdsTools(server, 'meta_');
        registerGoogleAdsTools(server, 'google_');
      } catch {
        /* Ads tools optional if a handler fails to register */
      }
      return server;
    };
  }
  return cachedFactory();
}

export async function mcpRuntimeStatus() {
  const found = findMcpCreateServer();
  try {
    if (found) ensureToolDeps(found);
    await createMyfngMcpServer();
    return { ok: true, dist_found: Boolean(found) };
  } catch (e: any) {
    return {
      ok: false,
      dist_found: Boolean(found),
      error: e?.message || String(e),
    };
  }
}
