import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMyfngMcpServer } from '@/lib/mcp/createMyfngMcpServer';
import {
  extractMcpTokenFromRequest,
  getMcpHttpToken,
  mcpCorsHeaders,
  withCors,
} from '@/lib/mcp/httpAuth';
import { isValidMcpAccessToken, mcpUnauthorizedResponse } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handleMcp(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: mcpCorsHeaders() });
  }

  const provided = extractMcpTokenFromRequest(req);
  const expected = await getMcpHttpToken();
  const staticOk = Boolean(expected && provided && provided === expected);
  const oauthOk = provided ? await isValidMcpAccessToken(provided) : false;
  if (!staticOk && !oauthOk) {
    return mcpUnauthorizedResponse();
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
