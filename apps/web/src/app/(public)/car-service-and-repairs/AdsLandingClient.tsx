'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import AIFeatureBadge from '@/components/landing/AIFeatureBadge';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';
import { ADS_LP_FAQS } from './faqs';
import { CITY_PAGES } from '@/lib/city-pages';
import { buildGoAppDownloadHref } from '@/lib/utm';
import {
  Shield,
  Clock,
  Star,
  Phone,
  Wrench,
  Camera,
  BadgeCheck,
  Truck,
  Quote,
  ChevronDown,
  Smartphone,
  CalendarCheck,
} from 'lucide-react';

const BOOK = '/book-service';
const PHONE = '+919152307030';

function useGoHref(placement: string) {
  const fallback = `/go/myfngapp?utm_source=myfng&utm_medium=landing&utm_campaign=car-service-and-repairs&utm_content=${placement}`;
  const [href, setHref] = useState(fallback);
  useEffect(() => {
    setHref(buildGoAppDownloadHref(placement));
  }, [placement]);
  return href;
}

const USPS = [
  {
    icon: Shield,
    title: 'Verified workshops only',
    desc: 'Every garage is audited so your car service and repairs happen at trusted multi-brand workshops — not random mechanics.',
  },
  {
    icon: BadgeCheck,
    title: 'Transparent car repair cost',
    desc: 'See the estimate before you book. No last-minute extras on periodic car service, AC repair or engine work.',
  },
  {
    icon: Truck,
    title: 'Free pickup & drop',
    desc: 'Doorstep car servicing in Mumbai, Thane, Navi Mumbai and Pune. We pick the car and return it after repairs.',
  },
  {
    icon: Camera,
    title: 'Photo & video updates',
    desc: 'Track car repairs with live photos and videos from the workshop so you know exactly what was done.',
  },
  {
    icon: Wrench,
    title: 'Genuine OEM / OES parts',
    desc: 'Car repairs use genuine, OEM or OES-recommended parts — not cheap duplicates that fail early.',
  },
  {
    icon: Clock,
    title: 'Warranty on service',
    desc: 'Labour and parts warranty on MYFNG car service so you are covered after the job is done.',
  },
];

const TRUST_CARDS = [
  { title: '100+ workshops', desc: 'Multi-brand car garages across MMR & Pune' },
  { title: '10,000+ customers', desc: 'Car owners who booked service & repairs' },
  { title: '4.8★ rated', desc: 'Trusted car servicing on app & Google' },
  { title: 'Same-day service', desc: 'Most periodic jobs finished the same day' },
];

const REVIEWS = [
  {
    name: 'Rajesh Kumar',
    location: 'Mumbai',
    vehicle: 'Honda City',
    text: 'Best car service near me. Transparent pricing for periodic servicing and the pickup was on time.',
  },
  {
    name: 'Priya Sharma',
    location: 'Navi Mumbai',
    vehicle: 'Maruti Swift',
    text: 'Needed car AC repair urgently. MYFNG booked a verified workshop and sent photo updates. Highly recommend.',
  },
  {
    name: 'Amit Patel',
    location: 'Thane',
    vehicle: 'Hyundai Creta',
    text: 'Car repairs were done with genuine parts. No surprise bill. This is how car servicing should work.',
  },
  {
    name: 'Sandeep Singh',
    location: 'Pune',
    vehicle: 'Tata Nexon',
    text: 'Booked car service from the MyFNG app. Mechanic quality was excellent and warranty gave me peace of mind.',
  },
];

const HOW_IT_WORKS = [
  {
    icon: Smartphone,
    title: 'Book on web or MyFNG app',
    desc: 'Choose periodic car service or a car repair, pick your city and see the estimate before you confirm.',
  },
  {
    icon: Truck,
    title: 'Free pickup from your door',
    desc: 'We collect the car for doorstep car servicing in Mumbai, Thane, Navi Mumbai and Pune.',
  },
  {
    icon: Camera,
    title: 'Live photos of the job',
    desc: 'Get photo and video updates while the workshop does car repairs — no guessing what was done.',
  },
  {
    icon: CalendarCheck,
    title: 'Delivery with warranty',
    desc: 'The car comes back the same day for most periodic jobs, with labour and parts warranty.',
  },
];

const AREA_CHIPS = [
  'Kalyan',
  'Dombivli',
  'Vasai',
  'Virar',
  'Andheri',
  'Borivali',
  'Mulund',
  'Panvel',
];

