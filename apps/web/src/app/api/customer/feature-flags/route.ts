import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;

  const { data: flags } = await supabaseAdmin
    .from('feature_flags')
    .select('flag_key, enabled, rollout_percent, config');

  const assigned: Record<string, boolean> = {};
  for (const f of flags || []) {
    const hashInput = `${customer.id}:${f.flag_key}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) hash = (hash * 31 + hashInput.charCodeAt(i)) % 1000;
    const bucket = hash % 100;
    assigned[f.flag_key] = Boolean(f.enabled) && bucket < Number(f.rollout_percent || 0);
  }

  return NextResponse.json({ flags: assigned, raw: flags || [] });
}

