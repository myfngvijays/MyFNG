import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runMetaAdsTool } from './tools';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error: message }) }], isError: true };
}

async function wrap(name: string, params: Record<string, unknown>) {
  try {
    return ok(await runMetaAdsTool(name, params));
  } catch (e: any) {
    return fail(e?.message || `${name} failed`);
  }
}

export function createMetaAdsMcpServer() {
  const server = new McpServer({
    name: 'myfng-meta-ads',
    version: '1.0.0',
  });

  server.tool(
    'get_account_info',
    'MyFNG Meta ad account name, currency, status, spend-to-date (read-only).',
    { account_id: z.string().optional() },
    async (args) => wrap('get_account_info', args),
  );

  server.tool(
    'list_ad_accounts',
    'Ad accounts this Meta token can access.',
    { limit: z.number().int().min(1).max(100).optional() },
    async (args) => wrap('list_ad_accounts', args),
  );

  server.tool(
    'list_campaigns',
    'Campaigns on the MyFNG ad account with last-7d spend and leads.',
    {
      account_id: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_campaigns', args),
  );

  server.tool(
    'get_campaign',
    'One campaign plus last-7d insights.',
    { campaign_id: z.string() },
    async (args) => wrap('get_campaign', args),
  );

  server.tool(
    'list_adsets',
    'Ad sets under a campaign or the whole account.',
    {
      campaign_id: z.string().optional(),
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_adsets', args),
  );

  server.tool(
    'list_ads',
    'Ads under an ad set, campaign, or account.',
    {
      adset_id: z.string().optional(),
      campaign_id: z.string().optional(),
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_ads', args),
  );

  server.tool(
    'get_insights',
    'Spend, CTR, leads for account / campaign / ad set / ad.',
    {
      object_id: z.string().optional(),
      level: z.string().optional(),
      date_preset: z.string().optional(),
    },
    async (args) => wrap('get_insights', args),
  );

  server.tool(
    'get_spend_summary',
    'Today / 7d / 30d spend, clicks, leads, and CPL.',
    { account_id: z.string().optional() },
    async (args) => wrap('get_spend_summary', args),
  );

  server.tool(
    'get_funds_tracker',
    'Ad account funds: lifetime spend, balance / amount due, spend cap, remaining, payment source.',
    { account_id: z.string().optional() },
    async (args) => wrap('get_funds_tracker', args),
  );

  server.tool(
    'list_ad_transactions',
    'Recent Meta ad billing or credit transactions (if the token can read them).',
    {
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_ad_transactions', args),
  );

  server.tool(
    'list_pages',
    'Facebook / Instagram pages assigned to this Meta token (read-only).',
    { limit: z.number().int().min(1).max(100).optional() },
    async (args) => wrap('list_pages', args),
  );

  server.tool(
    'get_page',
    'One Facebook page: fans, followers, Instagram account.',
    { page_id: z.string() },
    async (args) => wrap('get_page', args),
  );

  server.tool(
    'get_page_insights',
    'Page impressions, engagements, and fans for a date preset.',
    {
      page_id: z.string(),
      date_preset: z.string().optional(),
    },
    async (args) => wrap('get_page_insights', args),
  );

  server.tool(
    'list_pixels',
    'Pixels / datasets on the MyFNG ad account.',
    { account_id: z.string().optional() },
    async (args) => wrap('list_pixels', args),
  );

  server.tool(
    'get_pixel',
    'One pixel: name, last fired time, status.',
    { pixel_id: z.string() },
    async (args) => wrap('get_pixel', args),
  );

  server.tool(
    'get_pixel_stats',
    'Pixel event counts (PageView, Lead, Purchase, …) for the last N days.',
    {
      pixel_id: z.string(),
      days: z.number().int().min(1).max(90).optional(),
    },
    async (args) => wrap('get_pixel_stats', args),
  );

  return server;
}
