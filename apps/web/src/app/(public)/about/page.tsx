'use client';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import Link from 'next/link';
import { Bot, CheckCircle2, Eye, MapPin, MessageCircle, Phone, Shield, Smartphone, Sparkles, Target, TrendingUp, Truck, Wrench, Zap } from 'lucide-react';

const PROBLEMS = [
  { title: 'Unclear Estimates', desc: 'Hidden charges and surprise bills after service' },
  { title: 'Unnecessary Delays', desc: 'No updates, no timeline, no accountability' },
  { title: 'Zero Transparency', desc: 'Duplicate parts, fake repairs, no proof of work' },
];

const OFFERINGS = [
  { icon: Shield, title: 'Verified Workshops Only', desc: 'Every partner workshop is audited, graded, and continuously monitored for quality and pricing.' },
  { icon: Eye, title: 'Complete Transparency', desc: 'Real-time updates with photos and videos — pre-inspection, work in progress, parts used, and delivery.' },
  { icon: CheckCircle2, title: 'No Hidden Surprises', desc: 'Clear estimates before work begins. No work done without customer approval.' },
  { icon: Truck, title: 'Free Pickup & Drop', desc: 'Convenience is built into the system, not offered as an upsell.' },
  { icon: Shield, title: 'Warranty on Services', desc: 'Every service comes with warranty coverage for complete peace of mind.' },
  { icon: Phone, title: '24/7 Roadside Assistance', desc: 'In-house RSA after acquiring Roadserve — truly integrated car care.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#142033]">
      <Navbar />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#023D95] via-[#0357b8] to-[#0088E8] pt-28 text-white sm:pt-36">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#7ec8ff]/20 blur-3xl" />
        </div>
        <div className="container relative z-10 mx-auto px-4 pb-14 sm:px-6 sm:pb-16">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/80">
              India&apos;s first AI-powered car care platform
            </p>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
              About <span className="text-white">MY</span> <span className="text-[#b9e0ff]">FNG</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
              Your Friendly Neighbourhood Garage. Built to fix what the traditional car service industry has ignored for decades — trust, transparency, and convenience.
            </p>
          </div>
        </div>
        <div className="relative z-10 border-t border-white/10">
          <div className="container mx-auto grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              ['10,000+', 'Happy customers'],
              ['Mumbai, Thane & Pune', 'And expanding'],
              ['Verified only', 'Every workshop is audited'],
            ].map(([value, label]) => (
              <div key={label} className="px-6 py-5 text-center">
                <div className="text-sm font-semibold tracking-wide text-white sm:text-base">{value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/50">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0088E8]">01 — The problem</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">The problem we&apos;re solving</h2>
              <p className="max-w-md text-sm leading-relaxed text-[#5c6778] sm:text-base">
                Car owners are forced to choose between overpriced authorized centers or unorganized local garages with uncertain quality.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {PROBLEMS.map((item, index) => (
                <article key={item.title} className="rounded-3xl border border-[#d7e4f5] bg-white p-6 shadow-[0_12px_40px_-28px_rgba(12,26,51,0.45)]">
                  <div className="text-xs font-semibold tracking-[0.22em] text-[#0088E8]">0{index + 1}</div>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5c6778]">{item.desc}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-base font-medium text-[#023D95] sm:text-lg">
              MY FNG was founded to fundamentally change how car servicing works in India.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d7e4f5] bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0088E8]">02 — What we do</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">A managed service, not a directory of garages</h2>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[#5c6778] sm:text-base">
              MY FNG is a technology-driven car service aggregator that connects car owners with verified, top-quality multi-brand workshops — managing the entire service experience end-to-end.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {OFFERINGS.map(({ icon: Icon, title, desc }) => (
                <article key={title} className="rounded-3xl border border-[#d7e4f5] bg-[#f8fbff] p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#023D95] text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5c6778]">{desc}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-[#3d4a5c]">
              Customers don&apos;t deal with workshops directly. <span className="font-semibold text-[#023D95]">MY FNG owns the experience.</span>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-br from-[#023D95] to-[#0367C4] py-16 text-white sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#b9e0ff]">03 — Technology</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Built for scale, powered by technology</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base">
              India&apos;s first AI-focused car service booking platform — designed to eliminate outdated, form-heavy booking flows.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#023D95]">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">MISA</h3>
                    <p className="text-sm text-white/55">MyFNG Instant Service Assistant</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/75">
                  Our AI-powered assistant helps you book car services in under 60 seconds — no forms, no calls. Just chat naturally and get instant recommendations, pricing, and scheduling.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    'Natural language service booking',
                    'Instant price estimates',
                    'Smart recommendations based on car age and mileage',
                    'Available 24/7 on app and website',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#b9e0ff]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#023D95]">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">MyFNG App</h3>
                    <p className="text-sm text-white/55">Everything in your pocket</p>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-white/75">
                  Book services, track live progress with photos, chat with MISA, manage your service history, and get exclusive app-only discounts.
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    'Book in 60 seconds via AI or manual flow',
                    'Live tracking with real-time photo updates',
                    'MyFNG Prime membership for extra savings',
                    'Available on Android and iOS',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/80">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#b9e0ff]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center gap-3">
                  <a href="https://play.google.com/store/apps/details?id=com.myfng.app" target="_blank" rel="noopener noreferrer" className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#023D95]">
                    Google Play
                  </a>
                  <a href="https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white">
                    App Store
                  </a>
                </div>
              </article>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Zap, text: 'Faster bookings' },
                { icon: Bot, text: 'Smarter diagnostics' },
                { icon: MessageCircle, text: 'Better communication' },
                { icon: TrendingUp, text: 'Workshop efficiency' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-3">
                  <Icon className="h-4 w-4 flex-shrink-0 text-[#b9e0ff]" />
                  <span className="text-sm text-white/80">{text}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-white/55">This is not just a service platform. It is infrastructure for the future of car care.</p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-3xl bg-white p-7 shadow-[0_12px_40px_-28px_rgba(12,26,51,0.45)] sm:p-9">
              <Target className="h-5 w-5 text-[#0088E8]" />
              <h2 className="mt-5 text-2xl font-semibold">Our vision</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5c6778] sm:text-base">
                To become India&apos;s most trusted and seamless car care platform, serving millions of car owners with consistency, transparency, and reliability — city by city.
              </p>
            </article>
            <article className="rounded-3xl bg-gradient-to-br from-[#023D95] to-[#0088E8] p-7 text-white sm:p-9">
              <Sparkles className="h-5 w-5 text-[#b9e0ff]" />
              <h2 className="mt-5 text-2xl font-semibold text-white">Our mission</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                To remove stress, confusion, and unfair practices from car servicing by combining:
              </p>
              <ul className="mt-4 space-y-2">
                {['The best workshops', 'Strong operational processes', 'Technology and AI', 'A customer-first mindset'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/85">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-[#b9e0ff]" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d7e4f5] bg-white py-14">
        <div className="container mx-auto px-4 text-center sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0088E8]">Where we operate</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Currently serving, and expanding</h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {['Mumbai', 'Navi Mumbai', 'Thane', 'Palghar', 'Pune'].map((city) => (
              <span key={city} className="inline-flex items-center gap-2 text-sm font-medium text-[#142033]">
                <MapPin className="h-4 w-4 text-[#0088E8]" />
                {city}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-[32px] bg-gradient-to-br from-[#023D95] to-[#0088E8] px-6 py-12 text-center text-white sm:px-12">
            <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#b9e0ff]">Why customers trust MY FNG</h2>
            <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
              Thousands of car owners choose MY FNG not because we are cheaper — but because we are clear, reliable, and accountable.
            </p>
            <p className="mt-8 text-lg text-white/80">When you book with MY FNG, you&apos;re not booking a garage.</p>
            <p className="mt-2 text-3xl font-semibold text-white sm:text-4xl">You&apos;re booking peace of mind.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/car-services" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#023D95]">
                <Wrench className="h-4 w-4" />
                Explore Services
              </Link>
              <Link href="/book-service" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">
                <Zap className="h-4 w-4" />
                Book Service
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
