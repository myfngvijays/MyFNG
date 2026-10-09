export type CityCluster = 'mumbai' | 'pune' | 'thane-belt' | 'thane-local' | 'dombivli-local' | 'kalyan-local' | 'navi-mumbai';

export type CityPageConfig = {
  slug: string;
  name: string;
  state: string;
  pagePath: string;
  displayOrder: number;
  cluster: CityCluster;
  areas: string[];
};

function city(
  slug: string,
  name: string,
  displayOrder: number,
  cluster: CityCluster,
  areas: string[],
): CityPageConfig {
  return {
    slug,
    name,
    state: 'Maharashtra',
    pagePath: `/car-service-in-${slug}`,
    displayOrder,
    cluster,
    areas,
  };
}

export const THANE_LOCALITIES = [
  'Ghodbunder Road', 'Manpada', 'Vartak Nagar', 'Majiwada', 'Wagle Estate',
  'Hiranandani Estate', 'Kasarvadavali', 'Owale',
  'Kolshet', 'Thane West', 'Thane East', 'Pokhran Road', 'Kapurbawdi', 'Balkum',
  'Louiswadi', 'Cadbury Junction', 'Teen Hath Naka', 'Panch Pakhadi', 'Anand Nagar',
  'Brahmand', 'Waghbil', 'Kavesar', 'Dhokali', 'Patlipada', 'Hiranandani Meadows', 'Yeoor',
];

