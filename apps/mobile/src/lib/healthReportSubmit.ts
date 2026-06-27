import {
  buildSmartToolSubmitHeaders,
  resolveSmartToolCustomerContext,
  smartToolPlatform,
} from './smartToolSubmitContext';
import { ENV } from '../config/environment';

export async function submitHealthReportPayload(payload: Record<string, unknown>): Promise<void> {
  const headers = await buildSmartToolSubmitHeaders();
  const customer = await resolveSmartToolCustomerContext();

  const body = JSON.stringify({
    ...payload,
    ...customer,
    platform: smartToolPlatform(),
    report_json: payload.report_json
      ? {
          ...(payload.report_json as object),
          client: {
            platform: smartToolPlatform(),
            os: smartToolPlatform() === 'IOS' ? 'ios' : 'android',
          },
        }
      : payload.report_json,
  });

  try {
    const res = await fetch(`${ENV.API_URL}/api/public/vehicle-health-report`, {
      method: 'POST',
      headers,
      body,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.warn('[HealthReport] Submit failed:', res.status, errJson?.error || '');
    }
  } catch (err: any) {
    console.warn('[HealthReport] Network error:', err?.message || err);
  }
}
