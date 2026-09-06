import { authorizationServerMetadata, oauthCorsHeaders, oauthJson } from '@/lib/mcp/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return oauthJson(authorizationServerMetadata(), 200, {
    'Cache-Control': 'public, max-age=60',
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: oauthCorsHeaders() });
}
