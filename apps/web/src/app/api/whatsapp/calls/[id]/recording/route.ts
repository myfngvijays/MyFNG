import { NextRequest, NextResponse } from 'next/server';
import {
  callErrorResponse,
  fetchCallContext,
  isSuperAdminRole,
  requireOperationalUser,
} from '@/app/api/whatsapp/calls/_shared';

const BUCKET_NAME = 'whatsapp-media';

async function ensureBucket(db: any) {
  const { data: buckets } = await db.storage.listBuckets();
  const exists = Array.isArray(buckets) && buckets.some((b: any) => b.name === BUCKET_NAME);
  if (!exists) {
    await db.storage.createBucket(BUCKET_NAME, { public: true });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;
    const { db, userProfile, roleCode } = gate;
    if (!isSuperAdminRole(roleCode)) {
      return callErrorResponse('Only Super Admin can upload call recordings', 403);
    }

    const params = await Promise.resolve(context.params as any);
    const callId = String(params?.id || '').trim();
    if (!callId) return callErrorResponse('id is required', 400);

    const { error: callContextError, callLog } = await fetchCallContext(db, callId);
    if (callContextError || !callLog) return callErrorResponse(callContextError || 'Call not found', 404);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) return callErrorResponse('file is required', 400);
    const durationRaw = Number(formData.get('duration_seconds'));
    const durationSeconds =
      Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : null;

    const now = new Date().toISOString();
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `call-recordings/${callId}/${Date.now()}-${file.name || 'recording.webm'}`;

    // Ensure storage bucket exists
    await ensureBucket(db).catch(() => {});

    const { data: uploadData, error: uploadError } = await db.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type || 'audio/webm',
        upsert: true,
      });

    let publicUrl: string | null = null;
    if (uploadError) {
      const base64 = buffer.toString('base64');
      const mimeType = file.type || 'audio/webm';
      publicUrl = `data:${mimeType};base64,${base64}`;
    } else {
      const { data: publicUrlData } = db.storage
        .from(BUCKET_NAME)
        .getPublicUrl(uploadData?.path || fileName);
      publicUrl = publicUrlData?.publicUrl || null;
    }

    const { data: recording, error: insertError } = await db
      .from('whatsapp_call_recordings')
      .insert({
        call_log_id: callId,
        provider_call_id: callLog.provider_call_id || null,
        recording_url: publicUrl,
        recording_proxy_path: publicUrl,
        mime_type: file.type || 'audio/webm',
        size_bytes: file.size,
        duration_seconds: durationSeconds,
        available_at: now,
        payload: { source: 'browser_recording', file_name: fileName },
        meta: {
          actor_id: userProfile.id,
          actor_name: userProfile.full_name || null,
          source: 'browser_mediarecorder',
        },
        updated_at: now,
      })
      .select('id')
      .maybeSingle();

    if (insertError) {
      return callErrorResponse(insertError.message || 'Failed to save recording metadata', 500);
    }

    await db
      .from('whatsapp_call_logs')
      .update({
        recording_available: true,
        recording_count: 1,
        ...(durationSeconds ? { duration_seconds: durationSeconds } : {}),
        updated_at: now,
      })
      .eq('id', callId);

    return NextResponse.json({
      success: true,
      recording_id: recording?.id || null,
      url: publicUrl,
    });
  } catch (error: any) {
    return callErrorResponse(error?.message || 'Internal server error', 500);
  }
}
