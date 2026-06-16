import { ImageSourcePropType } from 'react-native';

const SERVICE_ICON_BASE = 'https://myfng.in';
export const RSA_ICON_URL = `${SERVICE_ICON_BASE}/icon-rsa-service.png`;
export const RSA_ICON_SOURCE: ImageSourcePropType = require('../../assets/icon-rsa-service.png');

export function getServiceIconUrl(name: string): string {
  const c = name.toUpperCase();
  if (c.includes('RSA') || c.includes('ROADSIDE') || c.includes('TOWING')) return RSA_ICON_URL;
  if (c.includes('PERIODIC')) return `${SERVICE_ICON_BASE}/icon-periodic-service.png`;
  if (c.includes('AC')) return `${SERVICE_ICON_BASE}/icon-ac-service.png`;
  if (c.includes('BATTERY') && !c.includes('ELECTRICAL')) return `${SERVICE_ICON_BASE}/icon-battery-service.png`;
  if (c.includes('BRAKE')) return `${SERVICE_ICON_BASE}/icon-brake-service.png`;
  if (c.includes('CLUTCH')) return `${SERVICE_ICON_BASE}/icon-clutch-service.png`;
  if (c.includes('DENTING') || c.includes('PAINTING')) return `${SERVICE_ICON_BASE}/icon-denting-service.png`;
  if (c.includes('DETAILING')) return `${SERVICE_ICON_BASE}/icon-detailing-service.png`;
  if (c.includes('ENGINE')) return `${SERVICE_ICON_BASE}/icon-engine-service.png`;
  if (c.includes('TYRE') || c.includes('WHEEL')) return `${SERVICE_ICON_BASE}/icon-tyre-service.png`;
  if (c.includes('ELECTRICAL')) return `${SERVICE_ICON_BASE}/icon-electrical-service.png`;
  if (c.includes('SUSPENSION') || c.includes('STEERING')) return `${SERVICE_ICON_BASE}/icon-suspension-service.png`;
  return '';
}

export function getServiceIconSource(name: string): ImageSourcePropType | null {
  const c = name.toUpperCase();
  if (c.includes('RSA') || c.includes('ROADSIDE') || c.includes('TOWING')) return RSA_ICON_SOURCE;
  const url = getServiceIconUrl(name);
  return url ? { uri: url } : null;
}
