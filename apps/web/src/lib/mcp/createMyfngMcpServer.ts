import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Load the Cursor MCP factory at runtime.
 * Do not statically import packages/myfng-mcp/src — Turbopack cannot resolve
 * its NodeNext `.js` imports or the SDK from that folder.
 */
export async function createMyfngMcpServer() {
  const cwd = process.cwd();
  const candidates = [
    join(cwd, 'packages/myfng-mcp/dist/createServer.js'),
    join(cwd, '../packages/myfng-mcp/dist/createServer.js'),
    join(cwd, '../../packages/myfng-mcp/dist/createServer.js'),
    join(cwd, '../../../packages/myfng-mcp/dist/createServer.js'),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'MyFNG MCP is not built. On the server run: cd packages/myfng-mcp && npm install && npm run build',
    );
  }
  const mod = await import(pathToFileURL(found).href);
  if (typeof mod.createMyfngMcpServer !== 'function') {
    throw new Error('MyFNG MCP dist is missing createMyfngMcpServer');
  }
  return mod.createMyfngMcpServer();
}
