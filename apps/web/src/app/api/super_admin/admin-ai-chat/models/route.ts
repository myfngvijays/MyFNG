import { NextResponse } from 'next/server';
import { assertSuperAdminAccess } from '@/lib/admin_ai/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_MODEL = 'gpt-4o-mini';

function isChatCapableModel(modelId: string) {
  const id = String(modelId || '').toLowerCase();
  if (!id) return false;
  const likelyChat = id.startsWith('gpt-') || id.startsWith('o');
  const blocked = /(audio|transcribe|tts|realtime|embedding|moderation|image)/.test(id);
  return likelyChat && !blocked;
}

export async function GET() {
  const auth = await assertSuperAdminAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { models: [{ id: DEFAULT_MODEL, label: 'GPT-4o mini (default)' }], defaultModel: DEFAULT_MODEL },
      { status: 200 }
    );
  }

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { models: [{ id: DEFAULT_MODEL, label: 'GPT-4o mini (default)' }], defaultModel: DEFAULT_MODEL },
        { status: 200 }
      );
    }

    const json = await res.json().catch(() => ({}));
    const all = Array.isArray(json?.data) ? json.data : [];
    const ids = all
      .map((row: any) => String(row?.id || '').trim())
      .filter((id: string) => isChatCapableModel(id))
      .sort((a: string, b: string) => a.localeCompare(b));

    const unique = Array.from(new Set([DEFAULT_MODEL, ...ids]));
    const models = unique.map((id) => ({
      id,
      label: id === DEFAULT_MODEL ? `${id} (default)` : id,
    }));

    return NextResponse.json({ models, defaultModel: DEFAULT_MODEL }, { status: 200 });
  } catch {
    return NextResponse.json(
      { models: [{ id: DEFAULT_MODEL, label: 'GPT-4o mini (default)' }], defaultModel: DEFAULT_MODEL },
      { status: 200 }
    );
  }
}

