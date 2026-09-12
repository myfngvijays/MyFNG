/**
 * Blog AI only. MISA / WhatsApp / Call IQ stay on OpenAI.
 */

export function stripCodeFences(s: string) {
  const t = String(s || '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

export function getBlogOpenRouterConfig() {
  return {
    apiKey: String(process.env.OPENROUTER_API_KEY || '').trim(),
    model: String(process.env.OPENROUTER_BLOG_MODEL || 'google/gemini-2.0-flash-001').trim(),
    referer: String(process.env.OPENROUTER_HTTP_REFERER || 'https://myfng.in').trim(),
    title: String(process.env.OPENROUTER_APP_TITLE || 'MyFNG').trim(),
  };
}

export async function blogOpenRouterChat(input: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<{ ok: true; content: string; model: string } | { ok: false; error: string; details?: string }> {
  const { apiKey, model, referer, title } = getBlogOpenRouterConfig();
  if (!apiKey) {
    return { ok: false, error: 'OPENROUTER_API_KEY not set — blog AI uses OpenRouter only' };
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': referer,
      'X-Title': title,
    },
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0.4,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
    }),
  });

  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false, error: 'OpenRouter request failed', details: raw.slice(0, 800) };
  }

  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    return { ok: false, error: 'OpenRouter returned invalid JSON', details: raw.slice(0, 400) };
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    return { ok: false, error: 'OpenRouter returned empty response' };
  }

  return { ok: true, content, model };
}

export function parseModelJson(content: string): any {
  return JSON.parse(stripCodeFences(content));
}
