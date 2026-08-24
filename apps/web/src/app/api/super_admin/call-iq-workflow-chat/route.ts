import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { ALL_CRM_LEAD_STATUS_NAMES, defaultCallIqNamedWorkflow } from '@/lib/telecaller/salesPlaybookDefaults';
import { applyWorkflowChat } from '@/lib/telecaller/callIqWorkflowChat';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertEditor(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile?.roles as any)?.role_code || '')
    .trim()
    .toUpperCase();
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  const auth = await assertEditor(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || '').trim();
  if (!message) return NextResponse.json({ error: 'Type what flow you want' }, { status: 400 });
  const crmStatuses = Array.isArray(body.crm_statuses) && body.crm_statuses.length
    ? body.crm_statuses.map(String)
    : [...ALL_CRM_LEAD_STATUS_NAMES];
  const workflow = defaultCallIqNamedWorkflow(body.workflow || {});
  const history = Array.isArray(body.history)
    ? body.history
        .filter((m: any) => m?.role === 'user' || m?.role === 'assistant')
        .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content || '') }))
    : [];
  const result = await applyWorkflowChat({ message, workflow, crmStatuses, history });
  return NextResponse.json({ success: true, ...result });
}
