import {
  buildSmartToolSubmitHeaders,
  resolveSmartToolCustomerContext,
  smartToolPlatform,
} from './smartToolSubmitContext';
import { ENV } from '../config/environment';

export async function submitResaleValuationPayload(payload: Record<string, unknown>): Promise<void> {
  const headers = await buildSmartToolSubmitHeaders();
  const customer = await resolveSmartToolCustomerContext();

  const body = JSON.stringify({
    ...payload,
    ...customer,
    platform: smartToolPlatform(),
    valuation_json: payload.valuation_json
      ? {
          ...(payload.valuation_json as object),
          client: {
            platform: smartToolPlatform(),
            os: smartToolPlatform() === 'IOS' ? 'ios' : 'android',
          },
        }
      : payload.valuation_json,
  });

  try {
    const res = await fetch(`${ENV.API_URL}/api/public/car-resale-valuation`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('[ResaleValuation] Submit failed:', res.status, errJson?.error || '');
    }
  } catch (err: any) {
    console.warn('[ResaleValuation] Network error:', err?.message || err);
  }
}
