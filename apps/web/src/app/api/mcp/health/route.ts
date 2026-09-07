import { mcpRuntimeStatus } from '@/lib/mcp/createMyfngMcpServer';
import { mcpCorsHeaders } from '@/lib/mcp/httpAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await mcpRuntimeStatus();
  return Response.json(status, {
    status: status.ok ? 200 : 503,
    headers: mcpCorsHeaders(),
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpCorsHeaders() });
}
