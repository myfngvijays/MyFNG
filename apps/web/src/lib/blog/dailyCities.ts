export type DailyTargetCity = {
  name: string;
  slug: string;
  pagePath: string;
  areas: string[];
  keywords: string[];
};

export const DAILY_CITY_THANE: DailyTargetCity = {
  name: 'Thane',
  slug: 'thane',
  pagePath: '/car-service-in/thane',
  areas: [
    'Ghodbunder Road',
    'Manpada',
    'Vartak Nagar',
    'Majiwada',
    'Wagle Estate',
    'Naupada',
    'Hiranandani Estate',
    'Kasarvadavali',
    'Owale',
    'Kalwa',
    'Kopri',
    'Kolshet',
  ],
  keywords: [
    'car service in Thane',
    'car garage Thane',
    'car workshop Ghodbunder Road',
    'car pickup and drop Thane',
    'periodic car service Thane',
    'car mechanic near me Thane',
  ],
};

export const DAILY_CITY_NAVI_MUMBAI: DailyTargetCity = {
  name: 'Navi Mumbai',
  slug: 'navi-mumbai',
  pagePath: '/car-service-in/navi-mumbai',
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
  pagePath: '/car-service-in/mumbai',
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
  pagePath: '/car-service-in/pune',
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

/** Fri = Mumbai, Sat = Pune, other days alternate Thane / Navi Mumbai. */
export function pickDailyCity(now = new Date()): DailyTargetCity {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  if (weekday === 'Fri') return DAILY_CITY_MUMBAI;
  if (weekday === 'Sat') return DAILY_CITY_PUNE;

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  return dayOfYear % 2 === 0 ? DAILY_CITY_THANE : DAILY_CITY_NAVI_MUMBAI;
}

export function dailyCityScheduleLabel() {
  return 'Most days Thane / Navi Mumbai · Friday Mumbai · Saturday Pune';
}
