import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMyfngMcpServer } from '@/lib/mcp/createMyfngMcpServer';
import {
  extractMcpTokenFromRequest,
  getMcpHttpToken,
  mcpCorsHeaders,
  withCors,
} from '@/lib/mcp/httpAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handleMcp(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: mcpCorsHeaders() });
  }

  const expected = await getMcpHttpToken();
  if (!expected) {
    return withCors(
      Response.json(
        {
          error: 'MCP token not configured',
          hint: 'Super Admin → MyFNG MCP → Generate Claude token (or set MYFNG_MCP_TOKEN).',
        },
        { status: 503 },
      ),
    );
  }

  const provided = extractMcpTokenFromRequest(req);
  if (provided !== expected) {
    return withCors(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer',
        },
      }),
    );
  }

  const server = await createMyfngMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const res = await transport.handleRequest(req);
  return withCors(res);
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
export const OPTIONS = handleMcp;
