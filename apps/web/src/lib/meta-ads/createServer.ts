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

export function registerMetaAdsTools(server: McpServer, prefix = '') {
  const n = (name: string) => `${prefix}${name}`;
  const d = (desc: string) => (prefix ? `Meta Ads — ${desc}` : desc);

  server.tool(
    n('get_account_info'),
    d('MyFNG Meta ad account name, currency, status, spend-to-date (read-only).'),
    { account_id: z.string().optional() },
    async (args) => wrap('get_account_info', args),
  );

  server.tool(
    n('list_ad_accounts'),
    d('Ad accounts this Meta token can access.'),
    { limit: z.number().int().min(1).max(100).optional() },
    async (args) => wrap('list_ad_accounts', args),
  );

  server.tool(
    n('list_campaigns'),
    d('Campaigns on the MyFNG ad account with last-7d spend and leads.'),
    {
      account_id: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_campaigns', args),
  );

  server.tool(
    n('get_campaign'),
    d('One campaign plus last-7d insights.'),
    { campaign_id: z.string() },
    async (args) => wrap('get_campaign', args),
  );

  server.tool(
    n('list_adsets'),
    d('Ad sets under a campaign or the whole account.'),
    {
      campaign_id: z.string().optional(),
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_adsets', args),
  );

  server.tool(
    n('list_ads'),
    d('Ads under an ad set, campaign, or account.'),
    {
      adset_id: z.string().optional(),
      campaign_id: z.string().optional(),
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_ads', args),
  );

  server.tool(
    n('get_insights'),
    d('Spend, CTR, leads for account / campaign / ad set / ad.'),
    {
      object_id: z.string().optional(),
      level: z.string().optional(),
      date_preset: z.string().optional(),
    },
    async (args) => wrap('get_insights', args),
  );

  server.tool(
    n('get_insights_breakdown'),
    d('Campaign results broken down by placement, age/gender, or device.'),
    {
      object_id: z.string().optional(),
      level: z.string().optional(),
      date_preset: z.string().optional(),
      breakdowns: z.string().optional(),
    },
    async (args) => wrap('get_insights_breakdown', args),
  );

  server.tool(
    n('get_spend_summary'),
    d('Today / 7d / 30d spend, clicks, leads, and CPL.'),
    { account_id: z.string().optional() },
    async (args) => wrap('get_spend_summary', args),
  );

  server.tool(
    n('get_funds_tracker'),
    d('Ad account funds: lifetime spend, balance / amount due, spend cap, remaining, payment source.'),
    { account_id: z.string().optional() },
    async (args) => wrap('get_funds_tracker', args),
  );

  server.tool(
    n('list_ad_transactions'),
    d('Recent Meta ad billing or credit transactions (if the token can read them).'),
    {
      account_id: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (args) => wrap('list_ad_transactions', args),
  );

  server.tool(
    n('list_pages'),
    d('Facebook / Instagram pages assigned to this Meta token (read-only).'),
    { limit: z.number().int().min(1).max(100).optional() },
    async (args) => wrap('list_pages', args),
  );

  server.tool(
    n('get_page'),
    d('One Facebook page: fans, followers, Instagram account.'),
    { page_id: z.string() },
    async (args) => wrap('get_page', args),
  );

  server.tool(
    n('get_page_insights'),
    d('Page impressions, engagements, and fans for a date preset.'),
    {
      page_id: z.string(),
      date_preset: z.string().optional(),
    },
    async (args) => wrap('get_page_insights', args),
  );

  server.tool(
    n('list_pixels'),
    d('Pixels / datasets on the MyFNG ad account.'),
    { account_id: z.string().optional() },
    async (args) => wrap('list_pixels', args),
  );

  server.tool(
    n('get_pixel'),
    d('One pixel: name, last fired time, status.'),
    { pixel_id: z.string() },
    async (args) => wrap('get_pixel', args),
  );

  server.tool(
    n('get_pixel_stats'),
    d('Pixel event counts (PageView, Lead, Purchase, …) for the last N days.'),
    {
      pixel_id: z.string(),
      days: z.number().int().min(1).max(90).optional(),
    },
    async (args) => wrap('get_pixel_stats', args),
  );
}

export function createMetaAdsMcpServer() {
  const server = new McpServer({
    name: 'myfng-meta-ads',
    version: '1.0.0',
  });
  registerMetaAdsTools(server);
  return server;
}
