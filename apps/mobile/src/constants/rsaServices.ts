export const RSA_PHONE = '+919152307030';

export type RsaServiceDef = {
  name: string;
  desc: string;
  bg: string;
  iconKind: 'ion' | 'mci' | 'material';
  iconName: string;
  action?: 'book_periodic';
};

export const RSA_SERVICES: RsaServiceDef[] = [
  { name: 'Battery Jumpstart', desc: 'Instant battery start at your location.', iconKind: 'mci', iconName: 'car-battery', bg: '#F97316' },
  { name: 'Fuel Delivery', desc: 'Emergency petrol/diesel delivery.', iconKind: 'material', iconName: 'local-gas-station', bg: '#EF4444' },
  { name: 'Car Towing Services', desc: 'Safe towing to nearest workshop.', iconKind: 'mci', iconName: 'tow-truck', bg: '#3B82F6' },
  { name: 'Accidental Car Towing', desc: 'Accident vehicle recovery & transport.', iconKind: 'mci', iconName: 'car-emergency', bg: '#DC2626' },
  { name: 'Roadside Assistance', desc: 'Minor on-road repairs support.', iconKind: 'ion', iconName: 'construct', bg: '#EA580C' },
  { name: 'Car Tracking Services', desc: 'Live location and tracking support.', iconKind: 'ion', iconName: 'location', bg: '#EC4899' },
  {
    name: 'Periodic Car Service',
    desc: 'Doorstep periodic maintenance booking.',
    iconKind: 'mci',
    iconName: 'car-wrench',
    bg: '#2563EB',
    action: 'book_periodic',
  },
  {
    name: 'Flat Tyre Assistance',
    desc: 'Tyre change or puncture fix instantly.',
    iconKind: 'mci',
    iconName: 'tire',
    bg: '#525252',
  },
];

export const RSA_FAQS_FALLBACK = [
  { q: 'How fast is RSA?', a: 'Our average response time is 30-45 minutes depending on your location.' },
  { q: 'Is RSA available 24/7?', a: 'Yes, our emergency team is available round the clock.' },
  { q: "What if my car can't be fixed on spot?", a: 'We provide towing services to the nearest MyFNG certified workshop.' },
  { q: 'Does RSA cover fuel delivery?', a: 'Yes, we provide emergency fuel delivery (fuel cost extra).' },
  { q: 'Is jumpstart safe for my car?', a: 'Yes, our technicians use professional equipment safe for modern car electronics.' },
  { q: 'What areas do you cover?', a: 'We currently cover all major cities and highways across India.' },
  { q: 'How much does RSA cost?', a: 'Pricing varies by service type and location. Towing starts at ₹25/km.' },
  { q: 'Can I track the RSA vehicle?', a: 'Yes, once dispatched you receive real-time tracking of the assistance vehicle.' },
  { q: 'Do I need a membership for RSA?', a: 'No membership required. However, MyFNG Pro and Max members get priority dispatch and discounted rates.' },
  { q: 'What happens after towing?', a: 'Your car is towed to the nearest MyFNG partner workshop where a full inspection is done and you receive a detailed estimate.' },
];
