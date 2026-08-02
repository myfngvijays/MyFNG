export type BrandTestimonial = {
  name: string;
  location: string;
  rating: number;
  vehicle: string;
  text: string;
  relativeTime?: string;
  authorPhoto?: string;
};

export type PopularBrandPageConfig = {
  slug: string;
  name: string;
  pagePath: string;
  logoUrl: string;
  tagline: string;
  heroDescription: string;
  prefillMake: string;
  dbMakePatterns: string[];
  technicianLabel: string;
  models: string[];
  highlights: string[];
  testimonials: BrandTestimonial[];
  faqs: Array<{ question: string; answer: string }>;
};

const BRAND_LOGOS_BUCKET =
  'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/car-brand/brands';

const STANDARD_HIGHLIGHTS = (technicianLabel: string) =>
  [
    'OEM/OES Parts',
    `Professional ${technicianLabel} Technicians`,
    'Free Pickup & Drop',
    'Live Photos & Videos Updates',
    'Same-Day Service',
  ] as const;

function buildHeroDescription(brandName: string): string {
  return `Book periodic service, AC repair, brake work, clutch, battery and more for your ${brandName} at 100+ verified MYFNG workshops across Mumbai, Thane, Navi Mumbai & Pune. Genuine parts, transparent pricing, free pickup & drop.`;
}

const TESTIMONIAL_SEEDS: Omit<BrandTestimonial, 'vehicle'>[] = [
  {
    name: 'Rahul Mehta',
    location: 'Thane',
    rating: 5,
    relativeTime: '1 week ago',
    text: 'General service package was excellent value. No hidden charges, genuine parts used, and car delivered before evening.',
  },
  {
    name: 'Priya Sharma',
    location: 'Navi Mumbai',
    rating: 5,
    relativeTime: '2 weeks ago',
    text: 'Booked periodic service online. Free pickup, transparent pricing, and WhatsApp updates throughout the job.',
  },
  {
    name: 'Vikram Joshi',
    location: 'Pune',
    rating: 5,
    relativeTime: '3 weeks ago',
    text: 'Premium package — thorough inspection, dashboard polish, and tyre rotation. Felt like authorised service at a better price.',
  },
  {
    name: 'Amit Shah',
    location: 'Mumbai',
    rating: 5,
    relativeTime: '5 days ago',
    text: 'AC gas refill and filter change done same day. Technician shared before/after photos on WhatsApp. Very professional.',
  },
  {
    name: 'Suresh Patil',
    location: 'Kalyan',
    rating: 4,
    relativeTime: '1 month ago',
    text: 'Clutch and brake work completed on time. Fair estimate upfront, no surprise billing at delivery.',
  },
  {
    name: 'Rohit Pawar',
    location: 'Dombivli',
    rating: 5,
    relativeTime: '2 months ago',
    text: 'Family car periodic service with doorstep pickup. Job card was detailed and warranty card was shared instantly.',
  },
  {
    name: 'Neha Kulkarni',
    location: 'Vasai',
    rating: 5,
    relativeTime: '10 days ago',
    text: 'First service through MYFNG. Smooth booking, polite driver for pickup, and car returned washed.',
  },
  {
    name: 'Manoj Gupta',
    location: 'Panvel',
    rating: 5,
    relativeTime: '3 weeks ago',
    text: 'Basic service done as quoted online. Engine oil, filters, wash — all included. Will repeat next interval.',
  },
  {
    name: 'Deepak Yadav',
    location: 'Bhiwandi',
    rating: 5,
    relativeTime: '6 weeks ago',
    text: 'Engine tune-up done well. Mileage improved slightly and idle vibration is gone. Good work.',
  },
  {
    name: 'Kunal Bhosale',
    location: 'Nashik',
    rating: 4,
    relativeTime: '2 weeks ago',
    text: 'Brake pads replaced. Test drive was offered before handover. Solid service for the price paid.',
  },
  {
    name: 'Harshad Naik',
    location: 'Thane West',
    rating: 5,
    relativeTime: '4 days ago',
    text: 'Premium service — thorough inspection, battery check, and AC disinfectant spray. Impressed with checklist report.',
  },
  {
    name: 'Pratik Jadhav',
    location: 'Majiwada',
    rating: 5,
    relativeTime: '3 months ago',
    text: 'Been using MYFNG for two services now. Consistent quality, same pickup boy, and reminders before due date.',
  },
  {
    name: 'Anjali Deshmukh',
    location: 'Pune',
    rating: 5,
    relativeTime: '1 month ago',
    text: 'Battery and electrical check sorted in one visit. Advisor was helpful explaining every line on the bill.',
  },
  {
    name: 'Nitin More',
    location: 'Navi Mumbai',
    rating: 5,
    relativeTime: '8 days ago',
    text: 'Denting touch-up and full body wash. Colour match was near perfect. Turnaround was faster than local garage quote.',
  },
  {
    name: 'Ganesh Kadam',
    location: 'Kalyan East',
    rating: 5,
    relativeTime: '2 weeks ago',
    text: 'Periodic service including filter cleaning and fluid top-ups. Advisor shared maintenance tips for better mileage.',
  },
  {
    name: 'Aditya Chavan',
    location: 'Mumbai',
    rating: 5,
    relativeTime: '6 days ago',
    text: 'Suspension noise fixed. Strut check, alignment, and trial drive included. Ride feels stable on highway now.',
  },
  {
    name: 'Rakesh Dubey',
    location: 'Dombivli',
    rating: 4,
    relativeTime: '5 weeks ago',
    text: 'Clutch plate replacement. Took a day longer than promised but quality of work and parts was genuine.',
  },
  {
    name: 'Sandeep Singh',
    location: 'Pune',
    rating: 5,
    relativeTime: '12 days ago',
    text: 'Periodic + AC service combo. Cooling is much better and pickup-drop was free as advertised on website.',
  },
];

