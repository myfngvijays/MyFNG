import { SITE_URL } from './metadata';
import { DEFAULT_ORGANIZATION_SAME_AS } from '@/lib/site-technical-seo';

export function organizationSchema(sameAs?: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MYFNG',
    alternateName: 'My Friendly Neighbourhood Garage',
    url: SITE_URL,
    logo: `${SITE_URL}/favicon-32x32.png`,
    description:
      "India's first AI-powered car service booking platform. Trusted multi-brand car servicing across Mumbai, Pune, Thane and Navi Mumbai.",
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-8657575757',
      contactType: 'customer service',
      areaServed: ['IN'],
      availableLanguage: ['English', 'Hindi', 'Marathi'],
    },
    areaServed: [
      { '@type': 'City', name: 'Mumbai' },
      { '@type': 'City', name: 'Pune' },
      { '@type': 'City', name: 'Thane' },
      { '@type': 'City', name: 'Navi Mumbai' },
    ],
    sameAs: sameAs?.length ? sameAs : DEFAULT_ORGANIZATION_SAME_AS,
  };
}

export async function getOrganizationSchema() {
  const { getSiteTechnicalSeo, parseSameAsUrls: parseSameAs } = await import('@/lib/site-technical-seo');
  const settings = await getSiteTechnicalSeo();
  return organizationSchema(parseSameAs(settings.organization_same_as));
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MYFNG',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/workshop-locator?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function localBusinessSchema(city = 'Mumbai') {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    name: `MYFNG - Car Service & Repairs in ${city}`,
    url: SITE_URL,
    image: `${SITE_URL}/app-download-popup.png`,
    telephone: '+91-8657575757',
    priceRange: '₹₹',
    address: {
      '@type': 'PostalAddress',
      addressLocality: city,
      addressRegion: 'Maharashtra',
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 19.076,
      longitude: 72.8777,
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '20:00',
    },
    areaServed: city,
  };
}

export function serviceSchema(input: {
  name: string;
  description: string;
  url: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    description: input.description,
    url: input.url,
    provider: {
      '@type': 'Organization',
      name: 'MYFNG',
      url: SITE_URL,
    },
    ...(input.image ? { image: input.image } : {}),
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function faqPageSchema(faqs: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function workshopLocalBusinessSchema(input: {
  name: string;
  description?: string;
  url: string;
  image?: string;
  telephone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoRepair',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    ...(input.telephone ? { telephone: input.telephone } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(input.address ? { streetAddress: input.address } : {}),
      ...(input.city ? { addressLocality: input.city } : {}),
      ...(input.state ? { addressRegion: input.state } : {}),
      ...(input.pincode ? { postalCode: input.pincode } : {}),
      addressCountry: 'IN',
    },
    ...(input.latitude != null && input.longitude != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: input.latitude,
            longitude: input.longitude,
          },
        }
      : {}),
    ...(input.rating != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: input.rating,
            reviewCount: input.reviewCount || 0,
          },
        }
      : {}),
    parentOrganization: {
      '@type': 'Organization',
      name: 'MYFNG',
      url: SITE_URL,
    },
  };
}

export function itemListSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
}

export function collectionPageSchema(input: {
  name: string;
  description: string;
  url: string;
  items: Array<{ name: string; url: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: input.url,
    mainEntity: itemListSchema(input.items),
  };
}

export function contactPageSchema(input: {
  name: string;
  description: string;
  url: string;
  telephone?: string;
  email?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: input.name,
    description: input.description,
    url: input.url,
    mainEntity: {
      '@type': 'Organization',
      name: 'MYFNG',
      url: SITE_URL,
      ...(input.telephone ? { telephone: input.telephone } : {}),
      ...(input.email ? { email: input.email } : {}),
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: input.telephone || '+91-8657575757',
        contactType: 'customer service',
        areaServed: 'IN',
        availableLanguage: ['English', 'Hindi', 'Marathi'],
      },
    },
  };
}

export function webPageSchema(input: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    description: input.description,
    url: input.url,
    isPartOf: {
      '@type': 'WebSite',
      name: 'MYFNG',
      url: SITE_URL,
    },
  };
}

export function webApplicationSchema(input: {
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: input.name,
    description: input.description,
    url: input.url,
    applicationCategory: input.applicationCategory || 'BusinessApplication',
    operatingSystem: 'Web, Android, iOS',
    provider: {
      '@type': 'Organization',
      name: 'MYFNG',
      url: SITE_URL,
    },
  };
}

export function emergencyServiceSchema(input: {
  name: string;
  description: string;
  url: string;
  areaServed?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Roadside Assistance',
    name: input.name,
    description: input.description,
    url: input.url,
    provider: {
      '@type': 'Organization',
      name: 'MYFNG',
      url: SITE_URL,
    },
    areaServed: input.areaServed || 'Mumbai, Pune, Thane, Navi Mumbai',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: input.url,
      servicePhone: '+91-8657575757',
    },
  };
}
