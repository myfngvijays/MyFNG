import { NextRequest, NextResponse } from 'next/server';
import {
  requireOperationalUser,
} from '@/app/api/whatsapp/calls/_shared';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const gate = await requireOperationalUser();
    if (!gate.ok) return gate.response;

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (adminError || !supabaseAdmin) {
      return NextResponse.json({ error: 'Service configuration error' }, { status: 500 });
    }
    const adminDb: any = supabaseAdmin;

    const params = await Promise.resolve(context.params as any);
    const id = String(params?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: recording, error } = await adminDb
      .from('whatsapp_call_recordings')
      .select('id, recording_url, recording_proxy_path, mime_type, expires_at, payload')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load recording' }, { status: 500 });
    }

    const url = String(recording?.recording_proxy_path || recording?.recording_url || '').trim();
    if (!url) {
      return NextResponse.json({ error: 'Recording not available' }, { status: 404 });
    }

    if (url.startsWith('data:')) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': String(buffer.length),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const upstream = await fetch(url);
        if (upstream.ok) {
          const body = await upstream.arrayBuffer();
          return new NextResponse(body, {
            status: 200,
            headers: {
              'Content-Type': recording?.mime_type || upstream.headers.get('content-type') || 'audio/webm',
              'Content-Length': String(body.byteLength),
              'Cache-Control': 'private, max-age=3600',
            },
          });
        }
      } catch { /* fall through to redirect */ }
      return NextResponse.redirect(url, { status: 302 });
    }

    return NextResponse.json({ error: 'Recording not available' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
