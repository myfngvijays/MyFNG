import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Activity, ArrowRight, Calendar, CheckCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { findServiceBySlug, makeShortDescription, MARKETING_SLUG_TO_INTERNAL } from '@/lib/services/catalog';
import AppDownloadPopup from '@/components/landing/AppDownloadPopup';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import { SITE_URL } from '@/lib/seo/metadata';
import { breadcrumbSchema, serviceSchema } from '@/lib/seo/schemas';
import JsonLd from '@/components/seo/JsonLd';
import { buildManagedServicePageMetadata } from '@/lib/service-page-seo';
import { toSiteMediaSrc, toSiteMediaUrl } from '@/lib/media/public-url';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug: marketingSlug } = await params;
  return buildManagedServicePageMetadata(marketingSlug);
}

export default async function CarServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: marketingSlug } = await params;
  const internalSlug = MARKETING_SLUG_TO_INTERNAL[marketingSlug];
  const service = internalSlug ? findServiceBySlug(internalSlug) : null;
  const IconComponent = service?.icon;

  if (!service) {
    notFound();
  }

  const description = makeShortDescription(service.longDescription) || service.description;
  const serviceUrl = `${SITE_URL}/car-services/${marketingSlug}`;
  const serviceImage = toSiteMediaUrl(service.image);

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          serviceSchema({
            name: service.title,
            description,
            url: serviceUrl,
            image: serviceImage,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Car Services', url: `${SITE_URL}/car-services` },
            { name: service.title, url: serviceUrl },
          ]),
        ]}
      />
      <Navbar />
      <AppDownloadPopup />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white py-12 sm:py-16 md:py-20 mt-16 sm:mt-18 md:mt-20">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/car-services"
              className="inline-flex items-center gap-2 text-gray-200 hover:text-white mb-4 sm:mb-5 md:mb-6 transition text-sm sm:text-base"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to All Services
            </Link>
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
              {service.iconImage ? (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-white p-0.5 shadow-lg">
                  <img src={service.iconImage} alt={service.title} className="w-full h-full object-contain" style={{ mixBlendMode: 'darken' }} />
                </div>
              ) : IconComponent && (
                <div className="bg-white/10 backdrop-blur-sm p-3 sm:p-4 rounded-xl">
                  <IconComponent className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white">{service.title}</h1>
            </div>
            <p className="text-base sm:text-lg md:text-xl text-gray-200 max-w-2xl">{service.longDescription}</p>
          </div>
        </div>
      </section>

      {/* Service Details */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12">
              {/* Content */}
              <div>
                {/* Service Info */}
                <div className="flex flex-wrap gap-4 sm:gap-6 mb-6 sm:mb-7 md:mb-8">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    <span className="font-semibold">{service.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Shield className="w-5 h-5 text-brand-primary" />
                    <span className="font-semibold">{service.warranty}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-6 sm:mb-7 md:mb-8">
                  <h3 className="text-lg sm:text-xl font-bold text-brand-secondary mb-3 sm:mb-4">What's Included:</h3>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs sm:text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Benefits */}
                <div className="mb-6 sm:mb-7 md:mb-8">
                  <h3 className="text-lg sm:text-xl font-bold text-brand-secondary mb-3 sm:mb-4">Benefits:</h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {service.benefits.map((benefit, idx) => (
                      <span
                        key={idx}
                        className="bg-green-50 text-green-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <Link
                  href={`/book-service?prefill_category=${encodeURIComponent(service.bookPrefill.category)}&prefill_query=${encodeURIComponent(service.bookPrefill.query)}`}
                  className="btn btn-primary inline-flex items-center gap-2 text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4"
                >
                  Book {service.title}
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </div>

              {/* Image */}
              <div>
                <div className="relative h-[300px] sm:h-[400px] md:h-[500px] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
                  <Image src={toSiteMediaSrc(service.image)} alt={service.title} fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AppDownloadSection />

      <Footer />
    </div>
  );
}