function buildTestimonials(brandName: string, models: string[]): BrandTestimonial[] {
  return TESTIMONIAL_SEEDS.map((seed, index) => ({
    ...seed,
    vehicle: `${brandName} ${models[index % models.length]}`,
  }));
}

function buildFaqs(brandName: string, models: string[]): PopularBrandPageConfig['faqs'] {
  const modelSample = models.slice(0, 4).join(', ');
  return [
    {
      question: `How often should I service my ${brandName}?`,
      answer: `Most ${brandName} models need periodic service every 10,000 km or 12 months — whichever comes first. MYFNG follows manufacturer-recommended schedules for ${modelSample} and all other models.`,
    },
    {
      question: `Do you use genuine ${brandName} spare parts?`,
      answer:
        'Yes. MYFNG partner workshops use genuine or OEM-equivalent parts with warranty. You receive a detailed job card before any extra work is approved.',
    },
    {
      question: `Can I book ${brandName} service online?`,
      answer:
        'Yes — book via the MYFNG app or website. Choose your car model, pick services, select a nearby workshop and schedule free pickup.',
    },
    {
      question: `Which ${brandName} models do you service?`,
      answer: `All popular ${brandName} petrol, diesel and hybrid models including ${modelSample} and more.`,
    },
    {
      question: `Is free pickup and drop available for ${brandName} cars?`,
      answer:
        'Yes, free doorstep pickup and delivery is available in most serviceable areas across Mumbai, Thane, Navi Mumbai and Pune when you book through MYFNG.',
    },
    {
      question: `How much does ${brandName} periodic service cost?`,
      answer:
        'Periodic service packages start from competitive rates based on your model and service type. You see transparent pricing on the booking page before confirming — no hidden charges.',
    },
    {
      question: `Do you service ${brandName} diesel models?`,
      answer: `Yes. We service ${brandName} diesel variants with appropriate oil, filters and diagnostics as per manufacturer guidelines.`,
    },
    {
      question: `Can I track my ${brandName} car service live?`,
      answer:
        'Absolutely. MYFNG sends WhatsApp updates with job progress, photos and approval requests so you stay informed throughout the service.',
    },
    {
      question: `What warranty do I get after ${brandName} service at MYFNG?`,
      answer:
        'Most periodic services include a 1 month / 1,000 km warranty on parts and labour. Warranty details are shown on your invoice and job card.',
    },
    {
      question: `How do I find the nearest MYFNG workshop for my ${brandName}?`,
      answer:
        'Use the Workshop Locator on our website or app to find verified MYFNG centres near you. You can also book online and we assign the best available workshop in your area.',
    },
  ];
}

