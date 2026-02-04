import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

function safeExtFromName(name: string) {
  const ext = (name || 'jpg').split('.').pop() || 'jpg';
  const e = ext.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  return e || 'jpg';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    // If RSA_MANAGER, allow upload only if lead is assigned to them
    if (roleCode === 'RSA_MANAGER') {
      const { data: leadRow, error: leadErr } = await (supabaseAdmin as any)
        .from('rsa_leads')
        .select('id, assigned_manager_id')
        .eq('id', leadId)
        .single();
      if (leadErr) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      if (String(leadRow?.assigned_manager_id || '') !== String(user.id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const fd = await request.formData();
    const mediaFiles = (fd.getAll('media') || []).filter(Boolean) as File[];

    if (mediaFiles.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    if (mediaFiles.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} images allowed` }, { status: 400 });
    }

    for (const f of mediaFiles) {
      if (!f || typeof (f as any).arrayBuffer !== 'function') continue;
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${f.name}. Max 10MB` }, { status: 413 });
      }
      const mime = String(f.type || '').toLowerCase();
      if (!mime.startsWith('image/')) {
        return NextResponse.json({ error: `Only image files allowed: ${f.name}` }, { status: 400 });
      }
    }

    const urls: string[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const ext = safeExtFromName(file.name);
      const filePath = `rsa-complaints/${leadId}/manager/${Date.now()}_${i + 1}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await (supabaseAdmin as any).storage.from('service-media').upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (uploadError) {
        return NextResponse.json({ error: 'Failed to upload media', details: uploadError.message, file: file.name }, { status: 500 });
      }

      const { data: publicUrlData } = (supabaseAdmin as any).storage.from('service-media').getPublicUrl(filePath);
      if (publicUrlData?.publicUrl) urls.push(publicUrlData.publicUrl);
    }

    // Append to existing media_upload
    const { data: existingLead, error: exErr } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .select('id, media_upload')
      .eq('id', leadId)
      .single();
    if (exErr) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const existing = Array.isArray(existingLead?.media_upload) ? existingLead.media_upload : [];
    const nextMedia = [...existing, ...urls];

    const { error: upErr } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .update({ media_upload: nextMedia, updated_at: now } as any)
      .eq('id', leadId);
    if (upErr) return NextResponse.json({ error: 'Failed to attach media', details: upErr.message }, { status: 500 });

    // Best-effort timeline
    try {
      await (supabaseAdmin as any)
        .from('rsa_lead_timeline')
        .insert({
          lead_id: leadId,
          status: 'media_added',
          status_description: `Added ${urls.length} media file(s)`,
          updated_by_id: user.id,
          updated_by_name: String((userProfile as any)?.full_name || (userProfile as any)?.name || user.email || '').trim() || null,
          updated_at: now,
          created_at: now,
        });
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, urls, media_upload: nextMedia }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

