export type CityPageConfig = {
  slug: string;
  name: string;
  state: string;
  pagePath: string;
  displayOrder: number;
};

export const CITY_PAGES: CityPageConfig[] = [
  { slug: 'mumbai', name: 'Mumbai', state: 'Maharashtra', pagePath: '/car-service-in/mumbai', displayOrder: 201 },
  { slug: 'pune', name: 'Pune', state: 'Maharashtra', pagePath: '/car-service-in/pune', displayOrder: 202 },
  { slug: 'thane', name: 'Thane', state: 'Maharashtra', pagePath: '/car-service-in/thane', displayOrder: 203 },
  { slug: 'navi-mumbai', name: 'Navi Mumbai', state: 'Maharashtra', pagePath: '/car-service-in/navi-mumbai', displayOrder: 204 },
];

export function getCityPageBySlug(slug: string): CityPageConfig | null {
  const normalized = String(slug || '').trim().toLowerCase();
  return CITY_PAGES.find((city) => city.slug === normalized) || null;
}

export function getCityPagePath(slug: string): string {
  return getCityPageBySlug(slug)?.pagePath || `/car-service-in/${slug}`;
}

export function isCityPagePath(path: string): boolean {
  return path.startsWith('/car-service-in/');
}

export function buildCityPageSeoDefaults() {
  return CITY_PAGES.map((city) => ({
    page_path: city.pagePath,
    page_label: `Car Service ${city.name}`,
    display_order: city.displayOrder,
    title: `Best Car Service in ${city.name} | Periodic, AC & Engine Repair | MyFNG`,
    description: `Book car service in ${city.name} at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.`,
    keywords: [
      `car service ${city.name}`,
      `car repair ${city.name}`,
      `best mechanic ${city.name}`,
      `car workshop ${city.name}`,
      'MYFNG',
    ],
    keyphrase: `car service ${city.name}`,
    canonicalPath: city.pagePath,
    city: city.name,
  }));
}
