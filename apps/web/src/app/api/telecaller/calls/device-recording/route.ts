import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { normalizePhone10 } from '@/lib/telecaller/initiateClickToCall';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
const AUDIO = new Set(['mp3', 'm4a', 'amr', 'wav', 'aac', '3gp', 'ogg', 'mp4']);

function last10(raw: unknown) {
  return normalizePhone10(raw) || '';
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '')
      .trim()
      .toUpperCase();
    if (!ALLOWED.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const telecallerId = String((profile as { id?: string } | null)?.id || '').trim();
    if (!telecallerId) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get('file');
    const phone = last10(form.get('phone'));
    const recordedAt = Number(form.get('recorded_at') || 0);
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Recording file missing' }, { status: 400 });
    }
    const ext = String(file.name || '').split('.').pop()?.toLowerCase() || '';
    if (!AUDIO.has(ext)) {
      return NextResponse.json({ status: 'skipped', reason: 'not_audio' });
    }
    if (phone.length < 10) {
      return NextResponse.json({ status: 'skipped', reason: 'no_phone' });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Upload is not configured' }, { status: 500 });
    }
    const admin = supabaseAdmin as any;

    const { data: logs } = await admin
      .from('telecaller_call_logs')
      .select('id, lead_id, phone_number, created_at, call_recording_url')
      .eq('telecaller_id', telecallerId)
      .order('created_at', { ascending: false })
      .limit(80);

    type LogRow = {
      id: string;
      lead_id?: string | null;
      phone_number?: string | null;
      created_at: string;
      call_recording_url?: string | null;
    };
    const open = ((logs || []) as LogRow[]).filter((row) => {
      if (String(row.call_recording_url || '').trim()) return false;
      return last10(row.phone_number) === phone;
    });

    let match: LogRow | null = open[0] || null;
    if (open.length > 1 && recordedAt > 0) {
      match = open.reduce((best, row) => {
        const delta = Math.abs(new Date(row.created_at).getTime() - recordedAt);
        const bestDelta = Math.abs(new Date(best.created_at).getTime() - recordedAt);
        return delta < bestDelta ? row : best;
      });
    }

    if (match && recordedAt > 0 && open.length !== 1) {
      const delta = Math.abs(new Date(match.created_at).getTime() - recordedAt);
      if (delta > 12 * 60 * 60 * 1000) match = null;
    }

    if (!match?.id) {
      return NextResponse.json({ status: 'no_match', phone });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ status: 'skipped', reason: 'too_large' });
    }

    const filePath = `call-recordings/${telecallerId}/${match.id}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || (ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4');
    const { error: uploadError } = await admin.storage.from('service-media').upload(filePath, buffer, {
      contentType,
      upsert: true,
    });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
    const publicUrl = admin.storage.from('service-media').getPublicUrl(filePath).data.publicUrl;
    if (!publicUrl) {
      return NextResponse.json({ error: 'Could not save recording' }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from('telecaller_call_logs')
      .update({ call_recording_url: publicUrl })
      .eq('id', match.id)
      .eq('telecaller_id', telecallerId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'attached',
      call_log_id: match.id,
      lead_id: match.lead_id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
