import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Calendar, MapPin, Wrench } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import { getCityPageBySlug } from '@/lib/city-pages';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';

export default async function CityServicePage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getCityPageBySlug(citySlug);
  if (!city) notFound();

  const services = DEFAULT_SERVICES.slice(0, 6);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white py-16 mt-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <p className="text-sm uppercase tracking-[0.2em] text-blue-200">MYFNG {city.name}</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-black">Best Car Service in {city.name}</h1>
          <p className="mt-4 max-w-3xl text-lg text-gray-200">
            Book periodic service, AC repair, engine service and more at verified MYFNG workshops in {city.name}.
            Transparent pricing, genuine parts, and free pickup & delivery options.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/book-service"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-900 hover:bg-gray-100"
            >
              Book Car Service
              <Calendar className="h-4 w-4" />
            </Link>
            <Link
              href="/workshop-locator"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Find Workshops in {city.name}
              <MapPin className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 text-gray-900">
            <Wrench className="h-5 w-5 text-brand-primary" />
            <h2 className="text-2xl font-black">Popular Services in {city.name}</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {services.map((service) => {
              const marketingSlug = INTERNAL_SLUG_TO_MARKETING[service.slug];
              return (
                <Link
                  key={service.slug}
                  href={`/car-services/${marketingSlug}`}
                  className="rounded-2xl border border-gray-200 p-5 hover:border-brand-primary hover:shadow-md transition"
                >
                  <h3 className="text-lg font-bold text-gray-900">{service.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">{service.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary">
                    View service
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <AppDownloadSection />
      <Footer />
    </div>
  );
}
