'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import WorkshopBrandsRow from '@/components/workshop/WorkshopBrandsRow';
import WorkshopFaqs from '@/components/workshop/WorkshopFaqs';
import PeriodicServicePackages from '@/components/workshop/PeriodicServicePackages';
import { DEFAULT_SERVICES } from '@/lib/services/catalog';
import type {
  Workshop,
  WorkshopPublicPage as WorkshopPublicPageType,
  GmbData,
  GmbReview,
} from '@/components/workshop/types';


const defaultFaqs = [
  {
    question: 'What is My FNG – Car Garage & Repairs?',
    answer:
      'My FNG (Friendly Neighbourhood Garage) is a trusted network of 100+ A-Grade multi-brand car servicing and repair workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune. Our car service center offers professional, transparent, and high-quality car servicing and repairs for local car owners.',
  },
  {
    question: 'What brands of cars do you service?',
    answer:
      'We service all major car brands and models, including hatchbacks, sedans, SUVs, and premium cars. Our technicians are trained to work on both petrol and diesel cars.',
  },
  {
    question: 'How can I find a My FNG car service center near me?',
    answer:
      'You can locate the nearest My FNG car service center by visiting www.myfng.in. You may also contact our customer support team for location details and booking assistance.',
  },
  {
    question: 'What car services are offered?',
    answer:
      'We provide a full range of car services including basic & general car service, periodic maintenance, oil changes, brake inspection & repairs, engine diagnostics & repairs, tyre services, car AC service & gas refill, battery replacement, suspension & steering work, and mechanical & electrical repairs.',
  },
  {
    question: 'How can I book a car service appointment?',
    answer:
      'You can book an AI-enabled car service appointment online via www.myfng.in or by calling our customer support team. We offer flexible appointment scheduling.',
  },
  {
    question: 'Are the technicians certified?',
    answer:
      'Yes. All technicians at My FNG are trained, experienced, and certified. They regularly undergo skill upgrades and use advanced diagnostic tools.',
  },
  {
    question: 'Do you use genuine parts for car repairs and servicing?',
    answer:
      'Yes. My FNG uses only genuine and high-quality car parts for all repairs to ensure safety, performance, and long-term reliability.',
  },
  {
    question: 'Is there a warranty on services provided?',
    answer:
      'Yes. My FNG offers service and parts warranty. Warranty terms vary based on service performed. Visit www.myfng.in or contact support for details.',
  },
  {
    question: 'How do I know if my car needs servicing?',
    answer:
      'Look for dashboard warning lights, unusual engine or brake noises, reduced fuel efficiency, poor driving performance, or delayed braking response. A basic car service is recommended every 5,000 km or 6 months.',
  },
  {
    question: 'How can I contact My FNG for more questions?',
    answer:
      'Visit www.myfng.in or call our customer support team. We are always ready to assist you.',
  },
];

