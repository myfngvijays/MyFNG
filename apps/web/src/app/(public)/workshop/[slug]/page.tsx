'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import WorkshopBrandsRow from '@/components/workshop/WorkshopBrandsRow';
import WorkshopFaqs from '@/components/workshop/WorkshopFaqs';
import WorkshopPackages from '@/components/workshop/WorkshopPackages';
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
  const [fallbackBrands, setFallbackBrands] = useState<{ name: string; logo_url: string }[]>([]);
  const [showTimingDropdown, setShowTimingDropdown] = useState(false);
  const timingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) fetchWorkshopPage();
  }, [slug]);

  useEffect(() => {
    if (typeof window !== 'undefined') setQrValue(window.location.href);
  }, []);

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
    return (
      <div className="min-h-screen bg-[#f5f7fb]">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Workshop Not Found</h1>
            <p className="text-gray-600">The workshop page you&apos;re looking for doesn&apos;t exist or is not published.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
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

  const displayRating = gmbRating ?? (typeof workshop.audit_score === 'number' ? workshop.audit_score : null);
  const auditScore = typeof workshop.audit_score === 'number' ? workshop.audit_score : null;
  const roundedAuditScore = displayRating ? Math.round(displayRating) : 0;
  const fullAddress = [workshop.address, workshop.city, workshop.state, workshop.pincode].filter(Boolean).join(', ');

  const serviceTags = services.length
    ? services
    : ['Auto Repair', 'Vehicle Repair', 'Periodic Service', 'Car Engine Repairs', 'Car Battery Repairs', 'Roadside Assistance', 'Car Garage', 'Multibrand Workshop', 'Car Service Center'];

  const defaultServicesList = [
    'Car Engine Service',
    'Car AC Service',
    'Car Battery Service',
    'Car Brake Service',
    'Car Clutch Service',
    'Tyre & Wheel Care',
    'Car Detailing Service',
    'Car Denting & Painting',
  ];
  const displayServices = services.length ? services : defaultServicesList;

  const serviceIcons: Record<string, string> = {
    'Car Engine Service': 'https://img.icons8.com/ios-filled/100/0a3d91/maintenance.png',
    'Car AC Service': 'https://img.icons8.com/ios-filled/100/0a3d91/air-conditioner.png',
    'Car Battery Service': 'https://img.icons8.com/ios-filled/100/0a3d91/car-battery.png',
    'Car Brake Service': 'https://img.icons8.com/ios-filled/100/0a3d91/brake-discs.png',
    'Car Clutch Service': 'https://img.icons8.com/ios-filled/100/0a3d91/clutch.png',
    'Tyre & Wheel Care': 'https://img.icons8.com/ios-filled/100/0a3d91/wheel.png',
    'Car Detailing Service': 'https://img.icons8.com/ios-filled/100/0a3d91/car.png',
    'Car Denting & Painting': 'https://img.icons8.com/ios-filled/100/0a3d91/spray.png',
  };

  const mapsEmbedUrl = page.google_maps_url
    ? page.google_maps_url.includes('/embed')
      ? page.google_maps_url
      : null
    : null;

  const directionsUrl = page.google_maps_url
    ? page.google_maps_url.includes('/embed')
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(workshop.name || '')}`
      : page.google_maps_url
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
      <section
        className="relative min-h-[480px] py-20 flex items-center bg-cover bg-center"
        style={{
          backgroundImage: `url('${page.cover_image || 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?q=80&w=1974&auto=format&fit=crop'}')`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,45,85,0.92) 0%, rgba(0,45,85,0.85) 40%, rgba(0,0,0,0.3) 100%)',
          }}
        />
        <div className="w-[90%] max-w-[1100px] mx-auto flex flex-col lg:flex-row justify-between items-center gap-10 lg:gap-[60px] relative">
          {/* Hero Left */}
          <div className="text-white lg:max-w-[55%] text-center lg:text-left">
            <h1 className="text-[32px] sm:text-[40px] lg:text-[46px] font-extrabold leading-[1.2] mb-5 text-white">
              {workshop.name || `Multi Brand Car Garage in ${workshop.city || 'Your City'}`}
            </h1>
            <div className="text-[18px] mb-[15px]">
              <span className="text-[#ffc107]">{displayRating || 4.8}★</span> Rated
              {gmbTotalReviews > 0 && <span> | {gmbTotalReviews} Google Reviews</span>}
              {!gmbTotalReviews && ' | 10000+ Car Serviced'}
            </div>
            <div className="bg-white/15 px-[18px] py-3 rounded-lg mb-[25px] text-[14px]">
              Same Day Servicing | Service Photos & Videos on WhatsApp | Transparent Pricing
            </div>
            <a
              href="/book-service"
              className="inline-block bg-[#ffc107] text-black px-[26px] py-3 rounded-[40px] font-semibold text-[14px] hover:bg-[#e5ad06] transition-colors"
            >
              Book Now →
            </a>
          </div>

          {/* Hero Form */}
          <div className="w-full max-w-[380px] bg-white p-7 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.15)]">
            <h3 className="font-semibold text-[#222] mb-5">Book Appointment</h3>
            <div className="space-y-[15px]">
              <input
                type="text"
                placeholder="Full Name"
                className="w-full px-3 py-[10px] border border-[#ddd] rounded-md text-sm outline-none focus:border-[#0a3d91]"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                className="w-full px-3 py-[10px] border border-[#ddd] rounded-md text-sm outline-none focus:border-[#0a3d91]"
              />
              <input
                type="text"
                placeholder="Car Number (MH01AB1234)"
                className="w-full px-3 py-[10px] border border-[#ddd] rounded-md text-sm outline-none focus:border-[#0a3d91]"
              />
              <input
                type="date"
                className="w-full px-3 py-[10px] border border-[#ddd] rounded-md text-sm outline-none focus:border-[#0a3d91]"
              />
              <button className="w-full py-3 bg-[#f97316] text-white border-none rounded-[8px] font-semibold text-[16px] hover:bg-[#ea580c] transition-all duration-300">
                BOOK APPOINTMENT
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* TWO-COLUMN CONTENT */}
      <section className="py-10">
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
            {/* LEFT COLUMN */}
            <div className="flex flex-col gap-5">
              {/* Store Header Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <h2 className="text-xl font-bold mb-2">
                  {workshop.name} – {workshop.city || 'Car Service'}
                </h2>
                <div className="flex flex-wrap gap-[15px] text-[13px] mb-3">
                  <span>{displayRating || 5.0}</span>
                  <span className="text-[#f4b400]">{'★'.repeat(roundedAuditScore || 5)}</span>
                  {gmbTotalReviews > 0 && <span>({gmbTotalReviews} reviews)</span>}
                  <span>{page.views_count || 0} Views</span>
                  {primaryHours && (
                    <span className="text-[#1aa260] font-semibold">Open Now</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {serviceTags.slice(0, 10).map((tag) => (
                    <span
                      key={tag}
                      className="bg-[#f5f5f5] px-[10px] py-[5px] rounded-[20px] text-[12px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-[10px]">
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-[12px] py-[7px] rounded-[6px] text-white text-[12px] bg-[#0a3d91] no-underline"
                  >
                    Directions
                  </a>
                  {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-[12px] py-[7px] rounded-[6px] text-white text-[12px] bg-[#2196f3] no-underline"
                    >
                      WhatsApp
                    </a>
                  )}
                  {callNumber && (
                    <a
                      href={`tel:${callNumber}`}
                      className="px-[12px] py-[7px] rounded-[6px] text-white text-[12px] bg-[#2196f3] no-underline"
                    >
                      Call Store
                    </a>
                  )}
                  <a
                    href="/book-service"
                    className="px-[12px] py-[7px] rounded-[6px] text-white text-[12px] bg-black no-underline"
                  >
                    Book Now
                  </a>
                </div>
              </div>

              {/* Highlights Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)] flex justify-between text-center">
                <div>
                  <h3 className="text-[#0a3d91] text-lg font-bold">1 Million+</h3>
                  <p className="text-[13px]">Cars Serviced</p>
                </div>
                <div>
                  <h3 className="text-[#0a3d91] text-lg font-bold">25 Lacs+</h3>
                  <p className="text-[13px]">Happy Customers</p>
                </div>
                <div>
                  <h3 className="text-[#0a3d91] text-lg font-bold">{displayRating || 4.0} ★</h3>
                  <p className="text-[13px]">{gmbTotalReviews > 0 ? 'Google Rating' : 'Average Rating'}</p>
                </div>
                <div>
                  <h3 className="text-[#0a3d91] text-lg font-bold">1000+</h3>
                  <p className="text-[13px]">Touch Points</p>
                </div>
              </div>

              {/* Workshop Details Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <h3 className="font-semibold mb-2">Workshop Details</h3>
                <hr className="mb-3 border-[#f1f1f1]" />

                <div className="flex gap-[10px] my-[10px]">
                  <div className="bg-[#f2f4f8] p-[6px] rounded-full text-base flex-shrink-0">📍</div>
                  <div className="text-[13px]">{fullAddress || 'Address not available'}</div>
                </div>

                <div className="flex gap-[10px] my-[10px]">
                  <div className="bg-[#f2f4f8] p-[6px] rounded-full text-base flex-shrink-0">📞</div>
                  <div className="text-[13px]">
                    {callNumber || gmbPhone || '—'}
                    {gmbPhone && callNumber !== sanitizePhone(gmbPhone) && (
                      <span className="block text-[11px] text-[#777] mt-0.5">{gmbPhone}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-[10px] my-[10px]" ref={timingRef}>
                  <div className="bg-[#f2f4f8] p-[6px] rounded-full text-base flex-shrink-0">🕒</div>
                  <div className="relative flex items-center gap-[10px]">
                    <span className="text-[13px]">{primaryHours || 'Hours not set'}</span>
                    {hoursEntries.length > 0 && (
                      <>
                        <button
                          onClick={() => setShowTimingDropdown((p) => !p)}
                          className="bg-[#d4f5e4] text-[#1aa260] border-none px-[12px] py-[6px] rounded-[20px] text-[12px] font-semibold cursor-pointer"
                        >
                          Open Now ▼
                        </button>
                        {showTimingDropdown && (
                          <div className="absolute top-10 left-0 w-[240px] bg-white rounded-[12px] shadow-[0_15px_40px_rgba(0,0,0,0.15)] p-[15px] z-10">
                            <ul className="list-none text-[13px] space-y-0">
                              {hoursEntries.map(([day, hours], i) => (
                                <li
                                  key={day}
                                  className={`py-[6px] capitalize ${i < hoursEntries.length - 1 ? 'border-b border-[#f1f1f1]' : ''}`}
                                >
                                  <strong>{day}</strong> : {hours}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Social Row */}
                <div className="flex gap-[10px] mt-[15px]">
                  {page.facebook_url && (
                    <a
                      href={page.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-[#f2f4f8] flex items-center justify-center rounded-lg"
                    >
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
                        alt="Google"
                        className="w-[18px]"
                      />
                    </a>
                  )}
                  {page.instagram_url && (
                    <a
                      href={page.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-[#f2f4f8] flex items-center justify-center rounded-lg"
                    >
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/2991/2991149.png"
                        alt="Maps"
                        className="w-[18px]"
                      />
                    </a>
                  )}
                  {page.youtube_url && (
                    <a
                      href={page.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-[#f2f4f8] flex items-center justify-center rounded-lg"
                    >
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/733/733547.png"
                        alt="Facebook"
                        className="w-[18px]"
                      />
                    </a>
                  )}
                  {page.website_url && (
                    <a
                      href={page.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 bg-[#f2f4f8] flex items-center justify-center rounded-lg"
                    >
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/733/733558.png"
                        alt="Website"
                        className="w-[18px]"
                      />
                    </a>
                  )}
                </div>
              </div>

              {/* About Section Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <h3 className="font-semibold mb-2">About This Business</h3>
                <hr className="mb-3 border-[#f1f1f1]" />
                {page.full_description ? (
                  <div className="text-[14px] leading-[1.7] text-[#444] whitespace-pre-line mb-[15px]">
                    {page.full_description}
                  </div>
                ) : (
                  <p className="text-[14px] leading-[1.7] text-[#444] mb-[15px]">
                    At MY FNG, our focus is on delivering car care that not only meets but exceeds
                    your expectations. We are a leading multi-brand car garage in{' '}
                    {workshop.city || 'your city'}, connecting car owners with professional
                    technicians and advanced diagnostic systems.
                  </p>
                )}

                <h4 className="font-semibold mt-5 mb-3">Why Us?</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                  <ul className="pl-[18px] text-[14px] text-[#444] leading-[1.7]">
                    <li>1000 KM/1 Month Warranty</li>
                    <li>Free Pick-Up & Drop</li>
                    <li>Same-Day Car Servicing</li>
                    <li>Transparent Pricing</li>
                  </ul>
                  <ul className="pl-[18px] text-[14px] text-[#444] leading-[1.7]">
                    <li>Live Photo/Video Updates</li>
                    <li>24x7 Roadside Assistance</li>
                    <li>Genuine OEM/OES Parts</li>
                    <li>Expert Mechanics</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR */}
            <div className="lg:sticky lg:top-[100px] flex flex-col gap-5 self-start">
              {/* Download App Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <h4 className="text-[15px] font-semibold mb-[10px] text-center">
                  Download The MyFNG App
                </h4>
                <p className="text-[13px] text-[#555] mb-3">
                  Download MyFNG Mobile App for Car Service Booking.
                </p>
                <div className="flex gap-[10px]">
                  <img
                    src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                    alt="App Store"
                    className="h-[38px]"
                  />
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                    alt="Google Play"
                    className="h-[38px]"
                  />
                </div>
              </div>

              {/* Google Maps Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                {mapsEmbedUrl ? (
                  <iframe
                    src={mapsEmbedUrl}
                    width="100%"
                    height="250"
                    style={{ border: 0, borderRadius: 12 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Workshop Location"
                  />
                ) : (
                  <div className="h-[250px] bg-[#f2f4f8] rounded-xl flex items-center justify-center text-[#777] text-sm">
                    Map Preview
                  </div>
                )}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-[15px] p-[14px] w-full bg-[#0a3d91] text-white rounded-[10px] font-semibold no-underline text-center text-sm"
                >
                  Get Directions
                </a>
              </div>

              {/* Ratings Card */}
              <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                <h4 className="text-[15px] font-semibold mb-[10px] text-center">
                  {gmbRating != null ? 'Google Ratings' : 'Ratings'} for {workshop.name || 'My FNG'}
                </h4>
                <div className="text-center mb-[15px]">
                  <h2 className="text-3xl font-bold">{displayRating || 5}</h2>
                  {gmbTotalReviews > 0 ? (
                    <p className="text-[13px] text-[#555]">{gmbTotalReviews} Google Reviews</p>
                  ) : (
                    <p className="text-[13px] text-[#555]">{page.views_count || 0} Views</p>
                  )}
                </div>
                <div className="space-y-[6px]">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span>{star}★</span>
                      <div className="flex-1 h-[6px] bg-[#eee] rounded">
                        <div
                          className="h-full bg-[#f4b400] rounded"
                          style={{
                            width:
                              star <= roundedAuditScore
                                ? `${80 - (roundedAuditScore - star) * 10}%`
                                : '10%',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {gmbLastFetched && (
                  <p className="text-[10px] text-[#999] text-center mt-3">
                    Last updated: {new Date(gmbLastFetched).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Google Reviews Card */}
              {gmbReviews.length > 0 && (
                <div className="bg-white p-[22px] rounded-xl border border-[#f1f1f1] shadow-[0_5px_20px_rgba(0,0,0,0.05)]">
                  <h4 className="text-[15px] font-semibold mb-[12px]">
                    Google Reviews
                  </h4>
                  <div className="space-y-3">
                    {gmbReviews.map((review, idx) => (
                      <div key={idx} className="border-b border-[#f1f1f1] pb-3 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          {review.author_photo ? (
                            <img src={review.author_photo} alt="" className="w-6 h-6 rounded-full" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#0a3d91] text-white flex items-center justify-center text-[10px] font-bold">
                              {(review.author_name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <span className="text-[12px] font-medium text-[#333]">{review.author_name}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-[#f4b400] text-[11px]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                          <span className="text-[10px] text-[#999] ml-1">{review.relative_time}</span>
                        </div>
                        {review.text && (
                          <p className="text-[12px] text-[#555] leading-[1.5] line-clamp-3">{review.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {gmb?.google_maps_uri && (
                    <a
                      href={gmb.google_maps_uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block mt-3 text-center text-[12px] text-[#0a3d91] font-medium hover:underline"
                    >
                      View all reviews on Google →
                    </a>
                  )}
                </div>
              )}

              {/* QR Code Card */}
              <div className="bg-white p-[22px] rounded-xl">
                <h4 className="text-base font-semibold mb-[15px] text-center">Discover More With Us</h4>
                <div className="flex justify-center my-5">
                  {qrValue ? (
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue)}`}
                      alt="QR Code"
                      className="w-[150px] h-[150px]"
                    />
                  ) : (
                    <div className="w-[150px] h-[150px] bg-[#f2f4f8] rounded-lg flex items-center justify-center text-[#777] text-xs">
                      QR Code
                    </div>
                  )}
                </div>
                <p className="text-center text-[13px] text-[#333] mb-[15px]">
                  Tell Us About Your Experience
                  <br />
                  <span className="text-xs text-[#777]">
                    Scan this QR Code to discover more with us
                  </span>
                </p>
                <a
                  href="#"
                  className="block p-[14px] w-full bg-[#0a3d91] text-white rounded-[10px] font-semibold no-underline text-center"
                >
                  Write A Review
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE MyFNG */}
      <section
        className="py-[70px]"
        style={{ background: 'linear-gradient(135deg, #f8faff, #eef3fb)' }}
      >
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-[32px] font-extrabold">
              Why Choose <span className="text-[#0a3d91]">MyFNG</span>
            </h2>
            <p className="mt-[10px] text-[14px] text-[#666]">
              Delivering Trust, Innovation & Excellence in Every Car Service
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[30px]">
            <div className="bg-white p-5 rounded-[18px] shadow-[0_15px_35px_rgba(0,0,0,0.06)] transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_25px_45px_rgba(0,0,0,0.12)] relative overflow-hidden">
              <div className="w-[60px] h-[60px] rounded-full bg-[#e6f0ff] text-[#0a3d91] flex items-center justify-center text-[22px] font-bold mb-5">
                🛡️
              </div>
              <h3 className="text-[18px] font-semibold mb-[15px]">Trust</h3>
              <ul className="pl-[18px] text-[14px] text-[#555] leading-[1.7]">
                <li>Verified and accountable workshops</li>
                <li>Transparent pricing with no hidden costs</li>
                <li>Genuine parts & honest recommendations</li>
                <li>Customer-first service decisions</li>
              </ul>
            </div>

            <div className="bg-white p-5 rounded-[18px] shadow-[0_15px_35px_rgba(0,0,0,0.06)] transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_25px_45px_rgba(0,0,0,0.12)] relative overflow-hidden">
              <div className="w-[60px] h-[60px] rounded-full bg-[#fff4e5] text-[#ff9800] flex items-center justify-center text-[22px] font-bold mb-5">
                🤖
              </div>
              <h3 className="text-[18px] font-semibold mb-[15px]">Innovation</h3>
              <ul className="pl-[18px] text-[14px] text-[#555] leading-[1.7]">
                <li>AI-powered car service booking system</li>
                <li>Intelligent service tracking</li>
                <li>Real-time updates & smart notifications</li>
                <li>Automated, data-driven workflows</li>
              </ul>
            </div>

            <div className="bg-white p-5 rounded-[18px] shadow-[0_15px_35px_rgba(0,0,0,0.06)] transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_25px_45px_rgba(0,0,0,0.12)] relative overflow-hidden">
              <div className="w-[60px] h-[60px] rounded-full bg-[#e8f9f1] text-[#1aa260] flex items-center justify-center text-[22px] font-bold mb-5">
                👨🏻‍🔧
              </div>
              <h3 className="text-[18px] font-semibold mb-[15px]">Excellence</h3>
              <ul className="pl-[18px] text-[14px] text-[#555] leading-[1.7]">
                <li>Skilled and experienced mechanics</li>
                <li>Standardized service processes</li>
                <li>High-quality workmanship</li>
                <li>Consistent service across all locations</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* BRANDS WE SERVE */}
      <WorkshopBrandsRow brands={brands} />

      {/* PERIODIC SERVICE PACKAGES */}
      <WorkshopPackages packages={packages} />

      {/* OTHER SERVICES */}
      <section className="py-[60px] bg-[#f2f4f8]">
        <div className="w-[90%] max-w-[1100px] mx-auto">
          <h2 className="text-center text-[26px] font-bold mb-10">Our Services</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[30px]">
            {displayServices.slice(0, 8).map((service) => (
              <div
                key={service}
                className="bg-white rounded-[14px] px-5 py-10 text-center transition-all duration-300 border border-[#e9edf3] hover:-translate-y-[6px] hover:shadow-[0_15px_35px_rgba(0,0,0,0.08)] hover:border-[#0a3d91]"
              >
                <img
                  src={
                    serviceIcons[service] ||
                    'https://img.icons8.com/ios-filled/100/0a3d91/maintenance.png'
                  }
                  alt={service}
                  className="w-[60px] mx-auto mb-5"
                />
                <p className="font-semibold text-[15px] text-[#333]">{service}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <WorkshopFaqs faqs={faqs} workshopName={workshop.name || 'My FNG'} city={workshop.city || ''} />

      <Footer />
    </div>
  );
}
