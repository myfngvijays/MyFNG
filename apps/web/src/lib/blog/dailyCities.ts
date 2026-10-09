import { getCityPageBySlug } from '@/lib/city-pages';
import { THANE_BLOG_KEYWORDS } from '@/lib/blog/localSeo';

export type DailyTargetCity = {
  name: string;
  slug: string;
  pagePath: string;
  areas: string[];
  keywords: string[];
};

function cityTarget(slug: string, keywords: string[], fallbackName: string): DailyTargetCity {
  const page = getCityPageBySlug(slug);
  return {
    name: page?.name || fallbackName,
    slug,
    pagePath: page?.pagePath || `/car-service-in-${slug}`,
    areas: (page?.areas || []).slice(0, 12),
    keywords,
  };
}

export const DAILY_CITY_THANE: DailyTargetCity = cityTarget('thane', [...THANE_BLOG_KEYWORDS], 'Thane');

export const DAILY_CITY_KALYAN: DailyTargetCity = cityTarget('kalyan', [
  'car service in Kalyan',
  'car garage Kalyan',
  'car workshop Kalyan East',
  'car pickup and drop Kalyan',
  'periodic car service Kalyan',
  'car mechanic near me Kalyan',
], 'Kalyan');

export const DAILY_CITY_DOMBIVLI: DailyTargetCity = cityTarget('dombivli', [
  'car service in Dombivli',
  'car garage Dombivli',
  'car workshop Dombivli East',
  'car pickup and drop Dombivli',
  'periodic car service Dombivli',
  'car mechanic near me Dombivli',
], 'Dombivli');

/** One daily slot each: post 1 Thane, post 2 Kalyan, post 3 Dombivli. */
export const DAILY_POST_CITIES: DailyTargetCity[] = [
  DAILY_CITY_THANE,
  DAILY_CITY_KALYAN,
  DAILY_CITY_DOMBIVLI,
];

export const DAILY_CITY_NAVI_MUMBAI: DailyTargetCity = {
  name: 'Navi Mumbai',
  slug: 'navi-mumbai',
  pagePath: '/car-service-in-navi-mumbai',
  areas: [
    'Vashi',
    'Nerul',
    'Kharghar',
    'Belapur',
    'Airoli',
    'Koparkhairane',
    'Sanpada',
    'Seawoods',
    'Ulwe',
    'Kamothe',
    'Panvel',
    'Kalamboli',
  ],
  keywords: [
    'car service in Navi Mumbai',
    'car garage Navi Mumbai',
    'car workshop Kharghar',
    'car pickup and drop Navi Mumbai',
    'periodic car service Vashi',
    'car mechanic near me Navi Mumbai',
  ],
};

export const DAILY_CITY_MUMBAI: DailyTargetCity = {
  name: 'Mumbai',
  slug: 'mumbai',
  pagePath: '/car-service-in-mumbai',
  areas: [
    'Andheri',
    'Malad',
    'Borivali',
    'Kandivali',
    'Goregaon',
    'Mulund',
    'Chembur',
    'Dadar',
    'Ghatkopar',
    'Powai',
    'Bandra',
    'Dahisar',
  ],
  keywords: [
    'car service in Mumbai',
    'car garage Mumbai',
    'car workshop Andheri',
    'car pickup and drop Mumbai',
    'periodic car service Mumbai',
    'car mechanic near me Mumbai',
  ],
};

export const DAILY_CITY_PUNE: DailyTargetCity = {
  name: 'Pune',
  slug: 'pune',
  pagePath: '/car-service-in-pune',
  areas: [
    'Baner',
    'Hinjewadi',
    'Wakad',
    'Kharadi',
    'Hadapsar',
    'Kothrud',
    'Viman Nagar',
    'Pimple Saudagar',
    'Aundh',
    'Katraj',
    'Tathawade',
    'Wagholi',
  ],
  keywords: [
    'car service in Pune',
    'car garage Pune',
    'car workshop Hinjewadi',
    'car pickup and drop Pune',
    'periodic car service Pune',
    'car mechanic near me Pune',
  ],
};

/** Slot 1 = Thane, slot 2 = Kalyan, slot 3 = Dombivli. Extra slots stay inside these three. */
export function pickDailyCity(slotIndex = 1): DailyTargetCity {
  const index = Math.max(0, (Number(slotIndex) || 1) - 1);
  return DAILY_POST_CITIES[index % DAILY_POST_CITIES.length];
}

export const BATCH_TARGET_CITIES: DailyTargetCity[] = [
  DAILY_CITY_THANE,
  DAILY_CITY_NAVI_MUMBAI,
  DAILY_CITY_PUNE,
  DAILY_CITY_MUMBAI,
];

export function cityByIndex(index: number): DailyTargetCity {
  const i = ((Number(index) % BATCH_TARGET_CITIES.length) + BATCH_TARGET_CITIES.length) % BATCH_TARGET_CITIES.length;
  return BATCH_TARGET_CITIES[i];
}

export const RSA_TARGET_CITIES: DailyTargetCity[] = [
  DAILY_CITY_THANE,
  DAILY_CITY_NAVI_MUMBAI,
  DAILY_CITY_MUMBAI,
];

export function rsaCityByIndex(index: number): DailyTargetCity {
  const i = ((Number(index) % RSA_TARGET_CITIES.length) + RSA_TARGET_CITIES.length) % RSA_TARGET_CITIES.length;
  return RSA_TARGET_CITIES[i];
}

export function dailyCityScheduleLabel() {
  return 'Thane · Kalyan · Dombivli';
}