type BrandSeed = {
  slug: string;
  name: string;
  logoFile: string;
  tagline: string;
  prefillMake: string;
  dbMakePatterns: string[];
  technicianLabel: string;
  models: string[];
};

function createBrandPage(seed: BrandSeed): PopularBrandPageConfig {
  return {
    slug: seed.slug,
    name: seed.name,
    pagePath: `/popular-brands/${seed.slug}`,
    logoUrl: `${BRAND_LOGOS_BUCKET}/${seed.logoFile}`,
    tagline: seed.tagline,
    heroDescription: buildHeroDescription(seed.name),
    prefillMake: seed.prefillMake,
    dbMakePatterns: seed.dbMakePatterns,
    technicianLabel: seed.technicianLabel,
    models: seed.models,
    highlights: [...STANDARD_HIGHLIGHTS(seed.technicianLabel)],
    testimonials: buildTestimonials(seed.name, seed.models),
    faqs: buildFaqs(seed.name, seed.models),
  };
}

const OTHER_BRAND_SEEDS: BrandSeed[] = [
  {
    slug: 'hyundai',
    name: 'Hyundai',
    logoFile: 'hyundai-1767167798279.png',
    tagline: 'India’s favourite SUV & sedan service specialists',
    prefillMake: 'Hyundai',
    dbMakePatterns: ['hyundai'],
    technicianLabel: 'Hyundai',
    models: ['Creta', 'i20', 'Verna', 'Venue', 'Alcazar', 'Exter', 'Tucson', 'Aura'],
  },
  {
    slug: 'honda',
    name: 'Honda',
    logoFile: 'honda-1767167825373.png',
    tagline: 'Premium sedan & SUV care you can trust',
    prefillMake: 'Honda',
    dbMakePatterns: ['honda'],
    technicianLabel: 'Honda',
    models: ['City', 'Amaze', 'Elevate', 'Jazz', 'WR-V', 'Civic'],
  },
  {
    slug: 'tata',
    name: 'Tata',
    logoFile: 'tata-1767167812163.png',
    tagline: 'Expert service for India’s safest cars',
    prefillMake: 'Tata',
    dbMakePatterns: ['tata'],
    technicianLabel: 'Tata',
    models: ['Nexon', 'Punch', 'Harrier', 'Safari', 'Tiago', 'Altroz', 'Tigor', 'Curvv'],
  },
  {
    slug: 'mahindra',
    name: 'Mahindra',
    logoFile: 'mahindra-1767167857458.png',
    tagline: 'SUV & pickup specialists across Maharashtra',
    prefillMake: 'Mahindra',
    dbMakePatterns: ['mahindra'],
    technicianLabel: 'Mahindra',
    models: ['XUV700', 'Scorpio', 'Thar', 'XUV300', 'Bolero', 'Scorpio-N', 'XUV400', 'Marazzo'],
  },
  {
    slug: 'toyota',
    name: 'Toyota',
    logoFile: 'toyota-1767167842662.png',
    tagline: 'Reliable periodic care for Innova, Fortuner & more',
    prefillMake: 'Toyota',
    dbMakePatterns: ['toyota'],
    technicianLabel: 'Toyota',
    models: ['Innova Crysta', 'Fortuner', 'Glanza', 'Urban Cruiser Hyryder', 'Camry', 'Hilux'],
  },
  {
    slug: 'kia',
    name: 'Kia',
    logoFile: 'kia-1767167878179.png',
    tagline: 'Feature-rich SUV service with transparent pricing',
    prefillMake: 'Kia',
    dbMakePatterns: ['kia'],
    technicianLabel: 'Kia',
    models: ['Seltos', 'Sonet', 'Carens', 'EV6', 'Carnival'],
  },
  {
    slug: 'skoda',
    name: 'Skoda',
    logoFile: 'skoda-1767167952193.png',
    tagline: 'European engineering, expert MYFNG care',
    prefillMake: 'Skoda',
    dbMakePatterns: ['skoda'],
    technicianLabel: 'Skoda',
    models: ['Slavia', 'Kushaq', 'Octavia', 'Superb', 'Kodiaq', 'Rapid'],
  },
  {
    slug: 'volkswagen',
    name: 'Volkswagen',
    logoFile: 'volkswagen-1767167978229.png',
    tagline: 'German precision service at verified workshops',
    prefillMake: 'Volkswagen',
    dbMakePatterns: ['volkswagen'],
    technicianLabel: 'Volkswagen',
    models: ['Virtus', 'Taigun', 'Polo', 'Tiguan', 'Vento'],
  },
];

