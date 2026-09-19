import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { GOOGLE_ADS_MCP_META, runGoogleAdsTool } from './tools';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: message }) }], isError: true };
}

async function wrap(name: string, params: Record<string, unknown>) {
  try {
    return ok(await runGoogleAdsTool(name, params));
  } catch (e: any) {
    return fail(e?.message || `${name} failed`);
  }
}

export function createGoogleAdsMcpServer() {
  const server = new McpServer({
    name: GOOGLE_ADS_MCP_META.name,
    version: GOOGLE_ADS_MCP_META.version,
  });

  server.tool(
    'list_accessible_customers',
    'Customer IDs this Google Ads user can access.',
    {},
    async () => wrap('list_accessible_customers', {}),
  );

  server.tool(
    'get_account',
    'MyFNG Google Ads account name, currency, timezone.',
    { customer_id: z.string().optional() },
    async (args) => wrap('get_account', args),
  );

  server.tool(
    'get_spend_summary',
    'Spend, clicks, impressions, conversions for today / 7d / 30d.',
    { customer_id: z.string().optional() },
    async (args) => wrap('get_spend_summary', args),
  );

  server.tool(
    'list_campaigns',
    'Campaigns with spend, clicks, conversions.',
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      q: z.string().optional(),
      status: z.string().optional(),
      channel: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_campaigns', args),
  );

  server.tool(
    'list_ad_groups',
    'Ad groups with spend, clicks, conversions.',
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_ad_groups', args),
  );

  server.tool(
    'list_ads',
    'Ads / RSA headlines with spend.',
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_ads', args),
  );

  server.tool(
    'list_keywords',
    'Keywords with match type and spend.',
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_keywords', args),
  );

  server.tool(
    'list_search_terms',
    'Search terms that triggered ads.',
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_search_terms', args),
  );

  server.tool(
    'search',
    'Read-only Google Ads GAQL SELECT query.',
    {
      query: z.string(),
      customer_id: z.string().optional(),
    },
    async (args) => wrap('search', args),
  );

  return server;
}
