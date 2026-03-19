export type PublicPackage = {
  id: string;
  name: string;
  price: number;
  desc: string;
  image: string;
};

export type PublicBlog = {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  image: string;
};

export type PublicBrand = {
  name: string;
  logo: string;
};

export const POPULAR_PACKAGES: PublicPackage[] = [
  {
    id: 'general',
    name: 'General Service',
    price: 4999,
    desc: 'Comprehensive checkup and service.',
    image:
      'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'premium',
    name: 'Premium Service',
    price: 8999,
    desc: 'Full car restoration and maintenance.',
    image:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'platinum',
    name: 'Platinum Service',
    price: 12999,
    desc: 'The ultimate care for your luxury vehicle.',
    image:
      'https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=400',
  },
];

export const BLOGS: PublicBlog[] = [
  {
    id: '1',
    title: '5 Tips to Extend Your Car Battery Life',
    excerpt: 'Learn how simple habits can save you from unexpected breakdowns.',
    date: 'Oct 24, 2023',
    image:
      'https://images.unsplash.com/photo-1599256621730-535171e28e50?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: '2',
    title: 'Why Periodic Service is Crucial',
    excerpt: 'Regular maintenance prevents expensive repairs in the long run.',
    date: 'Nov 12, 2023',
    image:
      'https://images.unsplash.com/photo-1530046339160-ce3e5b0c7a2f?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: '3',
    title: 'Understanding RSA: Your Safety Net',
    excerpt: 'What to do when you are stranded on the highway.',
    date: 'Dec 05, 2023',
    image:
      'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=400',
  },
];

export const CAR_BRANDS: PublicBrand[] = [
  { name: 'Maruti Suzuki', logo: 'https://logo.clearbit.com/suzuki.com' },
  { name: 'Hyundai', logo: 'https://logo.clearbit.com/hyundai.com' },
  { name: 'Tata Motors', logo: 'https://logo.clearbit.com/tatamotors.com' },
  { name: 'Mahindra', logo: 'https://logo.clearbit.com/mahindra.com' },
  { name: 'Toyota', logo: 'https://logo.clearbit.com/toyota.com' },
  { name: 'Honda', logo: 'https://logo.clearbit.com/honda.com' },
  { name: 'Kia', logo: 'https://logo.clearbit.com/kia.com' },
  { name: 'Volkswagen', logo: 'https://logo.clearbit.com/volkswagen.com' },
  { name: 'Skoda', logo: 'https://logo.clearbit.com/skoda-auto.com' },
];

export const SPARE_PART_BRANDS: PublicBrand[] = [
  { name: 'Bosch', logo: 'https://cdn.worldvectorlogo.com/logos/bosch-2.svg' },
  { name: 'TVS', logo: 'https://cdn.worldvectorlogo.com/logos/tvs-motor.svg' },
  { name: 'Gabriel', logo: 'https://upload.wikimedia.org/wikipedia/en/4/40/Gabriel_India_logo.png' },
  { name: 'Monroe', logo: 'https://cdn.worldvectorlogo.com/logos/monroe-4.svg' },
  { name: 'Valeo', logo: 'https://cdn.worldvectorlogo.com/logos/valeo-1.svg' },
  { name: 'OEM/OES', logo: '' },
];

export const ADD_ON_SERVICES = [
  {
    id: 'interior',
    name: 'Interior Cleaning',
    price: 499,
    description: 'Deep cleaning of seats, dashboard, and carpets.',
    icon: 'sparkles',
    recommended_for: ['periodic', 'general', 'premium', 'platinum'],
  },
  {
    id: 'alignment',
    name: 'Wheel Alignment',
    price: 399,
    description: 'Precision alignment for better tyre life and handling.',
    icon: 'pulse',
    recommended_for: ['periodic', 'general', 'premium', 'platinum'],
  },
  {
    id: 'ac-service',
    name: 'AC Service',
    price: 799,
    description: 'Filter cleaning and gas check for optimal cooling.',
    icon: 'snow',
    recommended_for: ['periodic', 'ac'],
  },
  {
    id: 'car-wash',
    name: 'Full Car Wash',
    price: 299,
    description: 'Exterior foam wash and wax for a shiny finish.',
    icon: 'water',
    recommended_for: ['periodic', 'general', 'premium', 'platinum'],
  },
];

export const ORDERS = [
  {
    id: 'MFNG10245',
    carModel: 'Hyundai Creta',
    serviceType: 'Periodic Service',
    date: '12 Feb 2026',
    totalAmount: 3250,
    status: 'completed',
  },
  {
    id: 'MFNG10258',
    carModel: 'Tata Nexon',
    serviceType: 'AC Service',
    date: '05 Mar 2026',
    totalAmount: 1800,
    status: 'in-progress',
  },
  {
    id: 'MFNG10262',
    carModel: 'Maruti Swift',
    serviceType: 'Brake Repair',
    date: '10 Mar 2026',
    totalAmount: 2400,
    status: 'upcoming',
  },
];

