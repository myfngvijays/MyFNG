#!/usr/bin/env node
/**
 * MyFNG read-only MCP server (stdio).
 * Never writes to the database — SELECT / head counts only.
 * Claude.ai uses the HTTPS endpoint at /api/mcp instead of this process.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMyfngMcpServer } from './createServer.js';

async function main() {
  const server = createMyfngMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[myfng-mcp]', err);
  process.exit(1);
});
