import { SITE_URL } from './metadata';

export function organizationSchema() {
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
    sameAs: [
      'https://www.facebook.com/myfng',
      'https://www.instagram.com/myfng',
      'https://www.linkedin.com/company/myfng',
    ],
  };
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