export const CAR_MODELS: Record<string, string[]> = {
  'Maruti Suzuki': ['Swift', 'Wagon R', 'Ertiga', 'Baleno', 'Dzire'],
  Hyundai: ['Creta', 'i20', 'Verna', 'Venue'],
  'Tata Motors': ['Nexon', 'Punch', 'Harrier', 'Safari'],
  Mahindra: ['XUV700', 'Scorpio', 'Thar'],
  Toyota: ['Innova Crysta', 'Fortuner', 'Glanza'],
  Honda: ['City', 'Amaze', 'Jazz'],
  Kia: ['Seltos', 'Sonet', 'Carens'],
  Volkswagen: ['Virtus', 'Taigun', 'Polo'],
  Skoda: ['Slavia', 'Kushaq', 'Octavia'],
};

export const VEHICLE_YEARS = Array.from(
  { length: 25 },
  (_, i) => (new Date().getFullYear() - i).toString(),
);

export const MEMBERSHIP_PLANS = [
  { name: 'MyFNG Go', price: '₹499', color: '#3B82F6' },
  { name: 'MyFNG Pro', price: '₹1,499', color: '#8B5CF6' },
  { name: 'MyFNG Max', price: '₹2,999', color: '#F97316' },
];

export const SUPPORT_FAQ_CATEGORIES: Record<string, Array<{ question: string; answer: string }>> = {
  Account: [
    { question: 'How do I delete my account?', answer: 'Go to Delete Account section in settings and confirm.' },
    { question: 'Can I change my phone number?', answer: 'Contact support to update your primary mobile number.' },
    { question: 'How do I update my profile details?', answer: 'Open My Profile from Settings, edit your name/email, and tap Save to update details.' },
  ],
  Booking: [
    { question: 'How can I track my service status?', answer: 'Use Live Tracking from home page or order history.' },
    { question: 'Can I reschedule a booking?', answer: 'Yes, reschedule up to 4 hours before pickup time.' },
  ],
  Payment: [
    { question: 'What payment methods are accepted?', answer: 'UPI, cards, net banking, wallet and cash on delivery.' },
    { question: 'How do refunds work?', answer: 'Refunds are processed in 5-7 business days.' },
  ],
};