const MARUTI_SUZUKI_PAGE: PopularBrandPageConfig = {
  slug: 'maruti-suzuki',
  name: 'Maruti Suzuki',
  pagePath: '/popular-brands/maruti-suzuki',
  logoUrl: `${BRAND_LOGOS_BUCKET}/maruti-suzuki-1767167782400.png`,
  tagline: 'India’s most trusted hatchback & SUV service specialists',
  heroDescription: buildHeroDescription('Maruti Suzuki'),
  prefillMake: 'Maruti',
  dbMakePatterns: ['maruti', 'suzuki'],
  technicianLabel: 'Maruti',
  models: [
      'Swift',
      'Baleno',
      'Dzire',
      'Brezza',
      'Ertiga',
      'Wagon R',
      'Celerio',
      'Alto',
      'Grand Vitara',
      'Fronx',
      'Ignis',
      'S-Presso',
    ],
    highlights: [
      'OEM/OES Parts',
      'Professional Maruti Technicians',
      'Free Pickup & Drop',
      'Live Photos & Videos Updates',
      'Same-Day Service',
    ],
    testimonials: [
      {
        name: 'Rahul Mehta',
        location: 'Thane',
        rating: 5,
        vehicle: 'Maruti Suzuki Baleno',
        relativeTime: '1 week ago',
        text: 'General service package was excellent value. No hidden charges, genuine parts used, and car delivered before evening.',
      },
      {
        name: 'Priya Sharma',
        location: 'Navi Mumbai',
        rating: 5,
        vehicle: 'Maruti Suzuki Swift',
        relativeTime: '2 weeks ago',
        text: 'Booked periodic service for my Swift. Free pickup, transparent pricing, and WhatsApp updates throughout the job.',
      },
      {
        name: 'Vikram Joshi',
        location: 'Pune',
        rating: 5,
        vehicle: 'Maruti Suzuki Brezza',
        relativeTime: '3 weeks ago',
        text: 'Premium package for Brezza — 50-point check, dashboard polish, tyre rotation. Felt like authorised service at better price.',
      },
      {
        name: 'Amit Shah',
        location: 'Mumbai',
        rating: 5,
        vehicle: 'Maruti Suzuki Dzire',
        relativeTime: '5 days ago',
        text: 'Dzire AC gas refill and filter change done same day. Technician shared before/after photos on WhatsApp. Very professional.',
      },
      {
        name: 'Suresh Patil',
        location: 'Kalyan',
        rating: 4,
        vehicle: 'Maruti Suzuki Wagon R',
        relativeTime: '1 month ago',
        text: 'Clutch and brake work on Wagon R completed on time. Fair estimate upfront, no surprise billing at delivery.',
      },
      {
        name: 'Rohit Pawar',
        location: 'Dombivli',
        rating: 5,
        vehicle: 'Maruti Suzuki Ertiga',
        relativeTime: '2 months ago',
        text: 'Family Ertiga periodic service with doorstep pickup. Job card was detailed and warranty card was shared instantly.',
      },
      {
        name: 'Neha Kulkarni',
        location: 'Vasai',
        rating: 5,
        vehicle: 'Maruti Suzuki Fronx',
        relativeTime: '10 days ago',
        text: 'First service for my new Fronx through MYFNG. Smooth booking, polite driver for pickup, and car returned washed.',
      },
      {
        name: 'Manoj Gupta',
        location: 'Panvel',
        rating: 5,
        vehicle: 'Maruti Suzuki Celerio',
        relativeTime: '3 weeks ago',
        text: 'Basic service done under ₹3,000 as quoted online. Engine oil, filters, wash — all included. Will repeat next interval.',
      },
      {
        name: 'Deepak Yadav',
        location: 'Bhiwandi',
        rating: 5,
        vehicle: 'Maruti Suzuki Alto K10',
        relativeTime: '6 weeks ago',
        text: 'Alto running smoother after engine tune-up. Mileage improved slightly and idle vibration is gone. Good work.',
      },
      {
        name: 'Kunal Bhosale',
        location: 'Nashik',
        rating: 4,
        vehicle: 'Maruti Suzuki S-Presso',
        relativeTime: '2 weeks ago',
        text: 'Brake pads replaced on S-Presso. Test drive was offered before handover. Solid service for the price paid.',
      },
      {
        name: 'Harshad Naik',
        location: 'Thane West',
        rating: 5,
        vehicle: 'Maruti Suzuki Grand Vitara',
        relativeTime: '4 days ago',
        text: 'Grand Vitara premium service — thorough inspection, battery check, and AC disinfectant spray. Impressed with checklist report.',
      },
      {
        name: 'Pratik Jadhav',
        location: 'Majiwada',
        rating: 5,
        vehicle: 'Maruti Suzuki Swift',
        relativeTime: '3 months ago',
        text: 'Been using MYFNG for two Swift services now. Consistent quality, same pickup boy, and reminders before due date.',
      },
      {
        name: 'Anjali Deshmukh',
        location: 'Pune',
        rating: 5,
        vehicle: 'Maruti Suzuki Ignis',
        relativeTime: '1 month ago',
        text: 'Ignis battery and electrical check sorted in one visit. Lady at workshop was helpful explaining every line on the bill.',
      },
      {
        name: 'Nitin More',
        location: 'Navi Mumbai',
        rating: 5,
        vehicle: 'Maruti Suzuki Baleno',
        relativeTime: '8 days ago',
        text: 'Baleno denting touch-up and full body wash. Colour match was near perfect. Turnaround was faster than local garage quote.',
      },
      {
        name: 'Ganesh Kadam',
        location: 'Kalyan East',
        rating: 5,
        vehicle: 'Maruti Suzuki Dzire',
        relativeTime: '2 weeks ago',
        text: 'CNG Dzire service including kit inspection. No leakage found, filter cleaned, and CNG mileage tips shared by advisor.',
      },
      {
        name: 'Aditya Chavan',
        location: 'Mumbai',
        rating: 5,
        vehicle: 'Maruti Suzuki Brezza',
        relativeTime: '6 days ago',
        text: 'Suspension noise fixed on Brezza. Strut check, alignment, and trial drive included. Ride feels stable on highway now.',
      },
      {
        name: 'Rakesh Dubey',
        location: 'Dombivli',
        rating: 4,
        vehicle: 'Maruti Suzuki Ertiga',
        relativeTime: '5 weeks ago',
        text: 'Ertiga clutch plate replacement. Took a day longer than promised but quality of work and parts was genuine.',
      },
      {
        name: 'Sandeep Singh',
        location: 'Pune',
        rating: 5,
        vehicle: 'Maruti Suzuki Wagon R',
        relativeTime: '12 days ago',
        text: 'Wagon R periodic + AC service combo. Cooling is much better and pickup-drop was free as advertised on website.',
      },
    ],
    faqs: [
      {
        question: 'How often should I service my Maruti Suzuki?',
        answer:
          'Most Maruti models need periodic service every 10,000 km or 12 months — whichever comes first. MYFNG follows manufacturer-recommended schedules for Swift, Baleno, Dzire and all other models.',
      },
      {
        question: 'Do you use genuine Maruti Suzuki spare parts?',
        answer:
          'Yes. MYFNG partner workshops use genuine or OEM-equivalent parts with warranty. You receive a detailed job card before any extra work is approved.',
      },
      {
        question: 'Can I book Maruti service online?',
        answer:
          'Yes — book via the MYFNG app or website. Choose your car model, pick services, select a nearby workshop and schedule free pickup.',
      },
      {
        question: 'Which Maruti models do you service?',
        answer:
          'All Maruti Suzuki petrol, CNG and mild-hybrid models including Swift, Baleno, Dzire, Brezza, Ertiga, Wagon R, Fronx, Grand Vitara and more.',
      },
      {
        question: 'Is free pickup and drop available for Maruti cars?',
        answer:
          'Yes, free doorstep pickup and delivery is available in most serviceable areas across Mumbai, Thane, Navi Mumbai and Pune when you book through MYFNG.',
      },
      {
        question: 'How much does Maruti periodic service cost?',
        answer:
          'Periodic service packages start from competitive rates based on your model and service type. You see transparent pricing on the booking page before confirming — no hidden charges.',
      },
      {
        question: 'Do you service Maruti CNG models?',
        answer:
          'Yes. We service Maruti Suzuki CNG variants including Wagon R, Ertiga, Dzire and others. CNG system checks and filter replacements are included where applicable.',
      },
      {
        question: 'Can I track my Maruti car service live?',
        answer:
          'Absolutely. MYFNG sends WhatsApp updates with job progress, photos and approval requests so you stay informed throughout the service.',
      },
      {
        question: 'What warranty do I get after Maruti service at MYFNG?',
        answer:
          'Most periodic services include a 1 month / 1,000 km warranty on parts and labour. Warranty details are shown on your invoice and job card.',
      },
      {
        question: 'How do I find the nearest MYFNG workshop for my Maruti?',
        answer:
          'Use the Workshop Locator on our website or app to find verified MYFNG centres near you. You can also book online and we assign the best available workshop in your area.',
      },
    ],
};