function localitySlug(name: string) {
  return name.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const DOMBIVLI_LOCALITIES = [
  'Dombivli East', 'Dombivli West', 'Kolegaon', 'Sonarpada', 'Palava',
  'Khoni', 'Thakurli', 'Kopar', 'Cross Road', 'Gharda Circle', 'Reti Bunder',
  'Pendse Nagar', 'Sunil Nagar', 'MIDC Dombivli', 'Manpada Dombivli', 'Dombivli Station',
];

export const KALYAN_LOCALITIES = [
  'Kalyan West', 'Kalyan East', 'Chikanghar', 'Khadakpada', 'Bail Bazar',
  'Shahad', 'Pisavali', 'Tisgaon', 'Malang Gad Road', 'Adharwadi', 'Rambaug',
  'Godrej Hill', 'Dudh Naka', 'Syndicate', 'Kalyan Station',
];

function localityPages(
  names: string[],
  cluster: CityCluster,
  startOrder: number,
  taken: Set<string>,
): CityPageConfig[] {
  return names.flatMap((name, index) => {
    const slug = localitySlug(name);
    if (taken.has(slug)) return [];
    taken.add(slug);
    const neighbors = names.filter((item) => item !== name).slice(0, 8);
    return [city(slug, name, startOrder + index, cluster, neighbors)];
  });
}

export const CITY_PAGES: CityPageConfig[] = [
  city('mumbai', 'Mumbai', 201, 'mumbai', [
    'Andheri', 'Malad', 'Borivali', 'Kandivali', 'Goregaon', 'Mulund',
    'Chembur', 'Dadar', 'Ghatkopar', 'Powai', 'Bandra', 'Dahisar',
  ]),
  city('pune', 'Pune', 202, 'pune', [
    'Baner', 'Hinjewadi', 'Wakad', 'Kharadi', 'Hadapsar', 'Kothrud',
    'Viman Nagar', 'Pimple Saudagar', 'Aundh', 'Katraj', 'Tathawade', 'Wagholi',
    'Pimpri', 'Chinchwad', 'Koregaon Park', 'Magarpatta',
  ]),
  city('thane', 'Thane', 203, 'thane-belt', THANE_LOCALITIES),
  city('navi-mumbai', 'Navi Mumbai', 204, 'navi-mumbai', [
    'Vashi', 'Nerul', 'Koparkhairane', 'Kharghar', 'Belapur', 'Airoli', 'Sanpada',
    'Seawoods', 'Ulwe', 'Kamothe', 'Panvel', 'Kalamboli', 'Ghansoli', 'Juinagar',
    'Turbhe', 'Rabale', 'Taloja', 'Khandeshwar', 'Mansarovar',
  ]),

  city('vashi', 'Vashi', 301, 'navi-mumbai', [
    'Vashi', 'Sector 9 Vashi', 'Sector 17 Vashi', 'APMC Vashi', 'Vashi Plaza',
    'Palm Beach Road', 'Turbhe', 'Juhu Village Vashi', 'Vashi Station', 'Sector 30A',
  ]),
  city('nerul', 'Nerul', 302, 'navi-mumbai', [
    'Nerul', 'Nerul East', 'Nerul West', 'Shiravane', 'Seawoods', 'Sector 20 Nerul',
    'Sector 48 Nerul', 'DY Patil Nerul', 'LP Nerul', 'Rock Garden Nerul',
  ]),
  city('koparkhairane', 'Koparkhairane', 303, 'navi-mumbai', [
    'Koparkhairane', 'Kopar Khairane', 'Pawane', 'Mahape', 'Ghansoli',
    'MIDC Koparkhairane', 'Sector 2 Koparkhairane', 'Sector 7 Koparkhairane', 'Koparkhairane Station',
  ]),
  city('kharghar', 'Kharghar', 304, 'navi-mumbai', [
    'Kharghar', 'Sector 7 Kharghar', 'Sector 12 Kharghar', 'Sector 20 Kharghar',
    'Pendhar', 'Taloja', 'Central Park Kharghar', 'Kharghar Station', 'Utsav Chowk',
  ]),
  city('belapur', 'CBD Belapur', 305, 'navi-mumbai', [
    'CBD Belapur', 'Belapur', 'Sector 11 Belapur', 'Sector 15 Belapur',
    'Konkan Bhavan', 'Artist Village', 'Belapur Station', 'Palm Beach Belapur',
  ]),
  city('airoli', 'Airoli', 306, 'navi-mumbai', [
    'Airoli', 'Sector 8 Airoli', 'Sector 19 Airoli', 'Dighe', 'Rabale',
    'Millennium Business Park', 'Airoli Station', 'Airoli West',
  ]),
  city('sanpada', 'Sanpada', 307, 'navi-mumbai', [
    'Sanpada', 'Sanpada Station', 'Juinagar', 'Palm Beach Sanpada',
    'Sector 3 Sanpada', 'Sanpada Railway Colony',
  ]),
  city('seawoods', 'Seawoods', 308, 'navi-mumbai', [
    'Seawoods', 'Seawoods Darave', 'Seawoods Station', 'Nerul West',
    'Palm Beach Seawoods', 'Darave Village',
  ]),
  city('ulwe', 'Ulwe', 309, 'navi-mumbai', [
    'Ulwe', 'Sector 19 Ulwe', 'Sector 20 Ulwe', 'Bamandongri', 'Dronagiri',
    'Ulwe Node', 'Ulwe Station',
  ]),
  city('kamothe', 'Kamothe', 310, 'navi-mumbai', [
    'Kamothe', 'Sector 7 Kamothe', 'Sector 22 Kamothe', 'Roadpali',
    'Kamothe Station', 'Kalamboli',
  ]),
  city('panvel', 'Panvel', 311, 'navi-mumbai', [
    'Panvel', 'Old Panvel', 'New Panvel', 'Khanda Colony', 'Krishna Nagar',
    'Panvel Station', 'Sector 15 Panvel', 'Khandeshwar',
  ]),
  city('kalamboli', 'Kalamboli', 312, 'navi-mumbai', [
    'Kalamboli', 'Roadpali', 'Taloja', 'Sector 7 Kalamboli', 'Kalamboli Station',
    'Kamothe',
  ]),
  city('ghansoli', 'Ghansoli', 313, 'navi-mumbai', [
    'Ghansoli', 'Ghansoli Station', 'Mahape', 'Rabale', 'Sector 2 Ghansoli',
    'Koparkhairane',
  ]),
  city('juinagar', 'Juinagar', 314, 'navi-mumbai', [
    'Juinagar', 'Juinagar Station', 'Sanpada', 'Nerul East', 'Sector 11 Juinagar',
  ]),
  city('khandeshwar', 'Khandeshwar', 318, 'navi-mumbai', [
    'Khandeshwar', 'Khandeshwar Station', 'New Panvel', 'Kamothe', 'Sector 8 Khandeshwar',
  ]),
  city('mansarovar', 'Mansarovar', 319, 'navi-mumbai', [
    'Mansarovar', 'Mansarovar Station', 'Kharghar', 'Sector 20 Kharghar',
  ]),
  city('turbhe', 'Turbhe', 315, 'navi-mumbai', [
    'Turbhe', 'Turbhe Station', 'APMC', 'Vashi', 'MIDC Turbhe',
  ]),
  city('rabale', 'Rabale', 316, 'navi-mumbai', [
    'Rabale', 'Rabale Station', 'Ghansoli', 'Airoli', 'MIDC Rabale',
  ]),
  city('taloja', 'Taloja', 317, 'navi-mumbai', [
    'Taloja', 'Taloja Station', 'Kharghar', 'Pendhar', 'Kalamboli', 'MIDC Taloja',
  ]),

  city('dombivli', 'Dombivli', 401, 'thane-belt', DOMBIVLI_LOCALITIES),
  city('kalyan', 'Kalyan', 402, 'thane-belt', KALYAN_LOCALITIES),
  city('ambernath', 'Ambernath', 403, 'thane-belt', [
    'Ambernath East', 'Ambernath West', 'B-Cabin', 'Chikhloli', 'Kansai',
    'Morivali', 'Shiv Mandir', 'Ambernath Station', 'Badlapur Road Ambernath',
  ]),
  city('badlapur', 'Badlapur', 404, 'thane-belt', [
    'Badlapur East', 'Badlapur West', 'Kulgaon', 'Katrap', 'Belavali',
    'Shirgaon', 'Manjarli', 'Neral-Badlapur Road', 'Badlapur Station',
  ]),
  city('titwala', 'Titwala', 405, 'thane-belt', [
    'Titwala', 'Titwala East', 'Titwala West', 'Mharal', 'Bapgaon', 'Titwala Station',
  ]),
  city('ulhasnagar', 'Ulhasnagar', 406, 'thane-belt', [
    'Ulhasnagar', 'Ulhasnagar Camp 1', 'Ulhasnagar Camp 2', 'Ulhasnagar Camp 3',
    'Ulhasnagar Camp 4', 'Ulhasnagar Camp 5', 'Shahad', 'Vithalwadi',
  ]),
];

const takenLocalitySlugs = new Set(CITY_PAGES.map((item) => item.slug));
CITY_PAGES.push(
  ...localityPages(THANE_LOCALITIES, 'thane-local', 420, takenLocalitySlugs),
  ...localityPages(DOMBIVLI_LOCALITIES, 'dombivli-local', 520, takenLocalitySlugs),
  ...localityPages(KALYAN_LOCALITIES, 'kalyan-local', 560, takenLocalitySlugs),
);

export function getCityPageBySlug(slug: string): CityPageConfig | null {
  const normalized = String(slug || '').trim().toLowerCase().replace(/^car-service-in-/, '');
  return CITY_PAGES.find((item) => item.slug === normalized) || null;
}

export function getCityPagePath(slug: string): string {
  return getCityPageBySlug(slug)?.pagePath || `/car-service-in-${String(slug || '').trim().toLowerCase()}`;
}

export function isCityPagePath(path: string): boolean {
  const normalized = String(path || '').split('?')[0];
  return CITY_PAGES.some((item) => item.pagePath === normalized) || normalized.startsWith('/car-service-in/');
}

export function nearbyCityPages(city: CityPageConfig): CityPageConfig[] {
  return CITY_PAGES.filter((item) => item.cluster === city.cluster && item.slug !== city.slug);
}

export function buildCityPageSeoDefaults() {
  return CITY_PAGES.map((item) => ({
    page_path: item.pagePath,
    page_label: `Car Service ${item.name}`,
    display_order: item.displayOrder,
    title: `Best Car Service in ${item.name} | Periodic, AC & Engine Repair | MyFNG`,
    description: `Book car service in ${item.name} at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.`,
    keywords: [
      `car service ${item.name}`,
      `car repair ${item.name}`,
      `best mechanic ${item.name}`,
      `car workshop ${item.name}`,
      'MYFNG',
    ],
    keyphrase: `car service ${item.name}`,
    canonicalPath: item.pagePath,
    city: item.name,
  }));
}