export const LEGAL_SECTIONS = {
  privacyIntro:
    'MyFNG Autocare Private Limited ("MY FNG", "we", "our", or "us") is committed to protecting the privacy and personal data of users who access our website, applications, and services (collectively referred to as the "Platform").',
  privacyFull:
    'MY FNG – Privacy Policy Last Updated: February 2026\n\nMyFNG Autocare Private Limited ("MY FNG", "we", "our", or "us") is committed to protecting the privacy and personal data of users who access our website, applications, and services (collectively referred to as the "Platform").\n\nThis Privacy Policy describes how MY FNG collects, uses, stores, and protects personal data when users interact with our services.\n\nThis Policy is published in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and applicable rules thereunder.',
  privacy: [
    {
      title: '1. Eligibility',
      content:
        'Our services are intended for individuals who are legally capable of entering into contracts under applicable law (generally 18 years or above). We do not knowingly collect data from children under the age of 18.',
    },
    {
      title: '2. Information We Collect',
      content:
        'We may collect the following categories of information:\n» Identity details: name, phone number, email address\n» Vehicle details: registration number, model, service history, fuel type\n» Service and booking data: selected services, appointment details, workshop interactions, support records\n» Location data: pickup/drop or breakdown location (where required for service fulfillment)\n» Device and technical data: IP address, device type, browser/app version, logs, diagnostics\n» Payment-related data: payment status, transaction references (handled via payment partners)\n» Communication data: call records, chat/email exchanges, feedback, and grievances',
    },
    {
      title: '3. How We Use Personal Data',
      content:
        'We use collected information to:\n» Create and manage your account\n» Facilitate bookings, roadside assistance, and service coordination\n» Connect you with partner workshops and service providers\n» Send confirmations, updates, invoices, and support communications\n» Process payments, refunds, and billing disputes\n» Prevent fraud, abuse, and misuse of services\n» Improve platform quality, reliability, and user experience\n» Comply with legal and regulatory obligations',
    },
    {
      title: '4. Third-Party Tracking & Advertising Technologies',
      content:
        'We may use cookies and similar technologies for session management, analytics, performance, and user experience improvements. You may control cookies through browser settings; disabling some cookies may affect platform functionality.',
    },
    {
      title: '5. Sharing and Disclosure of Information',
      content:
        'We may share data on a need-to-know basis with:\n» Partner workshops, RSA/towing partners, and service personnel\n» Payment gateways and banking partners\n» Cloud, analytics, customer-support, and IT service providers\n» Affiliates/group entities for operational purposes\n» Government, regulatory, or law-enforcement authorities when required by law\n\nWe do not sell your personal data.',
    },
    {
      title: '6. Aggregator Service Disclaimer',
      content:
        'MyFNG operates as a technology-enabled platform connecting customers with automotive service providers. The actual services are performed by independent partner workshops. MyFNG is not directly responsible for the quality, outcome, or warranties of services rendered by partner workshops, though we maintain quality standards and audit processes.',
    },
    {
      title: '7. Data Security',
      content:
        'We implement reasonable technical and organizational safeguards to protect data against unauthorized access, misuse, alteration, loss, or disclosure. However, no platform can guarantee absolute security.',
    },
    {
      title: '8. Data Retention',
      content:
        'We retain personal data only for as long as necessary for:\n» Service delivery and support\n» Legal, tax, audit, and compliance requirements\n» Dispute resolution and enforcement of terms\n\nRetention periods may vary by data type and legal requirements.',
    },
    {
      title: '9. Your Rights Under DPDP Act 2023',
      content:
        'Subject to applicable law, you may have rights to:\n» Access and review your personal data\n» Request correction of inaccurate or outdated data\n» Request deletion (where legally permissible)\n» Withdraw consent for specific processing activities\n» Raise concerns about misuse of personal data\n\nTo exercise rights, contact us at info@myfng.in or call +91-9152307030.',
    },
    {
      title: '10. Contact and Grievance',
      content:
        'For privacy queries, data requests, or grievances, contact:\n» Email: info@myfng.in\n» Customer Support: +91-9152307030\n» Grievance Officer: Nitish Jha\n» Grievance Contact: +91-7977118621\n\nIf you do not agree with this Privacy Policy, please discontinue use of the Platform and Services.',
    },
  ],
  termsIntro:
    'MyFNG Autocare Private Limited, a company duly incorporated under the Companies Act, 2013 and having its registered office at A/309, Centrum Business Square, Road No 16, Wagle Industrial Estate, Thane (W), Thane-400604, Maharashtra, India ("MyFNG" or "Company"), owns and operates a digital platform under the brand name MyFNG, which enables users to discover, schedule, and manage car maintenance, repair, inspection, and related automotive services offered by independent third-party service providers ("Partner Workshops").',
  termsFull:
    'MyFNG New - Terms and Conditions Draft\n\nCONTRACTUAL RELATIONSHIP\n\nMyFNG Autocare Private Limited (the "Company") owns and operates the MyFNG platform, including website and mobile app, to facilitate automotive services through independent partner workshops.\n\nThese Terms and Conditions govern your access and use of the Platform and Services. By using the Platform, you acknowledge that you have read, understood, and agreed to be bound by these Terms.\n\nIf you do not agree with these Terms, you must not use the Platform. MyFNG reserves the right to revise these Terms from time to time. Continued use after updates constitutes acceptance of the revised Terms.\n\nThese Terms constitute an electronic contract under applicable Indian laws, including the Indian Contract Act, 1872 and the Information Technology Act, 2000.',
  terms: [
    {
      title: 'Definitions',
      content:
        'Unless the context otherwise requires, key terms include:\n» Account: User account created on the Platform\n» Booking: Service appointment requested by a user\n» Charges: Amounts payable including service fees, labour, parts, taxes and levies\n» Partner Workshop: Independent third-party automobile service provider\n» Platform: MyFNG website, mobile app and associated interfaces\n» Services: Technology-enabled facilitation services by MyFNG\n» User Data: Information provided or generated by users on the Platform',
    },
    {
      title: 'Services',
      content:
        'MyFNG provides a technology-enabled facilitation platform and does not directly perform physical repairs unless expressly stated.\n\nService facilitation may include:\n» Periodic and general car servicing\n» Mechanical, electrical and diagnostic assistance\n» AC, battery, tyre and wheel services\n» RSA support (towing, jump-start, flat tyre assistance)\n» Appointment scheduling and service coordination\n\nAvailability may vary by location, vehicle type and partner capacity.',
    },
    {
      title: 'Eligibility',
      content:
        'Access is available only to individuals legally capable of entering into contracts (generally 18+).\n\nYou agree to:\n» Provide accurate and complete information\n» Use only vehicles lawfully owned/authorized by you\n» Maintain compatible device and network access\n» Comply with applicable laws and platform policies',
    },
    {
      title: 'Use of Services',
      content:
        'You are responsible for account credentials and all activities under your account.\n\nYou must not:\n» Make fraudulent/false requests\n» Harass support/service personnel\n» Bypass platform workflow or payment safeguards\n\nMyFNG may suspend access in case of misuse, non-payment, risk, or policy breach.',
    },
    {
      title: 'Support',
      content:
        'Customer support details:\n» Email: info@myfng.in\n» Helpline: +91-9152307030\n» Support Hours: Monday to Sunday, 10:00 a.m. to 7:00 p.m. IST\n\nSupport is facilitative in nature and response time may vary.',
    },
    {
      title: 'Prohibited',
      content:
        'Users shall not:\n» Engage in unlawful/fraudulent use\n» Misrepresent identity or service details\n» Interfere with platform security or operations\n» Reverse engineer or inject harmful code\n» Infringe intellectual property rights\n» Abuse RSA for non-emergency repeated calls',
    },
    {
      title: 'User Comments, Feedback and Other Submissions',
      content:
        'User submissions are treated as non-confidential unless agreed otherwise in writing. By submitting feedback/comments/content, you grant MyFNG a worldwide, perpetual, royalty-free, transferable, sublicensable license to use such submissions for service and business purposes, subject to law.',
    },
    {
      title: 'User Data',
      content:
        'You must provide accurate data. MyFNG may collect, process, and share data for booking, support, compliance, analytics, payment, fraud prevention, and service coordination in accordance with applicable law and the Privacy Policy.',
    },
    {
      title: 'Intellectual Property Rights',
      content:
        'All Platform intellectual property belongs to MyFNG or its licensors. Users receive only a limited revocable usage right and must not copy, distribute, reverse engineer, or commercially exploit platform IP without written permission.',
    },
    {
      title: 'License',
      content:
        'Subject to compliance with these Terms, MyFNG grants a limited, revocable, non-exclusive, non-transferable, non-sublicensable license for personal lawful use of the Platform.',
    },
    {
      title: 'Limitation of Liability',
      content:
        'MyFNG acts as a facilitation platform and does not physically perform services. To the maximum extent permitted by law, MyFNG disclaims indirect/consequential damages and limits aggregate liability as applicable under law.',
    },
    {
      title: 'Exemptions to Liability of Company',
      content:
        'MyFNG is not liable for:\n» Third-party partner acts/omissions\n» Pre-existing vehicle issues\n» Delays/unavailability due to force majeure or logistics\n» User negligence or false information\n» Personal belongings left in vehicle\n» Technical outages and lawful compliance actions',
    },
    {
      title: 'Billing / Charges',
      content:
        'Charges may include service fees, labour, spare parts, facilitation fees, taxes, towing/RSA charges and related levies. Displayed prices can be indicative; final charges may vary based on inspection and approved additional services.',
    },
    {
      title: 'Cancellation and Refund',
      content:
        'Cancellation/refund eligibility depends on service stage, dispatch status, and incurred costs. Once service/dispatch starts, refund eligibility may be limited as per these Terms and applicable law.',
    },
    {
      title: 'Dispute Resolution',
      content:
        'Parties will first attempt amicable resolution. Unresolved disputes are subject to arbitration under the Arbitration and Conciliation Act, 1996 (as amended), with seat/venue at Thane, Mumbai, Maharashtra, India.',
    },
    {
      title: 'Governing Law',
      content:
        'These Terms are governed by the laws of India. Subject to dispute resolution provisions, courts at Thane, Maharashtra, India shall have jurisdiction as permitted by law.',
    },
    {
      title: 'General Provisions',
      content:
        'Entire Agreement, Severability, No Waiver, Assignment, Force Majeure, Survival, Electronic Records and Interpretation provisions apply to these Terms.',
    },
    {
      title: 'Termination',
      content:
        'Users may stop using the Platform anytime. MyFNG may suspend/terminate access for breach, misuse, fraud, legal/security/operational risk, or legal requirements. Surviving clauses remain enforceable post-termination.',
    },
    {
      title: 'Indemnification',
      content:
        'User agrees to indemnify and hold harmless MyFNG and related parties from claims/losses arising out of breach, misuse, legal violations, false data, third-party disputes attributable to user conduct, and negligent/willful acts.',
    },
    {
      title: 'Support / Contacting You',
      content:
        'Customer Support / Grievance:\n» Helpline: +91-9152307030\n» Email: info@myfng.in\n» Grievance Officer: Nitish Jha\n» Grievance Mobile: +91-7977118621\n\nBy using the Platform and Services, you acknowledge and agree to these Terms and Conditions.',
    },
  ],
};
