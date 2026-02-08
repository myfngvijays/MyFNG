/**
 * GET /api/super_admin/reports
 * Reports & analytics: operational, financial, quality, department metrics (real data)
 * Query: period=today|week|month|year
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

async function assertSuperAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, status: 401 as const, error: 'Unauthorized', user: null };
  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  if (roleError || !userData) return { ok: false, status: 403 as const, error: 'Forbidden', user: null };
  const roleCode = (userData as { roles?: { role_code: string } })?.roles?.role_code ?? null;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) return { ok: false, status: 403 as const, error: 'Forbidden', user: null };
  return { ok: true, status: 200 as const, error: null, user: null };
}

function getDateRange(period: string): { start: string } {
  const now = new Date();
  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { start: start.toISOString() };
}

function safeNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }
    const db = supabaseAdmin as any;

    const period = (request.nextUrl.searchParams.get('period') || 'month') as string;
    const { start: periodStart } = getDateRange(period);

    const [
      leadsRes,
      completedRes,
      invoicesPaidRes,
      workshopsRes,
      ratingRes,
      slaTotalRes,
      slaBreachedRes,
      complaintsRes,
      telecallerLeadsRes,
      workshopLeadsRes,
    ] = await Promise.all([
      db.from('service_leads').select('id, invoice_amount').gte('created_at', periodStart),
      db.from('service_leads').select('id').in('status', ['COMPLETED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED']).gte('completed_at', periodStart),
      db.from('invoices').select('paid_amount, final_amount').eq('payment_status', 'PAID').gte('paid_at', periodStart),
      db.from('workshops').select('id').eq('is_verified', true),
      db.from('service_leads').select('customer_satisfaction_score').gte('completed_at', periodStart).not('customer_satisfaction_score', 'is', null).limit(5000),
      db.from('service_leads').select('id').not('sla_status', 'is', null).gte('created_at', periodStart),
      db.from('service_leads').select('id').eq('sla_status', 'BREACHED').gte('created_at', periodStart),
      db.from('customer_complaints').select('id').gte('created_at', periodStart),
      db.from('service_leads').select('id, status').not('assigned_telecaller_id', 'is', null).gte('created_at', periodStart).limit(5000),
      db.from('service_leads').select('id, status').not('workshop_id', 'is', null).gte('created_at', periodStart).limit(5000),
    ]);

    let rsaList: any[] = [];
    let auditList: any[] = [];
    try {
      const [rsaRes, auditsRes] = await Promise.all([
        db.from('rsa_leads').select('id, lead_status').eq('delete_status', false).gte('lead_registered_at', periodStart).limit(5000),
        db.from('workshop_audits').select('id, score_percentage').gte('created_at', periodStart).limit(5000),
      ]);
      rsaList = rsaRes.data || [];
      auditList = auditsRes.data || [];
    } catch {
      // rsa_leads or workshop_audits may not exist
    }

    const totalLeads = (leadsRes.data || []).length;
    const completedList = completedRes.data || [];
    const convertedLeads = completedList.length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    const totalRevenue = (invoicesPaidRes.data || []).reduce(
      (s: number, inv: any) => s + safeNum(inv?.paid_amount ?? inv?.final_amount ?? 0),
      0
    );
    const avgOrderValue = convertedLeads > 0 ? totalRevenue / convertedLeads : 0;
    const activeWorkshops = (workshopsRes.data || []).length;

    const ratingValues = (ratingRes.data || []).map((r: any) => safeNum(r?.customer_satisfaction_score)).filter((n: number) => n > 0);
    const avgRating = ratingValues.length ? Math.round(avg(ratingValues) * 10) / 10 : 0;

    const slaTotal = (slaTotalRes.data || []).length;
    const slaBreached = (slaBreachedRes.data || []).length;
    const slaCompliance = slaTotal > 0 ? Math.round(((slaTotal - slaBreached) / slaTotal) * 100) : 0;

    const totalComplaints = (complaintsRes.data || []).length;

    const teleList = telecallerLeadsRes.data || [];
    const teleTotal = teleList.length;
    const teleConverted = teleList.filter((l: any) =>
      ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CLOSED'].includes(String(l?.status || '').toUpperCase())
    ).length;
    const teleScore = teleTotal > 0 ? Math.round((teleConverted / teleTotal) * 100) : 0;

    const workshopList = workshopLeadsRes.data || [];
    const workshopTotal = workshopList.length;
    const workshopConverted = workshopList.filter((l: any) =>
      ['COMPLETED', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED'].includes(String(l?.status || '').toUpperCase())
    ).length;
    const workshopScore = workshopTotal > 0 ? Math.round((workshopConverted / workshopTotal) * 100) : 0;

    const rsaTotal = rsaList.length;
    const rsaCompleted = rsaList.filter((r: any) =>
      ['completed', 'closed'].includes(String(r?.lead_status || '').toLowerCase())
    ).length;
    const rsaScore = rsaTotal > 0 ? Math.round((rsaCompleted / rsaTotal) * 100) : 0;

    const auditScores = (auditList || []).map((r: any) => safeNum(r?.score_percentage) / 10).filter((n: number) => n > 0);
    const auditorScore = auditScores.length ? Math.round(avg(auditScores) * 10) : 0;

    const leadManagerAssigned = (workshopLeadsRes.data || []).length;
    const leadManagerConverted = workshopConverted;
    const leadManagerScore = leadManagerAssigned > 0 ? Math.round((leadManagerConverted / leadManagerAssigned) * 100) : 0;

    const departments = [
      { name: 'Telecaller', leads: teleTotal, converted: teleConverted, score: teleScore },
      { name: 'Lead Manager', leads: leadManagerAssigned, converted: leadManagerConverted, score: leadManagerScore },
      { name: 'Workshops', leads: workshopTotal, converted: workshopConverted, score: workshopScore },
      { name: 'RSA', leads: rsaTotal, converted: rsaCompleted, score: rsaScore },
      { name: 'Auditors', leads: auditList.length, converted: auditList.length, score: auditorScore },
    ];

    return NextResponse.json({
      period,
      stats: {
        totalLeads,
        convertedLeads,
        conversionRate,
        totalRevenue,
        avgOrderValue,
        activeWorkshops,
        avgRating,
        slaCompliance,
        totalComplaints,
      },
      departments,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in GET /api/super_admin/reports:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
