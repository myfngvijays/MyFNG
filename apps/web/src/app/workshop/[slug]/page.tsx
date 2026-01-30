'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ArrowRight, Clock, MapPin, MessageCircle, Phone, Star } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import WorkshopBrandsRow from '@/components/workshop/WorkshopBrandsRow';
import WorkshopFaqs from '@/components/workshop/WorkshopFaqs';
import WorkshopPackages from '@/components/workshop/WorkshopPackages';
import type {
  ContactLink,
  Workshop,
  WorkshopPublicPage,
} from '@/components/workshop/types';

export default function WorkshopPublicPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [page, setPage] = useState<WorkshopPublicPage | null>(null);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [qrValue, setQrValue] = useState('');
  const [fallbackBrands, setFallbackBrands] = useState<{ name: string; logo_url: string }[]>([]);

  const defaultFaqs = [
    {
      question: 'How does AI-powered booking work?',
      answer:
        'Simply chat with our AI assistant, provide your vehicle details, and get instant transparent pricing. Book your service directly without any employee interaction.',
    },
    {
      question: 'Is the pricing really transparent?',
      answer:
        'Yes! Our AI shows you exactly what you will pay upfront. No hidden charges, no surprises. You see the complete breakdown before booking.',
    },
    {
      question: 'How long does a typical service take?',
      answer:
        'Service duration varies by type. Basic service takes 2-3 hours, premium service takes 4-5 hours, and comprehensive service takes 6-8 hours.',
    },
    {
      question: 'Do you provide warranty on services?',
      answer:
        'Yes, all our services come with warranty. Labour warranty is typically 1 month or 1,000 km, and parts warranty varies by component.',
    },
    {
      question: 'Can I track my service in real-time?',
      answer: 'You will receive service updates, including photos and videos, after the car service is completed.',
    },
    {
      question: 'What car brands do you service?',
      answer:
        'We service all major car brands including Maruti Suzuki, Hyundai, Tata, Mahindra, Honda, Toyota, Ford, Volkswagen, BMW, Mercedes-Benz, Audi, and many more.',
    },
  ];

  useEffect(() => {
    if (slug) {
      fetchWorkshopPage();
    }
  }, [slug]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setQrValue(window.location.href);
    }
  }, []);

  useEffect(() => {
    if (!page || (Array.isArray(page.brands) && page.brands.length > 0)) return;

    async function fetchFallbackBrands() {
      try {
        const response = await fetch('/api/super_admin/car-brands?active_only=true');
        if (!response.ok) return;
        const result = await response.json();
        const brands = (result.data || []).map((brand: any) => ({
          name: brand.name,
          logo_url: brand.logo_url,
        }));
        setFallbackBrands(brands);
      } catch {
        setFallbackBrands([]);
      }
    }

    fetchFallbackBrands();
  }, [page]);

  const fetchWorkshopPage = async () => {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('workshop_public_pages')
        .select(`
          *,
          workshop:workshops(*)
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;

      if (data) {
        setPage(data as WorkshopPublicPage);
        setWorkshop(data.workshop as Workshop);

        // Update view count
        await supabase
          .from('workshop_public_pages')
          .update({ views_count: (data.views_count || 0) + 1 })
          .eq('id', data.id);
      }
    } catch (error: any) {
      console.error('Error fetching workshop page:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!page || !workshop) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Workshop Not Found</h1>
            <p className="text-gray-600">The workshop page you're looking for doesn't exist or is not published.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const services: string[] = Array.isArray(page.services_offered) ? page.services_offered : [];
  const galleryImages = Array.isArray(page.gallery_images) ? page.gallery_images : [];
  const businessHours = page.business_hours || {};
  const brands = Array.isArray(page.brands) && page.brands.length ? page.brands : fallbackBrands;
  const packages = Array.isArray(page.packages) ? page.packages : [];
  const faqs = Array.isArray(page.faqs) && page.faqs.length ? page.faqs : defaultFaqs;

  const sanitizePhone = (value?: string | null) => (value || '').replace(/[^\d+]/g, '');
  const whatsappNumber = page.whatsapp_number ? sanitizePhone(page.whatsapp_number) : '';
  const callNumber = page.alternate_phone ? sanitizePhone(page.alternate_phone) : whatsappNumber;

  const contactLinks: ContactLink[] = [
    ...(callNumber
      ? [{ href: `tel:${callNumber}`, label: callNumber, icon: Phone, className: 'text-blue-700' }]
      : []),
    ...(whatsappNumber
      ? [{ href: `https://wa.me/${whatsappNumber}`, label: whatsappNumber, icon: MessageCircle, className: 'text-green-600' }]
      : []),
  ];

  const serviceTags: string[] = services;

  const hoursEntries = Object.entries(businessHours || {}).filter(([, value]) => Boolean(value));
  const primaryHours = hoursEntries.length ? `${hoursEntries[0][0]}: ${hoursEntries[0][1]}` : null;

  const auditScore = typeof workshop.audit_score === 'number' ? workshop.audit_score : null;
  const roundedAuditScore = auditScore ? Math.round(auditScore) : 0;

  const stats = [
    { label: 'Page Views', value: page.views_count ?? 0 },
    { label: 'Audit Score', value: auditScore ? `${auditScore}/5` : '—' },
    { label: 'Services', value: services.length },
    { label: 'Gallery Images', value: galleryImages.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {lightboxIndex !== null && galleryImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white text-gray-800 shadow-lg hover:bg-gray-100"
              aria-label="Close gallery image"
            >
              ✕
            </button>
            <img
              src={galleryImages[lightboxIndex]}
              alt={`Gallery ${lightboxIndex + 1}`}
              className="w-full max-h-[80vh] object-contain rounded-lg bg-white"
            />
          </div>
        </div>
      )}

      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 mb-4">
            <span>Stores</span>
            <span className="text-gray-300">›</span>
            <span>{workshop.state || 'Maharashtra'}</span>
            <span className="text-gray-300">›</span>
            <span>{workshop.city || 'Palghar'}</span>
            <span className="text-gray-300">›</span>
            <span className="font-semibold text-gray-700">{workshop.name}</span>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              <img
                src={page.cover_image || 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&q=80&w=1600'}
                alt={workshop.name || 'Workshop cover'}
                className="h-[320px] sm:h-[380px] lg:h-[420px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
              <div className="absolute inset-0 p-6 sm:p-8 lg:p-10 text-white">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
                  Get Honest <br />
                  Car Service in <br />
                  {workshop.city || workshop.state || 'Your City'}
                </h1>
                <p className="mt-3 text-base sm:text-lg font-semibold text-white/90">
                  {workshop.name || 'MyFNG Workshop'}
                </p>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  {workshop.audit_score ? (
                    <span className="px-2 py-1 rounded-full bg-yellow-400 text-black font-semibold">
                      {workshop.audit_score}★ Rated
                    </span>
                  ) : null}
                  {page.views_count ? <span className="text-white/90">| {page.views_count} Page Views</span> : null}
                </div>
                {page.short_description ? (
                  <p className="mt-3 text-sm sm:text-base text-white/90">{page.short_description}</p>
                ) : null}
                <button className="mt-5 inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2 text-sm font-semibold text-black">
                  Book Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:absolute lg:top-6 lg:right-6 lg:w-[360px] mt-4 lg:mt-0">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Book Appointment</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Full Name</label>
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Phone Number</label>
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Preferred Service Date</label>
                    <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  </div>
                  <button className="w-full rounded-lg bg-blue-700 text-white py-2 text-sm font-semibold">
                    Book Appointment
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{workshop.name}</h2>
                {workshop.audit_score ? (
                  <div className="flex items-center gap-1 text-yellow-500">
                    {Array.from({ length: roundedAuditScore }).map((_, idx) => (
                      <Star key={idx} className="w-4 h-4 fill-yellow-500" />
                    ))}
                    <span className="text-sm text-gray-500">{auditScore}/5</span>
                  </div>
                ) : null}
                {primaryHours ? <span className="text-xs font-semibold text-green-600">Open Now</span> : null}
              </div>
              {serviceTags.length ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {serviceTags.slice(0, 10).map((tag: string) => (
                    <span key={tag} className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <a className="rounded-lg bg-blue-700 text-white text-sm px-4 py-2" href={page.google_maps_url || '#'}>
                  Directions
                </a>
                {whatsappNumber ? (
                  <a
                    className="rounded-lg border border-green-600 text-green-700 text-sm px-4 py-2"
                    href={`https://wa.me/${whatsappNumber}`}
                  >
                    WhatsApp
                  </a>
                ) : null}
                {callNumber ? (
                  <a className="rounded-lg border border-blue-700 text-blue-700 text-sm px-4 py-2" href={`tel:${callNumber}`}>
                  Call Store
                  </a>
                ) : null}
                <a className="rounded-lg border border-gray-300 text-gray-700 text-sm px-4 py-2" href="/book-service">
                  Book Now
                </a>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Download The App</h3>
              <p className="text-sm text-gray-600 mb-4">Download MyFNG Mobile App for Car Service Booking.</p>
              <div className="flex gap-3">
                <button className="rounded-lg bg-black text-white px-4 py-2 text-xs">App Store</button>
                <button className="rounded-lg bg-black text-white px-4 py-2 text-xs">Google Play</button>
              </div>
              <div className="mt-4 flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                {qrValue ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrValue)}`}
                    alt="Scan to open this workshop page"
                    className="h-20 w-20 rounded-lg bg-white p-2"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg border border-dashed border-gray-300 bg-white text-[10px] text-gray-400 flex items-center justify-center">
                    QR
                  </div>
                )}
                <div className="text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">Scan & Download</p>
                  <p>Get the MyFNG app instantly.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            {stats.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              <div className="space-y-4 text-sm text-gray-700">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <span>{workshop.address}, {workshop.city}, {workshop.state} - {workshop.pincode}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{callNumber || '—'}</span>
                </div>
                {primaryHours ? (
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>{primaryHours}</span>
                    <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      Open Now
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 text-center">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Discover More With Us</h3>
              <div className="h-40 bg-gray-100 rounded-lg mb-4" />
              <button className="w-full rounded-lg bg-blue-700 text-white py-2 text-sm font-semibold">
                Write A Review
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="h-56 bg-blue-50 flex items-center justify-center text-sm text-gray-500">
                Map Preview
              </div>
              <div className="p-4 text-right">
                <a className="text-sm text-blue-700" href={page.google_maps_url || '#'}>
                  Get Directions
                </a>
              </div>
            </div>

            {auditScore ? (
              <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Ratings</h3>
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl font-bold">{auditScore}</div>
                  <div className="text-sm text-gray-500">Audit Score</div>
                </div>
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="w-6">{star}★</span>
                      <div className="h-2 flex-1 bg-gray-100 rounded-full">
                        <div
                          className={`h-2 rounded-full ${
                            star <= roundedAuditScore ? 'w-3/5 bg-yellow-400' : 'w-1/5 bg-gray-300'
                          }`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {page.full_description ? (
            <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex flex-wrap gap-3 mb-6">
                {['Home', 'Gallery', 'Map', 'Contact Us'].map((tab) => (
                  <button key={tab} className="px-4 py-2 rounded-full text-sm border border-gray-200 bg-gray-50">
                    {tab}
                  </button>
                ))}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About This Business</h3>
              <p className="text-sm text-gray-700 whitespace-pre-line">{page.full_description}</p>
            </div>
          ) : null}

          <div className="mt-8">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-6">WHY CHOOSE MyFNG</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['TRUST', 'INNOVATION', 'EXCELLENCE'].map((title) => (
                <div key={title} className="bg-gray-100 rounded-xl p-5 text-center">
                  <h4 className="font-semibold text-gray-900 mb-3">{title}</h4>
                  <ul className="text-xs text-gray-600 space-y-2">
                    <li>Verified and accountable workshops</li>
                    <li>Transparent pricing with no hidden costs</li>
                    <li>Customer-first service decisions</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <WorkshopBrandsRow brands={brands} />

          <WorkshopPackages packages={packages} />

          {services.length ? (
            <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Our Services</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {services.map((service: string) => (
                  <div key={service} className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-700">
                    <div className="h-16 bg-gray-100 rounded-lg mb-3" />
                    {service}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <WorkshopFaqs faqs={faqs} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
