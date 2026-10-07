import { parseUtmParams, type UtmParams } from '@/lib/utm';

export type RsaEmergencyPage = {
  slug: string;
  title: string;
  eta: string;
  badge: string;
  description: string;
  metaDescription: string;
  keywords: string[];
  keyphrase: string;
  seoTitle: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
  faqs: Array<{ question: string; answer: string }>;
  whatsappService: string;
  showDropLink: boolean;
  price: { label: string; amount: string; suffix?: string; note: string };
  included: string[];
  steps: Array<{ title: string; text: string }>;
  extra?: { id: string; title: string; text: string; points: string[] };
  note?: { text: string; href: string; label: string };
};

export const RSA_PHONE = '+919152307030';
export const RSA_WHATSAPP = '919594996161';

/** WhatsApp RSA requests use the current page, not an older visit stored in the browser. */
export function rsaRequestUtm(campaign: string): UtmParams {
  const pageCampaign =
    campaign
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'roadside-assistance';
  if (typeof window !== 'undefined') {
    const fromUrl = parseUtmParams(window.location.search);
    if (Object.keys(fromUrl).length > 0) return fromUrl;
  }
  return {
    utm_source: 'website',
    utm_medium: 'rsa',
    utm_campaign: pageCampaign,
    utm_content: pageCampaign,
  };
}

export const RSA_SERVICE_AREAS = ['Mumbai', 'Navi Mumbai', 'Thane', 'Palghar', 'Pune'] as const;

