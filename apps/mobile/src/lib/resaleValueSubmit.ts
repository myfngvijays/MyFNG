import {
  buildSmartToolSubmitHeaders,
  resolveSmartToolCustomerContext,
  smartToolPlatform,
} from './smartToolSubmitContext';
import { ENV } from '../config/environment';

export async function submitResaleValuationPayload(payload: Record<string, unknown>): Promise<void> {
  const headers = await buildSmartToolSubmitHeaders();
  const customer = await resolveSmartToolCustomerContext();

  await fetch(`${ENV.API_URL}/api/public/car-resale-valuation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
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
    }),
  });
}
