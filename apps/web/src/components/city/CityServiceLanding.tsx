import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import OnPageBookingForm from '@/components/landing/OnPageBookingForm';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, collectionPageSchema, localBusinessSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { getCityPageBySlug, nearbyCityPages, type CityPageConfig } from '@/lib/city-pages';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';
import { toSiteMediaSrc } from '@/lib/media/public-url';
import { notFound } from 'next/navigation';

function areaKeywordLabel(area: string) {
  const text = area.trim().replace(/^car service in /i, '');
  return `Car Service in ${text}`;
}

const PHONE_TEL = '+919152307030';
const PHONE_LABEL = '91523 07030';

function bookingCityName(city: CityPageConfig) {
  if (city.cluster === 'mumbai') return 'Mumbai';
  if (city.cluster === 'pune') return 'Pune';
  if (city.cluster === 'navi-mumbai') return 'Navi Mumbai';
  return 'Thane';
}

function areaPage(area: string, currentSlug: string) {
  const slug = area.trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const page = getCityPageBySlug(slug);
  if (!page || page.slug === currentSlug) return null;
  return page;
}

function CityServiceLandingView({ city }: { city: CityPageConfig }) {
  const areas = city.areas || [];
  const nearby = nearbyCityPages(city);
  const pageUrl = `${SITE_URL}${city.pagePath}`;
  const serviceItems = DEFAULT_SERVICES.map((service) => ({
    name: `${service.title} in ${city.name}`,
    url: `${SITE_URL}/car-services/${INTERNAL_SLUG_TO_MARKETING[service.slug]}`,
  }));

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <JsonLd
        data={[
          localBusinessSchema(city.name),
          collectionPageSchema({
            name: `Car Service in ${city.name}`,
            description: `Verified MYFNG car service workshops and booking options in ${city.name}.`,
            url: pageUrl,
            items: serviceItems,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Car Services', url: `${SITE_URL}/car-services` },
            { name: `Car Service in ${city.name}`, url: pageUrl },
          ]),
        ]}
      />
      <Navbar />

      <section className="bg-[#003890] pb-8 pt-36 sm:pt-40 md:pt-44">
        <div className="mx-auto grid max-w-6xl items-start gap-6 px-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch lg:gap-8">
          <div className="flex min-w-0 flex-col">
            <nav className="text-sm text-blue-100">
              <Link href="/" className="hover:text-white">Home</Link>
              <span className="mx-2 text-blue-200/70">/</span>
              <Link href="/car-services" className="hover:text-white">Car Services</Link>
              <span className="mx-2 text-blue-200/70">/</span>
              <span className="text-white">Car service in {city.name}</span>
            </nav>
            <p className="mt-4 inline-flex w-fit items-center rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
              MyFNG {city.name}
            </p>
            <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-[2.6rem]">
              Best Car Service in {city.name}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-blue-100">
              Book a verified workshop in {city.name}. We call you, pick the car up, and drop it back. No mechanic at your house.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2">
              {['Same day service', 'Warranty on the job', 'Free pickup and drop', 'Photo updates on WhatsApp'].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-[13px] font-semibold leading-5 text-white">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7ec8ff]" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={`tel:${PHONE_TEL}`}
              className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#003890]"
            >
              <Phone className="h-4 w-4" />
              Call {PHONE_LABEL}
            </a>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['100+', 'Workshops'],
                ['10,000+', 'Customers'],
                ['4.8★', 'Rated'],
                ['₹1,500', 'Starts from'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white px-2 py-3 text-center shadow-sm ring-1 ring-slate-200">
                  <p className="text-sm font-extrabold text-blue-800 sm:text-base">{value}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            <section className="mt-5 flex flex-1 flex-col rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">How booking works</p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-950">Four steps. One form.</h2>
              <ol className="mt-3 grid flex-1 grid-cols-2 grid-rows-2 gap-2">
                {[
                  ['1', 'Fill this form', 'Name, phone, car and the job. It stays on this page.'],
                  ['2', 'We call you', `Advisor confirms the slot and pickup in ${city.name}.`],
                  ['3', 'Free pickup', 'Car is collected, serviced, and returned.'],
                  ['4', 'Updates + warranty', 'Photos of the job, then delivery with warranty.'],
                ].map(([n, title, desc]) => (
                  <li key={n} className="flex flex-col justify-center rounded-2xl bg-blue-50 px-3 py-2.5">
                    <p className="text-[11px] font-extrabold text-blue-700">Step {n}</p>
                    <p className="mt-1 text-sm font-bold leading-5 text-slate-900">{title}</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-600">{desc}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div id="book-service" className="scroll-mt-36 lg:sticky lg:top-36 lg:z-30 lg:self-start">
            <OnPageBookingForm
              page={city.pagePath}
              source={`car-service-in-${city.slug}`}
              campaign={`car-service-in-${city.slug}`}
              term={`car service in ${city.name}`}
              cities={['Mumbai', 'Thane', 'Navi Mumbai', 'Pune']}
              defaultCity={bookingCityName(city)}
              areaName={city.name}
              stickyClassName=""
            />
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0a4ea3]">All services</p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-gray-900">
                Car services in {city.name}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
                Every MyFNG service is available in {city.name} with pickup & drop, live updates, and transparent quotes.
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-2xl border border-blue-100 bg-white sm:hidden">
            {DEFAULT_SERVICES.map((service) => {
              const marketingSlug = INTERNAL_SLUG_TO_MARKETING[service.slug];
              const label = service.title.replace(/^Car /, '').replace(/ Service$/, '').replace(/ Car$/, '');
              const Icon = service.icon;
              return (
                <Link
                  key={service.slug}
                  href={`/car-services/${marketingSlug}`}
                  className="flex flex-col items-center justify-center border-b border-r border-blue-100 px-2 py-5 text-center"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
                    {service.iconImage ? (
                      <img src={service.iconImage} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
                    ) : (
                      <Icon className="h-6 w-6 text-[#003890]" />
                    )}
                  </span>
                  <span className="mt-2 line-clamp-2 text-[10px] font-bold uppercase leading-3 text-gray-600">{label}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {DEFAULT_SERVICES.map((service) => {
              const marketingSlug = INTERNAL_SLUG_TO_MARKETING[service.slug];
              return (
                <Link
                  key={service.slug}
                  href={`/car-services/${marketingSlug}`}
                  className="group overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm hover:shadow-lg hover:border-[#0a4ea3]/40 transition"
                >
                  <div className="relative h-40 bg-slate-100">
                    <Image
                      src={toSiteMediaSrc(service.image)}
                      alt={`${service.title} in ${city.name}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#0a4ea3]">{service.title}</h3>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-2">{service.description}</p>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {service.duration}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0a4ea3]">
                        View service
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {areas.length ? (
        <section className="pb-12 sm:pb-16">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="rounded-2xl bg-white border border-gray-200 p-6 sm:p-8">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900">Areas we cover in {city.name}</h2>
              <p className="mt-2 text-sm text-gray-600">
                Pickup & drop is available across these {city.name} locations.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {areas.map((area) => {
                  const page = areaPage(area, city.slug);
                  const label = areaKeywordLabel(area);
                  return page ? (
                    <Link
                      key={area}
                      href={page.pagePath}
                      className="text-[12px] font-semibold leading-5 text-[#0a4ea3] hover:underline"
                    >
                      {label}
                    </Link>
                  ) : (
                    <span key={area} className="text-[12px] font-semibold leading-5 text-[#0a4ea3]">
                      {label}
                    </span>
                  );
                })}
              </div>
              {nearby.length ? (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Nearby car service pages</p>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                    {nearby.map((item) => (
                      <Link
                        key={item.slug}
                        href={item.pagePath}
                        className="text-[12px] font-semibold leading-5 text-[#0a4ea3] hover:underline"
                      >
                        Car Service in {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-14">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="rounded-2xl bg-[#0a4ea3] px-6 py-8 sm:px-10 sm:py-10 text-white">
            <h2 className="text-2xl sm:text-3xl font-black text-white">Need car service in {city.name} today?</h2>
            <p className="mt-3 max-w-2xl text-blue-100">
              Download the MyFNG app to book pickup & drop, approve extra work with photos, and keep a service record.
            </p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2 text-sm text-blue-50">
              {[
                'No mechanic at your house — workshop service only',
                'Transparent starting price from ₹1,500',
                'Photo and video updates on WhatsApp',
                'Written warranty on eligible jobs',
              ].map((item) => (
                <li key={item} className="inline-flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <a
                href={`tel:${PHONE_TEL}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 text-center text-xs font-bold text-[#0a4ea3] sm:text-sm"
              >
                <Phone className="h-4 w-4 shrink-0" />
                Call {PHONE_LABEL}
              </a>
              <a
                href="#book-service"
                className="inline-flex items-center justify-center rounded-xl border border-white/40 px-3 py-3 text-center text-xs font-bold text-white sm:text-sm"
              >
                Book on this page
              </a>
            </div>
          </div>
        </div>
      </section>

      <AppDownloadSection />
      <Footer />
      <div className="h-16 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <a href={`tel:${PHONE_TEL}`} className="flex h-14 items-center justify-center gap-2 bg-slate-950 text-sm font-bold text-white">
          <Phone className="h-4 w-4" /> Call
        </a>
        <a href="#book-service" className="flex h-14 items-center justify-center bg-blue-600 text-sm font-bold text-white">
          Book service
        </a>
      </div>
    </div>
  );
}

export default function CityServiceLanding({ citySlug }: { citySlug: string }) {
  const city = getCityPageBySlug(citySlug);
  if (!city) notFound();
  return <CityServiceLandingView city={city} />;
}
