'use client';

import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ArrowRight, CheckCircle, Clock, IndianRupee, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { DEFAULT_SERVICES, Service, canonicalCategoryName, makeShortDescription, normalizeSpaces } from '@/lib/services/catalog';

/** Internal slug (catalog) → marketing URL slug (same as Navbar /car-services/ links) */
const INTERNAL_SLUG_TO_CAR_SERVICES: Record<string, string> = {
  'periodic-service': 'periodic-car-service',
  'engine-service': 'car-engine-service',
  'ac-service': 'car-ac-service',
  'battery-service': 'car-battery',
  'brake-service': 'car-brake-service',
  'clutch-service': 'car-clutch-service',
  'tyre-wheel-care': 'tyre-wheel-care',
  'detailing-service': 'car-detailing-service',
  'denting-painting': 'car-denting-painting',
};

type CategoryRow = { uuid: string; category: string; description: string | null; sequence: number };

export default function ServicesClient({ categories }: { categories: CategoryRow[] }) {
  const services = useMemo(() => {
    const byCategory = new Map<string, CategoryRow>();
    for (const c of categories || []) {
      byCategory.set(canonicalCategoryName(c.category), c);
    }
    const merged = DEFAULT_SERVICES.map((s) => {
      const hit = byCategory.get(canonicalCategoryName(s.title));
      if (!hit) return s;
      const longDesc = normalizeSpaces(hit.description || '') || s.longDescription;
      return {
        ...s,
        title: hit.category || s.title,
        longDescription: longDesc,
        description: makeShortDescription(longDesc) || s.description,
      };
    });
    // Prefer DB ordering if available.
    if ((categories || []).some((c) => typeof c.sequence === 'number')) {
      const seq = new Map<string, number>();
      for (const c of categories || [])
        seq.set(canonicalCategoryName(c.category), typeof c.sequence === 'number' ? c.sequence : 0);
      merged.sort((a, b) => (seq.get(normalizeSpaces(a.title)) ?? 0) - (seq.get(normalizeSpaces(b.title)) ?? 0));
    }
    return merged.map((service) => ({
      ...service,
      description: makeShortDescription(service.longDescription) || service.description,
    }));
  }, [categories]);

  const [selectedService, setSelectedService] = useState<Service>(services[0] || DEFAULT_SERVICES[0]);

  // Keep selection valid when services list changes (e.g., DB fetch arrives).
  useEffect(() => {
    if (!selectedService?.slug) return;
    const next = services.find((s) => s.slug === selectedService.slug);
    if (next && next !== selectedService) setSelectedService(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

  const popularServices = ['Car AC Service', 'Car Battery Service', 'Car Brake Service', 'Car Engine Service', 'Periodic Car Service'];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Full-Bleed Service Explorer Section */}
      <section className="relative min-h-[85vh] mt-16 overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
        {/* Background Illustration/Pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-100/20 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200/10 rounded-full blur-3xl"></div>
          <div className="absolute top-20 right-20 w-72 h-72 bg-blue-200/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 h-full">
          {/* Header */}
          <div className="container mx-auto px-4 sm:px-6 pt-12 pb-8">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">OUR SERVICES</p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                Explore services by <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">category</span>
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mb-8">
                Swipe to browse. Tap a service to preview pricing, timing, and what you get — all upfront.
              </p>

              <div className="flex flex-wrap gap-3 mb-8">
                <Link
                  href="#services"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25"
                >
                  Explore All Services
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/ai-booking"
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-all"
                >
                  <Sparkles className="w-5 h-5" />
                  Ask AI
                </Link>
              </div>
            </div>
          </div>

          {/* Main Service Explorer - Split View */}
          <div id="services" className="container mx-auto px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
                {/* Left: Sticky Service List */}
                <div className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-6 max-h-[70vh] overflow-y-auto">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Browse all services</h2>
                    <p className="text-sm text-gray-500 mb-6">Auto-scrolling • hover to pause</p>

                    <div className="space-y-3">
                      {services.map((service) => {
                        const IconComponent = service.icon;
                        const isSelected = selectedService.id === service.id;

                        return (
                          <button
                            key={service.id}
                            onClick={() => setSelectedService(service)}
                            className={`w-full text-left p-4 rounded-xl transition-all ${
                              isSelected
                                ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 shadow-md'
                                : 'bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div
                                className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                                  isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
                                } transition-all`}
                              >
                                <IconComponent className="w-6 h-6" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold mb-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {service.title}
                                </h3>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{service.description}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <IndianRupee className="w-3 h-3" />
                                    {service.duration.replace(' hours', 'h').replace(' hour', 'h')}
                                  </span>
                                  <span>•</span>
                                  <span>{service.duration}</span>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="flex-shrink-0">
                                  <CheckCircle className="w-5 h-5 text-blue-600" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Large Preview Card */}
                <div className="lg:col-span-7">
                  <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                    {/* Featured Badge */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-white" />
                        <span className="text-white font-semibold text-sm uppercase tracking-wide">Featured</span>
                      </div>
                      <span className="text-blue-100 text-sm font-medium">{selectedService.title}</span>
                    </div>

                    {/* Service Image */}
                    <div className="relative h-64 bg-gradient-to-br from-gray-100 to-gray-200">
                      <Image src={selectedService.image} alt={selectedService.title} fill className="object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                      {/* Big Icon + Title */}
                      <div className="flex items-start gap-6 mb-6">
                        <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-xl">
                          {(() => {
                            const IconComponent = selectedService.icon;
                            return <IconComponent className="w-10 h-10" />;
                          })()}
                        </div>

                        <div className="flex-1">
                          <h2 className="text-3xl font-bold text-gray-900 mb-2">{selectedService.title}</h2>
                          <p className="text-lg text-gray-600">{selectedService.longDescription}</p>
                        </div>
                      </div>

                      {/* Micro Highlights */}
                      <div className="grid grid-cols-3 gap-4 mb-8 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
                        <div className="text-center">
                          <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <IndianRupee className="w-5 h-5 text-blue-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Starting From</p>
                          <p className="text-xl font-bold text-gray-900">
                            {selectedService.duration.includes('days') ? '₹3,999+' : '₹' + selectedService.duration.split('-')[0].trim()}
                          </p>
                        </div>

                        <div className="text-center">
                          <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <Clock className="w-5 h-5 text-purple-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Avg. Time</p>
                          <p className="text-xl font-bold text-gray-900">{selectedService.duration}</p>
                        </div>

                        <div className="text-center">
                          <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <ShieldCheck className="w-5 h-5 text-green-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Warranty</p>
                          <p className="text-xl font-bold text-gray-900">{selectedService.warranty}</p>
                        </div>
                      </div>

                      {/* What you get */}
                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <h3 className="text-lg font-bold text-gray-900">What you get</h3>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {selectedService.features.slice(0, 6).map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                              <span className="text-sm text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={`/book-service?prefill_category=${encodeURIComponent(selectedService.bookPrefill.category)}&prefill_query=${encodeURIComponent(selectedService.bookPrefill.query)}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all"
                        >
                          Quick Book
                          <ArrowRight className="w-5 h-5" />
                        </Link>

                        <Link
                          href={`/car-services/${INTERNAL_SLUG_TO_CAR_SERVICES[selectedService.slug] ?? selectedService.slug}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all"
                        >
                          Know More
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Quick Access Chips */}
              <div className="mt-12 mb-8">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Popular Services</h3>
                    <span className="text-sm text-gray-500">Quick access</span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {popularServices.map((serviceName) => {
                      const service = services.find((s) => s.title === serviceName);
                      if (!service) return null;

                      return (
                        <button
                          key={service.id}
                          onClick={() => setSelectedService(service)}
                          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-full hover:border-blue-400 hover:shadow-md transition-all group"
                        >
                          {(() => {
                            const IconComponent = service.icon;
                            return <IconComponent className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />;
                          })()}
                          <span className="font-medium text-gray-900">{service.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}


