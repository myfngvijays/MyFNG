const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export type VehiclePhotoKind = 'odometer' | 'fuel' | 'dashboard';

export type VehiclePhotoVisionResult = {
  odometer_km: number | null;
  fuel_level: 'EMPTY' | 'QUARTER' | 'HALF' | 'THREE_QUARTER' | 'FULL' | null;
  confidence: number;
  note?: string;
};

function normalizeFuel(raw: unknown): VehiclePhotoVisionResult['fuel_level'] {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/THREE_QUARTERS?/i, 'THREE_QUARTER');
  if (s === 'EMPTY' || s === 'QUARTER' || s === 'HALF' || s === 'THREE_QUARTER' || s === 'FULL') {
    return s;
  }
  return null;
}

export async function analyzeVehiclePhotoBuffer(
  buffer: Buffer,
  mimeType: string,
  kind: VehiclePhotoKind,
): Promise<VehiclePhotoVisionResult | null> {
  if (!OPENAI_API_KEY) return null;

  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${base64}`;

  const hint =
    kind === 'dashboard'
      ? 'This is a car instrument cluster / dashboard photo. Read BOTH the odometer km reading AND fuel gauge level.'
      : kind === 'odometer'
        ? 'Read the odometer / kilometer reading from the dashboard. Return odometer_km as integer km only.'
        : 'Estimate fuel gauge level. Return fuel_level as one of EMPTY, QUARTER, HALF, THREE_QUARTER, FULL.';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You analyze vehicle inspection photos for an Indian garage pickup app. ' +
            'Return JSON only: {"odometer_km": number|null, "fuel_level": "EMPTY"|"QUARTER"|"HALF"|"THREE_QUARTER"|"FULL"|null, "confidence": 0-100, "note": "short hint"}. ' +
            hint,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Photo type: ${kind}. Extract readable values.` },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return null;

  const json = await res.json().catch(() => ({}));
  const raw = String(json?.choices?.[0]?.message?.content || '').trim();
  try {
    const parsed = JSON.parse(raw);
    const km = parsed.odometer_km != null ? Math.round(Number(parsed.odometer_km)) : null;
    return {
      odometer_km: km != null && Number.isFinite(km) && km >= 0 ? km : null,
      fuel_level: normalizeFuel(parsed.fuel_level),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      note: parsed.note ? String(parsed.note).slice(0, 120) : undefined,
    };
  } catch {
    return null;
  }
}
