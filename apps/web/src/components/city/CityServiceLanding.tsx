import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Shield,
  Truck,
  Wrench,
} from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import AppDownloadPopup from '@/components/landing/AppDownloadPopup';
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
      <AppDownloadPopup />

      <section className="bg-gradient-to-br from-[#061a3a] via-[#0a4ea3] to-[#023D95] text-white pt-40 pb-14 sm:pt-44 sm:pb-16 md:pt-48">
        <div className="container mx-auto px-4 max-w-6xl">
          <nav className="text-sm text-blue-100/80 pt-1">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/car-services" className="hover:text-white">Car Services</Link>
            <span className="mx-2">/</span>
            <span className="text-white">Car service in {city.name}</span>
          </nav>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-yellow-300">MyFNG {city.name}</p>
          <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-black leading-tight text-white">
            Best Car Service in {city.name}
          </h1>
          <p className="mt-4 max-w-3xl text-base sm:text-lg text-blue-50/90 leading-relaxed">
            Book periodic service, AC, engine, brakes and more at verified MyFNG workshops in {city.name}.
            We collect your car, service it at the workshop, and drop it back — no mechanic at your house.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {['Free pickup & drop', 'From ₹1,500', 'Photo-backed quotes', '1 month / 1,000 km warranty'].map((item) => (
              <span
                key={item}
                className="inline-flex items-center rounded-full bg-white/12 px-3 py-1.5 text-xs sm:text-sm font-semibold text-white ring-1 ring-white/20"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book-service"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0a4ea3] hover:bg-blue-50"
            >
              Book Car Service
              <Calendar className="h-4 w-4" />
            </Link>
            <Link
              href="/workshop-locator"
              className="inline-flex items-center gap-2 rounded-xl border border-white/35 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Find Workshops in {city.name}
              <MapPin className="h-4 w-4" />
            </Link>
            <Link
              href="/go/myfngapp"
              className="inline-flex items-center gap-2 rounded-xl bg-[#023D95] px-5 py-3 text-sm font-bold text-white ring-1 ring-white/30 hover:bg-[#032f73]"
            >
              Download App
              <ArrowRight className="h-4 w-4" />
            </Link>
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

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
              <div className="mt-5 flex flex-wrap gap-2">
                {areas.map((area) => (
                  <span
                    key={area}
                    className="rounded-full bg-[#eef4ff] px-3 py-1.5 text-sm font-semibold text-[#0a4ea3]"
                  >
                    {areaKeywordLabel(area)}
                  </span>
                ))}
              </div>
              {nearby.length ? (
                <div className="mt-6 pt-5 border-t border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Nearby car service pages</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {nearby.map((item) => (
                      <Link
                        key={item.slug}
                        href={item.pagePath}
                        className="rounded-full border border-[#0a4ea3]/20 bg-white px-3 py-1.5 text-sm font-semibold text-[#0a4ea3] hover:bg-[#eef4ff]"
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

      <section className="pb-12 sm:pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900">How MyFNG works in {city.name}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Calendar, title: 'Book on the app', text: 'Choose the service and a pickup slot in a few taps.' },
              { icon: Truck, title: 'We collect the car', text: `A pickup executive comes to your ${city.name} address.` },
              { icon: Wrench, title: 'Workshop service', text: 'Verified workshop work with live photos before extra jobs.' },
              { icon: Shield, title: 'Drop + warranty', text: 'Car comes back to you. Eligible work has written warranty.' },
            ].map((step) => (
              <div key={step.title} className="rounded-2xl bg-white border border-gray-200 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff] text-[#0a4ea3]">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/go/myfngapp"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0a4ea3]"
              >
                Download MyFNG App
              </Link>
              <Link
                href="/book-service"
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white"
              >
                Book Service Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      <AppDownloadSection />
      <Footer />
    </div>
  );
}

export default function CityServiceLanding({ citySlug }: { citySlug: string }) {
  const city = getCityPageBySlug(citySlug);
  if (!city) notFound();
  return <CityServiceLandingView city={city} />;
}