export const POPULAR_BRAND_PAGES: PopularBrandPageConfig[] = [
  MARUTI_SUZUKI_PAGE,
  ...OTHER_BRAND_SEEDS.map(createBrandPage),
];

export function getPopularBrandBySlug(slug: string): PopularBrandPageConfig | null {
  const normalized = String(slug || '').trim().toLowerCase();
  return POPULAR_BRAND_PAGES.find((b) => b.slug === normalized) || null;
}

export function getPopularBrandPagePath(slug: string): string {
  return getPopularBrandBySlug(slug)?.pagePath || `/popular-brands/${slug}`;
}

export function buildPopularBrandSeoDefaults() {
  return POPULAR_BRAND_PAGES.map((brand, index) => ({
    page_path: brand.pagePath,
    page_label: `${brand.name} Car Service`,
    display_order: 210 + index,
    title: `${brand.name} Car Service & Repair | Periodic, AC, Brake | MyFNG`,
    description: brand.heroDescription.slice(0, 155),
    keywords: [
      `${brand.name} service`,
      `${brand.name} repair`,
      `${brand.name} periodic service`,
      'MYFNG',
      'Mumbai',
      'Pune',
      'Thane',
    ],
    keyphrase: `${brand.name} car service`,
    canonicalPath: brand.pagePath,
    city: 'Mumbai',
  }));
}
