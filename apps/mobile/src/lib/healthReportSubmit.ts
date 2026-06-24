import {
  buildSmartToolSubmitHeaders,
  resolveSmartToolCustomerContext,
  smartToolPlatform,
} from './smartToolSubmitContext';
import { ENV } from '../config/environment';

export async function submitHealthReportPayload(payload: Record<string, unknown>): Promise<void> {
  const headers = await buildSmartToolSubmitHeaders();
  const customer = await resolveSmartToolCustomerContext();

  await fetch(`${ENV.API_URL}/api/public/vehicle-health-report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
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
    }),
  });
}
