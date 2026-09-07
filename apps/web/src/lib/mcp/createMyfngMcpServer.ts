import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Load the Cursor MCP factory at runtime.
 * Do not statically import packages/myfng-mcp/src — Turbopack cannot resolve
 * its NodeNext `.js` imports or the SDK from that folder.
 */
let cachedFactory: ((...args: any[]) => any) | null = null;

function nativeImport(specifier: string) {
  // Next/Turbopack refuses import(variable). Node must load the MCP dist itself.
  return (new Function('specifier', 'return import(specifier)'))(specifier);
}

function findMcpCreateServer(): string {
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
  return hits.find((p) => p && existsSync(p)) || '';
}

export async function createMyfngMcpServer() {
  if (!cachedFactory) {
    const found = findMcpCreateServer();
    if (!found) {
      throw new Error(
        `MyFNG MCP dist not found from cwd=${process.cwd()}. Run: cd packages/myfng-mcp && npm install && npm run build`,
      );
    }
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
  }
  return cachedFactory();
}

export async function mcpRuntimeStatus() {
  try {
    const found = findMcpCreateServer();
    await createMyfngMcpServer();
    return { ok: true, dist_found: Boolean(found) };
  } catch (e: any) {
    return {
      ok: false,
      dist_found: Boolean(findMcpCreateServer()),
      error: e?.message || String(e),
    };
  }
}