export default function AdsLandingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const goHero = useGoHref('ads-lp-hero');

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      <Navbar />

      <AppDownloadSection downloadHref={goHero} asHero />

      <section className="border-y border-blue-100 bg-slate-50/80 py-7">
        <div className="container mx-auto grid grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-6">
          {TRUST_CARDS.map((card) => (
            <div key={card.title} className="rounded-2xl border border-white bg-white p-4 text-center shadow-sm">
              <p className="text-lg font-extrabold text-blue-800 sm:text-xl">{card.title}</p>
              <p className="mt-1 text-xs font-medium text-gray-600 sm:text-sm">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6">
          <AIFeatureBadge text="About MYFNG" />
          <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
            About MYFNG — car service and repairs you can trust
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-gray-600">
            MYFNG (My Friendly Neighbourhood Garage) is India&apos;s AI-powered platform for{' '}
            <strong>car service and repairs</strong>. We connect you to audited multi-brand car garages, show
            the price before work starts, and manage pickup, parts, warranty and updates end to end. If you are
            searching for <strong>car service near me</strong>, <strong>car repair near me</strong> or a{' '}
            <strong>trusted mechanic in Mumbai, Pune or Thane</strong>, MYFNG is built for that — on the website
            and on the MyFNG app.
          </p>
          <p className="mt-3 text-[15px] leading-7 text-gray-600">
            Book periodic car service, car AC service, engine repair, brake service, battery replacement, clutch
            overhaul, denting &amp; painting and tyre care without calling random workshops. One booking. One
            warranty. Real technicians.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <AIFeatureBadge text="Why MYFNG" />
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Why choose MYFNG for car servicing and repairs
            </h2>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              Clear estimates, verified garages and live updates — why car owners book MYFNG instead of a random mechanic.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {USPS.map((usp) => {
              const Icon = usp.icon;
              return (
                <article key={usp.title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-gray-900">{usp.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{usp.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <AIFeatureBadge text="How it works" />
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              How to book car service and repairs with MYFNG
            </h2>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              From booking to delivery — one flow on myfng.in and the MyFNG app.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((step, idx) => {
              const Icon = step.icon;
              return (
                <article key={step.title} className="rounded-2xl border border-gray-100 bg-slate-50 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Step {idx + 1}</p>
                  <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{step.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <AIFeatureBadge text="Car services" />
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Car service and repair jobs we book
            </h2>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              Periodic car service, AC repair, engine service, brakes, clutch, battery, denting &amp; painting
              and more at verified garages.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEFAULT_SERVICES.map((service) => {
              const href = `/car-services/${INTERNAL_SLUG_TO_MARKETING[service.slug] || service.slug}`;
              return (
                <Link
                  key={service.slug}
                  href={href}
                  className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    {service.iconImage ? (
                      <img src={service.iconImage} alt="" className="h-10 w-10 object-contain" />
                    ) : null}
                    <h3 className="text-base font-bold text-gray-900">{service.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{service.description}</p>
                  <p className="mt-3 text-sm font-semibold text-blue-700">Book this car service →</p>
                </Link>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={BOOK}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-600 px-8 text-base font-bold text-white hover:bg-blue-700"
            >
              Get a car repair estimate
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <AIFeatureBadge text="Reviews" />
            <h2 className="mt-3 text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Customer reviews for MYFNG car service
            </h2>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {REVIEWS.map((review) => (
              <blockquote key={review.name} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <Quote className="h-5 w-5 text-blue-500" />
                <div className="mt-2 flex gap-0.5 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-700">{review.text}</p>
                <footer className="mt-4 text-sm font-bold text-gray-900">
                  {review.name} · {review.location}
                  <span className="block text-xs font-medium text-gray-500">{review.vehicle}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 sm:text-3xl">
              Car service near me — cities we cover
            </h2>
            <p className="mt-3 text-sm text-gray-600 sm:text-base">
              Find a MYFNG car garage for servicing and repairs across Mumbai Metropolitan Region and Pune.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {CITY_PAGES.map((city) => (
              <Link
                key={city.slug}
                href={city.pagePath}
                className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              >
                Car service in {city.name}
              </Link>
            ))}
            {AREA_CHIPS.map((city) => (
              <span
                key={city}
                className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800"
              >
                Car service in {city}
              </span>
            ))}
          </div>
          <p className="mt-6 text-center">
            <Link href="/workshop-locator" className="font-semibold text-blue-700 underline">
              Open workshop locator
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-white py-12 sm:py-16">
        <div className="container mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-extrabold text-gray-900 sm:text-3xl">
            Car service and repairs FAQs
          </h2>
          <div className="mt-6 space-y-2">
            {ADS_LP_FAQS.map((faq, idx) => {
              const open = openFaq === idx;
              return (
                <div key={faq.question} className="rounded-2xl border border-gray-100 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    onClick={() => setOpenFaq(open ? null : idx)}
                  >
                    <span className="text-sm font-bold text-gray-900 sm:text-base">{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? <p className="px-4 pb-4 text-sm leading-6 text-gray-600">{faq.answer}</p> : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer hideCta />

      <div className="h-16 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-[70] grid grid-cols-2 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <a href={`tel:${PHONE}`} className="flex min-h-14 items-center justify-center gap-2 bg-slate-900 font-bold text-white">
          <Phone className="h-4 w-4" /> Call now
        </a>
        <Link href={BOOK} className="flex min-h-14 items-center justify-center bg-blue-600 font-bold text-white">
          Book car service
        </Link>
      </div>
    </div>
  );
}
