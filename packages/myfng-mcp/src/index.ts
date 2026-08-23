#!/usr/bin/env node
/**
 * MyFNG read-only MCP server (stdio).
 * Never writes to the database — SELECT / head counts only.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools } from './tools/index.js';

async function main() {
  const server = new McpServer({
    name: 'myfng-readonly',
    version: '1.0.0',
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('[myfng-mcp]', err);
  process.exit(1);
});
