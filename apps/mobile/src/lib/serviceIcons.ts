import { ImageSourcePropType } from 'react-native';

const SERVICE_ICON_BASE = 'https://myfng.in';
export const RSA_ICON_URL = `${SERVICE_ICON_BASE}/icon-rsa-service.png`;
export const RSA_ICON_SOURCE: ImageSourcePropType = require('../../assets/icon-rsa-service.png');
export const RSA_ICON_RED_SOURCE: ImageSourcePropType = require('../../assets/icon-rsa-service-red.png');

const LOCAL_ICONS: Array<{ match: (c: string) => boolean; source: ImageSourcePropType }> = [
  {
    match: (c) => c.includes('RSA') || c.includes('ROADSIDE') || c.includes('TOWING'),
    source: RSA_ICON_SOURCE,
  },
  { match: (c) => c.includes('PERIODIC'), source: require('../../assets/icon-periodic-service.png') },
  { match: (c) => c.includes('AC'), source: require('../../assets/icon-ac-service.png') },
  {
    match: (c) => c.includes('BATTERY') && !c.includes('ELECTRICAL'),
    source: require('../../assets/icon-battery-service.png'),
  },
  { match: (c) => c.includes('BRAKE'), source: require('../../assets/icon-brake-service.png') },
  { match: (c) => c.includes('CLUTCH'), source: require('../../assets/icon-clutch-service.png') },
  {
    match: (c) => c.includes('DENTING') || c.includes('PAINTING'),
    source: require('../../assets/icon-denting-service.png'),
  },
  { match: (c) => c.includes('DETAILING'), source: require('../../assets/icon-detailing-service.png') },
  { match: (c) => c.includes('ENGINE'), source: require('../../assets/icon-engine-service.png') },
  {
    match: (c) => c.includes('TYRE') || c.includes('WHEEL'),
    source: require('../../assets/icon-tyre-service.png'),
  },
  { match: (c) => c.includes('ELECTRICAL'), source: require('../../assets/icon-electrical-service.png') },
  {
    match: (c) => c.includes('SUSPENSION') || c.includes('STEERING'),
    source: require('../../assets/icon-suspension-service.png'),
  },
];

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

/** Prefer bundled PNGs (no remote white-tile flash). */
export function getServiceIconSource(name: string): ImageSourcePropType | null {
  const c = String(name || '').toUpperCase();
  for (const row of LOCAL_ICONS) {
    if (row.match(c)) return row.source;
  }
  const url = getServiceIconUrl(name);
  return url ? { uri: url } : null;
}
