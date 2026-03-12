import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ROLE_CODES = ['SUPER_ADMIN', 'SUB_ADMIN', 'RSA_MANAGER', 'TELECALLER'];
const ASSIGNABLE_ROLE_CODES = ['SUPER_ADMIN', 'SUB_ADMIN', 'RSA_MANAGER', 'TELECALLER', 'CUSTOMER_SERVICE_EXECUTIVE'];

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('91') ? digits : `91${digits}`;
}

async function resolveUserProfile(db: any, user: any) {
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await db.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await db.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await db.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };
  return byEmail || byPhone || byId;
}

function userDisplayName(user: any): string {
  return String(user?.full_name || user?.email || user?.phone || user?.id || 'Unknown');
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(db, user);
    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = String(userProfile?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const normalizedPhone = normalizePhone(String(request.nextUrl.searchParams.get('phone') || ''));
    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }

    const { data: employeesRaw, error: employeesError } = await db
      .from('users_login')
      .select('id, full_name, email, phone, roles!inner(role_code)')
      .limit(300);
    if (employeesError) {
      return NextResponse.json({ error: employeesError.message || 'Failed to load employees' }, { status: 500 });
    }
    const employees = (employeesRaw || [])
      .map((row: any) => {
        const role = String(row?.roles?.role_code || '').toUpperCase();
        if (!ASSIGNABLE_ROLE_CODES.includes(role)) return null;
        return {
          id: String(row.id),
          full_name: String(row.full_name || '').trim() || null,
          email: String(row.email || '').trim() || null,
          phone: String(row.phone || '').trim() || null,
          role_code: role,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) =>
        String(a.full_name || a.email || a.phone || '').localeCompare(String(b.full_name || b.email || b.phone || ''))
      );

    const { data: assignmentRow, error: assignmentError } = await db
      .from('whatsapp_chat_assignments')
      .select('phone, assigned_to_ids, assigned_by, assigned_note, assigned_at, updated_at')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message || 'Failed to load chat assignment' }, { status: 500 });
    }

    let assignment: any = null;
    if (assignmentRow) {
      const assignedToIds = Array.isArray(assignmentRow.assigned_to_ids)
        ? assignmentRow.assigned_to_ids.map((id: any) => String(id || '').trim()).filter(Boolean)
        : [];
      const userIds = [...assignedToIds, assignmentRow.assigned_by].filter(Boolean);
      const usersById = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: users } = await db
          .from('users_login')
          .select('id, full_name, email, phone')
          .in('id', userIds);
        for (const row of users || []) usersById.set(String(row.id), row);
      }
      const assignees = assignedToIds
        .map((id: string) => usersById.get(String(id)))
        .filter(Boolean);
      const assigner = assignmentRow.assigned_by ? usersById.get(String(assignmentRow.assigned_by)) : null;
      assignment = {
        phone: String(assignmentRow.phone || normalizedPhone),
        assigned_to_ids: assignedToIds,
        assigned_to_names: assignees.map((row: any) => userDisplayName(row)),
        assigned_by: assignmentRow.assigned_by ? String(assignmentRow.assigned_by) : null,
        assigned_by_name: assigner ? userDisplayName(assigner) : null,
        assigned_note: String(assignmentRow.assigned_note || '').trim() || null,
        assigned_at: assignmentRow.assigned_at || null,
        updated_at: assignmentRow.updated_at || null,
      };
    }

    return NextResponse.json({
      success: true,
      phone: normalizedPhone,
      employees,
      assignment,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(db, user);
    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    const roleCode = String(userProfile?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const normalizedPhone = normalizePhone(String(body?.phone || ''));
    const assignedToIdsRaw = Array.isArray(body?.assigned_to_ids) ? body.assigned_to_ids : [];
    const assignedToIds = Array.from(
      new Set(
        assignedToIdsRaw
          .map((value: any) => String(value || '').trim())
          .filter(Boolean)
      )
    );
    const assignedNote = String(body?.assigned_note || '').trim() || null;

    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }

    if (assignedToIds.length > 2) {
      return NextResponse.json({ error: 'At most 2 assignees are allowed per chat' }, { status: 400 });
    }

    if (assignedToIds.length > 0) {
      const { data: assignees, error: assigneesError } = await db
        .from('users_login')
        .select('id, roles!inner(role_code)')
        .in('id', assignedToIds);
      if (assigneesError) {
        return NextResponse.json({ error: assigneesError.message || 'Failed to validate assignees' }, { status: 500 });
      }
      const assigneeRows = assignees || [];
      if (assigneeRows.length !== assignedToIds.length) {
        return NextResponse.json({ error: 'One or more selected employees were not found' }, { status: 404 });
      }
      for (const assignee of assigneeRows) {
        const assigneeRole = String((assignee as any)?.roles?.role_code || '').toUpperCase();
        if (!ASSIGNABLE_ROLE_CODES.includes(assigneeRole)) {
          return NextResponse.json({ error: 'Selected user is not assignable' }, { status: 400 });
        }
      }
    }

    const nowIso = new Date().toISOString();
    const payload = {
      phone: normalizedPhone,
      assigned_to_ids: assignedToIds,
      assigned_by: userProfile.id,
      assigned_note: assignedNote,
      assigned_at: nowIso,
      updated_at: nowIso,
    };
    const { error: upsertError } = await db
      .from('whatsapp_chat_assignments')
      .upsert(payload, { onConflict: 'phone' });
    if (upsertError) {
      return NextResponse.json({ error: upsertError.message || 'Failed to save assignment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      phone: normalizedPhone,
      assigned_to_ids: assignedToIds,
      assigned_note: assignedNote,
      assigned_at: nowIso,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
