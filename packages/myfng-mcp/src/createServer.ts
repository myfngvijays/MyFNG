import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tools/index.js';

export function createMyfngMcpServer() {
  const server = new McpServer({
    name: 'myfng-readonly',
    version: '1.0.0',
  });
  registerAllTools(server);
  return server;
}
