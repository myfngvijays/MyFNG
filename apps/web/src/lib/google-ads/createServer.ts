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

export function registerGoogleAdsTools(server: McpServer, prefix = '') {
  const n = (name: string) => `${prefix}${name}`;
  const d = (desc: string) => (prefix ? `Google Ads — ${desc}` : desc);

  server.tool(n('list_accessible_customers'), d('Customer IDs this Google Ads user can access.'), {}, async () =>
    wrap('list_accessible_customers', {}),
  );

  server.tool(
    n('get_account'),
    d('MyFNG Google Ads account name, currency, timezone.'),
    { customer_id: z.string().optional() },
    async (args) => wrap('get_account', args),
  );

  server.tool(
    n('get_spend_summary'),
    d('Spend, clicks, impressions, conversions for today / 7d / 30d.'),
    { customer_id: z.string().optional() },
    async (args) => wrap('get_spend_summary', args),
  );

  server.tool(
    n('get_funds_tracker'),
    d('Account budget remaining, daily budget, billing account, period spend.'),
    { customer_id: z.string().optional() },
    async (args) => wrap('get_funds_tracker', args),
  );

  server.tool(
    n('list_campaigns'),
    d('Campaigns with spend, clicks, conversions.'),
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
    n('get_campaign'),
    d('One campaign: settings, budget, daily, ad groups, ads, keywords.'),
    {
      campaign_id: z.string(),
      during: z.string().optional(),
      customer_id: z.string().optional(),
    },
    async (args) => wrap('get_campaign', args),
  );

  server.tool(
    n('list_ad_groups'),
    d('Ad groups with spend, clicks, conversions.'),
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_ad_groups', args),
  );

  server.tool(
    n('list_ads'),
    d('Ads / RSA headlines with spend.'),
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_ads', args),
  );

  server.tool(
    n('list_keywords'),
    d('Keywords with match type, spend, and conversions.'),
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_keywords', args),
  );

  server.tool(
    n('list_search_terms'),
    d('Search terms that triggered ads.'),
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (args) => wrap('list_search_terms', args),
  );

  server.tool(
    n('list_conversions'),
    d('Conversion actions tracked + counts in the date range.'),
    {
      customer_id: z.string().optional(),
      during: z.string().optional(),
      campaign_id: z.string().optional(),
    },
    async (args) => wrap('list_conversions', args),
  );

  server.tool(
    n('generate_report'),
    d('Deep Google Ads report. Pass campaign_id for one campaign.'),
    {
      period: z.string().optional(),
      campaign_id: z.string().optional(),
      during: z.string().optional(),
    },
    async (args) => wrap('generate_report', args),
  );

  server.tool(
    n('search'),
    d('Read-only Google Ads GAQL SELECT query.'),
    {
      query: z.string(),
      customer_id: z.string().optional(),
    },
    async (args) => wrap('search', args),
  );
}

export function createGoogleAdsMcpServer() {
  const server = new McpServer({
    name: GOOGLE_ADS_MCP_META.name,
    version: GOOGLE_ADS_MCP_META.version,
  });
  registerGoogleAdsTools(server);
  return server;
}