export default function WorkshopPublicPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [page, setPage] = useState<WorkshopPublicPageType | null>(null);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrValue, setQrValue] = useState('');
  const [heroSlide, setHeroSlide] = useState(0);
  const [fallbackBrands, setFallbackBrands] = useState<{ name: string; logo_url: string }[]>([]);
  const [showTimingDropdown, setShowTimingDropdown] = useState(false);
  const timingRef = useRef<HTMLDivElement>(null);
  const [companyStats, setCompanyStats] = useState({
    cars_serviced: '1 Million+',
    happy_customers: '25 Lacs+',
    avg_rating: '4.8',
    touch_points: '1000+',
    verified_workshops: '100+',
    cities_covered: '6+',
    about_description: "Mumbai & Pune's Trusted Multi-Brand Car Service Network — 100+ verified workshops, AI-powered booking, and transparent service for every car owner.",
    who_we_are_1: 'MyFNG (My Friendly Neighbourhood Garage) is a network of 100+ A-Grade multi-brand car servicing workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune.',
    who_we_are_2: 'We connect car owners with professional technicians, advanced diagnostic tools, and transparent pricing — so you never overpay or worry about your car\'s health again.',
  });

  useEffect(() => {
    if (slug) fetchWorkshopPage();
  }, [slug]);

  useEffect(() => {
    if (typeof window !== 'undefined') setQrValue(window.location.href);
    fetchCompanyStats();
  }, []);

  const fetchCompanyStats = async () => {
    try {
      const res = await fetch('/api/public/company-stats');
      if (!res.ok) return;
      const json = await res.json();
      if (json?.stats) setCompanyStats((prev) => ({ ...prev, ...json.stats }));
    } catch {}
  };

  useEffect(() => {
    if (!page || (Array.isArray(page.brands) && page.brands.length > 0)) return;
    async function fetchFallbackBrands() {
      try {
        const response = await fetch('/api/super_admin/car-brands?active_only=true');
        if (!response.ok) return;
        const result = await response.json();
        setFallbackBrands(
          (result.data || []).map((b: any) => ({ name: b.name, logo_url: b.logo_url }))
        );
      } catch {
        setFallbackBrands([]);
      }
    }
    fetchFallbackBrands();
  }, [page]);


  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (timingRef.current && !timingRef.current.contains(e.target as Node)) {
      setShowTimingDropdown(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [handleOutsideClick]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const fetchWorkshopPage = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workshop_public_pages')
        .select('*, workshop:workshops(*)')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();
      if (error) throw error;
      if (data) {
        setPage(data as WorkshopPublicPageType);
        setWorkshop(data.workshop as Workshop);
        await supabase
          .from('workshop_public_pages')
          .update({ views_count: (data.views_count || 0) + 1 })
          .eq('id', data.id);
      }
    } catch (err: any) {
      console.error('Error fetching workshop page:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0a3d91]" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!page || !workshop) {
    return null;
  }

  const services: string[] = Array.isArray(page.services_offered) ? page.services_offered : [];
  const businessHours = page.business_hours || {};
  const brands = Array.isArray(page.brands) && page.brands.length ? page.brands : fallbackBrands;
  const packages = Array.isArray(page.packages) ? page.packages : [];
  const faqs = Array.isArray(page.faqs) && page.faqs.length ? page.faqs : defaultFaqs;

  const gmb: GmbData | null = (page as any).gmb_data && Object.keys((page as any).gmb_data).length > 0 ? (page as any).gmb_data : null;
  const gmbReviews: GmbReview[] = gmb?.reviews || [];
  const gmbRating = gmb?.rating ?? null;
  const gmbTotalReviews = gmb?.total_reviews ?? 0;
  const gmbLastFetched = (page as any).gmb_last_fetched_at || null;

  const sanitizePhone = (v?: string | null) => (v || '').replace(/[^\d+]/g, '');
  const whatsappNumber = page.whatsapp_number ? sanitizePhone(page.whatsapp_number) : '';
  const gmbPhone = gmb?.phone_number || '';
  const callNumber = page.alternate_phone ? sanitizePhone(page.alternate_phone) : (gmbPhone ? sanitizePhone(gmbPhone) : whatsappNumber);

  // Prefer GMB hours if available, fall back to manual
  const gmbHoursEntries: [string, string][] = (gmb?.opening_hours || [])
    .map((h): [string, string] => {
      const match = h.match(/^(\w+):\s*(.+)$/);
      return match ? [match[1].toLowerCase(), match[2].trim()] : ['', ''];
    })
    .filter(([k]) => Boolean(k));
  const manualHoursEntries = Object.entries(businessHours).filter(([, v]) => Boolean(v));
  const hoursEntries = gmbHoursEntries.length > 0 ? gmbHoursEntries : manualHoursEntries;
  const primaryHours = hoursEntries.length ? hoursEntries[0][1] : null;

  const displayName = gmb?.business_name || workshop.name || 'Multi Brand Car Garage';
  const displayRating = gmbRating ?? (typeof workshop.audit_score === 'number' ? workshop.audit_score : null);
  const auditScore = typeof workshop.audit_score === 'number' ? workshop.audit_score : null;
  const roundedAuditScore = displayRating ? Math.round(displayRating) : 0;
  const gmbAddress = gmb?.formatted_address;
  const fullAddress = gmbAddress || [workshop.address, workshop.city, workshop.state, workshop.pincode].filter(Boolean).join(', ');

  const periodicTagKeywords = ['basic service', 'periodic', '15 points', '30 points', '50 points', '60 points', '15-point', '30-point', '50-point', '60-point'];
  const serviceTags = services.length
    ? services.filter((s) => !periodicTagKeywords.some((k) => s.toLowerCase().includes(k)))
    : ['Auto Repair', 'Car Engine Repairs', 'Car AC Service', 'Car Battery Service', 'Car Brake Service', 'Roadside Assistance', 'Car Garage', 'Multibrand Workshop', 'Car Service Center'];

  const otherServices = DEFAULT_SERVICES.filter((s) => s.slug !== 'periodic-service');

  const mapsEmbedUrl = (page as any).map_embed_url
    || (page.google_maps_url?.includes('/embed') ? page.google_maps_url : null);

  const directionsUrl = page.google_maps_url && !page.google_maps_url.includes('/embed')
    ? page.google_maps_url
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

  return (
    <div className="min-h-screen bg-[#f5f7fb] font-poppins text-[13px] text-[#222]">
      <Navbar />

      {/* BREADCRUMB */}
      <div className="w-[90%] max-w-[1100px] mx-auto text-[12px] text-[#777] py-[15px]">
        Home <span className="mx-[5px]">&gt;</span> Workshop Locator <span className="mx-[5px]">&gt;</span>{' '}
        {workshop.state || 'Maharashtra'} <span className="mx-[5px]">&gt;</span>{' '}
        {workshop.city || 'Thane'} <span className="mx-[5px]">&gt;</span>{' '}
        {workshop.address?.split(',')[0] || 'Location'}
      </div>

      {/* HERO SECTION */}
      <section className="relative bg-gradient-to-br from-[#0a1628] via-[#0d2847] to-[#0a3d91]">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] rounded-full bg-[#ffc107]/5 blur-3xl" />
          <div className="absolute -bottom-[100px] -left-[100px] w-[400px] h-[400px] rounded-full bg-[#0a3d91]/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-white/5" />
        </div>

        <div className="relative w-[90%] max-w-[1200px] mx-auto pt-20 pb-16 lg:pt-24 lg:pb-20">
          <div className="flex flex-col lg:flex-row items-start gap-12 lg:gap-16">
            {/* Hero Left Content — Carousel */}
            <div className="flex-1 text-center lg:text-left min-h-[420px] lg:min-h-[380px] relative">
              {/* Slide 1: Prime Membership */}
              <div className={`transition-all duration-700 ${heroSlide === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ffc107]/20 to-[#ff9800]/20 border border-[#ffc107]/30 px-4 py-2 rounded-full mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#ffc107] animate-pulse" />
                  <span className="text-[#ffc107] text-[13px] font-semibold tracking-wide uppercase">MyFNG Prime Membership</span>
                </div>
                <h1 className="text-[32px] sm:text-[42px] lg:text-[50px] font-extrabold leading-[1.15] mb-5 text-white">
                  {displayName}
                </h1>
                <p className="text-white/80 text-[16px] lg:text-[18px] leading-relaxed mb-6 max-w-[520px] mx-auto lg:mx-0">
                  Get exclusive benefits with <strong className="text-white">MyFNG Prime</strong> — priority booking, flat 20% off on all services, free roadside assistance & more.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-8">
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-[#ffc107] text-[16px] font-bold">{displayRating || 4.8}★</span>
                    <span className="text-white/80 text-[13px]">Rated</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">10,000+</span>
                    <span className="text-white/70 text-[13px]">Cars Serviced</span>
                  </div>
                </div>
              </div>

              {/* Slide 2: Book Service */}
              <div className={`transition-all duration-700 ${heroSlide === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
                  <span className="text-[#4ade80] text-[13px] font-semibold tracking-wide uppercase">Same Day Service Available</span>
                </div>
                <h1 className="text-[32px] sm:text-[42px] lg:text-[50px] font-extrabold leading-[1.15] mb-5 text-white">
                  Expert Car Service
                  <span className="block text-[#4ade80] mt-1">Doorstep Free Pickup & Drop</span>
                </h1>
                <p className="text-white/80 text-[16px] lg:text-[18px] leading-relaxed mb-6 max-w-[520px] mx-auto lg:mx-0">
                  Free pickup & drop, live service updates on WhatsApp, genuine parts with warranty. Book now and get your car serviced today!
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-8">
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">Free Pickup & Drop</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">1000 KM Warranty</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">Genuine Parts</span>
                  </div>
                </div>
              </div>

              {/* Slide 3: Download App */}
              <div className={`transition-all duration-700 ${heroSlide === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full mb-6">
                  <span className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse" />
                  <span className="text-[#f97316] text-[13px] font-semibold tracking-wide uppercase">Download & Save 10%</span>
                </div>
                <h1 className="text-[32px] sm:text-[42px] lg:text-[50px] font-extrabold leading-[1.15] mb-5 text-white">
                  MyFNG App
                  <span className="block text-[#f97316] mt-1">Book in 60 Seconds</span>
                </h1>
                <p className="text-white/80 text-[16px] lg:text-[18px] leading-relaxed mb-6 max-w-[520px] mx-auto lg:mx-0">
                  Download the MyFNG app for instant booking, real-time tracking, exclusive offers, and the fastest way to get your car serviced.
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-8">
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">Instant Booking</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">Live Tracking</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full">
                    <span className="text-white text-[13px] font-medium">Exclusive Deals</span>
                  </div>
                </div>
              </div>

              {/* Common: App Download + USPs (always visible) */}
              <div className="mt-auto">
                <div className="mb-6">
                  <p className="text-white/60 text-[12px] uppercase tracking-widest font-medium mb-3">Download the app & get 10% off</p>
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                    <a href="https://play.google.com/store/apps/details?id=com.myfng" target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" className="h-[44px]" />
                    </a>
                    <a href="https://apps.apple.com/app/myfng" target="_blank" rel="noopener noreferrer" className="inline-block hover:opacity-80 transition-opacity">
                      <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="Download on the App Store" className="h-[44px]" />
                    </a>
                  </div>
                </div>

                {/* USP Tags */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-4">
                  <div className="flex items-center gap-2 text-white/70 text-[13px]">
                    <svg className="w-4 h-4 text-[#4ade80]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    Same Day Service
                  </div>
                  <div className="flex items-center gap-2 text-white/70 text-[13px]">
                    <svg className="w-4 h-4 text-[#4ade80]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    WhatsApp Updates
                  </div>
                  <div className="flex items-center gap-2 text-white/70 text-[13px]">
                    <svg className="w-4 h-4 text-[#4ade80]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                    Transparent Pricing
                  </div>
                </div>

                {/* Slide Indicators */}
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => setHeroSlide(idx)}
                      className={`transition-all duration-300 rounded-full ${heroSlide === idx ? 'w-8 h-2 bg-[#ffc107]' : 'w-2 h-2 bg-white/30 hover:bg-white/50'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Hero Right — Prime Membership Card */}
            <div className="w-full max-w-[460px] lg:max-w-[480px] flex-shrink-0 lg:mt-4">
              <div className="relative rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.3)]">
                <div className="absolute -inset-[2px] rounded-2xl bg-gradient-to-r from-[#0a3d91] via-[#ffc107] via-[#f97316] via-[#1aa260] to-[#0a3d91] animate-[gradient-shift_4s_linear_infinite] bg-[length:300%_100%]" />
                <div className="relative bg-white rounded-2xl overflow-hidden">
                <div className="px-7 py-6 animate-[header-shift_6s_ease_infinite] bg-[length:200%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, #0a3d91, #1a5fc9, #2563eb, #0a3d91)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-[22px] m-0">MyFNG Prime</h3>
                      <p className="text-white/70 text-[14px] mt-1 mb-0">Exclusive Membership Benefits</p>
                    </div>
                    <div className="w-12 h-12 bg-[#ffc107] rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                      <svg className="w-6 h-6 text-[#0a3d91]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    </div>
                  </div>
                </div>

                <div className="px-7 py-6">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">10% Off Periodic Packages</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">5% Cashback to Wallet</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">Free Top-Up & Inspection</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">Free Car Scanning</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">Free Insurance Claim Help</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">Prime WhatsApp Group</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">Priority Slot Booking</span></div>
                    <div className="flex items-center gap-2"><span className="text-[14px]">⭐</span><span className="text-[14px] text-[#222]">Get Extended Warranty</span></div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-[#f1f1f1]">
                    <div className="flex items-baseline gap-3 mb-4">
                      <span className="text-[18px] text-[#999] line-through">₹999</span>
                      <span className="text-[40px] font-extrabold text-[#0a3d91]">₹699</span>
                      <span className="text-[13px] font-semibold text-white bg-[#1aa260] px-3 py-1 rounded-full">/year</span>
                    </div>
                    <p className="text-[15px] font-medium text-[#333] mb-4">Join MyFNG Prime — Download the app now</p>
                    <div className="flex items-center gap-3">
                      <a
                        href="https://play.google.com/store/apps/details?id=com.myfng"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block hover:opacity-80 transition-opacity"
                      >
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                          alt="Get it on Google Play"
                          className="h-[46px]"
                        />
                      </a>
                      <a
                        href="https://apps.apple.com/app/myfng"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block hover:opacity-80 transition-opacity"
                      >
                        <img
                          src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                          alt="Download on the App Store"
                          className="h-[46px]"
                        />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TWO-COLUMN CONTENT */}
      <section className="py-10">
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[62%_38%] gap-7">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-6">
              {/* Store Header Card — Redesigned */}
              <div className="bg-white p-6 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-[22px] font-bold text-[#111] mb-1.5">
                      {displayName} – {workshop.city || 'Car Service'}
                    </h2>
                    <div className="flex items-center gap-3 text-[13px]">
                      <div className="flex items-center gap-1">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg key={star} className={`w-4 h-4 ${star <= (roundedAuditScore || 5) ? 'text-[#f4b400]' : 'text-[#ddd]'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          ))}
                        </div>
                        <span className="font-semibold text-[#333]">{displayRating || 4.8}</span>
                      </div>
                      {gmbTotalReviews > 0 && <span className="text-[#666]">({gmbTotalReviews} reviews)</span>}
                      <span className="text-[#666]">{page.views_count || 0} Views</span>
                      {primaryHours && (
                        <span className="bg-[#dcfce7] text-[#15803d] px-2.5 py-0.5 rounded-full text-[11px] font-semibold">Open Now</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Service Tags */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {serviceTags.slice(0, 10).map((tag, idx) => {
                    const colors = ['bg-blue-50 text-blue-700', 'bg-orange-50 text-orange-700', 'bg-green-50 text-green-700', 'bg-purple-50 text-purple-700', 'bg-rose-50 text-rose-700', 'bg-teal-50 text-teal-700', 'bg-amber-50 text-amber-700', 'bg-indigo-50 text-indigo-700', 'bg-cyan-50 text-cyan-700', 'bg-pink-50 text-pink-700'];
                    return (
                      <span key={tag} className={`${colors[idx % colors.length]} px-3 py-1.5 rounded-full text-[12px] font-medium`}>
                        {tag}
                      </span>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] font-medium bg-[#0a3d91] no-underline hover:bg-[#083070] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    Directions
                  </a>
                  {whatsappNumber && (
                    <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] font-medium bg-[#25d366] no-underline hover:bg-[#1da851] transition-colors">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                      WhatsApp
                    </a>
                  )}
                  {callNumber && (
                    <a href={`tel:${callNumber}`} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] font-medium bg-[#2563eb] no-underline hover:bg-[#1d4ed8] transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      Call Store
                    </a>
                  )}
                  <a href="/book-service" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-[13px] font-medium bg-[#f97316] no-underline hover:bg-[#ea580c] transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    Book Now
                  </a>
                </div>
              </div>

              {/* Highlights Stats — Redesigned with icons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-[#e8ecf4] shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#e6f0ff] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#0a3d91]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                  </div>
                  <h3 className="text-[#0a3d91] text-[18px] font-bold">{companyStats.cars_serviced}</h3>
                  <p className="text-[12px] text-[#666]">Cars Serviced</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#e8ecf4] shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#fff4e5] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#f97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <h3 className="text-[#0a3d91] text-[18px] font-bold">{companyStats.happy_customers}</h3>
                  <p className="text-[12px] text-[#666]">Happy Customers</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#e8ecf4] shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#e8f9f1] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#1aa260]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                  </div>
                  <h3 className="text-[#0a3d91] text-[18px] font-bold">{displayRating || 4.8}</h3>
                  <p className="text-[12px] text-[#666]">{gmbTotalReviews > 0 ? 'Google Rating' : 'Avg Rating'}</p>
                </div>
                <div className="bg-white p-5 rounded-xl border border-[#e8ecf4] shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-[#fef3f2] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#ef4444]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  </div>
                  <h3 className="text-[#0a3d91] text-[18px] font-bold">{companyStats.touch_points}</h3>
                  <p className="text-[12px] text-[#666]">Touch Points</p>
                </div>
              </div>

              {/* Offers Banner - Color Changing */}
              <div className="relative overflow-hidden p-5 rounded-2xl animate-[banner-color_8s_ease_infinite] bg-[length:300%_100%]" style={{ backgroundImage: 'linear-gradient(90deg, #0a3d91, #2563eb, #7c3aed, #dc2626, #ea580c, #0a3d91)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-white/70 mb-1">Limited Time Offer</p>
                    <h3 className="text-[18px] font-bold mb-1 text-white">Get 10% Off on First Service</h3>
                    <p className="text-[13px] text-white/80">Download the MyFNG App & book your first service</p>
                  </div>
                  <div className="flex-shrink-0 bg-[#ffc107] text-[#111] px-4 py-2 rounded-lg font-bold text-[14px] shadow-lg">
                    10% OFF
                  </div>
                </div>
              </div>

              {/* Workshop Details Card — Redesigned */}
              <div className="bg-white p-6 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <h3 className="font-bold text-[16px] mb-4">Workshop Details</h3>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#e6f0ff] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#0a3d91]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#999] uppercase tracking-wide mb-0.5">Address</p>
                      <p className="text-[13px] text-[#333] font-medium">{fullAddress || 'Address not available'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#e8f9f1] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#1aa260]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    </div>
                    <div>
                      <p className="text-[11px] text-[#999] uppercase tracking-wide mb-0.5">Phone</p>
                      <p className="text-[13px] text-[#333] font-medium">
                        {callNumber || gmbPhone || '—'}
                        {gmbPhone && callNumber !== sanitizePhone(gmbPhone) && (
                          <span className="block text-[11px] text-[#777] mt-0.5">{gmbPhone}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3" ref={timingRef}>
                    <div className="w-9 h-9 rounded-lg bg-[#fff4e5] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#f97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div className="relative">
                      <p className="text-[11px] text-[#999] uppercase tracking-wide mb-0.5">Business Hours</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-[#333] font-medium">{primaryHours || 'Hours not set'}</span>
                        {hoursEntries.length > 0 && (
                          <>
                            <button
                              onClick={() => setShowTimingDropdown((p) => !p)}
                              className="bg-[#dcfce7] text-[#15803d] border-none px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer hover:bg-[#bbf7d0] transition-colors"
                            >
                              Open Now ▼
                            </button>
                            {showTimingDropdown && (
                              <div className="absolute top-12 left-0 w-[240px] bg-white rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.15)] p-4 z-10 border border-[#f1f1f1]">
                                <ul className="list-none text-[13px] space-y-0">
                                  {hoursEntries.map(([day, hours], i) => (
                                    <li key={day} className={`py-2 capitalize flex justify-between ${i < hoursEntries.length - 1 ? 'border-b border-[#f5f5f5]' : ''}`}>
                                      <strong className="text-[#333]">{day}</strong>
                                      <span className="text-[#666]">{hours}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Social Row */}
                {(page.facebook_url || page.instagram_url || page.youtube_url || page.website_url) && (
                  <div className="flex gap-2 mt-5 pt-4 border-t border-[#f5f5f5]">
                    {page.facebook_url && (
                      <a href={page.facebook_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-[#f0f2f5] hover:bg-[#e4e6eb] flex items-center justify-center rounded-lg transition-colors">
                        <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook" className="w-[18px]" />
                      </a>
                    )}
                    {page.instagram_url && (
                      <a href={page.instagram_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-[#f0f2f5] hover:bg-[#e4e6eb] flex items-center justify-center rounded-lg transition-colors">
                        <img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" className="w-[18px]" />
                      </a>
                    )}
                    {page.youtube_url && (
                      <a href={page.youtube_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-[#f0f2f5] hover:bg-[#e4e6eb] flex items-center justify-center rounded-lg transition-colors">
                        <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" className="w-[18px]" />
                      </a>
                    )}
                    {page.website_url && (
                      <a href={page.website_url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-[#f0f2f5] hover:bg-[#e4e6eb] flex items-center justify-center rounded-lg transition-colors">
                        <img src="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" alt="Website" className="w-[18px]" />
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* About Section Card — Redesigned */}
              <div className="bg-white p-6 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <h3 className="font-bold text-[16px] mb-3">About {displayName}</h3>
                {page.full_description ? (
                  <div className="text-[14px] leading-[1.8] text-[#444] whitespace-pre-line mb-5">
                    {page.full_description.replace(/^[\s]*[-–—]/gm, '•').replace(/\n[-–—]\s*/g, '\n• ')}
                  </div>
                ) : (
                  <p className="text-[14px] leading-[1.8] text-[#444] mb-5">
                    Welcome to {displayName}, your trusted automotive service partner in{' '}
                    {workshop.city || 'your city'}. We are a leading multi-brand car garage connecting car owners with professional
                    technicians and advanced diagnostic systems.
                  </p>
                )}

                <h4 className="font-bold text-[14px] mb-3 text-[#0a3d91]">We Offer</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    '1000 KM/1 Month Warranty',
                    'Free Pick-Up & Drop',
                    'Same-Day Car Servicing',
                    'Transparent Pricing',
                    'Live Photo/Video Updates',
                    '24x7 Roadside Assistance',
                    'Genuine OEM/OES Parts',
                    'Expert Mechanics',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 bg-[#f8fafc] p-2.5 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-[#0a3d91] flex-shrink-0" />
                      <span className="text-[13px] text-[#333] font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gallery Section */}
              {Array.isArray((page as any).gallery_images) && (page as any).gallery_images.length > 0 && (
                <div className="bg-white p-6 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                  <h3 className="font-bold text-[16px] mb-4">Workshop Gallery</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {((page as any).gallery_images as string[]).slice(0, 6).map((img, idx) => (
                      <div key={idx} className="aspect-[4/3] rounded-xl overflow-hidden">
                        <img src={img} alt={`Workshop photo ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="lg:sticky lg:top-[90px] flex flex-col gap-5 self-start">
              {/* Book Now CTA Card */}
              <div className="bg-gradient-to-br from-[#0a3d91] to-[#1a5fc9] p-6 rounded-2xl shadow-[0_4px_24px_rgba(10,61,145,0.2)]">
                <h4 className="text-[18px] font-bold mb-2 text-center text-white">Book Your Car Service</h4>
                <p className="text-[13px] text-white/70 text-center mb-5">Same day service • Transparent pricing • Doorstep pickup</p>
                <a
                  href="/book-service"
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl font-bold text-[15px] no-underline transition-all duration-300 hover:shadow-[0_4px_20px_rgba(249,115,22,0.4)]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Book Now
                </a>
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=Hi, I want to book a car service`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 mt-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-semibold text-[13px] no-underline transition-all duration-300"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                    Book via WhatsApp
                  </a>
                )}
              </div>

              {/* Google Maps Card */}
              <div className="bg-white p-5 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                {mapsEmbedUrl ? (
                  <iframe
                    src={mapsEmbedUrl}
                    width="100%"
                    height="200"
                    style={{ border: 0, borderRadius: 12 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Workshop Location"
                  />
                ) : (
                  <div className="h-[200px] bg-[#f2f4f8] rounded-xl flex items-center justify-center text-[#777] text-sm">
                    Map Preview
                  </div>
                )}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 mt-4 p-3 w-full bg-[#0a3d91] text-white rounded-lg font-semibold no-underline text-[13px] hover:bg-[#083070] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  Get Directions
                </a>
              </div>

              {/* Service Guarantee Card */}
              <div className="bg-white p-5 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <h4 className="text-[15px] font-bold mb-4 text-center">Our Service Guarantee</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-[#e6f0ff] rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-[#0a3d91] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0a3d91]">1000 KM Warranty</p>
                      <p className="text-[11px] text-[#666]">On every service performed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#e8f9f1] rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-[#1aa260] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#1aa260]">Same Day Delivery</p>
                      <p className="text-[11px] text-[#666]">Car ready within hours</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#fff4e5] rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-[#f97316] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#f97316]">Live Updates</p>
                      <p className="text-[11px] text-[#666]">Photos & videos on WhatsApp</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#fef3f2] rounded-xl">
                    <div className="w-9 h-9 rounded-full bg-[#ef4444] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/></svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#ef4444]">No Hidden Charges</p>
                      <p className="text-[11px] text-[#666]">Pay only what you see</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google Reviews Card */}
              {gmbReviews.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-[#e8ecf4] shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                  <h4 className="text-[15px] font-bold mb-3">Google Reviews</h4>
                  <div className="space-y-3">
                    {gmbReviews.slice(0, 3).map((review, idx) => (
                      <div key={idx} className="bg-[#f8fafc] p-3 rounded-xl">
                        <div className="flex items-center gap-2 mb-1.5">
                          {review.author_photo ? (
                            <img src={review.author_photo} alt="" className="w-7 h-7 rounded-full" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#0a3d91] text-white flex items-center justify-center text-[11px] font-bold">
                              {(review.author_name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="text-[12px] font-semibold text-[#333] block leading-tight">{review.author_name}</span>
                            <span className="text-[10px] text-[#999]">{review.relative_time}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 mb-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} className={`w-3 h-3 ${s <= review.rating ? 'text-[#f4b400]' : 'text-[#ddd]'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                          ))}
                        </div>
                        {review.text && (
                          <p className="text-[12px] text-[#555] leading-[1.5] line-clamp-2">{review.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {gmb?.google_maps_uri && (
                    <a href={gmb.google_maps_uri} target="_blank" rel="noopener noreferrer" className="block mt-3 text-center text-[12px] text-[#0a3d91] font-semibold hover:underline">
                      View all reviews on Google →
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT MyFNG */}
      <section className="py-10" style={{ background: 'linear-gradient(135deg, #f8faff, #eef3fb)' }}>
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-[32px] font-extrabold">
              About <span className="text-[#0a3d91]">MyFNG</span>
            </h2>
            <p className="mt-2 text-[15px] text-[#666] max-w-[700px] mx-auto">
              {companyStats.about_description}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Left: About Text */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              <h3 className="text-[18px] font-bold text-[#0a3d91] mb-4">Who We Are</h3>
              <p className="text-[14px] text-[#444] leading-[1.8] mb-4">
                {companyStats.who_we_are_1}
              </p>
              <p className="text-[14px] text-[#444] leading-[1.8]">
                {companyStats.who_we_are_2}
              </p>
            </div>

            {/* Right: Key Stats */}
            <div className="bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              <h3 className="text-[18px] font-bold text-[#0a3d91] mb-4">By The Numbers</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f8fafc] p-4 rounded-xl text-center">
                  <p className="text-[22px] font-extrabold text-[#0a3d91]">{companyStats.verified_workshops}</p>
                  <p className="text-[12px] text-[#666]">Verified Workshops</p>
                </div>
                <div className="bg-[#f8fafc] p-4 rounded-xl text-center">
                  <p className="text-[22px] font-extrabold text-[#0a3d91]">{companyStats.cars_serviced}</p>
                  <p className="text-[12px] text-[#666]">Cars Serviced</p>
                </div>
                <div className="bg-[#f8fafc] p-4 rounded-xl text-center">
                  <p className="text-[22px] font-extrabold text-[#0a3d91]">{companyStats.cities_covered}</p>
                  <p className="text-[12px] text-[#666]">Cities Covered</p>
                </div>
                <div className="bg-[#f8fafc] p-4 rounded-xl text-center">
                  <p className="text-[22px] font-extrabold text-[#0a3d91]">{companyStats.avg_rating}★</p>
                  <p className="text-[12px] text-[#666]">Average Rating</p>
                </div>
              </div>
            </div>
          </div>

          {/* What We Offer Grid */}
          <div className="bg-white p-8 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
            <h3 className="text-[18px] font-bold text-center mb-6">What We Offer</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Transparent Pricing', desc: 'No hidden charges, pay what you see', color: 'bg-[#e6f0ff] text-[#0a3d91]', bg: 'bg-[#f0f6ff]', icon: 'rupee' },
                { title: 'Genuine Parts', desc: 'OEM/OES parts with warranty', color: 'bg-[#e8f9f1] text-[#1aa260]', bg: 'bg-[#f0fdf6]', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
                { title: 'Free Pickup & Drop', desc: 'Doorstep convenience at no extra cost', color: 'bg-[#fff4e5] text-[#f97316]', bg: 'bg-[#fff8f0]', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
                { title: 'Same Day Service', desc: 'Get your car back within hours', color: 'bg-[#fef3f2] text-[#ef4444]', bg: 'bg-[#fff5f5]', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                { title: '1000 KM Warranty', desc: 'On every service performed', color: 'bg-[#f0e6ff] text-[#7c3aed]', bg: 'bg-[#f8f4ff]', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
                { title: 'Live WhatsApp Updates', desc: 'Photos & videos of service progress', color: 'bg-[#e6f0ff] text-[#0a3d91]', bg: 'bg-[#f0f6ff]', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                { title: 'AI-Powered Booking', desc: 'Smart scheduling & instant confirmation', color: 'bg-[#e8f9f1] text-[#1aa260]', bg: 'bg-[#f0fdf6]', icon: 'bot' },
                { title: '24x7 Roadside Help', desc: 'Emergency assistance, anywhere anytime', color: 'bg-[#fff4e5] text-[#f97316]', bg: 'bg-[#fff8f0]', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
              ].map((item) => (
                <div key={item.title} className={`p-4 rounded-xl ${item.bg} hover:shadow-md transition-shadow`}>
                  <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center mb-3`}>
                    {item.icon === 'rupee' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12M6 8h12M14.5 8c0 2.485-2.015 4.5-4.5 4.5H6l8 8.5"/></svg>
                    ) : item.icon === 'bot' ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="12" rx="2" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8V5m-4 7h.01M16 12h.01M9 16h6"/><circle cx="12" cy="5" r="1.5"/></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon}/></svg>
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-[#222] mb-1">{item.title}</p>
                  <p className="text-[11px] text-[#666]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* BRANDS WE SERVE */}
      <WorkshopBrandsRow brands={brands} />

      {/* PERIODIC SERVICE PACKAGES */}
      <PeriodicServicePackages packages={packages} />

      {/* OTHER SERVICES */}
      <section className="py-10 bg-[#f2f4f8]">
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <h2 className="text-center text-[26px] font-bold mb-6">Other Services</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-5">
            {otherServices.map((service) => (
              <div
                key={service.slug}
                className="bg-white rounded-[14px] px-5 py-7 text-center transition-all duration-300 border border-[#e9edf3] hover:-translate-y-[6px] hover:shadow-[0_15px_35px_rgba(0,0,0,0.08)] hover:border-[#0a3d91]"
              >
                {service.iconImage ? (
                  <img
                    src={service.iconImage}
                    alt={service.title}
                    className="w-[60px] h-[60px] mx-auto mb-5 object-contain"
                  />
                ) : (
                  <div className="w-[60px] h-[60px] mx-auto mb-5 rounded-2xl bg-[#e6f0ff] flex items-center justify-center">
                    <service.icon className="w-7 h-7 text-[#0a3d91]" />
                  </div>
                )}
                <p className="font-semibold text-[15px] text-[#333]">{service.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADSIDE ASSISTANCE (RSA) */}
      <section className="py-10" style={{ background: 'linear-gradient(135deg, #fff5f5, #fef2f2)' }}>
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] border border-red-100 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
              {/* Left — Info */}
              <div className="p-8 lg:p-10 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#fef2f2] flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#dc2626]" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="2" y="28" width="26" height="16" rx="3" stroke="currentColor" strokeWidth="3" fill="none" />
                      <path d="M28 28h10l8 10v6h-18v-16z" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
                      <circle cx="12" cy="47" r="5" stroke="currentColor" strokeWidth="3" fill="none" />
                      <circle cx="40" cy="47" r="5" stroke="currentColor" strokeWidth="3" fill="none" />
                      <line x1="17" y1="47" x2="35" y2="47" stroke="currentColor" strokeWidth="3" />
                      <path d="M2 34h-0" stroke="currentColor" strokeWidth="3" />
                      <path d="M50 38h8a3 3 0 013 3v3h-11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M55 28v-6a2 2 0 00-2-2h-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 3" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold text-[#dc2626]">24x7 Roadside Assistance</h2>
                    <p className="text-[13px] text-[#666]">Emergency help, anywhere anytime</p>
                  </div>
                </div>
                <p className="text-[14px] text-[#444] leading-[1.8] mb-6">
                  Stranded on the road? MyFNG RSA gets you moving again fast. Whether it&apos;s a flat tyre, dead battery, engine breakdown, or fuel emergency — our trained mechanics reach you within minutes.
                </p>
                <div className="grid grid-cols-2 gap-2.5 mb-6">
                  {[
                    'Flat Tyre Change & Repair',
                    'Battery Jumpstart',
                    'Emergency Towing',
                    'Fuel Delivery',
                    'Key Lockout Help',
                    'On-Spot Minor Repairs',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#dc2626] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      <span className="text-[13px] text-[#333]">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="/car-roadside-assistance"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-semibold text-[14px] no-underline transition-colors shadow-lg shadow-red-200"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    Request RSA Now
                  </a>
                  {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=Hi, I need roadside assistance`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 bg-white border-2 border-[#dc2626] text-[#dc2626] rounded-xl font-semibold text-[14px] no-underline hover:bg-[#fef2f2] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
                      WhatsApp for RSA
                    </a>
                  )}
                </div>
              </div>

              {/* Right — Stats & USPs */}
              <div className="bg-gradient-to-br from-[#dc2626] to-[#991b1b] p-8 lg:p-10 flex flex-col justify-center text-white">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                    <p className="text-[28px] font-extrabold">24/7</p>
                    <p className="text-[12px] text-white/80">Available</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                    <p className="text-[28px] font-extrabold">30 min</p>
                    <p className="text-[12px] text-white/80">Avg Response</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                    <p className="text-[28px] font-extrabold">6+</p>
                    <p className="text-[12px] text-white/80">Cities Covered</p>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                    <p className="text-[28px] font-extrabold">Free</p>
                    <p className="text-[12px] text-white/80">For Prime Members</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {['Trained & Verified Mechanics', 'Real-Time Tracking on WhatsApp', 'Transparent Pricing — No Hidden Charges', 'Cashless Service for Members'].map((usp) => (
                    <div key={usp} className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-[#fbbf24] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                      <span className="text-[13px] font-medium">{usp}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <WorkshopFaqs faqs={faqs} workshopName={displayName} city={workshop.city || ''} />

      <Footer />
    </div>
  );
}