export const RSA_EMERGENCY_PAGES: RsaEmergencyPage[] = [
  {
    slug: 'battery-jumpstart',
    title: 'Battery Jumpstart',
    eta: '10–30 min',
    badge: 'On-spot jumpstart',
    description:
      'Car will not start? MYFNG sends a technician to your location for a professional battery jumpstart. Available 24×7 across Mumbai, Navi Mumbai, Thane, Palghar and Pune.',
    metaDescription:
      'Dead car battery? MYFNG jumpstart reaches you in 10–30 minutes, 24×7, in Mumbai, Navi Mumbai, Thane, Palghar and Pune. Price is on demand.',
    keywords: [
      'car battery jumpstart',
      'battery jumpstart near me',
      'car battery dead',
      'jump start service Mumbai',
      'dead battery help Thane',
      'roadside battery jumpstart Pune',
      '24x7 jumpstart',
    ],
    keyphrase: 'car battery jumpstart near me',
    seoTitle: 'Car Battery Jumpstart Near Me | 10–30 Min | MYFNG',
    sections: [
      {
        heading: 'What is a car battery jumpstart?',
        paragraphs: [
          'A car battery jumpstart is on-the-spot help when the car will not start because the battery is flat. MYFNG sends a technician to your location with professional jumpstart equipment. You do not have to push the car or find a workshop first.',
          'This is roadside help, not a new battery. If the battery will not hold charge after the jump, the technician can arrange towing. A replacement battery is booked separately as Car Battery Service at a workshop.',
        ],
      },
      {
        heading: 'How fast does battery jumpstart arrive?',
        paragraphs: [
          'Typical arrival is 10–30 minutes in Mumbai, Navi Mumbai, Thane, Palghar and Pune. Time depends on traffic and how close the nearest technician is. The service runs 24×7, including late night and early morning.',
          'After you share your location, you can track the technician live until they reach the car.',
        ],
      },
      {
        heading: 'Is a jumpstart safe for modern cars?',
        paragraphs: [
          'Yes. Technicians use equipment meant for modern car electronics. They check the battery and terminals before you drive off. A jumpstart is for a flat battery. It does not repair a failed alternator or a battery that needs replacement.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How much does a car battery jumpstart cost?',
        answer: 'Battery jumpstart is priced on demand. The final amount depends on your location, vehicle type and what is done on the spot. MYFNG confirms the price before work starts.',
      },
      {
        question: 'How long does a battery jumpstart take to reach me?',
        answer: 'Most jumpstarts in Mumbai, Navi Mumbai, Thane, Palghar and Pune arrive in 10–30 minutes, subject to traffic and technician availability.',
      },
      {
        question: 'Do I need an RSA membership for a jumpstart?',
        answer: 'No. You can request a jumpstart without a membership. Membership customers get the calls included in their plan.',
      },
      {
        question: 'What if the car still will not start?',
        answer: 'If the battery will not hold charge, MYFNG can tow the car to a workshop. A new battery is a workshop job, not a roadside jump.',
      },
    ],
    whatsappService: 'Jump Start',
    showDropLink: false,
    price: {
      label: 'Battery Jumpstart',
      amount: 'On Demand',
      note: 'Final price depends on your location, vehicle type and what is done on the spot.',
    },
    included: [
      'Technician comes to your breakdown spot',
      'Professional jumpstart equipment, safe for modern car electronics',
      'Battery and terminal check before you drive off',
      'Live GPS tracking of the assigned technician',
      'Towing arranged if the car still will not start',
    ],
    steps: [
      { title: 'Share location', text: 'Call, WhatsApp, or send the request with your landmark.' },
      { title: 'Dispatch', text: 'Nearest available technician is assigned, usually within 10–30 minutes.' },
      { title: 'Jumpstart', text: 'Battery is started on the spot and checked before you leave.' },
      { title: 'Next step', text: 'If it will not hold charge, we can tow the car to a workshop.' },
    ],
    note: {
      text: 'A dead battery that needs replacement is a workshop job, not a roadside jump.',
      href: '/car-services/car-battery-service',
      label: 'Car Battery Service',
    },
  },
  {
    slug: 'car-towing',
    title: 'Car Towing Services',
    eta: '20–30 min',
    badge: 'Breakdown & accident towing',
    description:
      'Car will not move? MYFNG tows it from the breakdown or accident spot to the nearest workshop. Flatbed-style recovery for accident vehicles is on the same request.',
    metaDescription:
      'MYFNG car towing starts at ₹25/km. Breakdown help in 20–30 minutes, accident recovery in 30–35 minutes, across Mumbai, Thane, Navi Mumbai and Pune.',
    keywords: [
      'car towing service',
      'tow truck near me',
      'car towing Mumbai',
      'accident car towing',
      'breakdown towing Thane',
      'car towing Pune',
      '24x7 car towing',
    ],
    keyphrase: 'car towing service near me',
    seoTitle: 'Car Towing Service from ₹25/km | 24×7 | MYFNG',
    sections: [
      {
        heading: 'What is included in car towing?',
        paragraphs: [
          'MYFNG car towing picks the vehicle up from the breakdown spot and drops it at a workshop. You can send a Google Maps link for the drop. The tow is tracked live while it is on the way.',
          'Breakdown towing usually reaches you in 20–30 minutes. Use this when the car will not move and an on-spot repair is not enough.',
        ],
      },
      {
        heading: 'How much does car towing cost?',
        paragraphs: [
          'Towing starts at ₹25 per km. The base charge covers the first dispatch and loading. Distance charges apply after the minimum kilometres. The exact bill depends on location, vehicle type and how far the car is towed.',
          'Accident recovery uses the same ₹25/km rate. It is not a separate price list.',
        ],
      },
      {
        heading: 'Do you provide accidental car towing?',
        paragraphs: [
          'Yes. Accident towing is on this same page. A damaged car takes longer to load, so the usual ETA is 30–35 minutes. The team recovers the car from the accident spot and transports it to the workshop you choose, or the nearest one.',
          'Ask for Accident Support when you call or send the request, and share both the pickup point and the drop location.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How much is car towing per kilometre?',
        answer: 'MYFNG towing starts at ₹25 per km. The base charge covers first dispatch and loading. Distance charges apply after the minimum km.',
      },
      {
        question: 'How fast can a tow truck reach me?',
        answer: 'Breakdown towing usually arrives in 20–30 minutes. Accident recovery usually takes 30–35 minutes because loading a damaged car needs more care.',
      },
      {
        question: 'Can I choose where the car is dropped?',
        answer: 'Yes. Share a Google Maps link for the drop location. If you do not have one, the car goes to the nearest suitable workshop.',
      },
      {
        question: 'Is accident towing a different service?',
        answer: 'It uses the same towing team and the same ₹25/km rate. Mention Accident Support so dispatch sends the right recovery.',
      },
    ],
    whatsappService: 'Towing Service',
    showDropLink: true,
    price: {
      label: 'Towing',
      amount: '₹25/km',
      suffix: 'onwards',
      note: 'Base charge covers first dispatch and loading. Distance charges apply after the minimum km. Accident recovery uses the same rate.',
    },
    included: [
      'Pickup from the breakdown spot',
      'Safe loading and transport to the nearest workshop',
      'Drop location can be a Google Maps link',
      'Live GPS tracking while the tow is on the way',
    ],
    steps: [
      { title: 'Share both points', text: 'Tell us where the car is, and where it should be dropped.' },
      { title: 'Dispatch', text: 'A tow vehicle is assigned. Breakdown ETA is usually 20–30 minutes.' },
      { title: 'Load the car', text: 'The car is secured and moved. You can track the tow on the way.' },
      { title: 'Workshop drop', text: 'The car is handed to the workshop. Inspection and estimate happen after drop.' },
    ],
    extra: {
      id: 'accident',
      title: 'Accidental car towing',
      text: 'Accident recovery uses the same towing team. ETA is typically 30–35 minutes because loading a damaged car takes more care.',
      points: [
        'Recovery from the accident spot',
        'Careful loading so the car is not dragged',
        'Transport to the workshop you choose, or the nearest one',
        'Ask for Accident Support when you call or send the request',
      ],
    },
  },
  {
    slug: 'flat-tyre',
    title: 'Flat Tyre Assistance',
    eta: '15–30 min',
    badge: 'Puncture & spare change',
    description:
      'Puncture or a flat tyre on the road? MYFNG changes the spare or repairs the puncture at your location so you can continue the trip.',
    metaDescription:
      'Puncture or flat tyre? MYFNG fits the spare or repairs it on the spot in 15–30 minutes across Mumbai, Thane, Navi Mumbai, Palghar and Pune.',
    keywords: [
      'flat tyre assistance',
      'puncture repair on road',
      'roadside tyre change',
      'flat tyre help near me',
      'car puncture service Mumbai',
      'spare wheel change Thane',
      'flat tyre assistance Pune',
    ],
    keyphrase: 'flat tyre assistance near me',
    seoTitle: 'Flat Tyre Assistance Near Me | 15–30 Min | MYFNG',
    sections: [
      {
        heading: 'What is flat tyre assistance?',
        paragraphs: [
          'Flat tyre assistance is roadside help when a tyre is punctured or flat. MYFNG sends a technician to fit the spare wheel or repair the puncture at your location, so you can continue the trip.',
          'This is not a new tyre, wheel alignment or balancing. Those are workshop jobs under Tyre & Wheel Care.',
        ],
      },
      {
        heading: 'How fast is puncture help?',
        paragraphs: [
          'Typical arrival is 15–30 minutes in Mumbai, Navi Mumbai, Thane, Palghar and Pune. Tell us whether the car has a spare wheel. A spare change is usually quicker than a puncture that needs a plug.',
          'You can track the technician live after dispatch. The service is available 24×7.',
        ],
      },
      {
        heading: 'What if the tyre cannot be fixed on the spot?',
        paragraphs: [
          'If the tyre is not safe to drive on, MYFNG arranges towing instead of sending you ahead on a damaged tyre. Towing is charged separately, from ₹25/km.',
        ],
      },
    ],
    faqs: [
      {
        question: 'How much does flat tyre assistance cost?',
        answer: 'Roadside tyre help is priced on demand. The amount depends on your location, vehicle and whether the spare is fitted or the puncture is repaired on the spot.',
      },
      {
        question: 'How long does a roadside tyre change take?',
        answer: 'A technician usually reaches you in 15–30 minutes. Fitting a spare is often done in about 15 minutes once they arrive.',
      },
      {
        question: 'Can you repair a puncture without a spare wheel?',
        answer: 'Yes, when the puncture can be made safe at the location. If it cannot, the car is towed instead.',
      },
      {
        question: 'Do I need a membership for puncture help?',
        answer: 'No. You can request flat tyre assistance without a membership. Members use the calls included in their plan.',
      },
    ],
    whatsappService: 'Flat Tyre Fix',
    showDropLink: false,
    price: {
      label: 'Flat Tyre Assistance',
      amount: 'On Demand',
      note: 'Final price depends on your location, vehicle type and whether the tyre is changed or repaired on the spot.',
    },
    included: [
      'On-spot spare wheel change',
      'Puncture repair when it can be fixed at the location',
      'Typical arrival in 15–30 minutes',
      'Live GPS tracking of the technician',
      'Towing if the tyre cannot be made roadworthy',
    ],
    steps: [
      { title: 'Share the spot', text: 'Tell us the car location and whether you have a spare wheel.' },
      { title: 'Dispatch', text: 'A technician is sent. Typical ETA is 15–30 minutes.' },
      { title: 'Fix or swap', text: 'Spare is fitted, or the puncture is repaired if it is safe to do so.' },
      { title: 'If it cannot be fixed', text: 'We arrange towing instead of sending you out on a damaged tyre.' },
    ],
    note: {
      text: 'Alignment, balancing and a new tyre are workshop jobs.',
      href: '/car-services/tyre-wheel-care',
      label: 'Tyre & Wheel Care',
    },
  },
];

export function findRsaEmergencyPage(slug: string) {
  return RSA_EMERGENCY_PAGES.find((page) => page.slug === slug) || null;
}
