import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Calendar,
  Camera,
  Clock,
  MapPin,
  Shield,
  Sparkles,
  Truck,
  Wrench,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import AIFeatureBadge from '@/components/landing/AIFeatureBadge';
import BrandModelGrid from '@/components/popular-brands/BrandModelGrid';
import BrandFaqSection from '@/components/popular-brands/BrandFaqSection';
import BrandReviewsMarquee from '@/components/popular-brands/BrandReviewsMarquee';
import PeriodicServicePackages from '@/components/workshop/PeriodicServicePackages';
import { getPopularBrandBySlug, POPULAR_BRAND_PAGES } from '@/lib/popular-brands';
import { fetchBrandModelCards } from '@/lib/popular-brand-models';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';

export function generateStaticParams() {
  return POPULAR_BRAND_PAGES.map((brand) => ({ slug: brand.slug }));
}

export const revalidate = 0;

const COVERAGE_CITIES = ['Mumbai', 'Thane', 'Navi Mumbai', 'Pune', 'Kalyan', 'Dombivli', 'Vasai', 'Nashik'];

const HIGHLIGHT_ICONS = [Shield, Wrench, Truck, Camera, Clock] as const;

function SectionHeading({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 text-center sm:mb-8 md:mb-10">
      <AIFeatureBadge text={badge} />
      <h2 className="mt-3 text-xl font-black leading-snug text-brand-secondary sm:text-2xl md:text-4xl">{title}</h2>
      {subtitle ? (
        <p className="mx-auto mt-3 max-w-2xl px-1 text-sm leading-relaxed text-gray-600 sm:text-base">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default async function PopularBrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getPopularBrandBySlug(slug);
  if (!brand) notFound();

  const modelCards = await fetchBrandModelCards(brand);
  const otherServices = DEFAULT_SERVICES.filter((service) => service.slug !== 'periodic-service');

  return (
    <div className="min-h-screen overflow-x-hidden bg-background-grey pb-4 font-poppins lg:pb-0">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-x-hidden bg-gradient-to-br from-[#0a1628] via-[#0d2847] to-[#0a3d91] pt-28 text-white sm:pt-24 md:pt-28">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#0088e8] blur-3xl" />
          <div className="absolute -bottom-16 left-10 h-64 w-64 rounded-full bg-[#ffc107] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 md:py-16">
          {/* Row 1: heading left + logo right */}
          <div className="flex items-start justify-between gap-3 sm:gap-6">
            <div className="min-w-0 flex-1 pr-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#ffc107] sm:h-4 sm:w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-100 sm:text-xs sm:tracking-[0.2em]">
                  100+ Verified Workshops
                </span>
              </div>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">
                {brand.name} Car Service &amp; Repair
              </h1>
            </div>
            <div className="shrink-0">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white p-3 shadow-2xl sm:h-24 sm:w-24 sm:rounded-3xl sm:p-4 md:h-32 md:w-32">
                <Image
                  src={brand.logoUrl}
                  alt={`${brand.name} logo`}
                  width={120}
                  height={120}
                  className="h-auto w-full object-contain"
                  unoptimized
                />
              </div>
            </div>
          </div>

          {/* Row 2: content + buttons */}
          <div className="mt-5 sm:mt-6">
            <p className="text-base font-semibold text-[#ffc107] sm:text-lg">{brand.tagline}</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base md:text-lg">
              {brand.heroDescription}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <Link
                href={`/book-service?prefill_make=${encodeURIComponent(brand.prefillMake)}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#0a3d91] shadow-lg transition hover:bg-blue-50 sm:w-auto"
              >
                Book {brand.name} Service
                <Calendar className="h-4 w-4" />
              </Link>
              <Link
                href="/workshop-locator"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 sm:w-auto"
              >
                Find Nearby Workshop
                <MapPin className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust cards — single box, 5 items like app */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-8 pt-0">
        <div className="-mt-8 rounded-2xl border border-gray-100 bg-white p-3 shadow-lg shadow-brand-primary/5 sm:-mt-10 sm:p-4">
          <div className="grid grid-cols-5 gap-1 sm:gap-2">
            {brand.highlights.map((item, index) => {
              const Icon = HIGHLIGHT_ICONS[index] || Shield;
              return (
                <div key={item} className="flex min-w-0 flex-col items-center px-0.5 py-2 text-center sm:px-1 sm:py-3">
                  <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary/10 sm:mb-2 sm:h-9 sm:w-9 sm:rounded-xl">
                    <Icon className="h-4 w-4 text-brand-primary sm:h-[18px] sm:w-[18px]" />
                  </div>
                  <p className="text-[9px] font-bold leading-tight text-gray-800 sm:text-[10px] md:text-xs">{item}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Models with images */}
      <section className="relative overflow-visible bg-white py-10 pt-4 sm:py-14 sm:pt-6 md:py-20">
        <div className="pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-brand-primary/5 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4">
          <SectionHeading
            badge="All Models Covered"
            title={`Popular ${brand.name} Models We Service`}
            subtitle="Tap your model to book service — your car will be pre-selected on the booking page."
          />
          <BrandModelGrid brandName={brand.name} models={modelCards} />
        </div>
      </section>

      {/* Periodic packages — same as GMB workshop public page */}
      <PeriodicServicePackages
        packages={[]}
        subtitle={`Choose the best car service package for your ${brand.name}`}
      />

      {/* Other services — 5 per row */}
      <section className="bg-gradient-to-b from-background-grey to-white py-10 sm:py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            badge="Expert Care"
            title={`${brand.name} Repair & Maintenance Services`}
            subtitle="Engine, AC, brakes, clutch, detailing and more — handled at verified MYFNG workshops."
          />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {otherServices.map((service) => {
              const marketingSlug = INTERNAL_SLUG_TO_MARKETING[service.slug];
              const IconComponent = service.icon;
              return (
                <Link
                  key={service.slug}
                  href={`/car-services/${marketingSlug}`}
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-primary/30 hover:shadow-xl sm:p-5"
                >
                  <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-brand-primary to-brand-secondary transition-transform duration-300 group-hover:scale-x-100" />
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 p-2">
                      {service.iconImage ? (
                        <img
                          src={service.iconImage}
                          alt=""
                          className="h-full w-full object-contain"
                          style={{ mixBlendMode: 'darken' }}
                        />
                      ) : IconComponent ? (
                        <IconComponent className="h-5 w-5 text-brand-primary" />
                      ) : null}
                    </div>
                    {service.duration ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold uppercase text-gray-600">
                        {service.duration}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-bold leading-snug text-gray-900 transition group-hover:text-brand-primary sm:text-base">
                    {service.title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-gray-600 sm:text-sm">{service.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-primary sm:text-sm">
                    View service
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <AppDownloadSection />

      <BrandReviewsMarquee brandName={brand.name} testimonials={brand.testimonials} />

      {/* Coverage */}
      <section className="relative overflow-hidden bg-[#023D95] py-10 sm:py-14 md:py-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: 'linear-gradient(135deg, #0088E8 0%, #023D95 55%, #021f4a 100%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-2xl font-black text-white sm:text-3xl md:text-4xl">Service Coverage</h2>
          <p className="mx-auto mt-3 max-w-2xl px-1 text-sm font-medium leading-relaxed text-white sm:mt-4 sm:text-base md:text-lg">
            Book {brand.name} car service at verified MYFNG workshops across Maharashtra&apos;s top cities.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-8 sm:gap-3">
            {COVERAGE_CITIES.map((city) => (
              <span
                key={city}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/20 px-3 py-2 text-xs font-bold text-white shadow-sm sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <MapPin className="h-3.5 w-3.5 text-[#ffc107]" />
                {city}
              </span>
            ))}
          </div>
          <Link
            href={`/book-service?prefill_make=${encodeURIComponent(brand.prefillMake)}`}
            className="mt-8 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-[#ffc107] px-6 py-3.5 text-sm font-black text-gray-900 shadow-xl transition hover:bg-yellow-400 sm:mt-10 sm:w-auto sm:px-8"
          >
            Book Now — Free Pickup Available
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 sm:py-14 md:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <SectionHeading
            badge="Got Questions?"
            title={`FAQs — ${brand.name} Service`}
            subtitle="Quick answers before you book your next service."
          />
          <BrandFaqSection faqs={brand.faqs} initialCount={5} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
