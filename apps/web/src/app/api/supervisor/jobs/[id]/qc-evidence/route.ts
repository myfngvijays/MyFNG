import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

type Media = {
  id: string;
  url: string;
  label: string;
  isVideo: boolean;
};

function toMedia(row: any): Media | null {
  const url = String(row?.photo_url || row?.file_url || row?.media_url || '').trim();
  if (!url) return null;
  const type = String(row?.photo_type || row?.category || row?.media_category || '').toUpperCase();
  const cat = String(row?.photo_category || row?.media_category || row?.category || '').toLowerCase();
  const isVideo =
    type.startsWith('AFTER_VIDEO') ||
    type.includes('VIDEO') ||
    /\.(mp4|mov|m4v|webm|3gp)(\?|$)/i.test(url);
  return {
    id: String(row?.id || url),
    url,
    label: type || cat || 'PHOTO',
    isVideo,
  };
}

function extraWorkIdFromRow(row: any): string {
  const type = String(row?.photo_type || '').toUpperCase();
  if (type.startsWith('EXTRA_WORK-')) return type.slice('EXTRA_WORK-'.length).trim();
  return String(row?.notes || '').trim();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, role_id, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const profile = byEmail || byPhone || byId;
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = String((profile as any)?.roles?.role_code || '');
    if (!['WORKSHOP_SUPERVISOR', 'WORKSHOP_ADMIN', 'SUPER_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const reader = supabaseAdmin || supabase;

    const { data: lead, error: leadError } = await reader
      .from('service_leads')
      .select('id, workshop_id, lead_number')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (roleCode !== 'SUPER_ADMIN' && profile.workshop_id && lead.workshop_id !== profile.workshop_id) {
      return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
    }

    const { data: mechJobs } = await reader
      .from('mechanic_jobs')
      .select('id')
      .eq('lead_id', leadId);

    const jobIds = (mechJobs || []).map((row: any) => row.id).filter(Boolean);

    const photoQueries = [
      reader.from('mechanic_job_photos').select('*').eq('lead_id', leadId),
    ];
    if (jobIds.length) {
      photoQueries.push(reader.from('mechanic_job_photos').select('*').in('job_id', jobIds));
    }

    const [leadPhotosRes, jobPhotosRes, extraRes, mediaRes, mechanicMediaRes] = await Promise.all([
      photoQueries[0],
      photoQueries[1] || Promise.resolve({ data: [] as any[] }),
      reader.from('lead_extra_charges').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      reader.from('lead_media').select('id, file_url, file_name, category, photo_type').eq('lead_id', leadId),
      reader.from('mechanic_media').select('id, media_url, media_category').eq('lead_id', leadId),
    ]);

    let vehiclePhotoRows: any[] = [];
    try {
      const { data: vehiclePhotosData, error: vehiclePhotosError } = await reader
        .from('vehicle_condition_photos')
        .select('id, photo_url, photo_type')
        .eq('lead_id', leadId);
      if (!vehiclePhotosError) vehiclePhotoRows = vehiclePhotosData || [];
    } catch {
      vehiclePhotoRows = [];
    }

    const seen = new Set<string>();
    const photoRows: any[] = [];
    for (const row of [...((leadPhotosRes as any)?.data || []), ...((jobPhotosRes as any)?.data || [])]) {
      const key = String(row?.id || row?.photo_url || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      photoRows.push(row);
    }

    const before: Media[] = [];
    const during: Media[] = [];
    const after: Media[] = [];
    const videos: Media[] = [];
    const extra: Array<Media & { extraWorkId?: string }> = [];
    const seenUrl = new Set<string>();

    const pushUnique = (list: Media[], media: Media) => {
      const key = media.url;
      if (!key || seenUrl.has(key)) return;
      seenUrl.add(key);
      list.push(media);
    };

    const classifyJobPhoto = (row: any) => {
      const media = toMedia(row);
      if (!media) return;
      const type = String(row?.photo_type || '').toUpperCase();
      const cat = String(row?.photo_category || '').toLowerCase();
      if (type.startsWith('EXTRA_WORK')) {
        extra.push({ ...media, extraWorkId: type.slice('EXTRA_WORK-'.length).trim() || extraWorkIdFromRow(row) });
        return;
      }
      if (type.startsWith('AFTER_VIDEO') || media.isVideo) {
        pushUnique(videos, media);
        return;
      }
      if (cat === 'before') pushUnique(before, media);
      else if (cat === 'during') pushUnique(during, media);
      else if (cat === 'after') pushUnique(after, media);
    };

    photoRows.forEach(classifyJobPhoto);

    const classifyBySlot = (media: Media, slot: string) => {
      const type = slot.toUpperCase();
      if (
        type.startsWith('BEFORE_') ||
        type.startsWith('PICKUP_') ||
        type === 'BEFORE' ||
        type === 'PICKUP' ||
        type === 'VISIT'
      ) {
        pushUnique(before, media);
      } else if (type.startsWith('DURING_') || type.startsWith('PROGRESS_') || type === 'DURING' || type === 'PROGRESS') {
        pushUnique(during, media);
      } else if (type.startsWith('AFTER_') || type === 'AFTER') {
        pushUnique(after, media);
      }
    };

    ((mediaRes as any)?.data || []).forEach((row: any) => {
      const media = toMedia({ ...row, photo_url: row.file_url });
      if (!media) return;
      const slot = String(row.photo_type || row.category || row.file_name || '').toUpperCase();
      classifyBySlot(media, slot);
    });

    ((mechanicMediaRes as any)?.data || []).forEach((row: any) => {
      const media = toMedia({ ...row, photo_url: row.media_url });
      if (!media) return;
      classifyBySlot(media, String(row.media_category || ''));
    });

    vehiclePhotoRows.forEach((row: any) => {
      const media = toMedia(row);
      if (!media) return;
      const type = String(row.photo_type || '').toUpperCase();
      if (type.startsWith('DROP_') || type === 'AFTER_WORK' || type === 'DELIVERY_SIGNATURE') return;
      classifyBySlot(media, type);
    });

    const extraWork = ((extraRes as any)?.data || []).map((row: any) => ({
      id: String(row.id),
      label: String(row.description || row.reason || row.category || 'Additional work'),
      status: String(row.status || '').toUpperCase(),
      amount: row.amount ?? null,
      category: row.category || null,
      proof: extra.filter((item) => item.extraWorkId === String(row.id)),
    }));

    return NextResponse.json({
      success: true,
      photos: { before, during, after, videos, extra },
      extraWork,
    });
  } catch (error: any) {
    console.error('QC evidence load failed:', error);
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
