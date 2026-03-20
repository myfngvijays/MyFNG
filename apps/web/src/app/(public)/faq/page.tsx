'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle, Wrench, Wind, Cpu, BatteryCharging, Disc3, CircleDot, Paintbrush, Sparkles, Settings } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: FaqItem[];
}

const FAQ_DATA: FaqSection[] = [
  {
    title: 'General Car Service',
    icon: <HelpCircle className="w-5 h-5" />,
    color: 'bg-blue-600',
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
    icon: <Wrench className="w-5 h-5" />,
    color: 'bg-indigo-600',
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
    icon: <Wind className="w-5 h-5" />,
    color: 'bg-cyan-600',
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
    icon: <Cpu className="w-5 h-5" />,
    color: 'bg-orange-600',
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
    icon: <BatteryCharging className="w-5 h-5" />,
    color: 'bg-yellow-600',
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
    icon: <Disc3 className="w-5 h-5" />,
    color: 'bg-red-600',
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
    icon: <CircleDot className="w-5 h-5" />,
    color: 'bg-emerald-600',
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
    icon: <Paintbrush className="w-5 h-5" />,
    color: 'bg-purple-600',
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
    icon: <Sparkles className="w-5 h-5" />,
    color: 'bg-pink-600',
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
    icon: <Settings className="w-5 h-5" />,
    color: 'bg-slate-700',
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

function FaqQuestion({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-xl border transition-colors duration-200 ${open ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer select-none"
      >
        <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-blue-600' : 'bg-gray-200'}`}>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180 text-white' : 'text-gray-500'}`} />
        </span>
        <span className={`flex-1 text-sm font-semibold leading-snug ${open ? 'text-blue-900' : 'text-gray-800'}`}>
          {question}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pl-12">
          <p className="text-sm text-gray-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

function FaqCategory({ section, defaultOpen = false }: { section: FaqSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left cursor-pointer select-none group"
      >
        <span className={`flex-shrink-0 w-10 h-10 rounded-xl ${section.color} text-white flex items-center justify-center shadow-sm`}>
          {section.icon}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-base sm:text-lg font-bold text-gray-900 block">{section.title}</span>
          <span className="text-xs text-gray-500">{section.items.length} questions</span>
        </div>
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${open ? 'bg-blue-50' : 'bg-gray-50 group-hover:bg-gray-100'}`}>
          <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-out ${open ? 'rotate-180 text-blue-600' : 'text-gray-400'}`} />
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-2">
          {section.items.map((item, idx) => (
            <FaqQuestion key={idx} question={item.q} answer={item.a} defaultOpen={idx === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Navbar />
      <main className="pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 sm:px-6">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4">
              <HelpCircle className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Frequently Asked Questions</h1>
            <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
              Answers to the most common questions about My FNG services, bookings, pricing, and warranties.
            </p>
          </div>

          {/* FAQ Categories */}
          <div className="space-y-3">
            {FAQ_DATA.map((section, idx) => (
              <FaqCategory key={section.title} section={section} defaultOpen={idx === 0} />
            ))}
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <p className="text-sm font-semibold text-gray-900 mb-1">Still have questions?</p>
              <p className="text-sm text-gray-500 mb-4">Our customer support team is here to help.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="https://myfng.in/contact-us"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Contact Us
                </a>
                <a
                  href="tel:+919152307030"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Call +91-9152307030
                </a>
              </div>
            </div>
          </div>

          <div className="h-8" />
        </div>
      </main>
      <Footer />
    </div>
  );
}
