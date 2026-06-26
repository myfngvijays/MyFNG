import { ENV } from '../config/environment';
import { getMobileContentPlatform } from './appPlatform';

export type MembershipTermType = 'RSA' | 'SERVICE';

const DEFAULT_RSA_TERMS = [
  'Members are entitled to 2 free RSA services per year under all plans, excluding the Premium Plan.',
  'Towing distance is calculated on a round-trip basis (from the service provider’s location to the vehicle’s location and then to the destination).',
  'Key Unlock Assistance is subject to the type of lock system used in the vehicle.',
  'On-Spot Minor Repairs are limited to small fixes that can be completed without requiring extensive tools or garage equipment.',
  'Hotel accommodation is subject to availability and limited to one night.',
  'Cab arrangement is limited to 50 km and additional charges may apply for distances exceeding this limit.',
  'Ambulance service is provided in case of accidents only and is subject to availability.',
];

const DEFAULT_SERVICE_TERMS = [
  'Membership is valid for 12 months from the date of activation.',
  '10% off on periodic service packages applies at checkout, subject to the benefit cap shown on your plan.',
  '5% cashback is auto-credited to your MyFNG wallet within 48 hours of eligible service completion.',
  'Free top-up & inspection and free car scanning are limited to 2 visits each per membership year.',
  'Free insurance claim assistance covers assessment, documentation and claim support only.',
  'Prime personal WhatsApp group access is activated within 24 hours of membership purchase.',
  'Priority slot booking gives preferential workshop slots subject to availability.',
  '6-month extended warranty applies on eligible services completed during active membership.',
  'Free pickup & drop is included on eligible periodic services during active membership.',
  '2nd car add-on (if purchased) shares the same validity period as your primary car membership.',
  'Membership is non-transferable and linked to your verified mobile number.',
];

const cache: Record<MembershipTermType, string[]> = {
  RSA: [...DEFAULT_RSA_TERMS],
  SERVICE: [...DEFAULT_SERVICE_TERMS],
};

const loadPromises: Partial<Record<MembershipTermType, Promise<string[]>>> = {};

export function getMembershipTerms(type: MembershipTermType = 'RSA'): string[] {
  return cache[type]?.length ? cache[type] : type === 'RSA' ? DEFAULT_RSA_TERMS : DEFAULT_SERVICE_TERMS;
}

export async function loadMembershipTerms(
  type: MembershipTermType = 'RSA',
  apiUrl: string = ENV.API_URL,
): Promise<string[]> {
  if (loadPromises[type]) return loadPromises[type]!;

  loadPromises[type] = (async () => {
    try {
      const platform = getMobileContentPlatform();
      const res = await fetch(`${apiUrl}/api/public/membership-terms?type=${type}&platform=${platform}`);
      const json = await res.json().catch(() => ({}));
      const terms = Array.isArray(json?.terms) ? json.terms.filter(Boolean) : [];
      if (terms.length) cache[type] = terms;
      return getMembershipTerms(type);
    } catch {
      return getMembershipTerms(type);
    } finally {
      delete loadPromises[type];
    }
  })();

  return loadPromises[type]!;
}

export function preloadMembershipTerms(apiUrl: string = ENV.API_URL) {
  return Promise.all([loadMembershipTerms('RSA', apiUrl), loadMembershipTerms('SERVICE', apiUrl)]);
}
