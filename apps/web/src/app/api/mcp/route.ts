import {
  extractMcpTokenFromRequest,
  getMcpHttpToken,
  mcpCorsHeaders,
  withCors,
} from '@/lib/mcp/httpAuth';
import { handleAuthenticatedMcp } from '@/lib/mcp/httpSession';
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

  try {
    return await handleAuthenticatedMcp(req);
  } catch (e: any) {
    return withCors(
      Response.json(
        {
          error: 'MCP server failed',
          hint: e?.message || 'initialize/tools request failed',
        },
        { status: 500 },
      ),
    );
  }
}

export const GET = handleMcp;
export const POST = handleMcp;
export const DELETE = handleMcp;
export const OPTIONS = handleMcp;
