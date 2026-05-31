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
    desc: 'Scheduled maintenance by A-Grade verified multi-brand workshops.',
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public/MyFNG_Car_Periodic_Service.png',
  },
  {
    id: 'premium',
    name: 'Premium Service',
    price: 6800,
    desc: 'Advanced diagnostics and complete preventive engine care.',
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public/MyFNG_Car_Engine_Service.png',
  },
  {
    id: 'platinum',
    name: 'Platinum Service',
    price: 11300,
    desc: 'Complete detailing package with premium finish and protection.',
    image:
      'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public/MyFNG_Car_Detailing_Service.png',
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

const SPARE_PARTS_LOGOS_BUCKET = 'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/App/Spare%20Parts%20Logos%20PNG';

export const SPARE_PART_BRANDS: PublicBrand[] = [
  { name: 'Bosch', logo: `${SPARE_PARTS_LOGOS_BUCKET}/bosch-spare-parts-logo.png` },
  { name: 'TVS', logo: `${SPARE_PARTS_LOGOS_BUCKET}/tvs-spare-parts-logo.png` },
  { name: 'Gabriel', logo: `${SPARE_PARTS_LOGOS_BUCKET}/gabriel-spare-parts-logo.png` },
  { name: 'Monroe', logo: `${SPARE_PARTS_LOGOS_BUCKET}/monroe-spare-parts-logo.png` },
  { name: 'Valeo', logo: `${SPARE_PARTS_LOGOS_BUCKET}/valeo-spare-parts-logo.png` },
  { name: 'OEM/OES', logo: `${SPARE_PARTS_LOGOS_BUCKET}/oem_oes-spare-parts-logo.png` },
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

export const PRIME_MEMBERSHIP = {
  name: 'MY FNG Prime',
  badge: 'MEMBERSHIP',
  price: '₹699',
  priceNum: 699,
  period: '/ Year',
  tagline: 'Your Car. Our Responsibility.',
  benefits: [
    { icon: 'pricetag', title: '10% Off Periodic Packages', description: 'Save on every scheduled service, all year' },
    { icon: 'cash', title: '5% Cashback to Wallet', description: 'On every MY FNG bill, automatically credited' },
    { icon: 'construct', title: 'Free Top-Up & Inspection', description: '2 times a year — fluids, tyre pressure, visual check' },
    { icon: 'pulse', title: 'Free Car Scanning', description: "2 full diagnostic scans — know your car's health" },
    { icon: 'shield-checkmark', title: 'Free Damage Assessment & Insurance Claim', description: 'Accident or dent? We assess, document & handle your insurance claim end-to-end' },
    { icon: 'flash', title: 'Priority Slot Booking', description: 'Members get first pick — skip the wait' },
    { icon: 'ribbon', title: '6-Month Extended Warranty', description: '6x our standard coverage on every service' },
  ],
  addOn: {
    icon: 'car-sport',
    title: '2nd Car Add-On',
    description: "Cover your family's second car — same benefits",
    price: '+₹299',
  },
  footerNote: 'Valid 12 months from activation · Linked to registered mobile number',
};

export const SUPPORT_FAQ_CATEGORIES: Record<string, Array<{ question: string; answer: string }>> = {
  Account: [
    { question: 'How do I create a MyFNG account?', answer: 'Download the MyFNG app.\nEnter your mobile number.\nVerify using OTP.\nComplete your profile setup.' },
    { question: 'How do I login to the MyFNG app?', answer: 'Open the MyFNG app.\nEnter your registered mobile number.\nVerify using OTP.\nLogin successfully.' },
    { question: 'Why am I not receiving OTP?', answer: 'Wait for 30–60 seconds.\nCheck network signal.\nEnsure DND/SMS blocking is disabled.\nTap “Resend OTP”.' },
    { question: 'How can I change my mobile number?', answer: 'Open Profile section.\nTap “Edit Profile”.\nSelect “Change Mobile Number”.\nVerify new number using OTP.' },
    { question: 'How can I update my profile information?', answer: 'Go to Profile section.\nTap “Edit Profile”.\nUpdate your details.\nTap “Save Changes”.' },
    { question: 'How do I add my car in the app?', answer: 'Open “Setting Page”.\nTap “Add Vehicle”.\nEnter vehicle details.\nSave your vehicle.' },
    { question: 'Can I add multiple vehicles in one account?', answer: 'Yes, you can add multiple vehicles.' },
    { question: 'How do I remove a vehicle from my garage?', answer: 'Open “Setting Page”.\nSelect the vehicle.\nTap “Remove/Delete Vehicle”.\nConfirm removal request.' },
  ],
  Booking: [
    { question: 'How do I book a car service?', answer: 'Select your service and click “Book Now”.\nSelect your location.\nChoose your Vehicle.\nAdd Name & Number.\nChoose required service/plan.\nSelect preferred slot.\nConfirm booking request.' },
    { question: 'How do I reschedule my booking?', answer: 'You can call on given number to reschedule your booking.' },
    { question: 'How do I cancel a service booking?', answer: 'You can call on given number to cancel your booking.' },
    { question: 'How can I track my car service status live?', answer: 'Open “My Bookings”.\nSelect active booking.\nTap “Track Service”.\nView live updates.' },
    { question: 'Can I book emergency roadside assistance from the app?', answer: 'Open MyFNG app.\nTap “Roadside Assistance”.\nShare your location.\nConfirm assistance request.' },
    { question: 'Does MyFNG provide warranty on services?', answer: 'Warranty available on selected services.\nCheck warranty details before booking.\nSave service invoice safely.\nContact support for claims.' },
  ],
  Payment: [
    { question: 'Which payment methods are supported?', answer: 'UPI payments supported.\nDebit/Credit cards supported.\nNet Banking available.\nWallet and cash supported.' },
    { question: 'My payment failed but money was deducted. What should I do?', answer: 'Wait for payment confirmation.\nCheck booking status.\nSave payment screenshot.\nContact support if needed.' },
    { question: 'How long does refund processing take?', answer: 'Refunds usually take 5–7 days.\nCheck bank processing time.\nMonitor payment account.\nContact support for delays.' },
    { question: 'Can I pay after service completion?', answer: 'Check payment availability.\nSelect supported payment option.\nConfirm payment after service.\nCollect payment receipt.' },
  ],
};

export type FaqCategory = {
  title: string;
  icon: string;
  color: string;
  items: { q: string; a: string }[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    title: 'General Car Service',
    icon: 'help-circle',
    color: '#2563EB',
    items: [
      { q: 'What is My FNG?', a: 'My FNG - Friendly Neighbourhood Garage is a network of over 100+ A Grade Multi-brand Car Servicing and Repair Stations across Mumbai, Navi Mumbai, Thane, Palghar, Nashik and Pune. We connect car owners to A-grade service centers to ensure hassle-free and high-quality maintenance experiences.' },
      { q: 'What brands of cars do you service at My FNG?', a: 'My FNG services all major car brands. Our skilled technicians are trained to handle a wide range of vehicle makes and models ensuring comprehensive care for your car.' },
      { q: 'How can I find a My FNG service center near me?', a: 'You can find the nearest My FNG service center by visiting our website www.myfng.in/workshop-locator or by calling our customer support for assistance.' },
      { q: 'What services does My FNG Offer?', a: 'My FNG offers a wide range of car services including routine maintenance, oil changes, brake repairs, engine diagnostics, tyre services and complex repairs. Our service centers are equipped to handle all your car servicing needs.' },
      { q: 'How can I book a service appointment with My FNG?', a: 'You can book service via MyFNG AI Booking Agent - https://myfng.in/ai-booking or online through our website www.myfng.in/book-service or by calling our customer support. We offer flexible scheduling to accommodate your convenience.' },
      { q: 'Do you use genuine parts for repairs and servicing?', a: 'Yes, My FNG uses only genuine and high-quality (OEM/OES) spare parts for all repairs and servicing. We prioritize the longevity and performance of your vehicle.' },
      { q: 'Can I get an estimate before the service is performed?', a: 'Yes, My FNG provides detailed estimates before any service or repair work is performed. This ensures transparency and allows you to make informed decisions about your car.' },
      { q: 'Is there a Warranty On The Services Provided?', a: 'Yes, we offer a 1000 Kms or 1 Month Warranty on the parts and labour involved in your car\'s service. Warranty details are also available on our website www.myfng.in.' },
      { q: 'How Can I Contact You For More Questions?', a: 'If you have any additional questions or need assistance you can reach out to us via our website www.myfng.in/contact-us or call us at +91-9152307030. Our customer support team is here to help.' },
      { q: 'What Payment Options Are Available For Car Services?', a: 'We accept various payment methods including credit/debit cards, UPI and cash. For any specific questions about payment feel free to ask when booking your service or call us at +91-9152307030.' },
      { q: 'Can Periodic Car Service Improve My Car\'s Fuel Efficiency?', a: 'Yes, regular servicing can enhance your car\'s fuel efficiency by ensuring all systems are functioning optimally. This includes replacing filters, maintaining proper tire pressure and keeping the engine well-tuned.' },
      { q: 'How Long Will The Car Service Take?', a: 'The time required for a periodic service depends on the work needed and your car\'s condition. On average a standard service may take between 5 to 6 hours. We will provide you with an estimated time during the booking process.' },
      { q: 'What Should I Do If I Notice Any Issues Between Services?', a: 'If you notice any unusual sounds, vibrations or dashboard warning lights contact us immediately for a diagnostic check. Addressing problems early can prevent more significant repairs.' },
      { q: 'Why Should I Keep Records Of My Car\'s Services?', a: 'Keeping records of your car\'s service history is important for warranty compliance, resale value and tracking any recurring issues. It also helps you stay informed about your car\'s maintenance needs.' },
      { q: 'How Often Should I Service My Car?', a: 'It\'s generally recommended to service your car every 10,000 kilometers or every 6 months, whichever comes first. This ensures your car remains in optimal condition.' },
      { q: 'Why Is Periodic Service Necessary For Every Car?', a: 'Periodic car service is essential to maintain your car\'s safety, performance and longevity. Regular servicing helps identify problems early, preventing costly repairs and keeping your car in its best condition.' },
      { q: 'How Is My FNG Periodic Car Service Better Compared To Other Car Services?', a: 'At My FNG we focus on delivering high-quality car services using genuine spare parts and company-recommended oils & filters to ensure your car performs at its best. We offer a 1000 Kms or 1 Month Warranty on our services ensuring peace of mind. Our expert technicians use advanced diagnostic tools and we provide transparent pricing with spare parts charged at actual cost. Additionally, our convenient online booking system and customer support set us apart from the competition.' },
    ],
  },
  {
    title: 'Periodic Car Service',
    icon: 'construct',
    color: '#4F46E5',
    items: [
      { q: 'Why is regular periodic car service important?', a: 'Regular periodic car service helps maintain your car\'s performance, safety, fuel efficiency, and reliability. It prevents major breakdowns by identifying minor issues early and ensures smoother driving and longer engine life.' },
      { q: 'How often should I get my car serviced?', a: 'It is recommended to service your car every 10,000 kms or 6 months, whichever comes first. Regular servicing helps maintain optimal performance and avoids expensive repairs in the future.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What does a typical Periodic Car Service at My FNG include?', a: 'Periodic service at My FNG includes engine oil replacement, oil filter change, fluid top-ups, brake inspection, tyre pressure check, air filter cleaning, interior vacuuming, wheel rotation, and overall car health inspection.' },
      { q: 'What are the signs that my car needs periodic servicing?', a: 'Common signs include reduced mileage, unusual engine noise, warning lights on the dashboard, vibration while driving, poor braking performance, or delayed pickup.' },
      { q: 'How is My FNG\'s Periodic Car Service different from other car garages?', a: 'My FNG provides trained technicians, genuine spare parts, upfront pricing, free pickup & drop, live service updates on WhatsApp, and 1,000 Kms / 1 Month service warranty for complete peace of mind.' },
      { q: 'Will periodic service improve my car\'s mileage and performance?', a: 'Yes. Regular service ensures clean engine components, proper lubrication, and optimized fuel combustion, which improves mileage, pickup, and overall driving performance.' },
      { q: 'How long does a periodic car service take at My FNG?', a: 'Most periodic services are completed within the same day, depending on the car condition and additional repairs required.' },
      { q: 'Will I be charged extra for spare parts during periodic service?', a: 'Periodic service package includes labor and listed consumables. Any additional spare parts required will be charged at actual cost after customer approval.' },
      { q: 'What if my car needs additional repairs during service?', a: 'My FNG technicians will first inspect the issue, share photos/videos, provide an estimate, and proceed only after your approval.' },
      { q: 'Is there any warranty on periodic car service at My FNG?', a: 'Yes. My FNG provides 1,000 Kms or 1 Month service warranty on periodic car service.' },
      { q: 'How can I book Periodic Car Service with My FNG?', a: 'You can easily book online at www.myfng.in/book-service or call customer support to schedule free pickup & drop for your car service.' },
    ],
  },
  {
    title: 'AC Service',
    icon: 'snow',
    color: '#0891B2',
    items: [
      { q: 'Why is regular car AC service important?', a: 'Regular AC service keeps your car\'s air conditioning system working efficiently, providing proper cooling and improved air quality. It helps prevent refrigerant leaks, maintains system efficiency, and prevents costly repairs by addressing issues early.' },
      { q: 'How often should I service my car\'s AC?', a: 'It\'s recommended to service your car\'s AC every 12 months or before the summer season to ensure proper cooling. Regular servicing also helps maintain your AC system\'s performance and longevity.' },
      { q: 'What does a typical car AC service at My FNG include?', a: 'A typical AC service includes gas charging, refrigerant level check, leak detection, vacuuming, pressure testing, and performance inspection.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What are the signs that my car\'s AC needs servicing?', a: 'Common signs include reduced cooling performance, unusual odors, strange noises, warm air from vents, or water leakage.' },
      { q: 'How is My FNG\'s car AC service different from other service providers?', a: 'My FNG AC service uses genuine spare parts and company-recommended refrigerants. We also provide a 1,000 kms / 1 month service warranty for added peace of mind.' },
      { q: 'What is car AC gas charging and why is it necessary?', a: 'Car AC gas charging involves refilling refrigerant in the AC system to maintain proper cooling performance and prevent damage to AC components.' },
      { q: 'How do you detect leaks in the car AC system?', a: 'Specialized leak detection tools inspect refrigerant lines and components.' },
      { q: 'How long does a car AC service take at My FNG?', a: 'Service time varies with condition and complexity.' },
      { q: 'Will I be charged for spare parts during AC service?', a: 'Yes, spare parts are charged at actual cost.' },
      { q: 'What happens if my AC system needs repairs beyond a standard service?', a: 'Technicians will recommend the required repairs and share an estimate before proceeding.' },
      { q: 'What should I do if my car\'s AC is still not cooling properly after service?', a: 'Contact My FNG under the warranty for inspection and resolution.' },
      { q: 'How can I schedule an AC service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Car Engine Service',
    icon: 'pulse',
    color: '#EA580C',
    items: [
      { q: 'Why is car engine service important for my car?', a: 'Regular engine service keeps your car performing efficiently, enhances fuel economy, and prevents major repairs.' },
      { q: 'How often should I get my car\'s engine serviced?', a: 'Recommended every 6 months or 10,000 km (refer to manufacturer\'s recommendations).' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What does an engine service at My FNG include?', a: 'Engine service includes engine bay inspection, engine tuning, wiring inspection, belt and hose inspection, spark plug cleaning, air filter cleaning, and throttle body cleaning.' },
      { q: 'What are the signs that my car\'s engine needs servicing?', a: 'Warning lights, rough idling, unusual engine noise, smoke from the exhaust, or reduced fuel economy.' },
      { q: 'How is My FNG engine service different from others?', a: 'Use of genuine parts plus 1,000 Kms/1 Month Warranty and thorough diagnostics.' },
      { q: 'Will I be charged for spare parts during engine service?', a: 'Yes, parts are billed at actual cost.' },
      { q: 'How long does an engine service take?', a: 'Time depends on diagnostics and vehicle condition.' },
      { q: 'What should I do if I notice engine issues between services?', a: 'Contact support for diagnostics to prevent serious problems.' },
      { q: 'Do you offer any warranty on engine service?', a: 'Yes, 1,000 Kms/1 Month Warranty covers engine services.' },
      { q: 'How can I increase the lifespan of my car\'s engine?', a: 'Regular maintenance, timely oil changes, and proper driving habits help increase engine life.' },
      { q: 'How can I book an Engine service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Battery Service',
    icon: 'battery-charging',
    color: '#CA8A04',
    items: [
      { q: 'Why is regular car battery service important?', a: 'Regular battery service ensures reliable starting, prevents sudden breakdowns, and extends battery life.' },
      { q: 'How often should my car battery be checked?', a: 'Battery health should be checked every 6 months or before extreme summer and monsoon seasons.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What does a battery service at My FNG include?', a: 'Battery inspection, voltage testing, terminal cleaning, charging, and jump-start support if required.' },
      { q: 'How do I know if my car battery is weak?', a: 'Slow engine cranking, dim headlights, warning lights, or frequent jump-starts indicate a weak battery.' },
      { q: 'How long does a car battery usually last?', a: 'Most car batteries last between 2 to 3 years, depending on usage and weather conditions.' },
      { q: 'Can extreme weather affect my car battery?', a: 'Yes. High heat and extreme cold can reduce battery efficiency and lifespan.' },
      { q: 'Do you replace car batteries at My FNG?', a: 'Yes. Battery replacement is available using genuine, manufacturer-approved batteries.' },
      { q: 'Will battery replacement cost extra?', a: 'Yes. The cost of the new battery is charged at actual market price.' },
      { q: 'How long does battery service take?', a: 'Battery inspection and service usually take 30 to 60 minutes.' },
      { q: 'Is battery service covered under warranty?', a: 'Battery service labor is covered under My FNG warranty, while battery warranty depends on the manufacturer.' },
      { q: 'How can I schedule a Battery service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Brake Service',
    icon: 'disc',
    color: '#DC2626',
    items: [
      { q: 'Why is regular brake service necessary?', a: 'Brake service ensures safe stopping performance and prevents brake failure.' },
      { q: 'How often should brakes be inspected?', a: 'Brakes should be checked every 10,000 km or every 6 months.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What does brake service at My FNG include?', a: 'Brake pad inspection, cleaning, greasing, brake fluid check, and system diagnostics.' },
      { q: 'What are the signs that my brakes need servicing?', a: 'Squealing noise, grinding sound, vibration, soft brake pedal, or warning lights.' },
      { q: 'How long do brake pads usually last?', a: 'Brake pads typically last between 15,000–40,000 km, depending on driving habits.' },
      { q: 'Do you replace brake pads and discs?', a: 'Yes. Brake pad and disc replacement is done using genuine or OEM-approved parts.' },
      { q: 'Is brake fluid replacement included?', a: 'Brake fluid replacement is recommended every 2 years and charged separately if required.' },
      { q: 'How long does brake service take?', a: 'Standard brake service usually takes 1 to 2 hours.' },
      { q: 'Can worn brakes affect fuel efficiency?', a: 'Yes. Dragging or worn brakes can increase fuel consumption.' },
      { q: 'Is there a warranty on brake service?', a: 'Yes. Brake service comes with a 1,000 km or 1 month service warranty.' },
      { q: 'How can I book a Brake service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Tyre Service',
    icon: 'ellipse',
    color: '#059669',
    items: [
      { q: 'Why is tyre maintenance important?', a: 'Proper tyre maintenance ensures safety, better handling, and improved fuel efficiency.' },
      { q: 'What does tyre service at My FNG include?', a: 'Tyre pressure check, rotation, balancing, alignment inspection, and condition check.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'How often should tyre rotation be done?', a: 'Tyre rotation is recommended every 10,000 km or 6 months.' },
      { q: 'What are signs that tyres need replacement?', a: 'Low tread depth, uneven wear, cracks, bulges, or frequent punctures.' },
      { q: 'What is the minimum safe tyre tread depth?', a: 'The recommended minimum tread depth is 1.5 mm.' },
      { q: 'What is tyre balancing and why is it needed for smooth driving?', a: 'Tyre balancing prevents vibrations and ensures even tyre wear.' },
      { q: 'What is wheel alignment and why is it important for my car?', a: 'Wheel alignment ensures correct wheel angles for stable steering and tyre longevity.' },
      { q: 'Can improper tyres affect braking?', a: 'Yes. Worn or improperly inflated tyres reduce braking efficiency.' },
      { q: 'How long does tyre service take?', a: 'Basic tyre service takes around 30 to 60 minutes.' },
      { q: 'Do you offer tyre replacement?', a: 'Yes. Tyre replacement is available with genuine and branded tyre options.' },
      { q: 'How can I book Wheel Alignment & Balancing with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Denting & Painting',
    icon: 'brush',
    color: '#9333EA',
    items: [
      { q: 'What is included in denting and painting service?', a: 'Dent removal, surface preparation, primer, paint application, clear coat, and polishing.' },
      { q: 'How long does denting and painting take?', a: 'The process usually takes 2 to 5 days depending on damage severity.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'Can you match my car\'s original paint color?', a: 'Yes. We use computerized color matching for accurate paint finish.' },
      { q: 'Is denting and painting covered under insurance?', a: 'Yes. Insurance claim support is available where applicable.' },
      { q: 'Does denting & painting cover rusted panels?', a: 'Rust treatment may require additional work and is not included in standard packages.' },
      { q: 'Will the paint quality last long?', a: 'Yes. High-quality paints and clear coats are used for long-lasting finish.' },
      { q: 'Do you provide warranty on paint work?', a: 'Yes. Paint and workmanship warranty is provided.' },
      { q: 'Can minor scratches be fixed without full repainting?', a: 'Yes. Minor scratches can be corrected through rubbing and polishing.' },
      { q: 'Is part removal included in denting service?', a: 'Yes, if required for quality repair and finish.' },
      { q: 'Can I service multiple panels together?', a: 'Yes. Multiple-panel denting and painting packages are available.' },
      { q: 'How can I schedule a Denting & Painting service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Car Detailing',
    icon: 'sparkles',
    color: '#DB2777',
    items: [
      { q: 'What is car detailing?', a: 'Car detailing is a deep cleaning and protection process for both interior and exterior surfaces.' },
      { q: 'What does exterior detailing include?', a: 'Washing, claying, polishing, waxing, and paint protection treatment.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What does interior detailing include?', a: 'Interior vacuuming, seat shampooing, dashboard cleaning, and odor removal.' },
      { q: 'How often should car detailing be done?', a: 'Car detailing is recommended every 6 months.' },
      { q: 'What is ceramic or nano coating?', a: 'It is a protective layer applied on paint to enhance shine and protect from scratches and UV rays.' },
      { q: 'How long does detailing service take?', a: 'Depending on package, detailing can take 4 to 8 hours.' },
      { q: 'Is detailing safe for old cars?', a: 'Yes. Detailing improves appearance and preserves interior and exterior surfaces.' },
      { q: 'Does detailing remove scratches?', a: 'Minor scratches and swirl marks can be reduced through polishing.' },
      { q: 'Will detailing improve resale value?', a: 'Yes. A well-maintained car has higher resale value.' },
      { q: 'Is detailing covered under warranty?', a: 'Detailing quality assurance is provided for the service performed.' },
      { q: 'How can I book a Detailing service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
  {
    title: 'Clutch Maintenance',
    icon: 'settings',
    color: '#334155',
    items: [
      { q: 'Why is clutch maintenance important?', a: 'Proper clutch maintenance ensures smooth gear shifting and prevents breakdowns.' },
      { q: 'What are signs of clutch problems?', a: 'Hard gear shifting, clutch slipping, burning smell, or unusual noise.' },
      { q: 'Do you provide free pickup and drop for car service?', a: 'Yes. My FNG offers convenient free pickup and drop service for most car services depending on location and service type.' },
      { q: 'What does clutch maintenance include?', a: 'Clutch inspection, adjustment, pressure plate check, and replacement if required.' },
      { q: 'How long does a clutch usually last?', a: 'A clutch can last between 50,000 to 80,000 km depending on driving habits.' },
      { q: 'How long does clutch service take?', a: 'Clutch maintenance or replacement usually takes 6 to 8 hours.' },
      { q: 'Do you use genuine clutch parts?', a: 'Yes. Only manufacturer-approved or OEM-quality clutch parts are used.' },
      { q: 'Is clutch replacement included in maintenance package?', a: 'Replacement parts are charged separately at actual cost.' },
      { q: 'Can poor clutch affect fuel efficiency?', a: 'Yes. A slipping clutch increases fuel consumption.' },
      { q: 'Is there a warranty on clutch service?', a: 'Labor warranty is provided; parts carry manufacturer warranty.' },
      { q: 'How can I increase clutch life?', a: 'Avoid riding the clutch, use proper gear shifting, and follow regular inspections.' },
      { q: 'How can I schedule a Clutch Service with My FNG?', a: 'Online booking via website www.myfng.in/book-service or by calling directly.' },
    ],
  },
];

export const LEGAL_SECTIONS = {
  privacyIntro:
    'MY FNG Autocare Private Limited ("MY FNG", "we", "our", or "us") is committed to safeguarding the privacy and personal data of users who access or use our website, mobile applications, and related services (collectively, the "Platform").\n\nThis Privacy Policy outlines how MY FNG collects, processes, uses, stores, and protects personal data in connection with the use of our Platform and services.\n\nThis Policy is published in compliance with the provisions of the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, and other applicable laws and regulations in India.\n\nBy accessing or using the Platform, you acknowledge that you have read and understood this Privacy Policy and consent to the collection and processing of your personal data in accordance with its terms.',
  privacyFull:
    'MY FNG – Privacy Policy\nLast Updated: March 2026',
  privacy: [
    {
      title: '1. Eligibility',
      content:
        'The Platform is intended for use by individuals who are 18 years of age or older.\n\nMY FNG does not knowingly collect or process personal data from individuals under the age of 18 without verifiable consent from a parent or legal guardian. If MY FNG becomes aware that personal data of a minor has been collected without such consent, we will take appropriate steps to delete such information.',
    },
    {
      title: '2. Information We Collect',
      content:
        'We may collect the following categories of personal data when you access or use our Platform:\n\nA. Registration Information\n» Name\n» Mobile number\n» Email address\n» Location or address\n\nB. Vehicle Information\n» Vehicle registration number\n» Car model and variant\n» Fuel type\n» Service history (if voluntarily provided)\n\nC. Transaction Information\n» Service booking details\n» Appointment information\n» Workshop interactions\n» Payment details (processed through secure third-party payment gateways; MY FNG does not store sensitive financial information such as card details)\n\nD. Technical Information\n» IP address\n» Browser type and version\n» Device information\n» Operating system\n» Network details\n» Crash logs and diagnostic data\n\nE. Usage and Behavioral Data\n» Pages visited on the Platform\n» Search queries and activity\n» Interaction timestamps\n» Platform usage analytics\n\nF. Location Data\nWe may collect approximate geographic location data to enable location-based services such as identifying nearby workshops, service availability, and facilitating vehicle pickup and delivery.',
    },
    {
      title: '3. How We Use Personal Data',
      content:
        'MY FNG uses the personal data collected for the following purposes:\n\nA. Service Delivery\n» To process and manage service bookings\n» To coordinate with partner workshops and service providers\n» To arrange vehicle pickup and delivery services\n\nB. Customer Support\n» To respond to customer queries and resolve complaints\n» To provide updates regarding ongoing or completed services\n» To maintain and improve service quality\n\nC. Platform Improvement\n» To analyze user behavior and usage patterns\n» To improve platform functionality, features, and performance\n» To enhance overall user experience\n\nD. Communication\n» To send booking confirmations and service-related notifications\n» To provide important updates regarding services or platform changes\n» To share promotional communications, offers, and new services (where permitted by applicable law)\n\nE. Security and Fraud Prevention\n» To detect, prevent, and investigate fraudulent or unauthorized activities\n» To prevent misuse of the Platform\n» To ensure the security and integrity of our systems and services\n\nMY FNG processes personal data only for lawful purposes, including based on user consent, for the performance of a contract, compliance with legal obligations, and legitimate business interests, in accordance with applicable laws.',
    },
    {
      title: '4. Third-Party Tracking & Advertising Technologies',
      content:
        'To improve our Platform, services, and marketing effectiveness, MY FNG may use third-party analytics and advertising technologies.\n\nA. Google Analytics and Advertising Tools\nMY FNG may use Google Analytics 4 (GA4) and related Google services to analyze how users interact with the Platform, including traffic patterns, user behavior, and overall performance. Google Analytics may collect information such as device identifiers, IP address, and usage data. Users may opt out of Google Analytics tracking by using the Google Analytics opt-out browser add-on or by adjusting their browser settings.\n\nB. Meta Business Tools\nMY FNG may use Meta Pixel and Conversions API (CAPI) to measure advertising performance and improve marketing campaigns. These tools may process limited personal data, including encrypted or hashed identifiers, to:\n» Create Custom and Lookalike Audiences\n» Measure Campaign Effectiveness\n» Deliver Relevant Advertisements\n\nUsers can manage their advertising preferences directly through their accounts on respective platforms. These third-party tools may involve the transfer and processing of data outside India. MY FNG ensures that such processing is carried out in accordance with applicable data protection laws and appropriate safeguards.',
    },
    {
      title: '5. Sharing and Disclosure of Information',
      content:
        'MY FNG does not sell, rent, or trade personal data to third parties. Personal data may be shared only in the following circumstances:\n\nA. Service Partners\nWe may share relevant personal data with verified workshops and service partners solely for the purpose of fulfilling service requests, including vehicle servicing, pickup, and delivery. Such partners are contractually obligated to use the data only for the intended purpose.\n\nB. Legal and Regulatory Requirements\nWe may disclose personal data where required to do so by applicable law, regulation, legal process, or governmental request.\n\nC. Service Providers\nWe may engage trusted third-party service providers to support the operation of our Platform, including:\n» Cloud hosting and infrastructure providers\n» Payment gateway providers\n» Analytics and tracking service providers\n» Communication and notification service providers\n\nD. Business Transfers\nIn the event of a merger, acquisition, restructuring, or sale of assets, personal data may be transferred to the acquiring or successor entity, subject to appropriate data protection safeguards.',
    },
    {
      title: '6. Aggregator Service Disclaimer',
      content:
        'MY FNG operates solely as a technology platform that facilitates connections between customers and independent automotive workshops and service providers.\n\nWhile MY FNG undertakes reasonable due diligence and verification of partner workshops, all vehicle servicing, repairs, and related services are performed directly by independent third-party service providers.\n\nMY FNG does not control, supervise, or guarantee the quality, safety, or legality of services provided by such third parties. Users acknowledge that any service availed through the Platform is at their own discretion and risk.',
    },
    {
      title: '7. Data Security',
      content:
        'MY FNG implements appropriate technical and organizational measures to safeguard personal data against unauthorized access, disclosure, alteration, or destruction. These measures include:\n» Encryption of data during transmission\n» Secure servers and hosting infrastructure\n» Role-based access controls and restricted employee access\n» Internal data protection policies and procedures\n\nWe regularly review and update our security practices. However, no method of transmission over the internet or electronic storage is completely secure. In the event of a data breach, MY FNG will take appropriate steps to mitigate the impact and will notify affected users and relevant authorities as required under applicable law.',
    },
    {
      title: '8. Data Retention',
      content:
        'MY FNG retains personal data only for as long as necessary to:\n» Provide and manage services requested by users\n» Comply with applicable legal and regulatory obligations\n» Resolve disputes or enforce agreements\n» Maintain records for legitimate business purposes\n\nCertain records may be retained for longer periods if required by law. Once personal data is no longer required, MY FNG will take reasonable steps to securely delete or anonymize the data.',
    },
    {
      title: '9. Your Rights Under DPDP Act 2023',
      content:
        'Under the Digital Personal Data Protection Act, 2023, users have the following rights regarding their personal data:\n\nA. Right to Access – You may request a summary of the personal data being processed about you.\n\nB. Right to Correction – You may request correction of any inaccurate, incomplete, or outdated personal data.\n\nC. Right to Erasure – You may request deletion of your personal data where permitted by law.\n\nD. Right to Withdraw Consent – You may withdraw previously given consent for data processing at any time.\n\nE. Right to Nominate – You may nominate another individual to exercise your data protection rights in the event of your death or incapacity.\n\nF. Right to Grievance Redressal – You may contact the designated grievance officer to address any concerns.\n\nMY FNG will acknowledge your request within 48 hours and endeavor to resolve it within 30 days, in accordance with applicable law.',
    },
    {
      title: '10. Cookies and Similar Technologies',
      content:
        'MY FNG uses cookies and similar technologies to enhance the user experience on our Platform, including to:\n» Remember user preferences and settings\n» Analyze website and platform traffic\n» Improve platform functionality, performance, and features\n\nUsers may disable cookies through their browser or device settings; however, some Platform features may not function properly if cookies are disabled.',
    },
    {
      title: '11. Communications',
      content:
        'By providing your contact information, you consent to receive communications from MY FNG, which may include:\n» Booking confirmations and service-related notifications\n» Customer support messages\n» Promotional communications, offers, or updates via SMS, WhatsApp, RCS, email, or phone calls\n\nUsers may opt out of promotional communications at any time by following the opt-out instructions provided in the communication or by contacting MY FNG directly.',
    },
    {
      title: '12. Account and Data Deletion',
      content:
        'Users may request deletion of their account and personal data through the following methods:\n\nA. Platform Request – Users may submit a deletion request through their account settings, if available.\n\nB. Web Request – Users may submit a deletion request through: https://myfng.in/contact-us\n\nDeletion requests are typically processed within 90 days, except where retention is required for legal, regulatory, or legitimate business purposes.',
    },
    {
      title: '13. Intellectual Property',
      content:
        'All content on the MY FNG Platform, including but not limited to trademarks, service marks, logos, software, and materials, is the property of MY FNG Autocare Private Limited.\n\nUsers are prohibited from:\n» Copying, reproducing, or modifying Platform content\n» Distributing or publicly displaying Platform content\n» Reverse engineering or decompiling software or materials\n» Commercially exploiting Platform content without prior written permission from MY FNG',
    },
    {
      title: '14. Policy Updates',
      content:
        'MY FNG may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements.\n\nAny updates will be posted on this page with a revised "Last Updated" date. Continued use of the Platform after such updates constitutes acceptance of the updated Privacy Policy.',
    },
    {
      title: '15. Governing Law and Jurisdiction',
      content:
        'This Privacy Policy shall be governed by and construed in accordance with the laws of India.\n\nAny disputes arising out of or in connection with this Privacy Policy shall be subject to the exclusive jurisdiction of the competent courts in Thane, Maharashtra, India.',
    },
    {
      title: '16. Grievance Officer',
      content:
        'If you have any questions, concerns, or complaints regarding this Privacy Policy or the processing of your personal data, you may contact the designated Grievance and Data Protection Officer:\n\n» Name: Nitish Jha\n» Email: cs-reply@myfng.in\n» Address: A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate, Thane (West), Maharashtra - 400604, India\n\nFor general support inquiries: info@myfng.in\n\nMY FNG will acknowledge grievances within 48 hours and aim to resolve them within 30 days, in accordance with the DPDP Act, 2023. If a grievance is not satisfactorily resolved, users may escalate the matter to the appropriate regulatory authority under the applicable law.\n\nIf you do not agree with this Privacy Policy, please discontinue use of the Platform and Services.',
    },
  ],
  termsIntro:
    'My FNG Autocare Private Limited, a company duly incorporated under the Companies Act, 2013 and having its registered office at A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate, Thane (West), Thane - 400604, Maharashtra, India ("My FNG", "Company", "we", "us", or "our"), owns and operates a digital platform under the brand name My FNG. The Platform enables users to discover, schedule, and manage car maintenance, repair, inspection, and other related automotive services offered by independent third-party service providers ("Partner Workshops").\n\nThese Terms & Conditions ("Terms") govern your access to and use of the My FNG website available at www.myfng.in ("Website") and the My FNG mobile application ("App"), including all associated features, content, functionalities, and services provided through them (collectively referred to as the "Services").\n\nBy accessing, visiting, registering on, downloading, or using the Platform, or by availing any Services through it, you acknowledge that you have read, understood, and agreed to be bound by these Terms.\n\nIf you do not agree with any part of these Terms, you must not access or use the Platform or Services and should discontinue usage immediately.\n\nMy FNG reserves the right to modify, revise, or update these Terms at any time. Any updates shall become effective immediately upon publication. Continued use after updates constitutes acceptance of the revised Terms.\n\nThese Terms constitute an electronic contract under applicable Indian laws, including the Indian Contract Act, 1872 and the Information Technology Act, 2000.',
  termsFull:
    'Terms & Conditions\nEffective Date: March 2026',
  terms: [
    {
      title: 'Definitions',
      content:
        'Unless the context otherwise requires, the following capitalized terms shall have the meanings assigned to them below:\n\n» "Account" means the registered user account created by a User on the Platform.\n» "Additional Services" means any services, repairs, or works outside the scope of the selected Service Package.\n» "Affiliate" means any entity that directly or indirectly controls, is controlled by, or is under common control with My FNG.\n» "Applicable Law" means all statutes, rules, regulations, notifications, and orders having the force of law in India.\n» "Booking" means a service request or appointment initiated by a User through the Platform.\n» "Charges" means all amounts payable by the User including service fees, labour, spare parts, taxes, and other levies.\n» "Company" means My FNG Autocare Private Limited.\n» "Content" means all text, graphics, images, logos, designs, software, and other material on the Platform.\n» "Partner Workshop" means an independent third-party automobile service provider listed on the Platform.\n» "Platform" means the My FNG website and mobile application collectively.\n» "Privacy Policy" means the policy describing the collection, use, and protection of User Data.\n» "Service Package" means a predefined bundle of automotive services with defined scope and pricing.\n» "Services" means the technology-enabled facilitation services provided by My FNG.\n» "User" or "you" means any individual or entity that accesses or uses the Platform.\n» "User Data" means all information provided or generated by a User on the Platform.\n» "Vehicle" means any passenger car registered in India and owned or lawfully used by the User.',
    },
    {
      title: 'Services',
      content:
        'My FNG provides a technology-enabled facilitation platform that enables Users to discover, request, schedule, and manage automotive services offered by independent Partner Workshops and RSA Partners. My FNG does not itself perform any physical automotive or roadside services unless expressly stated in writing.\n\nService facilitation may include:\n» Periodic and general car servicing\n» Mechanical, electrical, and diagnostic assistance\n» Car air-conditioning, battery, tyre, and wheel-related services\n» Roadside Assistance (RSA) including vehicle towing, battery jump-start, flat tyre assistance, emergency fuel delivery, and minor on-road assistance\n» Appointment scheduling and booking confirmations\n» Service coordination and communication between Users and service providers\n» Customer support and escalation assistance\n\nAvailability may vary by location, time, vehicle type, and partner capacity.\n\nAny pricing, response times, or estimated arrival times displayed on the Platform are indicative only. My FNG reserves the right to add, modify, restrict, suspend, or discontinue any Service at any time without prior notice.\n\nMy FNG does not provide any warranty with respect to the quality or outcome of services provided by Partner Workshops or RSA Partners. Nothing shall be construed to create any partnership, agency, or employment relationship between My FNG and any service provider.',
    },
    {
      title: 'Eligibility',
      content:
        'Access to the Platform and Services is available only to individuals who are at least 18 years of age and legally competent to enter into a binding contract.\n\nIf you are accessing the Platform on behalf of any organization, you represent that you have authority to bind such entity to these Terms.\n\nYou must be the lawful owner or authorized user of the Vehicle for which Services are requested.\n\nYou agree to:\n» Provide true, accurate, current, and complete information\n» Use only vehicles lawfully owned/authorized by you\n» Maintain a compatible device and active internet connectivity\n» Comply with all applicable laws and platform policies\n\nMy FNG reserves the right to suspend or deny access if information is found to be false or incomplete.',
    },
    {
      title: 'Use of Services',
      content:
        'Subject to compliance with these Terms, My FNG grants the User a limited, personal, non-exclusive, non-transferable, and revocable right to access and use the Platform solely for lawful purposes.\n\nThe User is solely responsible for maintaining account credentials and all activities under their account.\n\nThe User shall not:\n» Place false, duplicate, or fraudulent service requests\n» Misuse RSA services for non-emergency purposes\n» Interfere with service providers or Platform operations\n» Harass or abuse Partner Workshops, RSA Partners, or My FNG personnel\n\nBy using the Services, the User consents to receive communications including calls, SMS, emails, and app notifications for service coordination and support.\n\nMy FNG reserves the right to suspend or terminate access for breach, misuse, non-payment, or conduct posing legal/operational risks.',
    },
    {
      title: 'Support',
      content:
        'My FNG provides facilitative customer support for Platform access, bookings, coordination, and general queries. Support is provided on a best-effort basis and does not constitute provision of automotive service.\n\nSupport channels:\n» Email: support@myfng.in\n» Helpline: +91-9152307030\n» Support Hours: Monday to Saturday, 10:00 a.m. to 7:00 p.m. IST\n\nResponse times may vary depending on the nature of the request and operational capacity. My FNG does not guarantee resolution within any specific timeframe.\n\nMy FNG support does not replace or substitute the obligations of Partner Workshops or RSA Partners. My FNG reserves the right to refuse support for abusive conduct, false information, or frivolous requests.',
    },
    {
      title: 'Prohibited Usage',
      content:
        'Users shall not:\n» Access or use the Platform for unlawful, fraudulent, or deceptive purposes\n» Impersonate any person or entity or misrepresent identity\n» Submit false, misleading, or fabricated information\n» Misuse Roadside Assistance for non-emergency situations\n» Attempt unauthorized access to the Platform, servers, or databases\n» Reverse engineer, decompile, or extract source code\n» Introduce viruses, malware, or harmful code\n» Disrupt platform security or performance\n» Copy, reproduce, or commercially exploit Platform content without consent\n» Engage in abusive, threatening, or inappropriate conduct\n» Use the Platform for commercial resale or competitive purposes\n» Harvest data or contact details for competitive purposes\n\nMy FNG may immediately suspend or terminate access for violations. My FNG may preserve User information for 90+ days for suspected violations and disclose information to governmental authorities where required by law.',
    },
    {
      title: 'User Comments, Feedback and Other Submissions',
      content:
        'The Platform may permit Users to submit reviews, ratings, comments, suggestions, feedback, images, or other content ("User Submissions").\n\nAll User Submissions shall be deemed non-confidential and non-proprietary unless expressly stated otherwise.\n\nBy submitting User Submissions, you grant My FNG a worldwide, irrevocable, perpetual, non-exclusive, royalty-free, transferable, and sublicensable license to use, reproduce, modify, publish, display, and distribute such content.\n\nUser Submissions shall not be false, defamatory, abusive, offensive, or infringe any rights. My FNG reserves the right to review, monitor, edit, or remove any User Submissions without prior notice.\n\nYou remain solely responsible for all User Submissions and any consequences arising from them.',
    },
    {
      title: 'User Data',
      content:
        'The User represents and warrants that all information provided is true, accurate, current, and complete. My FNG reserves the right to suspend access if User Data is found to be false or incomplete.\n\nMy FNG may collect, store, and process User Data for:\n» Facilitating Service Bookings and RSA Requests\n» Verifying and validating documents\n» Coordinating with Partner Workshops and service providers\n» Communicating service updates and support information\n» Processing payments, refunds, and transaction records\n» Ensuring platform security and fraud prevention\n» Analytics and platform improvement\n\nMy FNG may share User Data with Partner Workshops, Payment Gateways, Affiliates, and Governmental Authorities where required. User Data may be transferred to entities within India or abroad with comparable data protection standards.\n\nSubject to Applicable Law, Users may access, correct, or request deletion of User Data. The collection and protection of User Data are further governed by the Privacy Policy.',
    },
    {
      title: 'Intellectual Property Rights',
      content:
        'All intellectual property rights in the Platform are owned by or lawfully licensed to My FNG Autocare Private Limited. The Platform IP is protected under applicable intellectual property laws.\n\nMy FNG grants the User a limited, revocable, non-exclusive, non-transferable right to access and use the Platform solely for personal and lawful use.\n\nThe User shall not:\n» Copy, reproduce, modify, or create derivative works\n» Reverse engineer, decompile, or extract source code\n» Remove or obscure any copyright or trademark notices\n» Use the Company\'s branding without written consent\n» Use the Platform for any commercial purpose unless authorized\n\nUnauthorized use may result in immediate suspension and civil or criminal remedies under Applicable Law.',
    },
    {
      title: 'License',
      content:
        'My FNG grants the User a limited, non-exclusive, non-transferable, non-sublicensable, and revocable license to access and use the Platform and its content for availing the Services. The License is provided solely for personal and non-commercial use.\n\nThe User shall not copy, reproduce, distribute, sell, publicly display, reverse engineer, or circumvent security features of the Platform. No licenses or rights are granted by implication.\n\nThe Platform and all IP rights remain the exclusive property of My FNG. This License terminates automatically upon breach, suspension, or discontinuation of the Platform.',
    },
    {
      title: 'Limitation of Liability',
      content:
        'My FNG operates solely as a technology-enabled facilitation platform. All automotive services are performed by independent Partner Workshops or RSA Partners.\n\nThe Platform is provided "as is" and "as available" without warranties of merchantability, fitness, accuracy, or uninterrupted operation.\n\nMy FNG shall not be liable for any indirect, incidental, special, consequential, or punitive damages including loss of profits, business, data, or goodwill.\n\nMy FNG shall not be liable for quality, delays, cancellation, or damages related to services by Partner Workshops or RSA Partners, or for platform downtime, technical failures, or cyber incidents beyond reasonable control.\n\nTotal aggregate liability shall not exceed the facilitation fee paid for the specific Service, or INR 1,000, whichever is lower.\n\nNothing shall exclude liability that cannot be excluded under Applicable Law.',
    },
    {
      title: 'Exemptions to Liability',
      content:
        'My FNG shall not be liable for losses arising from:\n\n» Acts or Omissions of Third-Party Service Providers including workmanship quality, service outcomes, or timelines\n» Pre-existing vehicle issues, normal wear and tear, or manufacturer defects\n» Damage from prior repairs, modifications, or improper maintenance\n» Delays or non-availability of RSA services\n» Route selection or handling decisions by towing operators\n» Damage during towing, jump-start, fuel delivery, or on-road assistance\n» Force Majeure Events (natural disasters, floods, pandemics, strikes, government actions, power failures)\n» Incorrect information, failure to follow instructions, or unauthorized repairs by User\n» Loss, theft, or damage to personal belongings left inside the Vehicle\n» Changes in costs due to additional repairs or spare part price fluctuations\n» Temporary unavailability, technical malfunctions, or connectivity issues\n» Failure to achieve expected performance improvements\n» Actions taken in good faith to comply with Applicable Law',
    },
    {
      title: 'Billing / Charges',
      content:
        'Charges may include service fees, labour, inspection charges, facilitation fees, spare parts, towing, taxes, and other levies. Prices shown are indicative; final Charges may vary based on vehicle condition, additional repairs, and taxes.\n\nWork outside the scope of a selected Service Package shall be treated as Additional Services and billed separately after User approval.\n\nRSA services may be charged based on distance, time, location, vehicle type, and complexity. All Charges are exclusive of applicable taxes unless stated otherwise.\n\nPayment methods accepted: Digital payment gateways, UPI, Credit/debit cards, Net banking, and other permitted methods.\n\nBy confirming a Booking, the User authorizes My FNG to charge the applicable amount. My FNG may suspend or cancel bookings for non-payment. My FNG may revise pricing at any time for future Bookings. No Charges shall be levied without disclosure or User approval.',
    },
    {
      title: 'Cancellation and Refund',
      content:
        'Cancellation requests shall be effective only upon confirmation by My FNG.\n\n» Before Service Commencement: The User may be eligible for a refund, subject to deduction of applicable charges.\n» After Service Commencement: No refunds where service has commenced, a provider has arrived, or parts have been procured.\n» Roadside Assistance: No refunds once the service provider has been dispatched.\n» Cancellation by My FNG: May occur due to unavailability, inaccurate information, safety concerns, or non-payment.\n\nRefunds processed through the original payment method. My FNG does not offer cash refunds. Approved refunds processed within a reasonable period.\n\nNon-Refundable Amounts:\n» Inspection, Diagnostic, or Visit Charges\n» Towing or RSA Dispatch Charges\n» Charges for Additional Services Approved by the User\n» Charges Due to User\'s Absence or Incorrect Information\n\nRefunds are not guaranteed. My FNG\'s decision shall be final, subject to Applicable Law.',
    },
    {
      title: 'Dispute Resolution',
      content:
        'The User and My FNG shall first attempt to resolve Disputes amicably through mutual discussions. My FNG may internally review and facilitate further communication.\n\nUnresolved Disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996:\n» Sole arbitrator appointed by My FNG\n» Seat and venue: Thane, Maharashtra, India\n» Language: English\n\nExclusive jurisdiction of courts in Thane, Maharashtra, India for non-arbitrable matters. My FNG may seek interim relief to protect IP rights, confidential information, and platform security.\n\nDuring any Dispute, the User agrees to continue complying with these Terms. Each party bears its own costs unless otherwise determined by the arbitrator.',
    },
    {
      title: 'Governing Law',
      content:
        'These Terms shall be governed by the laws of India. Competent courts in Thane, Maharashtra, India shall have exclusive jurisdiction, subject to Applicable Law.',
    },
    {
      title: 'Modification of Terms',
      content:
        'My FNG may modify these Terms at any time. Updated versions will be published with a revised "Effective Date." Continued use constitutes acceptance. If you disagree, discontinue use.',
    },
    {
      title: 'General Provisions',
      content:
        '» Entire Agreement: These Terms and Privacy Policy constitute the entire agreement, superseding all prior understandings.\n» Severability: Invalid provisions shall be severed; remaining provisions remain in full force.\n» No Waiver: Failure to enforce any right shall not constitute a waiver.\n» Assignment: The User shall not assign rights without written consent. My FNG may freely assign.\n» Relationship of Parties: No partnership, joint venture, agency, or employment relationship is created.\n» Force Majeure: My FNG is not liable for delays due to acts of God, natural disasters, pandemics, strikes, government actions, network failures, or technical breakdowns.\n» Survival: IP Rights, Limitation of Liability, Indemnification, Dispute Resolution, and Governing Law survive termination.\n» Electronic Records: These Terms are an electronic record under the IT Act, 2000. Electronic communications have the same legal effect as written ones.',
    },
    {
      title: 'Termination',
      content:
        'The User may discontinue use at any time. Active bookings and payment obligations survive termination.\n\nMy FNG may suspend or terminate access for breaches, false information, fraudulent conduct, security risks, or as required by law. Immediate termination without notice for conduct causing harm, RSA misuse, or IP infringement.\n\nEffect of Termination:\n» Access rights immediately cease\n» Pending bookings may be cancelled\n» Outstanding Charges become immediately payable\n» License automatically terminates\n\nMy FNG shall not be liable for losses from suspension or termination. Termination does not obligate My FNG to permit re-registration.',
    },
    {
      title: 'Indemnification',
      content:
        'The User agrees to indemnify and hold harmless My FNG from all claims, losses, and expenses arising from:\n\n» Breach of these Terms, Privacy Policy, or applicable policies\n» Violation of Applicable Law\n» Misuse, abuse, or fraudulent activity including RSA misuse\n» Claims from inaccurate information, submissions, or IP infringement\n» Disputes from interaction with Partner Workshops, RSA Partners, or other service providers\n» Negligent act or willful misconduct by the User\n\nMy FNG may assume exclusive defense and the User agrees to cooperate. This Indemnification clause survives termination of these Terms.',
    },
    {
      title: 'Support / Contacting Us',
      content:
        'Customer Support Helpline: +91-9152307030\nEmail: support@myfng.in\nSupport available Monday to Saturday, 10:00 a.m. to 7:00 p.m. (IST).\n\nGrievance Redressal Officer:\n» Name: Nitish Jha\n» Mobile: +91-7977118621\n» Email: cs-reply@myfng.in\n\nBy using the Platform and Services, you acknowledge and agree to these Terms and Conditions.',
    },
  ],
};
