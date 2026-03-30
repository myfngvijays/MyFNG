import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Activity, ArrowRight, Calendar, CheckCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { findServiceBySlug, makeShortDescription } from '@/lib/services/catalog';

const MARKETING_SLUG_TO_INTERNAL: Record<string, string> = {
  'periodic-car-service': 'periodic-service',
  'car-engine-service': 'engine-service',
  'car-ac-service': 'ac-service',
  'car-battery-service': 'battery-service',
  'car-battery': 'battery-service',
  'car-brake-service': 'brake-service',
  'car-clutch-service': 'clutch-service',
  'tyre-wheel-care': 'tyre-wheel-care',
  'car-detailing-service': 'detailing-service',
  'car-denting-painting': 'denting-painting',
};

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug: marketingSlug } = await params;
  const internalSlug = MARKETING_SLUG_TO_INTERNAL[marketingSlug];
  const service = internalSlug ? findServiceBySlug(internalSlug) : null;

  if (!service) return {};

  const canonicalUrl = `https://myfng.in/car-services/${marketingSlug}`;

  return {
    title: `${service.title} | MyFNG`,
    description: makeShortDescription(service.longDescription) || service.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${service.title} | MyFNG`,
      description: makeShortDescription(service.longDescription) || service.description,
      url: canonicalUrl,
      siteName: 'MyFNG',
      type: 'website',
      images: service.image ? [{ url: service.image, alt: service.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${service.title} | MyFNG`,
      description: makeShortDescription(service.longDescription) || service.description,
      images: service.image ? [service.image] : undefined,
    },
  };
}

export default async function CarServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: marketingSlug } = await params;
  const internalSlug = MARKETING_SLUG_TO_INTERNAL[marketingSlug];
  const service = internalSlug ? findServiceBySlug(internalSlug) : null;
  const IconComponent = service?.icon;

  if (!service) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

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
              {IconComponent && (
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
                <Link href="/book-service" className="btn btn-primary inline-flex items-center gap-2 text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4">
                  Book {service.title}
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </div>

              {/* Image */}
              <div>
                <div className="relative h-[300px] sm:h-[400px] md:h-[500px] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
                  <Image src={service.image} alt={service.title} fill className="object-cover" />
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
